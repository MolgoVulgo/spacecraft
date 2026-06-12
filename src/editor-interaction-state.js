export function createEmptyEditorSelectionState() {
  return {
    points: new Set(),
    lines: new Set(),
    edges: new Set(),
    faces: new Set(),
    active: null,
    hovered: null,
  };
}

export function getPrimitiveKey(primitive) {
  if (!primitive?.type || !primitive?.id) return '';
  return `${primitive.type}:${primitive.id}`;
}

function cloneSelectionState(selection = createEmptyEditorSelectionState()) {
  return {
    points: new Set(selection.points ?? []),
    lines: new Set(selection.lines ?? []),
    edges: new Set(selection.edges ?? []),
    faces: new Set(selection.faces ?? []),
    active: selection.active ?? null,
    hovered: selection.hovered ?? null,
  };
}

function selectionBucketForPrimitive(selection, primitive) {
  if (primitive?.type === 'point') return selection.points;
  if (primitive?.type === 'line') return selection.lines;
  if (primitive?.type === 'edge') return selection.edges;
  if (primitive?.type === 'face') return selection.faces;
  return null;
}

function hasMixedSelection(selection) {
  const populated = [
    selection.points.size,
    selection.lines.size,
    selection.edges.size,
    selection.faces.size,
  ].filter(Boolean);
  return populated.length > 1;
}

export function applySelectionClick(selection, primitive, { toggle = false } = {}) {
  const next = cloneSelectionState(selection);
  if (!primitive?.type || !primitive?.id) return next;

  const key = getPrimitiveKey(primitive);
  const bucket = selectionBucketForPrimitive(next, primitive);
  if (!bucket) return next;

  if (!toggle) {
    next.points.clear();
    next.lines.clear();
    next.edges.clear();
    next.faces.clear();
    bucket.add(key);
    next.active = primitive;
    return next;
  }

  if (bucket.has(key)) {
    bucket.delete(key);
    if (getPrimitiveKey(next.active) === key) next.active = null;
    return next;
  }

  bucket.add(key);
  next.active = primitive;
  return next;
}

export function isClickGesture(startPoint, endPoint, threshold = 5) {
  if (!startPoint || !endPoint) return false;
  return Math.abs(endPoint.x - startPoint.x) <= threshold
    && Math.abs(endPoint.y - startPoint.y) <= threshold;
}

export function getEditorContextActions(selection, hovered, capabilities = {}) {
  const source = selection ?? createEmptyEditorSelectionState();
  if (capabilities.locked) return [];

  const hasSelection = source.points.size || source.lines.size || source.edges.size || source.faces.size;
  if (hasSelection && hasMixedSelection(source)) return [];

  const faceCount = source.faces.size;
  const edgeCount = source.edges.size;

  if (hasSelection && faceCount && !edgeCount && !source.points.size && !source.lines.size) {
    return [
      capabilities.faceRound ? { id: 'face_round', label: 'Arrondir face' } : null,
      capabilities.faceChamfer ? { id: 'face_chamfer', label: 'Chanfreiner face' } : null,
      capabilities.faceDelete ? { id: 'face_delete', label: 'Supprimer correction face' } : null,
    ].filter(Boolean);
  }

  if (hasSelection && edgeCount && !faceCount && !source.points.size && !source.lines.size) {
    return [
      capabilities.edgeChamfer ? { id: 'edge_chamfer', label: 'Chanfrein' } : null,
      capabilities.edgeFillet ? { id: 'edge_fillet', label: 'Arrondi' } : null,
    ].filter(Boolean);
  }

  if (!hasSelection && hovered?.type === 'face') {
    return [
      capabilities.faceRound ? { id: 'face_round', label: 'Arrondir face' } : null,
      capabilities.faceChamfer ? { id: 'face_chamfer', label: 'Chanfreiner face' } : null,
      capabilities.faceDelete ? { id: 'face_delete', label: 'Supprimer correction face' } : null,
    ].filter(Boolean);
  }

  if (!hasSelection && hovered?.type === 'edge') {
    return [
      capabilities.edgeChamfer ? { id: 'edge_chamfer', label: 'Chanfrein' } : null,
      capabilities.edgeFillet ? { id: 'edge_fillet', label: 'Arrondi' } : null,
    ].filter(Boolean);
  }

  return [];
}
