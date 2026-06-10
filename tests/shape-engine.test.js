import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildShapeGeometry } from '../src/shape-engine.js';

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

function sizeOf(geometry) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  return {
    x: rounded(size.x),
    y: rounded(size.y),
    z: rounded(size.z),
  };
}

test('box geometry keeps declared bounding box dimensions', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(sizeOf(geometry), { x: 300, y: 400, z: 100 });
});

test('width symmetry preserves the same bounding box', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
    symmetry: { width: true, length: false, height: false },
  });

  assert.deepEqual(sizeOf(geometry), { x: 300, y: 400, z: 100 });
});
