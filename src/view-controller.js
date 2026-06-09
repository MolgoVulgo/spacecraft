import * as THREE from 'three';
import { NAVIGATION_CUBE_VIEW_IDS } from './navigation-cube.js';

export const LEGACY_ASSEMBLY_SIDE_VIEW_ID = 'side';

const DEFAULT_EDITOR_HOME_DIRECTION = Object.freeze([0.8, -1, 0.75]);

export function normalizeViewId(viewId) {
  if (viewId === LEGACY_ASSEMBLY_SIDE_VIEW_ID) return NAVIGATION_CUBE_VIEW_IDS.right;
  if (Object.values(NAVIGATION_CUBE_VIEW_IDS).includes(viewId)) return viewId;
  return NAVIGATION_CUBE_VIEW_IDS.top;
}

export function getAssemblyProjectionPlane(viewId) {
  const normalized = normalizeViewId(viewId);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.front || normalized === NAVIGATION_CUBE_VIEW_IDS.back) return 'xz';
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.left || normalized === NAVIGATION_CUBE_VIEW_IDS.right) return 'yz';
  return 'xy';
}

export function getLegacyAssemblyButtonViewId(viewId) {
  const normalized = normalizeViewId(viewId);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.front || normalized === NAVIGATION_CUBE_VIEW_IDS.back) return NAVIGATION_CUBE_VIEW_IDS.front;
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.left || normalized === NAVIGATION_CUBE_VIEW_IDS.right) return LEGACY_ASSEMBLY_SIDE_VIEW_ID;
  return NAVIGATION_CUBE_VIEW_IDS.top;
}

export function getViewDirectionVector(viewId, options = {}) {
  const normalized = normalizeViewId(viewId);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.front) return new THREE.Vector3(0, -1, 0);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.back) return new THREE.Vector3(0, 1, 0);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.left) return new THREE.Vector3(-1, 0, 0);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.right) return new THREE.Vector3(1, 0, 0);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.bottom) return new THREE.Vector3(0, 0, -1);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.home) {
    const homeDirection = options.homeDirection ?? DEFAULT_EDITOR_HOME_DIRECTION;
    return new THREE.Vector3(...homeDirection).normalize();
  }
  return new THREE.Vector3(0, 0, 1);
}

export function getViewUpVector(viewId) {
  const normalized = normalizeViewId(viewId);
  if (normalized === NAVIGATION_CUBE_VIEW_IDS.top || normalized === NAVIGATION_CUBE_VIEW_IDS.bottom) {
    return new THREE.Vector3(0, 1, 0);
  }
  return new THREE.Vector3(0, 0, 1);
}

export function applyCanonicalViewToCamera(camera, target, distance, viewId, options = {}) {
  const normalized = normalizeViewId(viewId);
  const direction = getViewDirectionVector(normalized, options);
  const up = getViewUpVector(normalized, options);
  camera.position.copy(target.clone().add(direction.multiplyScalar(distance)));
  camera.up.copy(up);
  camera.lookAt(target);
  return normalized;
}

export function createAssemblyViewController(options) {
  const {
    camera,
    orbitControls,
    getTarget,
    getActiveViewId,
    setActiveViewId,
    fitView,
    updateAfterViewChange,
    updateProjection,
    distance = 1200,
    resetViewId = NAVIGATION_CUBE_VIEW_IDS.top,
  } = options ?? {};

  let activeViewId = normalizeViewId(getActiveViewId?.() ?? resetViewId);

  const syncActiveView = (nextViewId) => {
    activeViewId = normalizeViewId(nextViewId);
    setActiveViewId?.(activeViewId);
    return activeViewId;
  };

  const applyToTarget = (target, viewId = activeViewId) => {
    const normalized = syncActiveView(viewId);
    applyCanonicalViewToCamera(camera, target, distance, normalized);
    updateProjection?.();
    orbitControls.update();
    updateAfterViewChange?.(normalized);
    return normalized;
  };

  return Object.freeze({
    setView(viewId, fit = true) {
      const target = getTarget?.() ?? new THREE.Vector3(0, 0, 0);
      const normalized = applyToTarget(target, viewId);
      if (fit) fitView?.(normalized);
      return normalized;
    },
    resetView(fit = true) {
      return this.setView(resetViewId, fit);
    },
    getActiveViewId() {
      return normalizeViewId(getActiveViewId?.() ?? activeViewId);
    },
    positionCameraForTarget(target) {
      return applyToTarget(target, this.getActiveViewId());
    },
  });
}

export function createEditorViewController(options) {
  const {
    camera,
    orbitControls,
    getTarget,
    setActiveViewId,
    getActiveViewId,
    defaultHomeDirection = DEFAULT_EDITOR_HOME_DIRECTION,
    defaultHomeDistance = 387,
  } = options ?? {};

  let activeViewId = normalizeViewId(getActiveViewId?.() ?? NAVIGATION_CUBE_VIEW_IDS.home);

  const syncActiveView = (nextViewId) => {
    activeViewId = nextViewId === NAVIGATION_CUBE_VIEW_IDS.home
      ? NAVIGATION_CUBE_VIEW_IDS.home
      : normalizeViewId(nextViewId);
    setActiveViewId?.(activeViewId);
    return activeViewId;
  };

  return Object.freeze({
    setView(viewId, viewOptions = {}) {
      const normalized = syncActiveView(viewId);
      const target = viewOptions.target ?? getTarget?.() ?? new THREE.Vector3(0, 0, 0);
      const distance = viewOptions.distance ?? defaultHomeDistance;
      applyCanonicalViewToCamera(camera, target, distance, normalized, {
        homeDirection: defaultHomeDirection,
      });
      camera.near = Math.max(distance / 100, 0.1);
      camera.far = Math.max(distance * 50, 5000);
      camera.updateProjectionMatrix();
      orbitControls.target.copy(target);
      orbitControls.update();
      return normalized;
    },
    resetView(viewOptions = {}) {
      return this.setView(NAVIGATION_CUBE_VIEW_IDS.home, viewOptions);
    },
    getActiveViewId() {
      return getActiveViewId?.() ?? activeViewId;
    },
  });
}
