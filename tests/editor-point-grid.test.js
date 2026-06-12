import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateEditorPointGrid,
  isEditorPointWithinBounds,
  summarizeEditorPointGrid,
} from '../src/3d/editor/editorPointGrid.js';

test('4x3x1 generates the expected 0.5 point grid count', () => {
  const points = generateEditorPointGrid({ dimensions: { length: 4, width: 3, height: 1 } }, 0.5);
  assert.equal(points.length, 189);
});

test('6x3x1 generates more points than 4x3x1', () => {
  const small = generateEditorPointGrid({ dimensions: { length: 4, width: 3, height: 1 } }, 0.5);
  const large = generateEditorPointGrid({ dimensions: { length: 6, width: 3, height: 1 } }, 0.5);
  assert.ok(large.length > small.length);
});

test('all generated points stay within the bounding box', () => {
  const size = { dimensions: { length: 4, width: 3, height: 2 } };
  const points = generateEditorPointGrid(size, 0.5);
  assert.ok(points.every((point) => isEditorPointWithinBounds(point, size)));
});

test('changing size regenerates a different point grid summary', () => {
  const summaryA = summarizeEditorPointGrid({ dimensions: { length: 4, width: 3, height: 1 } }, 0.5);
  const summaryB = summarizeEditorPointGrid({ dimensions: { length: 4, width: 3, height: 2 } }, 0.5);

  assert.notEqual(summaryA.total, summaryB.total);
  assert.ok(summaryB.total > summaryA.total);
});
