import { resolveRuntimePath } from './runtime-paths.js';

export const NAVIGATION_CUBE_VIEW_IDS = Object.freeze({
  top: 'top',
  bottom: 'bottom',
  front: 'front',
  back: 'back',
  left: 'left',
  right: 'right',
  home: 'home',
});

export const NAVIGATION_CUBE_RUNTIME_BASE = resolveRuntimePath('ui/navigation-cube');

const NAVIGATION_CUBE_ITEMS_INTERNAL = Object.freeze([
  { id: NAVIGATION_CUBE_VIEW_IDS.top, label: 'TOP', action: 'top', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.bottom, label: 'BOTTOM', action: 'bottom', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.front, label: 'FRONT', action: 'front', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.back, label: 'BACK', action: 'back', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.left, label: 'LEFT', action: 'left', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.right, label: 'RIGHT', action: 'right', kind: 'face' },
  { id: NAVIGATION_CUBE_VIEW_IDS.home, label: 'HOME', action: 'reset_view', kind: 'utility' },
].map((item) => Object.freeze({
  ...item,
  iconPath: `${NAVIGATION_CUBE_RUNTIME_BASE}/view_${item.id}_256.png`,
})));

export const NAVIGATION_CUBE_ITEMS = Object.freeze(NAVIGATION_CUBE_ITEMS_INTERNAL);

export function getNavigationCubeItems() {
  return [...NAVIGATION_CUBE_ITEMS];
}

export function getNavigationCubeItem(itemId) {
  return NAVIGATION_CUBE_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getNavigationCubeIconPath(itemId) {
  const item = typeof itemId === 'string' ? getNavigationCubeItem(itemId) : itemId;
  if (!item) return null;
  return item.iconPath;
}

export function createNavigationCubeViewApi(controller) {
  if (!controller || typeof controller !== 'object') {
    throw new Error('Navigation cube API invalide : contrôleur absent.');
  }
  if (typeof controller.setView !== 'function') {
    throw new Error('Navigation cube API invalide : setView(viewId) manquant.');
  }
  if (typeof controller.resetView !== 'function') {
    throw new Error('Navigation cube API invalide : resetView() manquant.');
  }
  if (typeof controller.getActiveViewId !== 'function') {
    throw new Error('Navigation cube API invalide : getActiveViewId() manquant.');
  }

  return Object.freeze({
    setView(viewId) {
      controller.setView(viewId);
    },
    resetView() {
      controller.resetView();
    },
    getActiveViewId() {
      return controller.getActiveViewId();
    },
    activate(itemId) {
      const item = getNavigationCubeItem(itemId);
      if (!item) throw new Error(`Navigation cube item inconnu : ${itemId}`);
      if (item.id === NAVIGATION_CUBE_VIEW_IDS.home) {
        controller.resetView();
        return;
      }
      controller.setView(item.id);
    },
  });
}
