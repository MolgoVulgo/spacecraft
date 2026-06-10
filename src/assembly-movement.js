export function createAssemblyMovementController(deps) {
  const {
    collidesBoxesWithScene,
    getAssemblyGroupById,
    getGroupChildBoxes,
    getInstanceBox,
    getInstanceById,
    isGroupPlacementValid,
    isSaneWorldPosition,
    resolveVerticalCollisionOriginForGroup,
    setGroupWorldPosition,
    setMessage,
    updateAttachmentStates,
    updateSelectionBox,
    updateStats,
  } = deps;

  function finalizeMove() {
    updateAttachmentStates();
    updateStats();
    updateSelectionBox();
    setMessage('');
  }

  function tryMoveAssemblyGroup(group, targetOrigin, options = {}) {
    const resolvedOrigin = options.autoVertical
      ? resolveVerticalCollisionOriginForGroup(group, targetOrigin)
      : targetOrigin;
    if (!isSaneWorldPosition(resolvedOrigin)) {
      setMessage('Déplacement refusé : position de groupe invalide.');
      return false;
    }
    if (!isGroupPlacementValid(group, resolvedOrigin)) {
      setMessage('Déplacement groupe refusé : collision avec une autre pièce.');
      return false;
    }
    setGroupWorldPosition(group, resolvedOrigin);
    finalizeMove();
    return true;
  }

  function tryMoveSelectionBatch(entities, delta) {
    if (!entities.length) return false;
    const ignoredInstanceIds = new Set();
    const candidateBoxes = [];
    const groupOrigins = new Map();
    const looseInstances = [];

    for (const entity of entities) {
      if (entity.type === 'group') {
        const group = getAssemblyGroupById(entity.id);
        if (!group) continue;
        const nextOrigin = group.origin.clone().add(delta);
        groupOrigins.set(group.id, nextOrigin);
        for (const child of group.children) {
          ignoredInstanceIds.add(child.instanceId);
        }
        candidateBoxes.push(...getGroupChildBoxes(group, nextOrigin));
        continue;
      }

      const instance = getInstanceById(entity.id);
      if (!instance) continue;
      ignoredInstanceIds.add(instance.id);
      looseInstances.push(instance);
      candidateBoxes.push(getInstanceBox(instance, instance.group.position.clone().add(delta)));
    }

    if (!candidateBoxes.length) return false;
    if (collidesBoxesWithScene(candidateBoxes, { ignoredInstanceIds })) {
      setMessage('Déplacement refusé : collision avec une autre pièce.');
      return false;
    }

    for (const [groupId, nextOrigin] of groupOrigins) {
      const group = getAssemblyGroupById(groupId);
      if (!group) continue;
      setGroupWorldPosition(group, nextOrigin);
    }
    for (const instance of looseInstances) {
      instance.group.position.add(delta);
    }

    finalizeMove();
    return true;
  }

  return {
    tryMoveAssemblyGroup,
    tryMoveSelectionBatch,
  };
}
