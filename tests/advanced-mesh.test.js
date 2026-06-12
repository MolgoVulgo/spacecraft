import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addAdvancedMeshVertex,
  createAdvancedMeshFace,
  createDefaultAdvancedMesh,
  deleteAdvancedMeshVertex,
  ensureAdvancedMeshGeneration,
  updateAdvancedMeshVertex,
  validateAdvancedMeshDefinition,
} from '../src/advanced-mesh.js';

function createShape() {
  return {
    id: 'shape_test',
    size_id: '4x3x1',
    generation: {
      mode: 'advanced_mesh',
      base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
      visual_mesh: { grid_step: 0.5, vertices: [], faces: [] },
    },
    collision: { mode: 'base_box' },
    anchors: [],
  };
}

const size = { id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } };

test('add advanced vertex snaps to grid', () => {
  const shape = createShape();
  shape.generation.visual_mesh = { grid_step: 0.5, vertices: [], faces: [] };
  const result = addAdvancedMeshVertex(shape, size, { x: 0.26, y: 1.24, z: 0.74 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.vertex, { id: 'v001', x: 0.5, y: 1, z: 0.5 });
});

test('add advanced vertex outside base is rejected', () => {
  const shape = createShape();
  shape.generation.visual_mesh = { grid_step: 0.5, vertices: [], faces: [] };
  const result = addAdvancedMeshVertex(shape, size, { x: 4.5, y: 0, z: 0 });

  assert.equal(result.ok, false);
  assert.match(result.error, /hors baseBox/);
});

test('move advanced vertex outside base is rejected', () => {
  const shape = createShape();
  shape.generation.visual_mesh = createDefaultAdvancedMesh(size);
  ensureAdvancedMeshGeneration(shape, size);
  const result = updateAdvancedMeshVertex(shape, size, 'v001', { x: -0.5, y: 0, z: 0 });

  assert.equal(result.ok, false);
  assert.match(result.error, /hors baseBox/);
});

test('create face requires at least 3 selected vertices', () => {
  const shape = createShape();
  ensureAdvancedMeshGeneration(shape, size);
  const result = createAdvancedMeshFace(shape, size, ['v001', 'v002']);

  assert.equal(result.ok, false);
  assert.match(result.error, /au moins 3/);
});

test('delete used vertex is rejected', () => {
  const shape = createShape();
  shape.generation.visual_mesh = createDefaultAdvancedMesh(size);
  ensureAdvancedMeshGeneration(shape, size);
  const result = deleteAdvancedMeshVertex(shape, size, 'v001');

  assert.equal(result.ok, false);
  assert.match(result.error, /utilisé/);
});

test('advanced mesh validation accepts a minimal valid mesh', () => {
  const shape = createShape();
  ensureAdvancedMeshGeneration(shape, size);
  shape.generation.visual_mesh = {
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
  };

  const report = validateAdvancedMeshDefinition({ shape, size, collisionMode: 'base_box' });

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});
