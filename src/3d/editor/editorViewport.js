import * as THREE from 'three';

export function getEditorPreviewTargetZ(size, scale) {
  return ((Number(size?.dimensions?.height) || 1) * scale) / 2;
}

export function getEditorPreviewDistance(size, scale, minimumDistance = 180) {
  const dimensions = size?.dimensions ?? {};
  const maxSize = Math.max(
    Number(dimensions.length) || 0,
    Number(dimensions.width) || 0,
    Number(dimensions.height) || 0,
  ) * scale;
  return Math.max(minimumDistance, maxSize * 2.4);
}

export function createEditorFitPreviewPlan(size, scale) {
  return {
    target: new THREE.Vector3(0, 0, getEditorPreviewTargetZ(size, scale)),
    distance: getEditorPreviewDistance(size, scale),
  };
}
