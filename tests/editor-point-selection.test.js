import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAdvancedPointSelection,
  normalizeAdvancedPointSelection,
  selectAdvancedPoint,
  summarizeAdvancedPointSelection,
} from '../src/3d/editor/editorPointSelection.js';

test('selecting one point adds its id to the state', () => {
  assert.deepEqual(selectAdvancedPoint('pt_0_0_0', []), ['pt_0_0_0']);
});

test('selecting two points with multi keeps a stable list', () => {
  const selection = selectAdvancedPoint('pt_0_5_0_0', ['pt_0_0_0'], { multi: true });
  assert.deepEqual(selection, ['pt_0_0_0', 'pt_0_5_0_0']);
});

test('escape helper clears the advanced point selection', () => {
  assert.deepEqual(clearAdvancedPointSelection(), []);
});

test('changing variant can reset point selection without leaking ids', () => {
  const previous = ['pt_0_0_0', 'pt_0_5_0_0'];
  const next = clearAdvancedPointSelection(previous);
  assert.deepEqual(next, []);
});

test('leaving advanced mode can clear point selection cleanly', () => {
  const summaryBefore = summarizeAdvancedPointSelection(['pt_0_0_0', 'pt_0_5_0_0']);
  const summaryAfter = summarizeAdvancedPointSelection(clearAdvancedPointSelection());
  assert.equal(summaryBefore.count, 2);
  assert.equal(summaryAfter.count, 0);
});

test('selection normalization removes duplicates and empties', () => {
  assert.deepEqual(
    normalizeAdvancedPointSelection(['pt_0_0_0', '', 'pt_0_0_0', 'pt_0_5_0_0']),
    ['pt_0_0_0', 'pt_0_5_0_0'],
  );
});
