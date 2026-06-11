import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildShapeGeometry, createCatalogReservationBox } from '../src/shape-engine.js';

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

function boundsOf(geometry) {
  geometry.computeBoundingBox();
  return {
    min: {
      x: rounded(geometry.boundingBox.min.x),
      y: rounded(geometry.boundingBox.min.y),
      z: rounded(geometry.boundingBox.min.z),
    },
    max: {
      x: rounded(geometry.boundingBox.max.x),
      y: rounded(geometry.boundingBox.max.y),
      z: rounded(geometry.boundingBox.max.z),
    },
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

test('box geometry uses the bottom face as Z origin', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 150, y: 200, z: 100 },
  });
});

test('reservation box uses the bottom face as Z origin', () => {
  const box = createCatalogReservationBox({ dimensions: { length: 4, width: 3, height: 1 } }, 100, new THREE.Vector3());

  assert.deepEqual({
    min: { x: rounded(box.min.x), y: rounded(box.min.y), z: rounded(box.min.z) },
    max: { x: rounded(box.max.x), y: rounded(box.max.y), z: rounded(box.max.z) },
  }, {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 150, y: 200, z: 100 },
  });
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

test('height symmetry preserves the bottom anchored bounding box', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
    symmetry: { width: false, length: false, height: true },
  });

  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 150, y: 200, z: 100 },
  });
});
