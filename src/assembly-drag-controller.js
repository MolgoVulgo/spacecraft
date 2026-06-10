import * as THREE from 'three';

export const INTERACTION_STATES = {
  IDLE: 'IDLE',
  HOVER_PIECE_OR_GROUP: 'HOVER_PIECE_OR_GROUP',
  DRAG_SELECTED_OBJECT: 'DRAG_SELECTED_OBJECT',
  MARQUEE_SELECTION: 'MARQUEE_SELECTION',
  CAMERA_ROTATE_OR_PAN: 'CAMERA_ROTATE_OR_PAN',
  KEYBOARD_MOVE_SELECTED: 'KEYBOARD_MOVE_SELECTED',
  KEYBOARD_MOVE_SCENE: 'KEYBOARD_MOVE_SCENE',
};

const LOGICAL_ACTIONS = {
  FORWARD_DEPTH: 'FORWARD_DEPTH',
  BACKWARD_DEPTH: 'BACKWARD_DEPTH',
  LEFT_HORIZONTAL: 'LEFT_HORIZONTAL',
  RIGHT_HORIZONTAL: 'RIGHT_HORIZONTAL',
  UP_VERTICAL: 'UP_VERTICAL',
  DOWN_VERTICAL: 'DOWN_VERTICAL',
};

function createMarqueeElement(container) {
  const element = document.createElement('div');
  element.className = 'assembly-marquee';
  element.hidden = true;
  container.append(element);
  return element;
}

function getPointInContainer(event, container) {
  const rect = container.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function createRect(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function setMarqueeElementRect(element, rect) {
  element.hidden = false;
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function hideMarqueeElement(element) {
  element.hidden = true;
  element.style.width = '0px';
  element.style.height = '0px';
}

function getLogicalKeyboardAction(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const codeMap = {
    KeyW: LOGICAL_ACTIONS.FORWARD_DEPTH,
    KeyS: LOGICAL_ACTIONS.BACKWARD_DEPTH,
    KeyA: LOGICAL_ACTIONS.LEFT_HORIZONTAL,
    KeyD: LOGICAL_ACTIONS.RIGHT_HORIZONTAL,
    KeyE: LOGICAL_ACTIONS.UP_VERTICAL,
    KeyQ: LOGICAL_ACTIONS.DOWN_VERTICAL,
  };
  if (codeMap[event.code]) return codeMap[event.code];

  const key = String(event.key ?? '').toLowerCase();
  const keyMap = {
    w: LOGICAL_ACTIONS.FORWARD_DEPTH,
    z: LOGICAL_ACTIONS.FORWARD_DEPTH,
    s: LOGICAL_ACTIONS.BACKWARD_DEPTH,
    q: LOGICAL_ACTIONS.LEFT_HORIZONTAL,
    d: LOGICAL_ACTIONS.RIGHT_HORIZONTAL,
    e: LOGICAL_ACTIONS.UP_VERTICAL,
    a: LOGICAL_ACTIONS.DOWN_VERTICAL,
  };
  return keyMap[key] ?? null;
}

function logicalActionToDelta(action, step) {
  if (action === LOGICAL_ACTIONS.FORWARD_DEPTH) return new THREE.Vector3(0, step, 0);
  if (action === LOGICAL_ACTIONS.BACKWARD_DEPTH) return new THREE.Vector3(0, -step, 0);
  if (action === LOGICAL_ACTIONS.LEFT_HORIZONTAL) return new THREE.Vector3(-step, 0, 0);
  if (action === LOGICAL_ACTIONS.RIGHT_HORIZONTAL) return new THREE.Vector3(step, 0, 0);
  if (action === LOGICAL_ACTIONS.UP_VERTICAL) return new THREE.Vector3(0, 0, step);
  if (action === LOGICAL_ACTIONS.DOWN_VERTICAL) return new THREE.Vector3(0, 0, -step);
  return null;
}

export function createAssemblyInteractionController(options) {
  const {
    canvas,
    viewportStage,
    orbitControls,
    isBlockedTarget,
    pickSelectable,
    resolveDragSelection,
    selectEntities,
    toggleSelectionEntity,
    clearSelection,
    hasSelection,
    beginObjectDrag,
    updateObjectDrag,
    endObjectDrag,
    beginCameraDrag,
    endCameraDrag,
    collectMarqueeSelection,
    moveSelectedByDelta,
    moveSceneByDelta,
    getMoveStep,
  } = options;

  const marqueeElement = createMarqueeElement(viewportStage);
  const interaction = {
    state: INTERACTION_STATES.IDLE,
    pointerId: null,
    startPoint: null,
    currentRect: null,
  };

  function setState(nextState) {
    interaction.state = nextState;
  }

  function resetInteraction() {
    interaction.pointerId = null;
    interaction.startPoint = null;
    interaction.currentRect = null;
    hideMarqueeElement(marqueeElement);
    setState(INTERACTION_STATES.IDLE);
  }

  function beginMarquee(event) {
    interaction.pointerId = event.pointerId;
    interaction.startPoint = getPointInContainer(event, viewportStage);
    interaction.currentRect = createRect(interaction.startPoint, interaction.startPoint);
    setMarqueeElementRect(marqueeElement, interaction.currentRect);
    canvas.setPointerCapture?.(event.pointerId);
    setState(INTERACTION_STATES.MARQUEE_SELECTION);
  }

  function updateMarquee(event) {
    const point = getPointInContainer(event, viewportStage);
    interaction.currentRect = createRect(interaction.startPoint, point);
    setMarqueeElementRect(marqueeElement, interaction.currentRect);
  }

  function finishMarquee(event) {
    const rect = interaction.currentRect ?? createRect(interaction.startPoint, getPointInContainer(event, viewportStage));
    const entities = collectMarqueeSelection(rect, 3);
    if (entities.length) selectEntities(entities);
    else clearSelection();
    canvas.releasePointerCapture?.(event.pointerId);
    resetInteraction();
  }

  function handleLeftPointerDown(event, selectable) {
    if (selectable) {
      if (event.shiftKey) {
        toggleSelectionEntity(selectable);
        return true;
      }
      const dragEntities = resolveDragSelection(selectable);
      selectEntities(dragEntities);
      if (beginObjectDrag(event, selectable, dragEntities)) {
        interaction.pointerId = event.pointerId;
        canvas.setPointerCapture?.(event.pointerId);
        setState(INTERACTION_STATES.DRAG_SELECTED_OBJECT);
      }
      return true;
    }

    clearSelection();
    beginMarquee(event);
    return true;
  }

  function handleRightPointerDown(event) {
    beginCameraDrag(event);
    setState(INTERACTION_STATES.CAMERA_ROTATE_OR_PAN);
    return false;
  }

  function onPointerDown(event) {
    if (isBlockedTarget(event.target)) return false;
    if (interaction.state !== INTERACTION_STATES.IDLE && interaction.state !== INTERACTION_STATES.HOVER_PIECE_OR_GROUP) return false;
    if (event.button === 2) return handleRightPointerDown(event);
    if (event.button !== 0) return false;
    const selectable = pickSelectable(event);
    return handleLeftPointerDown(event, selectable);
  }

  function onPointerMove(event) {
    if (interaction.state === INTERACTION_STATES.DRAG_SELECTED_OBJECT) {
      if (event.pointerId !== interaction.pointerId) return false;
      updateObjectDrag(event);
      return true;
    }
    if (interaction.state === INTERACTION_STATES.MARQUEE_SELECTION) {
      if (event.pointerId !== interaction.pointerId) return false;
      updateMarquee(event);
      return true;
    }
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN) return false;

    const selectable = pickSelectable(event);
    setState(selectable ? INTERACTION_STATES.HOVER_PIECE_OR_GROUP : INTERACTION_STATES.IDLE);
    return false;
  }

  function onPointerUp(event) {
    if (interaction.state === INTERACTION_STATES.DRAG_SELECTED_OBJECT) {
      if (event.pointerId !== interaction.pointerId) return false;
      canvas.releasePointerCapture?.(event.pointerId);
      endObjectDrag(event);
      resetInteraction();
      return true;
    }
    if (interaction.state === INTERACTION_STATES.MARQUEE_SELECTION) {
      if (event.pointerId !== interaction.pointerId) return false;
      finishMarquee(event);
      return true;
    }
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN && event.button === 2) {
      endCameraDrag(event);
      resetInteraction();
      return false;
    }
    return false;
  }

  function onPointerCancel(event) {
    if (interaction.state === INTERACTION_STATES.DRAG_SELECTED_OBJECT) endObjectDrag(event);
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN) endCameraDrag(event);
    canvas.releasePointerCapture?.(interaction.pointerId);
    resetInteraction();
  }

  function onKeyDown(event) {
    const logicalAction = getLogicalKeyboardAction(event);
    if (!logicalAction) return false;
    const delta = logicalActionToDelta(logicalAction, getMoveStep());
    if (!delta) return false;
    if (hasSelection()) {
      setState(INTERACTION_STATES.KEYBOARD_MOVE_SELECTED);
      moveSelectedByDelta(delta);
    } else {
      setState(INTERACTION_STATES.KEYBOARD_MOVE_SCENE);
      moveSceneByDelta(delta);
    }
    setState(INTERACTION_STATES.IDLE);
    return true;
  }

  orbitControls.enabled = true;

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    getState: () => interaction.state,
  };
}
