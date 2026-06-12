import { isClickGesture } from './editor-interaction-state.js';

export const EDITOR_INTERACTION_STATES = {
  IDLE: 'IDLE',
  LEFT_DOWN_PENDING: 'LEFT_DOWN_PENDING',
  VIEWPORT_PAN: 'VIEWPORT_PAN',
  RIGHT_DOWN_PENDING: 'RIGHT_DOWN_PENDING',
  CAMERA_DRAG: 'CAMERA_DRAG',
  CONTEXT_MENU_OPEN: 'CONTEXT_MENU_OPEN',
};

function getPointInElement(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function createEditorInteractionController(options) {
  const {
    canvas,
    viewportStage,
    orbitControls,
    isBlockedTarget = () => false,
    pickPrimitive,
    selectPrimitive,
    togglePrimitive,
    clearPrimitiveSelection,
    getSelectionState,
    beginViewportPan,
    updateViewportPan,
    endViewportPan,
    beginCameraDrag,
    updateCameraDrag,
    endCameraDrag,
    openContextMenu,
    closeContextMenu,
    getContextActions,
    getUserSettings = () => ({}),
  } = options;

  if (orbitControls?.mouseButtons) {
    orbitControls.mouseButtons.LEFT = null;
    orbitControls.mouseButtons.RIGHT = null;
  }

  const interaction = {
    state: EDITOR_INTERACTION_STATES.IDLE,
    pointerId: null,
    startPoint: null,
    lastPoint: null,
    startPrimitive: null,
    hoveredPrimitive: null,
    menuOpen: false,
  };

  function setState(nextState) {
    interaction.state = nextState;
  }

  function capturePointer(event) {
    interaction.pointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function releasePointer() {
    if (interaction.pointerId == null) return;
    canvas.releasePointerCapture?.(interaction.pointerId);
    interaction.pointerId = null;
  }

  function resetPointerState() {
    interaction.startPoint = null;
    interaction.lastPoint = null;
    interaction.startPrimitive = null;
    if (interaction.menuOpen) setState(EDITOR_INTERACTION_STATES.CONTEXT_MENU_OPEN);
    else setState(EDITOR_INTERACTION_STATES.IDLE);
  }

  function fullReset() {
    releasePointer();
    interaction.startPoint = null;
    interaction.lastPoint = null;
    interaction.startPrimitive = null;
    if (interaction.menuOpen) setState(EDITOR_INTERACTION_STATES.CONTEXT_MENU_OPEN);
    else setState(EDITOR_INTERACTION_STATES.IDLE);
  }

  function currentPoint(event) {
    return getPointInElement(event, viewportStage ?? canvas);
  }

  function updateHoveredPrimitive(event) {
    interaction.hoveredPrimitive = pickPrimitive?.(event) ?? null;
    return interaction.hoveredPrimitive;
  }

  function openMenuForEvent(event, hoveredPrimitive) {
    const selection = getSelectionState?.() ?? null;
    let hovered = hoveredPrimitive ?? updateHoveredPrimitive(event);
    let actions = getContextActions?.(selection, hovered) ?? [];
    const hasSelection = Boolean(
      selection
      && ((selection.points?.size ?? 0)
        || (selection.lines?.size ?? 0)
        || (selection.edges?.size ?? 0)
        || (selection.faces?.size ?? 0)),
    );

    if (!actions.length && !hasSelection && hovered) {
      selectPrimitive?.(hovered, { preserveMenu: true });
      const nextSelection = getSelectionState?.() ?? null;
      actions = getContextActions?.(nextSelection, hovered) ?? [];
    }

    if (!actions.length) {
      interaction.menuOpen = false;
      closeContextMenu?.();
      setState(EDITOR_INTERACTION_STATES.IDLE);
      return;
    }

    openContextMenu?.({
      clientX: event.clientX,
      clientY: event.clientY,
      viewportStage,
      actions,
      selection: getSelectionState?.() ?? null,
      hovered,
    });
    interaction.menuOpen = true;
    setState(EDITOR_INTERACTION_STATES.CONTEXT_MENU_OPEN);
  }

  function onPointerDown(event) {
    if (isBlockedTarget(event.target)) return;
    canvas.focus?.({ preventScroll: true });

    if (event.button === 0) {
      closeContextMenu?.();
      interaction.menuOpen = false;
      interaction.startPrimitive = pickPrimitive?.(event) ?? null;
      interaction.startPoint = currentPoint(event);
      interaction.lastPoint = interaction.startPoint;
      capturePointer(event);
      setState(EDITOR_INTERACTION_STATES.LEFT_DOWN_PENDING);
      return;
    }

    if (event.button === 2) {
      interaction.startPrimitive = pickPrimitive?.(event) ?? null;
      interaction.startPoint = currentPoint(event);
      interaction.lastPoint = interaction.startPoint;
      capturePointer(event);
      setState(EDITOR_INTERACTION_STATES.RIGHT_DOWN_PENDING);
    }
  }

  function onPointerMove(event) {
    if (interaction.state === EDITOR_INTERACTION_STATES.IDLE || interaction.state === EDITOR_INTERACTION_STATES.CONTEXT_MENU_OPEN) {
      updateHoveredPrimitive(event);
      return;
    }

    const point = currentPoint(event);
    interaction.lastPoint = point;

    if (interaction.state === EDITOR_INTERACTION_STATES.LEFT_DOWN_PENDING) {
      if (!isClickGesture(interaction.startPoint, point)) {
        if (!interaction.startPrimitive) {
          closeContextMenu?.();
          interaction.menuOpen = false;
          beginViewportPan?.(event, { startPoint: interaction.startPoint, currentPoint: point });
          setState(EDITOR_INTERACTION_STATES.VIEWPORT_PAN);
          return;
        }
        fullReset();
      }
      return;
    }

    if (interaction.state === EDITOR_INTERACTION_STATES.RIGHT_DOWN_PENDING) {
      if (!isClickGesture(interaction.startPoint, point)) {
        closeContextMenu?.();
        interaction.menuOpen = false;
        beginCameraDrag?.(event, {
          startPoint: interaction.startPoint,
          currentPoint: point,
          settings: getUserSettings?.(),
        });
        setState(EDITOR_INTERACTION_STATES.CAMERA_DRAG);
      }
      return;
    }

    if (interaction.state === EDITOR_INTERACTION_STATES.VIEWPORT_PAN) {
      updateViewportPan?.(event, { startPoint: interaction.startPoint, currentPoint: point });
      return;
    }

    if (interaction.state === EDITOR_INTERACTION_STATES.CAMERA_DRAG) {
      updateCameraDrag?.(event, {
        startPoint: interaction.startPoint,
        currentPoint: point,
        settings: getUserSettings?.(),
      });
    }
  }

  function onPointerUp(event) {
    const point = currentPoint(event);

    if (event.button === 0 && interaction.state === EDITOR_INTERACTION_STATES.LEFT_DOWN_PENDING) {
      if (isClickGesture(interaction.startPoint, point) && interaction.startPrimitive) {
        if (event.shiftKey) togglePrimitive?.(interaction.startPrimitive);
        else selectPrimitive?.(interaction.startPrimitive);
      }
      fullReset();
      return;
    }

    if (event.button === 0 && interaction.state === EDITOR_INTERACTION_STATES.VIEWPORT_PAN) {
      endViewportPan?.(event, { startPoint: interaction.startPoint, currentPoint: point });
      fullReset();
      return;
    }

    if (event.button === 2 && interaction.state === EDITOR_INTERACTION_STATES.RIGHT_DOWN_PENDING) {
      openMenuForEvent(event, interaction.startPrimitive);
      releasePointer();
      interaction.startPoint = null;
      interaction.lastPoint = null;
      interaction.startPrimitive = null;
      return;
    }

    if (event.button === 2 && interaction.state === EDITOR_INTERACTION_STATES.CAMERA_DRAG) {
      endCameraDrag?.(event, { startPoint: interaction.startPoint, currentPoint: point });
      fullReset();
    }
  }

  function onPointerCancel(event) {
    if (interaction.state === EDITOR_INTERACTION_STATES.VIEWPORT_PAN) endViewportPan?.(event, { cancelled: true });
    if (interaction.state === EDITOR_INTERACTION_STATES.CAMERA_DRAG) endCameraDrag?.(event, { cancelled: true });
    fullReset();
  }

  function onLostPointerCapture(event) {
    if (interaction.pointerId != null && event.pointerId !== interaction.pointerId) return;
    if (interaction.state === EDITOR_INTERACTION_STATES.VIEWPORT_PAN) endViewportPan?.(event, { cancelled: true });
    if (interaction.state === EDITOR_INTERACTION_STATES.CAMERA_DRAG) endCameraDrag?.(event, { cancelled: true });
    fullReset();
  }

  function onCanvasContextMenu(event) {
    event.preventDefault();
  }

  function onDocumentPointerDown(event) {
    if (!interaction.menuOpen) return;
    if (canvas.contains(event.target)) return;
    if (event.target?.closest?.('.editor-context-menu')) return;
    closeContextMenu?.();
    interaction.menuOpen = false;
    setState(EDITOR_INTERACTION_STATES.IDLE);
  }

  function onDocumentKeyDown(event) {
    if (event.key !== 'Escape' || !interaction.menuOpen) return;
    closeContextMenu?.();
    interaction.menuOpen = false;
    setState(EDITOR_INTERACTION_STATES.IDLE);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onLostPointerCapture);
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onDocumentKeyDown, true);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
      canvas.removeEventListener('contextmenu', onCanvasContextMenu);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('keydown', onDocumentKeyDown, true);
    },
    syncSettings() {},
    clearSelection() {
      clearPrimitiveSelection?.();
      closeContextMenu?.();
      interaction.menuOpen = false;
      setState(EDITOR_INTERACTION_STATES.IDLE);
    },
    closeContextMenu() {
      closeContextMenu?.();
      interaction.menuOpen = false;
      setState(EDITOR_INTERACTION_STATES.IDLE);
    },
    getSelectionState() {
      return getSelectionState?.() ?? null;
    },
  };
}
