function roundEdgeValue(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

const EDGE_CORRECTION_OPERATION_TYPES = new Set([
  'edge_chamfer',
  'edge_fillet',
  'chamfer_edge',
  'fillet_edge',
  'round_edge',
  'edge_round',
]);

export function normalizeEdgeId(edgeId) {
  return String(edgeId ?? '').trim();
}

function normalizeEdgeIds(edgeIds = []) {
  const seen = new Set();
  const result = [];
  for (const edgeId of edgeIds) {
    const normalized = normalizeEdgeId(edgeId);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function readOperationRawEdgeIds(operation) {
  if (!operation || typeof operation !== 'object') return [];
  const explicitEdgeIds = [
    ...(Array.isArray(operation.edge_ids) ? operation.edge_ids : []),
    ...(Array.isArray(operation.scope?.edge_ids) ? operation.scope.edge_ids : []),
  ];
  const singletonEdgeIds = [
    operation.edge_id,
    operation.edgeId,
    operation.target_edge_id,
    operation.target?.edge_id,
    operation.target?.edgeId,
  ];
  if (explicitEdgeIds.length) return [...explicitEdgeIds, ...singletonEdgeIds];
  return singletonEdgeIds;
}

function cloneEdgeCorrectionOperationForEdgeIds(operation, edgeIds) {
  const normalizedEdgeIds = normalizeEdgeIds(edgeIds);
  if (!normalizedEdgeIds.length) return null;

  const nextOperation = structuredClone(operation);
  nextOperation.edge_ids = normalizedEdgeIds;
  if (nextOperation.scope && typeof nextOperation.scope === 'object') {
    nextOperation.scope.edge_ids = normalizedEdgeIds;
    if (Array.isArray(nextOperation.scope.edges)) {
      nextOperation.scope.edges = nextOperation.scope.edges.filter((edge) => normalizedEdgeIds.includes(normalizeEdgeId(edge?.id)));
    }
  }
  if ('edge_id' in nextOperation) nextOperation.edge_id = normalizedEdgeIds[0];
  if ('edgeId' in nextOperation) nextOperation.edgeId = normalizedEdgeIds[0];
  if ('target_edge_id' in nextOperation) nextOperation.target_edge_id = normalizedEdgeIds[0];
  if (nextOperation.target && typeof nextOperation.target === 'object') {
    if ('edge_id' in nextOperation.target) nextOperation.target.edge_id = normalizedEdgeIds[0];
    if ('edgeId' in nextOperation.target) nextOperation.target.edgeId = normalizedEdgeIds[0];
  }
  if (typeof nextOperation.id === 'string') nextOperation.id = `${nextOperation.type}_${normalizedEdgeIds.join('__')}`;
  return nextOperation;
}

function excludeEdgeIdsFromOperation(operation, excludedEdgeIds) {
  if (!isEdgeCorrectionOperation(operation)) return operation;
  const operationEdgeIds = getOperationEdgeIds(operation);
  if (!operationEdgeIds.length) return operation;
  const remainingEdgeIds = operationEdgeIds.filter((edgeId) => !excludedEdgeIds.has(edgeId));
  if (remainingEdgeIds.length === operationEdgeIds.length) return operation;
  return cloneEdgeCorrectionOperationForEdgeIds(operation, remainingEdgeIds);
}

export function isEdgeCorrectionOperation(operation) {
  return EDGE_CORRECTION_OPERATION_TYPES.has(operation?.type);
}

export function getOperationEdgeIds(operation) {
  const rawEdgeIds = readOperationRawEdgeIds(operation);
  if (rawEdgeIds.length) return normalizeEdgeIds(rawEdgeIds);
  return normalizeEdgeIds((operation?.scope?.edges ?? []).map((edge) => edge?.id));
}

export function getOperationEdgeId(operation) {
  return getOperationEdgeIds(operation)[0] ?? null;
}

export function removeEdgeCorrectionsForEdge(operations = [], edgeId) {
  const normalizedEdgeId = normalizeEdgeId(edgeId);
  if (!normalizedEdgeId) return [...operations];
  const excludedEdgeIds = new Set([normalizedEdgeId]);
  const nextOperations = [];
  for (const operation of operations) {
    const nextOperation = excludeEdgeIdsFromOperation(operation, excludedEdgeIds);
    if (nextOperation) nextOperations.push(nextOperation);
  }
  return nextOperations;
}

export function upsertEdgeCorrection(shape, edgeId, operation) {
  if (!shape?.generation) return { changed: false, replaced: 0, inserted: false };

  const targetEdgeIds = normalizeEdgeIds([edgeId, ...getOperationEdgeIds(operation)]);
  if (!targetEdgeIds.length) return { changed: false, replaced: 0, inserted: false };

  const previousOperations = Array.isArray(shape.generation.operations) ? shape.generation.operations : [];
  const excludedEdgeIds = new Set(targetEdgeIds);
  const nextOperations = [];
  let replaced = 0;

  for (const existingOperation of previousOperations) {
    const existingEdgeIds = getOperationEdgeIds(existingOperation);
    const overlaps = existingEdgeIds.some((existingEdgeId) => excludedEdgeIds.has(existingEdgeId));
    if (!overlaps) {
      nextOperations.push(existingOperation);
      continue;
    }
    replaced += 1;
    const trimmedOperation = excludeEdgeIdsFromOperation(existingOperation, excludedEdgeIds);
    if (trimmedOperation) nextOperations.push(trimmedOperation);
  }

  nextOperations.push(operation);
  shape.generation.operations = nextOperations;
  return { changed: true, replaced, inserted: true };
}

export function findEdgeCorrectionConflicts(operations = []) {
  const operationsByEdgeId = new Map();
  for (const operation of operations) {
    if (!isEdgeCorrectionOperation(operation)) continue;
    for (const edgeId of getOperationEdgeIds(operation)) {
      const list = operationsByEdgeId.get(edgeId) ?? [];
      list.push(operation);
      operationsByEdgeId.set(edgeId, list);
    }
  }

  const conflicts = [];
  for (const [edgeId, list] of operationsByEdgeId.entries()) {
    if (list.length <= 1) continue;
    conflicts.push({
      edgeId,
      operations: list,
      types: [...new Set(list.map((operation) => operation?.type).filter(Boolean))],
    });
  }
  return conflicts;
}

export function validateEdgeCorrectionExclusivity(operations = []) {
  const conflicts = findEdgeCorrectionConflicts(operations);
  return {
    valid: conflicts.length === 0,
    conflicts,
    errors: conflicts.map((conflict) => `EDGE_CORRECTION_EXCLUSIVE_PER_EDGE edge ${conflict.edgeId}: ${conflict.types.join(' + ')}`),
  };
}

export function normalizeEdgeCorrectionOperations(operations = []) {
  const seenEdgeIds = new Set();
  const normalizedReversed = [];
  let changed = false;

  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index];
    if (!isEdgeCorrectionOperation(operation)) {
      normalizedReversed.push(operation);
      continue;
    }

    const operationEdgeIds = getOperationEdgeIds(operation);
    if (!operationEdgeIds.length) {
      normalizedReversed.push(operation);
      continue;
    }

    const remainingEdgeIds = operationEdgeIds.filter((edgeId) => !seenEdgeIds.has(edgeId));
    if (!remainingEdgeIds.length) {
      changed = true;
      continue;
    }
    if (remainingEdgeIds.length !== operationEdgeIds.length) changed = true;
    normalizedReversed.push(
      remainingEdgeIds.length === operationEdgeIds.length
        ? operation
        : cloneEdgeCorrectionOperationForEdgeIds(operation, remainingEdgeIds),
    );
    for (const edgeId of remainingEdgeIds) seenEdgeIds.add(edgeId);
  }

  return {
    changed,
    operations: normalizedReversed.reverse(),
  };
}

function createCatalogPoint(x, y, z) {
  return {
    x: roundEdgeValue(x),
    y: roundEdgeValue(y),
    z: roundEdgeValue(z),
  };
}

function createEditableEdge({ id, start, end, axis, side, face }) {
  return {
    id,
    start,
    end,
    axis,
    side,
    face,
    source: 'bbox',
  };
}

export function deriveEditableBBoxEdges(size) {
  const dimensions = size?.dimensions ?? {};
  const length = Number(dimensions.length) || 0;
  const width = Number(dimensions.width) || 0;
  const height = Number(dimensions.height) || 0;
  if (length <= 0 || width <= 0 || height <= 0) return [];

  return [
    createEditableEdge({
      id: 'top-front',
      start: createCatalogPoint(0, 0, height),
      end: createCatalogPoint(length, 0, height),
      axis: 'length',
      side: 'front',
      face: 'top',
    }),
    createEditableEdge({
      id: 'top-back',
      start: createCatalogPoint(0, width, height),
      end: createCatalogPoint(length, width, height),
      axis: 'length',
      side: 'back',
      face: 'top',
    }),
    createEditableEdge({
      id: 'top-left',
      start: createCatalogPoint(0, 0, height),
      end: createCatalogPoint(0, width, height),
      axis: 'width',
      side: 'left',
      face: 'top',
    }),
    createEditableEdge({
      id: 'top-right',
      start: createCatalogPoint(length, 0, height),
      end: createCatalogPoint(length, width, height),
      axis: 'width',
      side: 'right',
      face: 'top',
    }),
    createEditableEdge({
      id: 'bottom-front',
      start: createCatalogPoint(0, 0, 0),
      end: createCatalogPoint(length, 0, 0),
      axis: 'length',
      side: 'front',
      face: 'bottom',
    }),
    createEditableEdge({
      id: 'bottom-back',
      start: createCatalogPoint(0, width, 0),
      end: createCatalogPoint(length, width, 0),
      axis: 'length',
      side: 'back',
      face: 'bottom',
    }),
    createEditableEdge({
      id: 'bottom-left',
      start: createCatalogPoint(0, 0, 0),
      end: createCatalogPoint(0, width, 0),
      axis: 'width',
      side: 'left',
      face: 'bottom',
    }),
    createEditableEdge({
      id: 'bottom-right',
      start: createCatalogPoint(length, 0, 0),
      end: createCatalogPoint(length, width, 0),
      axis: 'width',
      side: 'right',
      face: 'bottom',
    }),
  ];
}

export function selectEditableEdge(edgeId, currentSelection = [], options = {}) {
  const normalized = normalizeEdgeId(edgeId);
  if (!normalized) return normalizeEdgeIds(currentSelection);

  const selection = normalizeEdgeIds(currentSelection);
  if (!options.multi) return [normalized];
  return selection.includes(normalized)
    ? selection.filter((value) => value !== normalized)
    : [...selection, normalized];
}

function buildEdgeOperation({ shapeId, edgeIds = [], editableEdges = [], type, amount = null, radius = null, segments = null }) {
  if (!shapeId) return { created: false, reason: 'missing_shape' };

  const normalizedEdgeIds = normalizeEdgeIds(edgeIds);
  if (!normalizedEdgeIds.length) return { created: false, reason: 'empty_selection' };

  const edgeById = new Map(editableEdges.map((edge) => [edge.id, edge]));
  const selectedEdges = normalizedEdgeIds.map((edgeId) => edgeById.get(edgeId)).filter(Boolean);
  if (selectedEdges.length !== normalizedEdgeIds.length) return { created: false, reason: 'unknown_edge' };

  const primary = selectedEdges[0];
  const operation = {
    id: `${type}_${normalizedEdgeIds.join('__')}`,
    type,
    target: 'edge_selection',
    edge_ids: normalizedEdgeIds,
    selection: {
      cell: null,
      face: primary.face,
      position: primary.start,
    },
    scope: {
      kind: 'edge_selection',
      label_fr: type === 'edge_chamfer' ? 'chanfrein arête' : 'arrondi arête',
      edge_ids: normalizedEdgeIds,
      edges: selectedEdges.map((edge) => ({
        id: edge.id,
        axis: edge.axis,
        side: edge.side,
        face: edge.face,
      })),
    },
    status: 'draft',
    metadata: {
      source: 'editor_geometry_edges',
      shape_id: shapeId,
    },
  };

  if (type === 'edge_chamfer') operation.amount = roundEdgeValue(amount ?? 0.5);
  if (type === 'edge_fillet') {
    operation.radius = roundEdgeValue(radius ?? 1);
    operation.segments = Math.max(3, Math.floor(Number(segments) || 8));
  }

  return { created: true, operation };
}

export function createEdgeChamferOperation({ shapeId, edgeIds = [], editableEdges = [], amount = 0.5 }) {
  return buildEdgeOperation({ shapeId, edgeIds, editableEdges, type: 'edge_chamfer', amount });
}

export function createEdgeFilletOperation({ shapeId, edgeIds = [], editableEdges = [], radius = 1, segments = 8 }) {
  return buildEdgeOperation({ shapeId, edgeIds, editableEdges, type: 'edge_fillet', radius, segments });
}

export function validateEdgeChamferOperation(operation) {
  const errors = [];
  const warnings = [];
  if (operation?.type !== 'edge_chamfer') errors.push('type invalide');
  if (!normalizeEdgeIds(operation?.edge_ids).length) errors.push('aucune arête sélectionnée');
  if (Number(operation?.amount) !== 0.5) errors.push('chanfrein avec taille différente de 0.5');
  if (!Array.isArray(operation?.scope?.edges) || !operation.scope.edges.length) warnings.push('scope.edges absent');
  return { valid: errors.length === 0, errors, warnings };
}

export function validateEdgeFilletOperation(operation) {
  const errors = [];
  const warnings = [];
  if (operation?.type !== 'edge_fillet') errors.push('type invalide');
  if (!normalizeEdgeIds(operation?.edge_ids).length) errors.push('aucune arête sélectionnée');
  if (Number(operation?.radius) !== 1) errors.push('arrondi avec rayon différent de 1');
  if (Math.floor(Number(operation?.segments) || 0) < 3) errors.push('segments invalides');
  if (!Array.isArray(operation?.scope?.edges) || !operation.scope.edges.length) warnings.push('scope.edges absent');
  return { valid: errors.length === 0, errors, warnings };
}
