export function normalizeAssemblySelectionEntity(entity, { getAssemblyGroupById, getInstanceById }) {
  if (!entity?.type || !entity?.id) return null;
  if (entity.type === 'group') return getAssemblyGroupById(entity.id) ? { type: 'group', id: entity.id } : null;
  const instance = getInstanceById(entity.id);
  if (!instance || instance.groupId) return null;
  return { type: 'piece', id: entity.id };
}

export function getAssemblySelectionBatch(state, deps) {
  if (Array.isArray(state.selectionBatch) && state.selectionBatch.length) {
    return state.selectionBatch
      .map((entity) => normalizeAssemblySelectionEntity(entity, deps))
      .filter(Boolean);
  }
  if (state.selectedEntityType === 'group' && state.selectedId) return [{ type: 'group', id: state.selectedId }];
  if (state.selectedEntityType === 'piece' && state.selectedId) return [{ type: 'piece', id: state.selectedId }];
  if (Array.isArray(state.selectedGroupIds) && state.selectedGroupIds.length) {
    return state.selectedGroupIds
      .map((id) => normalizeAssemblySelectionEntity({ type: 'piece', id }, deps))
      .filter(Boolean);
  }
  return [];
}

export function hasAssemblySelection(state, deps) {
  return getAssemblySelectionBatch(state, deps).length > 0;
}

export function assemblySelectionContainsEntity(entity, state, deps) {
  const candidate = normalizeAssemblySelectionEntity(entity, deps);
  if (!candidate) return false;
  return getAssemblySelectionBatch(state, deps).some((item) => item.type === candidate.type && item.id === candidate.id);
}

export function applyAssemblySelectionState(state, entities, deps, options = {}) {
  const normalized = [];
  const seen = new Set();
  for (const entity of entities ?? []) {
    const resolved = normalizeAssemblySelectionEntity(entity, deps);
    if (!resolved) continue;
    const key = `${resolved.type}:${resolved.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(resolved);
  }

  state.selectionBatch = normalized;
  state.selectedEntityType = null;
  state.selectedId = null;
  state.selectedGroupIds = normalized.filter((entity) => entity.type === 'piece').map((entity) => entity.id);

  if (normalized.length === 1) {
    state.selectedEntityType = normalized[0].type;
    state.selectedId = normalized[0].id;
    if (normalized[0].type === 'group') state.selectedGroupIds = [];
    if (normalized[0].type === 'piece') options.onSinglePieceSelected?.(normalized[0].id);
  }
}

export function toggleLoosePieceSelection(state, instanceId, { getInstanceById }) {
  const instance = getInstanceById(instanceId);
  if (!instance || instance.groupId) return null;

  const baseIds = state.selectedGroupIds.length
    ? [...state.selectedGroupIds]
    : (state.selectedEntityType === 'piece' && state.selectedId && !getInstanceById(state.selectedId)?.groupId
      ? [state.selectedId]
      : []);

  return baseIds.includes(instanceId)
    ? baseIds.filter((id) => id !== instanceId)
    : [...baseIds, instanceId];
}
