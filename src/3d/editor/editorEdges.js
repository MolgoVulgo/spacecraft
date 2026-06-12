function normalizePointId(pointId) {
  return String(pointId ?? '').trim();
}

function normalizeEdgeId(edgeId) {
  return String(edgeId ?? '').trim();
}

function normalizeEdgePair(pointA, pointB) {
  const a = normalizePointId(pointA);
  const b = normalizePointId(pointB);
  return [a, b].sort((left, right) => left.localeCompare(right));
}

function findExistingEdge(existingEdges = [], pointA, pointB) {
  const [from, to] = normalizeEdgePair(pointA, pointB);
  return existingEdges.find((edge) => {
    const [edgeFrom, edgeTo] = normalizeEdgePair(edge.pointA, edge.pointB);
    return edgeFrom === from && edgeTo === to;
  }) ?? null;
}

function toPointVector(point) {
  return {
    id: point.id,
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    z: Number(point?.z) || 0,
  };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
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
  if (!length) return null;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function projectPointTo2d(point, normal) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) return { x: point.y, y: point.z };
  if (ay >= ax && ay >= az) return { x: point.x, y: point.z };
  return { x: point.x, y: point.y };
}

function computeNormal(points) {
  const origin = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const candidate = normalize(cross(subtract(points[index], origin), subtract(points[index + 1], origin)));
    if (candidate) return candidate;
  }
  return null;
}

function arePointsCoplanar(points, normal) {
  const origin = points[0];
  return points.every((point) => Math.abs(dot(normal, subtract(point, origin))) < 1e-6);
}

function orderLoopPoints(points) {
  const normal = computeNormal(points);
  if (!normal) return { valid: false, reason: 'invalid_points' };
  if (!arePointsCoplanar(points, normal)) return { valid: false, reason: 'non_coplanar' };

  const center = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
    z: acc.z + point.z,
  }), { x: 0, y: 0, z: 0 });
  center.x /= points.length;
  center.y /= points.length;
  center.z /= points.length;

  return {
    valid: true,
    orderedPoints: [...points].sort((left, right) => {
      const a = projectPointTo2d(left, normal);
      const b = projectPointTo2d(right, normal);
      const ca = projectPointTo2d(center, normal);
      const angleA = Math.atan2(a.y - ca.y, a.x - ca.x);
      const angleB = Math.atan2(b.y - ca.y, b.x - ca.x);
      return angleA - angleB;
    }),
  };
}

export function getAdvancedDraftEdgesForShape(edgeState, shapeId) {
  return Array.isArray(edgeState?.[shapeId]) ? edgeState[shapeId] : [];
}

export function normalizeAdvancedEdgeSelection(edgeIds = []) {
  const seen = new Set();
  const result = [];
  for (const edgeId of edgeIds) {
    const value = normalizeEdgeId(edgeId);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function selectAdvancedEdge(edgeId, currentSelection = [], options = {}) {
  const normalizedCurrent = normalizeAdvancedEdgeSelection(currentSelection);
  const value = normalizeEdgeId(edgeId);
  if (!value) return normalizedCurrent;

  if (options.multi) {
    if (normalizedCurrent.includes(value)) return normalizedCurrent;
    return [...normalizedCurrent, value];
  }

  return [value];
}

export function removeAdvancedDraftEdgesById(existingEdges = [], edgeIds = []) {
  const removedIds = new Set(normalizeAdvancedEdgeSelection(edgeIds));
  return existingEdges.filter((edge) => !removedIds.has(edge.id));
}

export function createAdvancedDraftEdge({ shapeId, selectedPointIds = [], existingEdges = [], validPointIds = [] }) {
  if (!shapeId) return { created: false, reason: 'missing_shape' };
  if (selectedPointIds.length < 2) return { created: false, reason: 'insufficient_points' };
  if (selectedPointIds.length > 2) return { created: false, reason: 'too_many_points' };

  const [pointA, pointB] = selectedPointIds.map(normalizePointId);
  if (!pointA || !pointB || pointA === pointB) return { created: false, reason: 'invalid_points' };

  const validSet = new Set(validPointIds.map(normalizePointId));
  if (!validSet.has(pointA) || !validSet.has(pointB)) return { created: false, reason: 'unknown_points' };

  const [from, to] = normalizeEdgePair(pointA, pointB);
  const duplicate = findExistingEdge(existingEdges, pointA, pointB);
  if (duplicate) return { created: false, reason: 'duplicate_edge' };

  return {
    created: true,
    edge: {
      id: `edge_${from}__${to}`,
      pointA,
      pointB,
      status: 'draft',
    },
  };
}

export function createAdvancedDraftEdgesFromSelection({
  shapeId,
  selectedPointIds = [],
  existingEdges = [],
  pointMap = new Map(),
}) {
  if (!shapeId) return { created: false, reason: 'missing_shape' };
  if (selectedPointIds.length < 2) return { created: false, reason: 'insufficient_points' };
  if (selectedPointIds.length > 4) return { created: false, reason: 'unsupported_point_count' };

  const normalizedIds = [...new Set(selectedPointIds.map(normalizePointId).filter(Boolean))];
  if (normalizedIds.length !== selectedPointIds.length) return { created: false, reason: 'invalid_points' };

  if (normalizedIds.length === 2) {
    const single = createAdvancedDraftEdge({
      shapeId,
      selectedPointIds: normalizedIds,
      existingEdges,
      validPointIds: [...pointMap.keys()],
    });
    return single.created
      ? { created: true, edges: [single.edge], loopEdges: [single.edge], loopEdgeIds: [single.edge.id], reusedEdgeCount: 0 }
      : single;
  }

  const points = normalizedIds.map((pointId) => pointMap.get(pointId)).filter(Boolean).map(toPointVector);
  if (points.length !== normalizedIds.length) return { created: false, reason: 'unknown_points' };

  const ordered = orderLoopPoints(points);
  if (!ordered.valid) return ordered;

  const createdEdges = [];
  const loopEdges = [];
  const orderedIds = ordered.orderedPoints.map((point) => point.id);
  for (let index = 0; index < orderedIds.length; index += 1) {
    const pointA = orderedIds[index];
    const pointB = orderedIds[(index + 1) % orderedIds.length];
    const existingEdge = findExistingEdge([...existingEdges, ...createdEdges], pointA, pointB);
    if (existingEdge) {
      loopEdges.push(existingEdge);
      continue;
    }
    const result = createAdvancedDraftEdge({
      shapeId,
      selectedPointIds: [pointA, pointB],
      existingEdges: [...existingEdges, ...createdEdges],
      validPointIds: [...pointMap.keys()],
    });
    if (!result.created) return result;
    createdEdges.push(result.edge);
    loopEdges.push(result.edge);
  }

  return {
    created: true,
    edges: createdEdges,
    loopEdges,
    loopEdgeIds: loopEdges.map((edge) => edge.id),
    reusedEdgeCount: loopEdges.length - createdEdges.length,
  };
}
