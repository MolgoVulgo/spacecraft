import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomFaceOperation,
  removeCustomFaceOperationById,
  validateCustomFaceOperation,
} from '../src/3d/editor/editorCustomFaceOperations.js';

function pointMap(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test('a valid draft face becomes a custom_face operation', () => {
  const result = createCustomFaceOperation({
    shapeId: 'shape_1',
    face: {
      id: 'face_p1__p2__p3',
      points: ['p1', 'p2', 'p3'],
      normal: { x: 0, y: 0, z: 1 },
    },
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 1 },
      { id: 'p2', x: 2, y: 0, z: 1 },
      { id: 'p3', x: 1, y: 1, z: 1 },
    ]),
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.type, 'custom_face');
  assert.deepEqual(result.operation.point_ids, ['p1', 'p2', 'p3']);
  assert.equal(result.operation.points.length, 3);
});

test('invalid custom_face operation is rejected by validation', () => {
  const report = validateCustomFaceOperation({
    type: 'custom_face',
    points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }],
    scope: { kind: 'custom_face' },
  }, { dimensions: { length: 4, width: 3, height: 1 } });

  assert.equal(report.valid, false);
  assert.ok(report.errors.includes('au moins 3 points requis'));
});

test('custom_face operation removal keeps unrelated operations', () => {
  const remaining = removeCustomFaceOperationById([
    { id: 'custom_face_a', type: 'custom_face' },
    { id: 'round_a', type: 'round' },
  ], 'custom_face_a');

  assert.deepEqual(remaining.map((operation) => operation.id), ['round_a']);
});
