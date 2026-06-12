import * as THREE from 'three';

export { catalogCellCenterVector, catalogPointVector, createCatalogReservationBox } from './meshGeneration.js';

export function getGeometryBounds(geometry) {
  if (!geometry?.boundingBox) geometry?.computeBoundingBox?.();
  return geometry?.boundingBox ?? null;
}

export function getGeometrySize(geometry) {
  const bounds = getGeometryBounds(geometry);
  return bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3();
}
