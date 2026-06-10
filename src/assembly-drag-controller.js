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

function getKeyboardCharacterBindings(config) {
  const layout = config?.keyboardLayout ?? 'auto';
  if (layout === 'azerty') {
    return {
      z: LOGICAL_ACTIONS.FORWARD_DEPTH,
      s: LOGICAL_ACTIONS.BACKWARD_DEPTH,
      q: LOGICAL_ACTIONS.LEFT_HORIZONTAL,
      d: LOGICAL_ACTIONS.RIGHT_HORIZONTAL,
      e: LOGICAL_ACTIONS.UP_VERTICAL,
      a: LOGICAL_ACTIONS.DOWN_VERTICAL,
    };
  }
  return {
    w: LOGICAL_ACTIONS.FORWARD_DEPTH,
    s: LOGICAL_ACTIONS.BACKWARD_DEPTH,
    a: LOGICAL_ACTIONS.LEFT_HORIZONTAL,
    d: LOGICAL_ACTIONS.RIGHT_HORIZONTAL,
    e: LOGICAL_ACTIONS.UP_VERTICAL,
    q: LOGICAL_ACTIONS.DOWN_VERTICAL,
  };
}

function getLogicalKeyboardAction(event, config = {}) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const bindings = config.bindings ?? {};
  const codeMap = {
    [bindings.moveForward ?? 'KeyW']: LOGICAL_ACTIONS.FORWARD_DEPTH,
    [bindings.moveBackward ?? 'KeyS']: LOGICAL_ACTIONS.BACKWARD_DEPTH,
    [bindings.moveLeft ?? 'KeyA']: LOGICAL_ACTIONS.LEFT_HORIZONTAL,
    [bindings.moveRight ?? 'KeyD']: LOGICAL_ACTIONS.RIGHT_HORIZONTAL,
    [bindings.moveUp ?? 'KeyE']: LOGICAL_ACTIONS.UP_VERTICAL,
    [bindings.moveDown ?? 'KeyQ']: LOGICAL_ACTIONS.DOWN_VERTICAL,
  };
  if ((config.keyboardInputMode ?? 'physical') === 'physical' && codeMap[event.code]) return codeMap[event.code];

  const key = String(event.key ?? '').toLowerCase();
  const keyMap = getKeyboardCharacterBindings(config);
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

function scaleSceneDelta(delta, action, config = {}) {
  const next = delta.clone();
  const panScale = Number.isFinite(config.panSensitivity) ? config.panSensitivity : 1;
  const depthScale = Number.isFinite(config.depthSensitivity) ? config.depthSensitivity : 1;
  if (action === LOGICAL_ACTIONS.FORWARD_DEPTH || action === LOGICAL_ACTIONS.BACKWARD_DEPTH) {
    next.multiplyScalar(depthScale);
    return next;
  }
  next.multiplyScalar(panScale);
  return next;
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
    updateCameraDrag,
    endCameraDrag,
    collectMarqueeSelection,
    moveSelectedByDelta,
    moveSceneByDelta,
    getMoveStep,
    getKeyboardConfig = () => ({}),
    getCameraOrbitTarget = () => null,
  } = options;

  const marqueeElement = createMarqueeElement(viewportStage);
  const interaction = {
    state: INTERACTION_STATES.IDLE,
    pointerId: null,
    startPoint: null,
    lastPoint: null,
    currentRect: null,
    cameraMode: null,
  };

  function setState(nextState) {
    interaction.state = nextState;
  }

  function resetInteraction() {
    interaction.pointerId = null;
    interaction.startPoint = null;
    interaction.lastPoint = null;
    interaction.currentRect = null;
    interaction.cameraMode = null;
    hideMarqueeElement(marqueeElement);
    setState(INTERACTION_STATES.IDLE);
  }

  function releaseCapturedPointer(pointerId = interaction.pointerId) {
    if (pointerId == null) return;
    canvas.releasePointerCapture?.(pointerId);
  }

  function cancelCurrentInteraction(event) {
    if (interaction.state === INTERACTION_STATES.DRAG_SELECTED_OBJECT) endObjectDrag(event);
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN) endCameraDrag(event);
    releaseCapturedPointer();
    resetInteraction();
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
    releaseCapturedPointer(event.pointerId);
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
    const cameraConfig = getKeyboardConfig();
    const rightMouseMode = cameraConfig?.rightMouseMode ?? 'moveScene';
    interaction.pointerId = event.pointerId;
    interaction.startPoint = getPointInContainer(event, viewportStage);
    interaction.lastPoint = interaction.startPoint;
    interaction.cameraMode = rightMouseMode;
    canvas.setPointerCapture?.(event.pointerId);
    beginCameraDrag(event, {
      mode: rightMouseMode === 'orbitCamera' ? 'orbit' : 'moveScene',
      target: rightMouseMode === 'orbitCamera' ? getCameraOrbitTarget() : null,
    });
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
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN) {
      if (event.pointerId !== interaction.pointerId) return false;
      if (interaction.cameraMode === 'moveScene') {
        const point = getPointInContainer(event, viewportStage);
        const delta = {
          x: point.x - interaction.lastPoint.x,
          y: point.y - interaction.lastPoint.y,
        };
        interaction.lastPoint = point;
        updateCameraDrag(event, {
          mode: 'moveScene',
          delta,
          config: getKeyboardConfig(),
        });
        return true;
      }
      return false;
    }

    const selectable = pickSelectable(event);
    setState(selectable ? INTERACTION_STATES.HOVER_PIECE_OR_GROUP : INTERACTION_STATES.IDLE);
    return false;
  }

  function onPointerUp(event) {
    if (interaction.state === INTERACTION_STATES.DRAG_SELECTED_OBJECT) {
      if (event.pointerId !== interaction.pointerId) return false;
      releaseCapturedPointer(event.pointerId);
      endObjectDrag(event);
      resetInteraction();
      return true;
    }
    if (interaction.state === INTERACTION_STATES.MARQUEE_SELECTION) {
      if (event.pointerId !== interaction.pointerId) return false;
      finishMarquee(event);
      return true;
    }
    if (interaction.state === INTERACTION_STATES.CAMERA_ROTATE_OR_PAN && event.pointerId === interaction.pointerId) {
      releaseCapturedPointer(event.pointerId);
      endCameraDrag(event);
      resetInteraction();
      return false;
    }
    return false;
  }

  function onPointerCancel(event) {
    cancelCurrentInteraction(event);
  }

  function onWindowBlur() {
    cancelCurrentInteraction({ type: 'blur' });
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') cancelCurrentInteraction({ type: 'visibilitychange' });
  }

  function onKeyDown(event) {
    const keyboardConfig = getKeyboardConfig();
    const logicalAction = getLogicalKeyboardAction(event, keyboardConfig);
    if (!logicalAction) return false;
    const delta = logicalActionToDelta(logicalAction, getMoveStep());
    if (!delta) return false;
    if (hasSelection()) {
      setState(INTERACTION_STATES.KEYBOARD_MOVE_SELECTED);
      moveSelectedByDelta(delta);
    } else {
      setState(INTERACTION_STATES.KEYBOARD_MOVE_SCENE);
      moveSceneByDelta(scaleSceneDelta(delta, logicalAction, keyboardConfig));
    }
    setState(INTERACTION_STATES.IDLE);
    return true;
  }

  orbitControls.enabled = true;
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    getState: () => interaction.state,
    destroy() {
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelCurrentInteraction({ type: 'destroy' });
    },
  };
}
