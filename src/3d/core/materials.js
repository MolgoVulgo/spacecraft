import * as THREE from 'three';

export function createDoubleSidedColorMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
  });
}
