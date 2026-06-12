import { catalogPointVector } from './meshGeneration.js';

export function catalogAnchorToWorld(position, dimensions, scale = 100) {
  return catalogPointVector(position ?? { x: 0, y: 0, z: 0 }, dimensions, scale);
}

export function isSixFacePlaceholderAnchorSet(anchors = []) {
  if (anchors.length !== 6) return false;
  return anchors.every((anchor) => /^anchor_(length|width|height)_(min|max)$/.test(String(anchor.id ?? '')));
}

export function generateHalfStepFaceAnchors(size = {}) {
  const length = Number(size.length) || 1;
  const width = Number(size.width) || 1;
  const height = Number(size.height) || 1;
  const anchors = [];

  const values = (max) => {
    const result = [];
    for (let value = 0.25; value < max - 1e-9; value += 0.5) result.push(Number(value.toFixed(3)));
    return result.length ? result : [max / 2];
  };

  const xs = values(length);
  const ys = values(width);
  const zs = values(height);
  const push = (id, position, normal, face) => anchors.push({ id, position, normal, face, type: 'standard', enabled: true, status: 'generated' });

  for (const y of ys) for (const z of zs) {
    push(`anchor_length_min_${y}_${z}`, { x: 0, y, z }, { x: -1, y: 0, z: 0 }, 'length_min');
    push(`anchor_length_max_${y}_${z}`, { x: length, y, z }, { x: 1, y: 0, z: 0 }, 'length_max');
  }
  for (const x of xs) for (const z of zs) {
    push(`anchor_width_min_${x}_${z}`, { x, y: 0, z }, { x: 0, y: -1, z: 0 }, 'width_min');
    push(`anchor_width_max_${x}_${z}`, { x, y: width, z }, { x: 0, y: 1, z: 0 }, 'width_max');
  }
  for (const x of xs) for (const y of ys) {
    push(`anchor_height_min_${x}_${y}`, { x, y, z: 0 }, { x: 0, y: 0, z: -1 }, 'height_min');
    push(`anchor_height_max_${x}_${y}`, { x, y, z: height }, { x, y, z: 1 }, 'height_max');
  }

  return anchors;
}

export function getEffectiveAttachmentAnchors(shape, size) {
  const anchors = (shape?.anchors ?? []).filter((anchor) => anchor.enabled !== false);
  if (!anchors.length) return [];
  if (isSixFacePlaceholderAnchorSet(anchors)) return generateHalfStepFaceAnchors(size);
  return anchors;
}
