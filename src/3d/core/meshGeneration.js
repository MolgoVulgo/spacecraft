import * as THREE from 'three';
import { validateAdvancedMeshDefinition } from '../../advanced-mesh.js';

export function buildShapeGeometry({ shape, size, scale = 100, symmetry = {}, showVoxels = false, renderMode = null } = {}) {
  const dimensions = size?.dimensions ?? shape?.generation?.base?.bounds ?? { length: 4, width: 3, height: 1 };
  const mode = shape?.generation?.mode;
  const baseType = shape?.generation?.base?.type ?? shape?.shape_family ?? 'box';
  const operations = shape?.generation?.operations ?? [];
  const displayVoxels = Boolean(showVoxels || renderMode === 'editor');

  let geometry = null;

  if (mode === 'parametric_shape' && ['point_1', 'point_2', 'point_3'].includes(baseType)) {
    geometry = geometryFromIndexedMesh(...getParametricPrismMesh(dimensions, baseType, scale, shape?.generation?.base));
  } else if (mode === 'advanced_mesh') {
    geometry = buildAdvancedMeshGeometry(shape, dimensions, scale);
  } else if (mode === 'primitive_stack') {
    if (baseType === 'wedge') geometry = geometryFromIndexedMesh(...getWedgeMesh(dimensions, scale, shape?.generation?.base));
    else geometry = geometryFromIndexedMesh(...getBoxMesh(dimensions, scale));
  } else if (mode === 'voxel_grid' || operations.length > 0) {
    geometry = displayVoxels
      ? buildVoxelOperationGeometry(shape, dimensions, scale, { shrinkCells: true })
      : buildAssemblySolidGeometry(shape, dimensions, scale);
  } else if (shape?.preview_mesh?.vertices?.length && shape?.preview_mesh?.faces?.length) {
    geometry = displayVoxels
      ? buildVoxelOperationGeometry(shape, dimensions, scale, { shrinkCells: true })
      : buildLegacyAssemblyGeometry(shape, dimensions, scale);
  } else {
    geometry = geometryFromIndexedMesh(...getBoxMesh(dimensions, scale));
  }

  if (!geometry) geometry = geometryFromIndexedMesh(...getBoxMesh(dimensions, scale));
  return applySymmetryToGeometry(geometry, symmetry);
}

function buildAdvancedMeshGeometry(shape, dimensions, scale) {
  const visualMesh = shape?.generation?.visual_mesh;
  const report = validateAdvancedMeshDefinition({
    shape,
    size: { dimensions },
    visualMesh,
    collisionMode: shape?.collision?.mode ?? 'base_box',
  });
  if (!report.valid || !Array.isArray(visualMesh?.faces) || visualMesh.faces.length === 0) {
    return null;
  }

  const vertices = (visualMesh.vertices ?? []).map((vertex) => (
    catalogPoint(vertex.x, vertex.y, vertex.z, dimensions, scale)
  ));
  const vertexIndexById = new Map((visualMesh.vertices ?? []).map((vertex, index) => [vertex.id, index]));
  const faces = [];

  for (const face of visualMesh.faces ?? []) {
    const indices = face.vertices.map((vertexId) => vertexIndexById.get(vertexId)).filter((index) => Number.isInteger(index));
    if (indices.length < 3) continue;
    for (let index = 1; index < indices.length - 1; index += 1) {
      faces.push([indices[0], indices[index], indices[index + 1]]);
    }
  }

  if (!faces.length) return null;
  return geometryFromIndexedMesh(vertices, faces);
}

export function applySymmetryToGeometry(geometry, symmetry = {}) {
  const mirrors = {
    length: Boolean(symmetry.length),
    width: Boolean(symmetry.width),
    height: Boolean(symmetry.height),
  };
  if (!mirrors.length && !mirrors.width && !mirrors.height) return geometry;

  const result = geometry.clone();
  result.computeBoundingBox();
  const zMirrorSum = result.boundingBox.min.z + result.boundingBox.max.z;
  const position = result.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    // Shape-engine coordinates are assembly coordinates:
    // X = catalog width, Y = catalog length/depth, Z = catalog height.
    if (mirrors.length) position.setY(i, -position.getY(i));
    if (mirrors.width) position.setX(i, -position.getX(i));
    if (mirrors.height) position.setZ(i, zMirrorSum - position.getZ(i));
  }
  position.needsUpdate = true;

  const mirrorCount = Number(mirrors.length) + Number(mirrors.width) + Number(mirrors.height);
  if (mirrorCount % 2 === 1 && result.index) {
    const index = result.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const tmp = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = tmp;
    }
    result.index.needsUpdate = true;
  }

  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  geometry.dispose?.();
  return result;
}

export function geometryFromIndexedMesh(vertices, faces) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function getBoxMesh(size, scale) {
  const lx = Number(size.length) || 1;
  const wy = Number(size.width) || 1;
  const hz = Number(size.height) || 1;
  const corners = [
    [0, 0, 0], [lx, 0, 0], [lx, wy, 0], [0, wy, 0],
    [0, 0, hz], [lx, 0, hz], [lx, wy, hz], [0, wy, hz],
  ];
  const vertices = corners.map(([x, y, z]) => catalogPoint(x, y, z, size, scale));
  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7],
  ];
  return [vertices, faces];
}

export function getWedgeMesh(size, scale, base = {}) {
  const L = Number(size.length) || 1;
  const W = Number(size.width) || 1;
  const H = Number(size.height) || 1;
  const axis = base.slope_axis ?? 'length';

  if (axis === 'width') {
    const points = [
      [0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0],
      [0, 0, H], [L, 0, H],
    ];
    const faces = [
      [0, 2, 1], [0, 3, 2],
      [0, 1, 5], [0, 5, 4],
      [0, 4, 3],
      [1, 2, 5],
      [3, 4, 5], [3, 5, 2],
    ];
    return [points.map(([x, y, z]) => catalogPoint(x, y, z, size, scale)), faces];
  }

  const points = [
    [0, 0, 0], [L, 0, 0], [L, W, 0], [0, W, 0],
    [0, 0, H], [0, W, H],
  ];
  const faces = [
    [0, 2, 1], [0, 3, 2],
    [0, 4, 5], [0, 5, 3],
    [0, 1, 4],
    [3, 5, 2],
    [1, 2, 5], [1, 5, 4],
  ];
  return [points.map(([x, y, z]) => catalogPoint(x, y, z, size, scale)), faces];
}

export function getParametricPrismMesh(dim, type, scale, base = {}) {
  const footprint = getParametricFootprint(dim, type, base);
  const vertices = [];
  for (const p of footprint) vertices.push(catalogPoint(p.x, p.y, 0, dim, scale));
  for (const p of footprint) vertices.push(catalogPoint(p.x, p.y, p.zTop ?? dim.height, dim, scale));
  const n = footprint.length;
  const faces = [];
  for (let i = 1; i < n - 1; i += 1) faces.push([0, i + 1, i]);
  for (let i = 1; i < n - 1; i += 1) faces.push([n, n + i, n + i + 1]);
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j]);
    faces.push([i, n + j, n + i]);
  }
  return [vertices, faces];
}

export function getParametricFootprint(dim, type, base = {}) {
  const L = Number(dim.length) || 1;
  const W = Number(dim.width) || 1;
  const H = Number(dim.height) || 1;
  const side = base.tip_side === 'right' ? 'right' : 'left';
  const flipY = (y) => side === 'right' ? W - y : y;

  if (type === 'point_1') {
    const neck = Math.max(0.8, Math.min(L * 0.32, 2.4));
    const shoulder = Math.max(neck + 0.8, L * 0.62);
    return [
      { x: 0, y: flipY(0), zTop: H },
      { x: neck, y: flipY(W * 0.18), zTop: H },
      { x: shoulder, y: flipY(W), zTop: H },
      { x: L, y: flipY(W), zTop: H },
      { x: L, y: flipY(0), zTop: H },
    ];
  }

  if (type === 'point_2') {
    const shoulder = Math.max(1, L * 0.34);
    return [
      { x: 0, y: flipY(0), zTop: H },
      { x: shoulder, y: flipY(W), zTop: H },
      { x: L, y: flipY(W), zTop: H },
      { x: L, y: flipY(0), zTop: H },
    ];
  }

  // point_3: triangle asymétrique déjà validé. Les symétries donnent les orientations inversées.
  return [
    { x: 0, y: 0, zTop: H },
    { x: L, y: W, zTop: H },
    { x: L, y: 0, zTop: H },
  ];
}

function buildLegacyAssemblyGeometry(shape, dim, scale) {
  // Legacy meshes came from the old Python/STL path and may have arbitrary axis/scale.
  // In Assembly, keep fixed catalogue dimensions and rebuild a normalized simplified shape.
  const family = String(shape?.shape_family ?? '').toLowerCase();
  const label = String(shape?.label ?? '').toLowerCase();
  if (family.includes('slope') || label.includes('pent') || label.includes('pente')) {
    return geometryFromIndexedMesh(...getWedgeMesh(dim, scale, { slope_axis: 'length' }));
  }
  if (family.includes('rounded') || label.includes('arrondi')) {
    return buildAssemblySolidGeometry({ generation: { operations: [{
      type: 'round',
      selection: { face: 'top', cell: { x: 0, y: 0, z: 0 } },
      scope: { kind: 'edge_line', side: 'front', axis: 'length' },
    }] } }, dim, scale);
  }
  if (family.includes('chamfer') || label.includes('chanfr') || label.includes('chamfer')) {
    const operations = [{
      type: 'chamfer',
      selection: { face: 'top', cell: { x: 0, y: 0, z: 0 } },
      scope: { kind: 'edge_line', side: 'front', axis: 'length' },
    }];
    if (label.includes('2')) operations.push({
      type: 'chamfer',
      selection: { face: 'top', cell: { x: 0, y: Number(dim.width) - 1, z: 0 } },
      scope: { kind: 'edge_line', side: 'back', axis: 'length' },
    });
    return buildAssemblySolidGeometry({ generation: { operations } }, dim, scale);
  }
  return geometryFromIndexedMesh(...getBoxMesh(dim, scale));
}

function buildVoxelOperationGeometry(shape, dim, scale, options = {}) {
  const operations = shape?.generation?.operations ?? [];
  const additiveOperations = operations.filter((op) => op?.type !== 'cut');
  const cutOperations = operations.filter((op) => op?.type === 'cut');
  const cells = getShapeCells(shape, dim).filter((cell) => cell.enabled !== false);
  const suppressed = getSuppressedCellKeysForOperations(additiveOperations, dim);
  const geometries = [];

  for (const cell of cells) {
    if (suppressed.has(cellKey(cell.x, cell.y, cell.z))) continue;
    geometries.push(createCellGeometry(cell, dim, scale, options));
  }

  for (const op of additiveOperations) {
    const geom = createOperationGeometry(op, dim, scale);
    if (geom) geometries.push(geom);
  }

  let geometry = geometries.length ? mergeGeometries(geometries) : geometryFromIndexedMesh(...getBoxMesh(dim, scale));
  for (const op of cutOperations) {
    const clipped = applyCutOperationToGeometry(geometry, op, dim, scale);
    if (clipped) geometry = clipped;
  }
  return geometry;
}

function buildAssemblySolidGeometry(shape, dim, scale) {
  const operations = shape?.generation?.operations ?? [];
  if (!operations.length) {
    return geometryFromIndexedMesh(...getBoxMesh(dim, scale));
  }

  // Assembly must display real solid pieces, not the editor voxel grid.
  // Local shape corrections still come from the same operation data, but full cells are not shrunk
  // and the renderer avoids editor-only 1x1x1 gaps.
  const geom = buildVoxelOperationGeometry(shape, dim, scale, { shrinkCells: false });
  geom.userData.assemblySolid = true;
  return geom;
}

function getShapeCells(shape, dim) {
  const cells = shape?.generation?.cells;
  if (Array.isArray(cells) && cells.length) return cells;
  const result = [];
  for (let x = 0; x < (Number(dim.length) || 1); x += 1) {
    for (let y = 0; y < (Number(dim.width) || 1); y += 1) {
      for (let z = 0; z < (Number(dim.height) || 1); z += 1) result.push({ x, y, z, enabled: true });
    }
  }
  return result;
}

function createCellGeometry(cell, dim, scale, options = {}) {
  const inset = options.shrinkCells ? 0.01 : 0;
  const x0 = Number(cell.x) + inset;
  const x1 = Number(cell.x) + 1 - inset;
  const y0 = Number(cell.y) + inset;
  const y1 = Number(cell.y) + 1 - inset;
  const z0 = Number(cell.z) + inset;
  const z1 = Number(cell.z) + 1 - inset;
  const corners = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7],
  ];
  return geometryFromIndexedMesh(corners.map(([x, y, z]) => catalogPoint(x, y, z, dim, scale)), faces);
}

function createOperationGeometry(op, dim, scale) {
  if (op.type === 'round') {
    if (op.scope?.kind === 'corner') return createCornerRoundGeometry(op, dim, scale);
    if (['edge_line', 'top_side_line', 'side_line'].includes(op.scope?.kind)) return createEdgeProfileGeometry(op, dim, scale, 'round');
  }
  if (op.type === 'chamfer') {
    if (op.scope?.kind === 'corner') return createCornerChamferGeometry(op, dim, scale);
    if (['edge_line', 'top_side_line', 'side_line'].includes(op.scope?.kind)) return createEdgeProfileGeometry(op, dim, scale, 'chamfer');
  }
  if (op.type === 'custom_face') return createCustomFaceGeometry(op, dim, scale);
  return null;
}

function createCustomFaceGeometry(op, dim, scale) {
  const points = Array.isArray(op?.points) ? op.points : [];
  if (points.length < 3) return null;

  const vertices = points.map((point) => catalogPoint(point.x, point.y, point.z, dim, scale));
  const faces = [];
  for (let index = 1; index < vertices.length - 1; index += 1) {
    faces.push([0, index, index + 1]);
    faces.push([0, index + 1, index]);
  }
  return geometryFromIndexedMesh(vertices, faces);
}

function applyCutOperationToGeometry(geometry, op, dim, scale) {
  const plane = createCutPlane(op, dim, scale);
  if (!plane) return geometry;
  return clipGeometryWithPlane(geometry, plane);
}

function createCutPlane(op, dim, scale) {
  const points = Array.isArray(op?.points) ? op.points : [];
  if (points.length < 3) return null;
  const worldPoints = points.map((point) => new THREE.Vector3(...catalogPoint(point.x, point.y, point.z, dim, scale)));
  const ab = new THREE.Vector3().subVectors(worldPoints[1], worldPoints[0]);
  const ac = new THREE.Vector3().subVectors(worldPoints[2], worldPoints[0]);
  const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
  if (!Number.isFinite(normal.length()) || normal.lengthSq() < 1e-12) return null;
  if (op.keep_side === 'inverse') normal.negate();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPoints[0]);
}

function clipGeometryWithPlane(geometry, plane) {
  const triangles = geometryToTriangles(geometry);
  const positions = [];
  const indices = [];
  const cutPoints = [];
  let vertexOffset = 0;

  for (const triangle of triangles) {
    const clipped = clipPolygonWithPlane(triangle, plane, cutPoints);
    if (clipped.length < 3) continue;
    for (let index = 1; index < clipped.length - 1; index += 1) {
      positions.push(
        clipped[0].x, clipped[0].y, clipped[0].z,
        clipped[index].x, clipped[index].y, clipped[index].z,
        clipped[index + 1].x, clipped[index + 1].y, clipped[index + 1].z,
      );
      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
      vertexOffset += 3;
    }
  }

  const capTriangles = buildCutCapTriangles(cutPoints, plane);
  for (const triangle of capTriangles) {
    positions.push(
      triangle[0].x, triangle[0].y, triangle[0].z,
      triangle[1].x, triangle[1].y, triangle[1].z,
      triangle[2].x, triangle[2].y, triangle[2].z,
    );
    indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
    vertexOffset += 3;
  }

  if (!positions.length) return geometry;
  geometry.dispose?.();
  return geometryFromFlatPositions(positions, indices);
}

function geometryToTriangles(geometry) {
  const position = geometry.getAttribute('position');
  const triangles = [];
  if (geometry.index) {
    const source = geometry.index.array;
    for (let index = 0; index < source.length; index += 3) {
      triangles.push([
        new THREE.Vector3(position.getX(source[index]), position.getY(source[index]), position.getZ(source[index])),
        new THREE.Vector3(position.getX(source[index + 1]), position.getY(source[index + 1]), position.getZ(source[index + 1])),
        new THREE.Vector3(position.getX(source[index + 2]), position.getY(source[index + 2]), position.getZ(source[index + 2])),
      ]);
    }
    return triangles;
  }
  for (let index = 0; index < position.count; index += 3) {
    triangles.push([
      new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)),
      new THREE.Vector3(position.getX(index + 1), position.getY(index + 1), position.getZ(index + 1)),
      new THREE.Vector3(position.getX(index + 2), position.getY(index + 2), position.getZ(index + 2)),
    ]);
  }
  return triangles;
}

function clipPolygonWithPlane(points, plane, cutPoints = []) {
  const result = [];
  const epsilon = 1e-6;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentDistance = plane.distanceToPoint(current);
    const nextDistance = plane.distanceToPoint(next);
    const currentInside = currentDistance >= -epsilon;
    const nextInside = nextDistance >= -epsilon;

    if (currentInside) result.push(current.clone());
    if (currentInside !== nextInside) {
      const t = currentDistance / (currentDistance - nextDistance);
      const intersection = current.clone().lerp(next, t);
      result.push(intersection.clone());
      cutPoints.push(intersection.clone());
    } else if (Math.abs(currentDistance) < epsilon && Math.abs(nextDistance) < epsilon) {
      cutPoints.push(current.clone(), next.clone());
    }
  }
  return dedupePoints(result);
}

function buildCutCapTriangles(points, plane) {
  const unique = dedupePoints(points);
  if (unique.length < 3) return [];

  const center = unique.reduce((acc, point) => acc.add(point), new THREE.Vector3()).multiplyScalar(1 / unique.length);
  const ref = Math.abs(plane.normal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const axisU = new THREE.Vector3().crossVectors(plane.normal, ref).normalize();
  const axisV = new THREE.Vector3().crossVectors(plane.normal, axisU).normalize();
  const ordered = [...unique].sort((left, right) => {
    const leftOffset = left.clone().sub(center);
    const rightOffset = right.clone().sub(center);
    const leftAngle = Math.atan2(leftOffset.dot(axisV), leftOffset.dot(axisU));
    const rightAngle = Math.atan2(rightOffset.dot(axisV), rightOffset.dot(axisU));
    return leftAngle - rightAngle;
  });

  const desiredNormal = plane.normal.clone().negate();
  const triangles = [];
  for (let index = 1; index < ordered.length - 1; index += 1) {
    const triangle = [ordered[0].clone(), ordered[index].clone(), ordered[index + 1].clone()];
    const triangleNormal = new THREE.Vector3()
      .crossVectors(
        triangle[1].clone().sub(triangle[0]),
        triangle[2].clone().sub(triangle[0]),
      )
      .normalize();
    if (triangleNormal.dot(desiredNormal) < 0) {
      triangles.push([triangle[0], triangle[2], triangle[1]]);
    } else {
      triangles.push(triangle);
    }
  }
  return triangles;
}

function dedupePoints(points = []) {
  const seen = new Map();
  for (const point of points) {
    const key = `${Math.round(point.x * 1000000)}:${Math.round(point.y * 1000000)}:${Math.round(point.z * 1000000)}`;
    if (!seen.has(key)) seen.set(key, point);
  }
  return [...seen.values()];
}

function createCornerRoundGeometry(op, dim, scale) {
  const sides = getCornerSides(op, dim);
  const shape2d = pathToShape(roundedCornerPath(sides.x, sides.y, dim, 1), dim, scale);
  const geom = new THREE.ExtrudeGeometry(shape2d, {
    depth: (Number(dim.height) || 1) * scale,
    bevelEnabled: false,
    curveSegments: 18,
    steps: 1,
  });
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function createCornerChamferGeometry(op, dim, scale) {
  const sides = getCornerSides(op, dim);
  const shape2d = pathToShape(chamferCornerPath(sides.x, sides.y, dim, 0.5), dim, scale);
  const geom = new THREE.ExtrudeGeometry(shape2d, {
    depth: (Number(dim.height) || 1) * scale,
    bevelEnabled: false,
    steps: 1,
  });
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function pathToShape(points, dim, scale) {
  const shape2d = new THREE.Shape();
  points.forEach((p, index) => {
    if (p.arc) {
      shape2d.absarc(
        worldWidth(p.arc.cy, dim, scale),
        worldLength(p.arc.cx, dim, scale),
        p.arc.radius * scale,
        p.arc.start,
        p.arc.end,
        Boolean(p.arc.clockwise),
      );
      return;
    }
    const x = worldWidth(p.y, dim, scale);
    const y = worldLength(p.x, dim, scale);
    if (index === 0) shape2d.moveTo(x, y);
    else shape2d.lineTo(x, y);
  });
  shape2d.closePath();
  return shape2d;
}

function roundedCornerPath(xSide, ySide, d, radius = 1) {
  const L = Number(d.length) || 1;
  const W = Number(d.width) || 1;
  if (xSide === 'left' && ySide === 'front') return [pt(1, 0), pt(1, 1), pt(0, 1), arc(1, 1, radius, Math.PI, Math.PI * 1.5, false)];
  if (xSide === 'right' && ySide === 'front') return [pt(L - 1, 0), pt(L - 1, 1), pt(L, 1), arc(L - 1, 1, radius, 0, -Math.PI / 2, true)];
  if (xSide === 'right' && ySide === 'back') return [pt(L - 1, W), pt(L - 1, W - 1), pt(L, W - 1), arc(L - 1, W - 1, radius, 0, Math.PI / 2, false)];
  return [pt(1, W), pt(1, W - 1), pt(0, W - 1), arc(1, W - 1, radius, Math.PI, Math.PI / 2, true)];
}

function chamferCornerPath(xSide, ySide, d, amount = 0.5) {
  const L = Number(d.length) || 1;
  const W = Number(d.width) || 1;
  if (xSide === 'left' && ySide === 'front') return [pt(1, 0), pt(1, 1), pt(0, 1), pt(0, amount), pt(amount, 0)];
  if (xSide === 'right' && ySide === 'front') return [pt(L - 1, 0), pt(L - 1, 1), pt(L, 1), pt(L, amount), pt(L - amount, 0)];
  if (xSide === 'right' && ySide === 'back') return [pt(L - 1, W), pt(L - 1, W - 1), pt(L, W - 1), pt(L, W - amount), pt(L - amount, W)];
  return [pt(1, W), pt(1, W - 1), pt(0, W - 1), pt(0, W - amount), pt(amount, W)];
}

function pt(x, y) { return { x, y }; }
function arc(cx, cy, radius, start, end, clockwise) { return { arc: { cx, cy, radius, start, end, clockwise } }; }

function getCornerSides(op, d) {
  const faces = op.scope?.affected_faces ?? [];
  let x = faces.includes('left') ? 'left' : faces.includes('right') ? 'right' : null;
  let y = faces.includes('front') ? 'front' : faces.includes('back') ? 'back' : null;
  const cell = op.selection?.cell ?? {};
  x ??= Number(cell.x) === (Number(d.length) || 1) - 1 ? 'right' : 'left';
  y ??= Number(cell.y) === (Number(d.width) || 1) - 1 ? 'back' : 'front';
  return { x, y };
}

function createEdgeProfileGeometry(op, dim, scale, mode) {
  const side = op.scope?.side;
  const axis = op.scope?.axis === 'width' ? 'width' : 'length';
  const face = op.selection?.face ?? 'top';
  const amount = mode === 'round' ? 1 : 0.5;
  if (!side) return null;

  if (axis === 'length') {
    const y0 = side === 'front' ? 0 : (Number(dim.width) || 1) - 1;
    const y1 = side === 'front' ? 1 : (Number(dim.width) || 1);
    const z0 = face === 'bottom' ? 0 : Math.max(0, (Number(dim.height) || 1) - 1);
    const z1 = face === 'bottom' ? Math.min(1, Number(dim.height) || 1) : (Number(dim.height) || 1);
    const yz = mode === 'round'
      ? roundedSideProfile(side, face, y0, y1, z0, z1, amount)
      : chamferSideProfile(side, face, y0, y1, z0, z1, amount);
    return extrudeProfileAlongX(yz, 0, Number(dim.length) || 1, dim, scale);
  }

  const x0 = side === 'left' ? 0 : (Number(dim.length) || 1) - 1;
  const x1 = side === 'left' ? 1 : (Number(dim.length) || 1);
  const z0 = face === 'bottom' ? 0 : Math.max(0, (Number(dim.height) || 1) - 1);
  const z1 = face === 'bottom' ? Math.min(1, Number(dim.height) || 1) : (Number(dim.height) || 1);
  const xz = mode === 'round'
    ? roundedSideProfile(side, face, x0, x1, z0, z1, amount)
    : chamferSideProfile(side, face, x0, x1, z0, z1, amount);
  return extrudeProfileAlongY(xz, 0, Number(dim.width) || 1, dim, scale);
}

function roundedSideProfile(side, face, a0, a1, z0, z1, radius = 1) {
  const outerIsMin = side === 'front' || side === 'left';
  const top = face !== 'bottom';
  const innerA = outerIsMin ? a1 : a0;
  const outerA = outerIsMin ? a0 : a1;
  const innerZ = top ? z0 : z1;
  const outerZ = top ? z1 : z0;
  const centerA = innerA;
  const centerZ = innerZ;
  if (top && outerIsMin) return [{ a: innerA, z: z1 }, { a: innerA, z: z0 }, { a: outerA, z: z0 }, { arc: { a: centerA, z: centerZ, radius, start: Math.PI, end: Math.PI / 2, clockwise: true } }];
  if (top && !outerIsMin) return [{ a: innerA, z: z1 }, { a: innerA, z: z0 }, { a: outerA, z: z0 }, { arc: { a: centerA, z: centerZ, radius, start: 0, end: Math.PI / 2, clockwise: false } }];
  if (!top && outerIsMin) return [{ a: innerA, z: z0 }, { a: innerA, z: z1 }, { a: outerA, z: z1 }, { arc: { a: centerA, z: centerZ, radius, start: Math.PI, end: Math.PI * 1.5, clockwise: false } }];
  return [{ a: innerA, z: z0 }, { a: innerA, z: z1 }, { a: outerA, z: z1 }, { arc: { a: centerA, z: centerZ, radius, start: 0, end: -Math.PI / 2, clockwise: true } }];
}

function chamferSideProfile(side, face, a0, a1, z0, z1, amount = 0.5) {
  const outerIsMin = side === 'front' || side === 'left';
  const top = face !== 'bottom';
  const innerA = outerIsMin ? a1 : a0;
  const outerA = outerIsMin ? a0 : a1;
  const stepA = outerIsMin ? amount : -amount;
  const innerZ = top ? z0 : z1;
  const outerZ = top ? z1 : z0;
  const stepZ = top ? -amount : amount;
  return [
    { a: innerA, z: outerZ },
    { a: innerA, z: innerZ },
    { a: outerA, z: innerZ },
    { a: outerA, z: outerZ + stepZ },
    { a: outerA + stepA, z: outerZ },
  ];
}

function extrudeProfileAlongX(profile, xMin, xMax, dim, scale) {
  const sampled = sampleProfile(profile);
  const positions = [];
  const indices = [];
  for (const x of [xMin, xMax]) {
    for (const p of sampled) positions.push(...catalogPoint(x, p.a, p.z, dim, scale));
  }
  buildPrismIndices(indices, sampled.length);
  return geometryFromFlatPositions(positions, indices);
}

function extrudeProfileAlongY(profile, yMin, yMax, dim, scale) {
  const sampled = sampleProfile(profile);
  const positions = [];
  const indices = [];
  for (const y of [yMin, yMax]) {
    for (const p of sampled) positions.push(...catalogPoint(p.a, y, p.z, dim, scale));
  }
  buildPrismIndices(indices, sampled.length);
  return geometryFromFlatPositions(positions, indices);
}

function sampleProfile(profile) {
  const sampled = [];
  for (const p of profile) {
    if (!p.arc) {
      sampled.push({ a: p.a, z: p.z });
      continue;
    }
    const steps = 18;
    const { a, z, radius, start, end, clockwise } = p.arc;
    let delta = end - start;
    if (clockwise && delta > 0) delta -= Math.PI * 2;
    if (!clockwise && delta < 0) delta += Math.PI * 2;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const angle = start + delta * t;
      sampled.push({ a: a + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius });
    }
  }
  return sampled;
}

function buildPrismIndices(indices, n) {
  for (let i = 1; i < n - 1; i += 1) indices.push(0, i + 1, i);
  for (let i = 1; i < n - 1; i += 1) indices.push(n, n + i, n + i + 1);
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    indices.push(i, j, n + j, i, n + j, n + i);
  }
}

function geometryFromFlatPositions(positions, indices) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function mergeGeometries(geometries) {
  const vertices = [];
  const indices = [];
  let offset = 0;

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) vertices.push(position.getX(i), position.getY(i), position.getZ(i));

    if (geometry.index) {
      const source = geometry.index.array;
      for (let i = 0; i < source.length; i += 1) indices.push(source[i] + offset);
    } else {
      for (let i = 0; i < position.count; i += 1) indices.push(i + offset);
    }
    offset += position.count;
    geometry.dispose?.();
  }

  return geometryFromFlatPositions(vertices, indices);
}

function getSuppressedCellKeysForOperations(operations, dim) {
  const keys = new Set();
  for (const op of operations ?? []) {
    for (const cell of getOperationAffectedCells(op, dim)) keys.add(cellKey(cell.x, cell.y, cell.z));
  }
  return keys;
}

function getOperationAffectedCells(op, dim) {
  const scope = op.scope ?? {};
  const cells = [];
  const add = (x, y, z) => { if (isCellInside(dim, x, y, z)) cells.push({ x, y, z }); };
  const allZ = [...Array(Number(dim.height) || 1).keys()];

  if (Array.isArray(scope.cells) && scope.cells.length && scope.kind === 'corner') return normalizeCells(scope.cells, dim);
  if (scope.kind === 'corner') {
    const base = op.selection?.cell ?? { x: 0, y: 0 };
    for (const z of allZ) add(Number(base.x) || 0, Number(base.y) || 0, z);
    return cells;
  }

  const selectedFace = op.selection?.face;
  const zLevels = (scope.kind === 'edge_line' && (selectedFace === 'top' || selectedFace === 'bottom'))
    ? [selectedFace === 'top' ? (Number(dim.height) || 1) - 1 : 0]
    : allZ;

  if (scope.side === 'front') {
    for (let x = 0; x < (Number(dim.length) || 1); x += 1) for (const z of zLevels) add(x, 0, z);
  } else if (scope.side === 'back') {
    for (let x = 0; x < (Number(dim.length) || 1); x += 1) for (const z of zLevels) add(x, (Number(dim.width) || 1) - 1, z);
  } else if (scope.side === 'left') {
    for (let y = 0; y < (Number(dim.width) || 1); y += 1) for (const z of zLevels) add(0, y, z);
  } else if (scope.side === 'right') {
    for (let y = 0; y < (Number(dim.width) || 1); y += 1) for (const z of zLevels) add((Number(dim.length) || 1) - 1, y, z);
  }
  return cells;
}

function normalizeCells(cells, dim) {
  return cells
    .map((cell) => ({ x: Number(cell.x), y: Number(cell.y), z: Number(cell.z) }))
    .filter((cell) => isCellInside(dim, cell.x, cell.y, cell.z));
}

function isCellInside(dim, x, y, z) {
  return x >= 0 && y >= 0 && z >= 0 && x < (Number(dim.length) || 1) && y < (Number(dim.width) || 1) && z < (Number(dim.height) || 1);
}

function cellKey(x, y, z) { return `${x}:${y}:${z}`; }
export function catalogPointVector(position, dim, scale = 100) {
  const p = position ?? { x: 0, y: 0, z: 0 };
  return new THREE.Vector3(
    worldWidth(Number(p.y) || 0, dim, scale),
    worldLength(Number(p.x) || 0, dim, scale),
    worldHeight(Number(p.z) || 0, dim, scale),
  );
}

export function catalogCellCenterVector(cell, dim, scale = 100) {
  return catalogPointVector({
    x: Number(cell?.x) + 0.5,
    y: Number(cell?.y) + 0.5,
    z: Number(cell?.z) + 0.5,
  }, dim, scale);
}

export function createCatalogReservationBox(sizeOrDimensions, scale = 100, position = new THREE.Vector3()) {
  const dim = sizeOrDimensions?.dimensions ?? sizeOrDimensions ?? { length: 1, width: 1, height: 1 };
  const halfX = (Number(dim.width) || 1) * scale / 2;
  const halfY = (Number(dim.length) || 1) * scale / 2;
  const height = (Number(dim.height) || 1) * scale;
  return new THREE.Box3(
    new THREE.Vector3(-halfX, -halfY, 0).add(position),
    new THREE.Vector3(halfX, halfY, height).add(position),
  );
}

function catalogPoint(xLength, yWidth, zHeight, dim, scale) {
  return [
    worldWidth(yWidth, dim, scale),
    worldLength(xLength, dim, scale),
    worldHeight(zHeight, dim, scale),
  ];
}

function worldLength(x, dim, scale) { return (x - (Number(dim.length) || 1) / 2) * scale; }
function worldWidth(y, dim, scale) { return (y - (Number(dim.width) || 1) / 2) * scale; }
function worldHeight(z, dim, scale) { return z * scale; }
function worldZ(z, dim, scale) { return worldHeight(z, dim, scale); }
