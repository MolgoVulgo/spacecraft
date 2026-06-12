import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCutOperation,
  validateCutOperation,
} from '../src/3d/editor/editorCutOperations.js';

function pointMap(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test('a valid draft face becomes a cut operation', () => {
  const result = createCutOperation({
    shapeId: 'shape_1',
    face: {
      id: 'face_p1__p2__p3',
      points: ['p1', 'p2', 'p3'],
      normal: { x: 0, y: 0, z: 1 },
    },
    pointMap: pointMap([
      { id: 'p1', x: 0, y: 0, z: 1 },
      { id: 'p2', x: 4, y: 0, z: 1 },
      { id: 'p3', x: 2, y: 1.5, z: 0.5 },
    ]),
    keepSide: 'inverse',
  });

  assert.equal(result.created, true);
  assert.equal(result.operation.type, 'cut');
  assert.equal(result.operation.keep_side, 'inverse');
});

test('invalid cut operation is rejected by validation', () => {
  const report = validateCutOperation({
    type: 'cut',
    points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
    keep_side: 'bad',
    scope: { kind: 'cut' },
  }, { dimensions: { length: 4, width: 3, height: 1 } });

  assert.equal(report.valid, false);
  assert.ok(report.errors.includes('au moins 3 points requis'));
  assert.ok(report.errors.includes('keep_side invalide'));
});
