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

test('advanced mesh builds a geometry smaller than the logical base box', () => {
  const geometry = buildShapeGeometry({
    shape: {
      generation: {
        mode: 'advanced_mesh',
        base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
        visual_mesh: {
          grid_step: 0.5,
          vertices: [
            { id: 'v001', x: 0, y: 0, z: 0 },
            { id: 'v002', x: 4, y: 0, z: 0 },
            { id: 'v003', x: 4, y: 2, z: 0 },
            { id: 'v004', x: 0, y: 2, z: 0 },
            { id: 'v005', x: 0, y: 0, z: 1 },
            { id: 'v006', x: 4, y: 0, z: 1 },
            { id: 'v007', x: 4, y: 2, z: 1 },
            { id: 'v008', x: 0, y: 2, z: 1 },
          ],
          faces: [
            { id: 'f001', vertices: ['v001', 'v002', 'v003', 'v004'] },
            { id: 'f002', vertices: ['v005', 'v008', 'v007', 'v006'] },
            { id: 'f003', vertices: ['v001', 'v005', 'v006', 'v002'] },
            { id: 'f004', vertices: ['v002', 'v006', 'v007', 'v003'] },
            { id: 'f005', vertices: ['v003', 'v007', 'v008', 'v004'] },
            { id: 'f006', vertices: ['v004', 'v008', 'v005', 'v001'] },
          ],
        },
      },
      collision: { mode: 'base_box' },
    },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(sizeOf(geometry), { x: 200, y: 400, z: 100 });
  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 50, y: 200, z: 100 },
  });
});

test('advanced mesh triangulates quad faces', () => {
  const geometry = buildShapeGeometry({
    shape: {
      generation: {
        mode: 'advanced_mesh',
        base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
        visual_mesh: {
          grid_step: 0.5,
          vertices: [
            { id: 'v001', x: 0, y: 0, z: 0 },
            { id: 'v002', x: 4, y: 0, z: 0 },
            { id: 'v003', x: 4, y: 3, z: 0 },
            { id: 'v004', x: 0, y: 3, z: 0 },
          ],
          faces: [{ id: 'f001', vertices: ['v001', 'v002', 'v003', 'v004'] }],
        },
      },
      collision: { mode: 'base_box' },
    },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.equal(geometry.index.count, 6);
});

test('advanced mesh height symmetry preserves bounding dimensions', () => {
  const geometry = buildShapeGeometry({
    shape: {
      generation: {
        mode: 'advanced_mesh',
        base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
        visual_mesh: {
          grid_step: 0.5,
          vertices: [
            { id: 'v001', x: 0, y: 0, z: 0 },
            { id: 'v002', x: 4, y: 0, z: 0 },
            { id: 'v003', x: 4, y: 2, z: 0 },
            { id: 'v004', x: 0, y: 2, z: 0 },
            { id: 'v005', x: 0, y: 0, z: 1 },
            { id: 'v006', x: 4, y: 0, z: 1 },
            { id: 'v007', x: 4, y: 2, z: 1 },
            { id: 'v008', x: 0, y: 2, z: 1 },
          ],
          faces: [
            { id: 'f001', vertices: ['v001', 'v002', 'v003', 'v004'] },
            { id: 'f002', vertices: ['v005', 'v008', 'v007', 'v006'] },
          ],
        },
      },
      collision: { mode: 'base_box' },
    },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
    symmetry: { height: true },
  });

  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 50, y: 200, z: 100 },
  });
});

test('custom_face operation is added to generated geometry', () => {
  const geometry = buildShapeGeometry({
    shape: {
      generation: {
        mode: 'voxel_grid',
        operations: [{
          id: 'custom_face_p1__p2__p3',
          type: 'custom_face',
          scope: { kind: 'custom_face' },
          points: [
            { x: 0, y: 0, z: 1 },
            { x: 4, y: 0, z: 1 },
            { x: 2, y: 1.5, z: 0.5 },
          ],
        }],
      },
    },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.ok(geometry.index.count > 36);
  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 0 },
    max: { x: 150, y: 200, z: 100 },
  });
});

test('cut operation clips the generated geometry and keeps it closed', () => {
  const geometry = buildShapeGeometry({
    shape: {
      generation: {
        mode: 'voxel_grid',
        operations: [{
          id: 'cut_top',
          type: 'cut',
          scope: { kind: 'cut' },
          keep_side: 'inverse',
          points: [
            { x: 0, y: 0, z: 0.5 },
            { x: 4, y: 0, z: 0.5 },
            { x: 0, y: 3, z: 0.5 },
          ],
        }],
      },
    },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(boundsOf(geometry), {
    min: { x: -150, y: -200, z: 50 },
    max: { x: 150, y: 200, z: 100 },
  });
  assert.ok(geometry.index.count > 0);
});
