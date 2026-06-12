function roundFaceValue(value) {
  return Math.round(value * 1000000) / 1000000;
}

function toPointVector(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    z: Number(point?.z) || 0,
  };
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(vector) {
  return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
  const length = magnitude(vector);
  if (!length) return { x: 0, y: 0, z: 0 };
  return {
    x: roundFaceValue(vector.x / length),
    y: roundFaceValue(vector.y / length),
    z: roundFaceValue(vector.z / length),
  };
}

function projectPointTo2d(point, normal) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) return { x: point.y, y: point.z };
  if (ay >= ax && ay >= az) return { x: point.x, y: point.z };
  return { x: point.x, y: point.y };
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, c) {
  return Math.min(a.x, b.x) <= c.x + 1e-9
    && c.x <= Math.max(a.x, b.x) + 1e-9
    && Math.min(a.y, b.y) <= c.y + 1e-9
    && c.y <= Math.max(a.y, b.y) + 1e-9;
}

function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) return true;
  if (Math.abs(o1) < 1e-9 && onSegment(a1, a2, b1)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(a1, a2, b2)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(b1, b2, a1)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(b1, b2, a2)) return true;
  return false;
}

function orderLoopPoints(edges, pointById) {
  const adjacency = new Map();
  for (const edge of edges) {
    adjacency.set(edge.pointA, [...(adjacency.get(edge.pointA) ?? []), edge.pointB]);
    adjacency.set(edge.pointB, [...(adjacency.get(edge.pointB) ?? []), edge.pointA]);
  }

  for (const neighbors of adjacency.values()) {
    if (neighbors.length !== 2) return { valid: false, reason: 'open_loop' };
  }

  const ordered = [];
  const visited = new Set();
  const start = [...adjacency.keys()].sort()[0];
  let previous = null;
  let current = start;

  while (current != null) {
    ordered.push(current);
    visited.add(current);
    const neighbors = adjacency.get(current) ?? [];
    const next = neighbors.find((candidate) => candidate !== previous);
    if (next == null) break;
    previous = current;
    current = next === start ? null : next;
    if (current && visited.has(current)) return { valid: false, reason: 'self_crossed' };
  }

  if (visited.size !== adjacency.size) return { valid: false, reason: 'open_loop' };
  return {
    valid: true,
    orderedPointIds: ordered,
    orderedPoints: ordered.map((pointId) => ({ id: pointId, ...toPointVector(pointById.get(pointId)) })),
  };
}

function computeLoopNormal(points) {
  const origin = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = subtract(points[index], origin);
    const b = subtract(points[index + 1], origin);
    const candidate = cross(a, b);
    if (magnitude(candidate) > 1e-9) return normalize(candidate);
  }
  return null;
}

function isCoplanar(points, normal) {
  const origin = points[0];
  return points.every((point) => Math.abs(dot(normal, subtract(point, origin))) < 1e-6);
}

function isSelfCrossed(points, normal) {
  const projected = points.map((point) => projectPointTo2d(point, normal));
  for (let i = 0; i < projected.length; i += 1) {
    const a1 = projected[i];
    const a2 = projected[(i + 1) % projected.length];
    for (let j = i + 1; j < projected.length; j += 1) {
      const isAdjacent = j === i || (j + 1) % projected.length === i || (i + 1) % projected.length === j;
      if (isAdjacent) continue;
      const b1 = projected[j];
      const b2 = projected[(j + 1) % projected.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function orderSelectedLoopPoints(selectedPointIds = [], pointMap = new Map()) {
  const points = selectedPointIds
    .map((pointId) => ({ id: pointId, ...toPointVector(pointMap.get(pointId)) }))
    .filter((point) => point.id);
  if (points.length !== selectedPointIds.length) return { valid: false, reason: 'unknown_points' };

  const normal = computeLoopNormal(points);
  if (!normal) return { valid: false, reason: 'degenerate_face' };
  if (!isCoplanar(points, normal)) return { valid: false, reason: 'non_coplanar' };

  const center = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
    z: acc.z + point.z,
  }), { x: 0, y: 0, z: 0 });
  center.x /= points.length;
  center.y /= points.length;
  center.z /= points.length;

  const projectedCenter = projectPointTo2d(center, normal);
  return {
    valid: true,
    orderedPointIds: [...points]
      .sort((left, right) => {
        const a = projectPointTo2d(left, normal);
        const b = projectPointTo2d(right, normal);
        const angleA = Math.atan2(a.y - projectedCenter.y, a.x - projectedCenter.x);
        const angleB = Math.atan2(b.y - projectedCenter.y, b.x - projectedCenter.x);
        return angleA - angleB;
      })
      .map((point) => point.id),
  };
}

function findEdgeByPair(edges = [], pointA, pointB) {
  return edges.find((edge) => (
    (edge.pointA === pointA && edge.pointB === pointB)
      || (edge.pointA === pointB && edge.pointB === pointA)
  )) ?? null;
}

export function getAdvancedDraftFacesForShape(faceState, shapeId) {
  return Array.isArray(faceState?.[shapeId]) ? faceState[shapeId] : [];
}

export function removeInvalidDraftFaces(existingFaces = [], validEdgeIds = []) {
  const validSet = new Set(validEdgeIds);
  return existingFaces.filter((face) => (face.edges ?? []).every((edgeId) => validSet.has(edgeId)));
}

function resolveEffectiveEdgeIds({ selectedEdgeIds = [], selectedPointIds = [], edges = [] }) {
  if (selectedEdgeIds.length) return selectedEdgeIds;

  return edges.map((edge) => edge.id);
}

export function createAdvancedDraftFace({
  shapeId,
  selectedEdgeIds = [],
  selectedPointIds = [],
  edges = [],
  pointMap = new Map(),
}) {
  if (!shapeId) return { created: false, reason: 'missing_shape' };
  if (!selectedEdgeIds.length && selectedPointIds.length > 4) return { created: false, reason: 'unsupported_point_count' };

  if (!selectedEdgeIds.length && selectedPointIds.length >= 3) {
    const orderedPoints = orderSelectedLoopPoints(selectedPointIds, pointMap);
    if (!orderedPoints.valid) return { created: false, reason: orderedPoints.reason };
    const perimeterEdgeIds = [];
    for (let index = 0; index < orderedPoints.orderedPointIds.length; index += 1) {
      const pointA = orderedPoints.orderedPointIds[index];
      const pointB = orderedPoints.orderedPointIds[(index + 1) % orderedPoints.orderedPointIds.length];
      const edge = findEdgeByPair(edges, pointA, pointB);
      if (!edge) return { created: false, reason: 'insufficient_edges' };
      perimeterEdgeIds.push(edge.id);
    }
    selectedEdgeIds = perimeterEdgeIds;
  }

  const effectiveEdgeIds = resolveEffectiveEdgeIds({ selectedEdgeIds, selectedPointIds, edges });
  if (effectiveEdgeIds.length < 3) return { created: false, reason: 'insufficient_edges' };

  const selectedSet = new Set(effectiveEdgeIds);
  const selectedEdges = edges.filter((edge) => selectedSet.has(edge.id));
  if (selectedEdges.length !== effectiveEdgeIds.length) return { created: false, reason: 'unknown_edges' };

  const ordered = orderLoopPoints(selectedEdges, pointMap);
  if (!ordered.valid) return { created: false, reason: ordered.reason };

  const normal = computeLoopNormal(ordered.orderedPoints);
  if (!normal) return { created: false, reason: 'degenerate_face' };
  if (!isCoplanar(ordered.orderedPoints, normal)) return { created: false, reason: 'non_coplanar' };
  if (isSelfCrossed(ordered.orderedPoints, normal)) return { created: false, reason: 'self_crossed' };

  return {
    created: true,
    face: {
      id: `face_${ordered.orderedPointIds.join('__')}`,
      edges: [...effectiveEdgeIds],
      points: ordered.orderedPointIds,
      normal,
      status: 'draft',
    },
  };
}
