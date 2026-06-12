export const ADVANCED_MESH_DEFAULT_GRID_STEP = 0.5;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundToPrecision(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function makeUniqueId(prefix, existingIds) {
  let index = existingIds.size + 1;
  let id = `${prefix}${String(index).padStart(3, '0')}`;
  while (existingIds.has(id)) {
    index += 1;
    id = `${prefix}${String(index).padStart(3, '0')}`;
  }
  return id;
}

export function getShapeBaseBounds(shape, size) {
  return {
    length: toFiniteNumber(size?.dimensions?.length ?? shape?.generation?.base?.bounds?.length, 1),
    width: toFiniteNumber(size?.dimensions?.width ?? shape?.generation?.base?.bounds?.width, 1),
    height: toFiniteNumber(size?.dimensions?.height ?? shape?.generation?.base?.bounds?.height, 1),
  };
}

export function getAdvancedMeshGridStep(visualMesh, fallback = ADVANCED_MESH_DEFAULT_GRID_STEP) {
  const gridStep = Number(visualMesh?.grid_step);
  return gridStep > 0 ? gridStep : fallback;
}

export function snapAdvancedCoordinate(value, gridStep = ADVANCED_MESH_DEFAULT_GRID_STEP) {
  const step = getAdvancedMeshGridStep({ grid_step: gridStep }, ADVANCED_MESH_DEFAULT_GRID_STEP);
  return roundToPrecision(Math.round(toFiniteNumber(value) / step) * step);
}

export function isCoordinateOnGrid(value, gridStep = ADVANCED_MESH_DEFAULT_GRID_STEP) {
  const step = getAdvancedMeshGridStep({ grid_step: gridStep }, ADVANCED_MESH_DEFAULT_GRID_STEP);
  const snapped = snapAdvancedCoordinate(value, step);
  return Math.abs(snapped - toFiniteNumber(value)) <= 1e-6;
}

function isVertexInsideBounds(vertex, bounds) {
  const x = toFiniteNumber(vertex?.x);
  const y = toFiniteNumber(vertex?.y);
  const z = toFiniteNumber(vertex?.z);
  return x >= 0 && x <= bounds.length
    && y >= 0 && y <= bounds.width
    && z >= 0 && z <= bounds.height;
}

function normalizeVertex(vertex, gridStep) {
  return {
    id: String(vertex?.id ?? '').trim(),
    x: snapAdvancedCoordinate(vertex?.x, gridStep),
    y: snapAdvancedCoordinate(vertex?.y, gridStep),
    z: snapAdvancedCoordinate(vertex?.z, gridStep),
  };
}

function cloneVisualMesh(visualMesh) {
  return {
    grid_step: getAdvancedMeshGridStep(visualMesh),
    vertices: Array.isArray(visualMesh?.vertices) ? visualMesh.vertices.map((vertex) => ({ ...vertex })) : [],
    faces: Array.isArray(visualMesh?.faces) ? visualMesh.faces.map((face) => ({
      ...face,
      vertices: Array.isArray(face?.vertices) ? [...face.vertices] : [],
    })) : [],
  };
}

export function createDefaultAdvancedMesh(size, options = {}) {
  const bounds = getShapeBaseBounds(null, size);
  const gridStep = getAdvancedMeshGridStep(options, ADVANCED_MESH_DEFAULT_GRID_STEP);
  return {
    grid_step: gridStep,
    vertices: [
      { id: 'v001', x: 0, y: 0, z: 0 },
      { id: 'v002', x: bounds.length, y: 0, z: 0 },
      { id: 'v003', x: bounds.length, y: bounds.width, z: 0 },
      { id: 'v004', x: 0, y: bounds.width, z: 0 },
      { id: 'v005', x: 0, y: 0, z: bounds.height },
      { id: 'v006', x: bounds.length, y: 0, z: bounds.height },
      { id: 'v007', x: bounds.length, y: bounds.width, z: bounds.height },
      { id: 'v008', x: 0, y: bounds.width, z: bounds.height },
    ],
    faces: [
      { id: 'f001', vertices: ['v001', 'v002', 'v003', 'v004'] },
      { id: 'f002', vertices: ['v005', 'v008', 'v007', 'v006'] },
      { id: 'f003', vertices: ['v001', 'v005', 'v006', 'v002'] },
      { id: 'f004', vertices: ['v002', 'v006', 'v007', 'v003'] },
      { id: 'f005', vertices: ['v003', 'v007', 'v008', 'v004'] },
      { id: 'f006', vertices: ['v004', 'v008', 'v005', 'v001'] },
    ],
  };
}

export function ensureAdvancedMeshGeneration(shape, size, options = {}) {
  const bounds = getShapeBaseBounds(shape, size);
  shape.generation = {
    mode: 'advanced_mesh',
    base: {
      type: 'box',
      bounds,
      fixed_catalog_dimensions: true,
    },
    visual_mesh: cloneVisualMesh(shape?.generation?.visual_mesh),
  };
  if (options.seedDefault && !shape.generation.visual_mesh.vertices.length && !shape.generation.visual_mesh.faces.length) {
    shape.generation.visual_mesh = createDefaultAdvancedMesh(size, options);
  }
  shape.collision = {
    ...(shape.collision ?? {}),
    mode: 'base_box',
  };
  return shape.generation.visual_mesh;
}

export function validateAdvancedMeshDefinition({ shape = null, size = null, visualMesh = null, collisionMode = null, defaultGridStep = ADVANCED_MESH_DEFAULT_GRID_STEP } = {}) {
  const bounds = getShapeBaseBounds(shape, size);
  const mesh = visualMesh ? cloneVisualMesh(visualMesh) : cloneVisualMesh(shape?.generation?.visual_mesh);
  const gridStep = getAdvancedMeshGridStep(mesh, defaultGridStep);
  const errors = [];
  const warnings = [];
  const vertexIds = new Set();
  const vertexMap = new Map();

  if (collisionMode != null && collisionMode !== 'base_box') {
    errors.push({ path: 'collision.mode', message: 'collision.mode doit rester "base_box".', code: 'invalid_collision_mode' });
  }

  if (!Array.isArray(mesh.vertices) || mesh.vertices.length === 0) {
    errors.push({ path: 'generation.visual_mesh.vertices', message: 'visual_mesh.vertices doit contenir au moins un vertex.', code: 'missing_vertices' });
  }

  if (!Array.isArray(mesh.faces) || mesh.faces.length === 0) {
    warnings.push({ path: 'generation.visual_mesh.faces', message: 'visual_mesh.faces est vide.', code: 'empty_faces' });
  }

  mesh.vertices.forEach((vertex, index) => {
    const path = `generation.visual_mesh.vertices[${index}]`;
    if (!isObject(vertex)) {
      errors.push({ path, message: 'vertex invalide.', code: 'invalid_vertex' });
      return;
    }
    const id = String(vertex.id ?? '').trim();
    if (!id) {
      errors.push({ path: `${path}.id`, message: 'id absent.', code: 'missing_vertex_id' });
      return;
    }
    if (vertexIds.has(id)) {
      errors.push({ path: `${path}.id`, message: `id dupliqué: ${id}.`, code: 'duplicate_vertex_id' });
      return;
    }
    vertexIds.add(id);
    vertexMap.set(id, vertex);

    for (const axis of ['x', 'y', 'z']) {
      if (!Number.isFinite(Number(vertex[axis]))) {
        errors.push({ path: `${path}.${axis}`, message: `${axis} doit être un nombre fini.`, code: 'invalid_number' });
      }
    }

    if (!isVertexInsideBounds(vertex, bounds)) {
      errors.push({ path, message: 'vertex hors baseBox.', code: 'vertex_out_of_bounds' });
    }

    for (const axis of ['x', 'y', 'z']) {
      if (!isCoordinateOnGrid(vertex[axis], gridStep)) {
        errors.push({ path: `${path}.${axis}`, message: `coordonnée hors pas ${gridStep}.`, code: 'vertex_off_grid' });
      }
    }
  });

  mesh.faces.forEach((face, index) => {
    const path = `generation.visual_mesh.faces[${index}]`;
    if (!isObject(face)) {
      errors.push({ path, message: 'face invalide.', code: 'invalid_face' });
      return;
    }
    if (!Array.isArray(face.vertices)) {
      errors.push({ path: `${path}.vertices`, message: 'face.vertices doit être un tableau.', code: 'invalid_face_vertices' });
      return;
    }
    if (face.vertices.length < 3) {
      errors.push({ path: `${path}.vertices`, message: 'une face doit référencer au moins 3 vertices.', code: 'face_too_small' });
    }
    const uniqueVertices = new Set(face.vertices.map((id) => String(id)));
    if (uniqueVertices.size < 3) {
      errors.push({ path: `${path}.vertices`, message: 'une face dégénérée doit contenir 3 vertices distincts.', code: 'degenerate_face' });
    }
    face.vertices.forEach((vertexId, vertexIndex) => {
      if (!vertexMap.has(String(vertexId))) {
        errors.push({
          path: `${path}.vertices[${vertexIndex}]`,
          message: `vertex introuvable (${vertexId}).`,
          code: 'unknown_vertex_reference',
        });
      }
    });
  });

  return { valid: errors.length === 0, errors, warnings, bounds, gridStep };
}

export function addAdvancedMeshVertex(shape, size, coordinates, options = {}) {
  const visualMesh = ensureAdvancedMeshGeneration(shape, size, options);
  const gridStep = getAdvancedMeshGridStep(visualMesh, options.gridStep);
  const bounds = getShapeBaseBounds(shape, size);
  const vertex = normalizeVertex(coordinates, gridStep);
  const existingIds = new Set(visualMesh.vertices.map((item) => item.id));
  if (!vertex.id) vertex.id = makeUniqueId('v', existingIds);
  if (existingIds.has(vertex.id)) {
    return { ok: false, error: `Vertex ${vertex.id} existe déjà.` };
  }
  if (!isVertexInsideBounds(vertex, bounds)) {
    return { ok: false, error: 'Vertex hors baseBox.' };
  }
  visualMesh.vertices.push(vertex);
  return { ok: true, vertex };
}

export function updateAdvancedMeshVertex(shape, size, vertexId, coordinates, options = {}) {
  const visualMesh = ensureAdvancedMeshGeneration(shape, size, options);
  const gridStep = getAdvancedMeshGridStep(visualMesh, options.gridStep);
  const bounds = getShapeBaseBounds(shape, size);
  const vertex = visualMesh.vertices.find((item) => item.id === vertexId);
  if (!vertex) return { ok: false, error: `Vertex ${vertexId} introuvable.` };
  const next = normalizeVertex({ id: vertex.id, ...coordinates }, gridStep);
  if (!isVertexInsideBounds(next, bounds)) {
    return { ok: false, error: 'Vertex hors baseBox.' };
  }
  vertex.x = next.x;
  vertex.y = next.y;
  vertex.z = next.z;
  return { ok: true, vertex: { ...vertex } };
}

export function deleteAdvancedMeshVertex(shape, size, vertexId, options = {}) {
  const visualMesh = ensureAdvancedMeshGeneration(shape, size, options);
  const usedByFace = visualMesh.faces.find((face) => face.vertices.includes(vertexId));
  if (usedByFace) {
    return { ok: false, error: `Vertex ${vertexId} utilisé par ${usedByFace.id}.` };
  }
  const index = visualMesh.vertices.findIndex((vertex) => vertex.id === vertexId);
  if (index < 0) return { ok: false, error: `Vertex ${vertexId} introuvable.` };
  visualMesh.vertices.splice(index, 1);
  return { ok: true };
}

export function createAdvancedMeshFace(shape, size, vertexIds, options = {}) {
  const visualMesh = ensureAdvancedMeshGeneration(shape, size, options);
  const vertices = Array.isArray(vertexIds) ? vertexIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (vertices.length < 3) {
    return { ok: false, error: 'Une face doit contenir au moins 3 vertices.' };
  }
  if (new Set(vertices).size < 3) {
    return { ok: false, error: 'Une face doit contenir 3 vertices distincts.' };
  }
  const knownIds = new Set(visualMesh.vertices.map((vertex) => vertex.id));
  for (const id of vertices) {
    if (!knownIds.has(id)) return { ok: false, error: `Vertex ${id} introuvable.` };
  }
  const faceId = makeUniqueId('f', new Set(visualMesh.faces.map((face) => face.id)));
  const face = { id: faceId, vertices };
  visualMesh.faces.push(face);
  return { ok: true, face };
}

export function deleteAdvancedMeshFace(shape, size, faceId, options = {}) {
  const visualMesh = ensureAdvancedMeshGeneration(shape, size, options);
  const index = visualMesh.faces.findIndex((face) => face.id === faceId);
  if (index < 0) return { ok: false, error: `Face ${faceId} introuvable.` };
  visualMesh.faces.splice(index, 1);
  return { ok: true };
}
