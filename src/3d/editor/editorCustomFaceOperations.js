function roundCustomFaceValue(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function normalizePoint(point) {
  return {
    id: String(point?.id ?? ''),
    x: roundCustomFaceValue(point?.x),
    y: roundCustomFaceValue(point?.y),
    z: roundCustomFaceValue(point?.z),
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
  if (!length) return null;
  return {
    x: roundCustomFaceValue(vector.x / length),
    y: roundCustomFaceValue(vector.y / length),
    z: roundCustomFaceValue(vector.z / length),
  };
}

function computeNormal(points = []) {
  const origin = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const candidate = normalize(cross(subtract(points[index], origin), subtract(points[index + 1], origin)));
    if (candidate) return candidate;
  }
  return null;
}

export function getCustomFaceOperations(operations = []) {
  return operations.filter((operation) => operation?.type === 'custom_face');
}

export function createCustomFaceOperation({ shapeId, face, pointMap = new Map() }) {
  if (!shapeId) return { created: false, reason: 'missing_shape' };
  if (!face?.id || !Array.isArray(face?.points) || face.points.length < 3) return { created: false, reason: 'invalid_face' };

  const points = face.points.map((pointId) => normalizePoint({ id: pointId, ...(pointMap.get(pointId) ?? {}) }));
  if (points.some((point) => !point.id)) return { created: false, reason: 'unknown_points' };

  const normal = face.normal ?? computeNormal(points);
  if (!normal) return { created: false, reason: 'degenerate_face' };

  return {
    created: true,
    operation: {
      id: `custom_face_${face.points.join('__')}`,
      type: 'custom_face',
      target: 'custom_face',
      selection: {
        face: 'custom',
        cell: null,
        position: null,
      },
      scope: {
        kind: 'custom_face',
        label_fr: 'face personnalisée',
      },
      point_ids: [...face.points],
      points: points.map((point) => ({ x: point.x, y: point.y, z: point.z })),
      normal: {
        x: roundCustomFaceValue(normal.x),
        y: roundCustomFaceValue(normal.y),
        z: roundCustomFaceValue(normal.z),
      },
      status: 'draft',
      metadata: {
        source: 'editor_advanced_face',
        draft_face_id: face.id,
        shape_id: shapeId,
      },
    },
  };
}

export function validateCustomFaceOperation(operation, size = null) {
  const errors = [];
  const warnings = [];
  const points = Array.isArray(operation?.points) ? operation.points : [];

  if (operation?.type !== 'custom_face') errors.push('type invalide');
  if (points.length < 3) errors.push('au moins 3 points requis');

  for (const point of points) {
    if (![point?.x, point?.y, point?.z].every((value) => Number.isFinite(Number(value)))) {
      errors.push('coordonnées invalides');
      break;
    }
  }

  const normalizedPoints = points.map((point, index) => normalizePoint({ id: operation?.point_ids?.[index] ?? `p${index}`, ...point }));
  if (normalizedPoints.length >= 3 && !computeNormal(normalizedPoints)) errors.push('face dégénérée');

  const dimensions = size?.dimensions;
  if (dimensions) {
    for (const point of normalizedPoints) {
      if (
        point.x < 0 || point.y < 0 || point.z < 0
        || point.x > Number(dimensions.length)
        || point.y > Number(dimensions.width)
        || point.z > Number(dimensions.height)
      ) {
        errors.push('point hors volume');
        break;
      }
    }
  }

  if (!operation?.scope?.kind) warnings.push('scope absent');
  return { valid: errors.length === 0, errors, warnings };
}

export function removeCustomFaceOperationById(operations = [], operationId) {
  return operations.filter((operation) => operation?.id !== operationId);
}
