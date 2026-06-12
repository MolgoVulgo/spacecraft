import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySelectionClick,
  createEmptyEditorSelectionState,
  getEditorContextActions,
  getPrimitiveKey,
  isClickGesture,
} from '../src/editor-interaction-state.js';

test('left click replaces selection', () => {
  const initial = createEmptyEditorSelectionState();
  const next = applySelectionClick(initial, { type: 'face', id: 'face:a' });
  assert.deepEqual([...next.faces], ['face:face:a']);
  assert.equal(next.edges.size, 0);
});

test('shift left click toggles selection', () => {
  const initial = applySelectionClick(createEmptyEditorSelectionState(), { type: 'edge', id: 'edge:a' });
  const added = applySelectionClick(initial, { type: 'edge', id: 'edge:b' }, { toggle: true });
  assert.deepEqual([...added.edges], ['edge:edge:a', 'edge:edge:b']);

  const removed = applySelectionClick(added, { type: 'edge', id: 'edge:a' }, { toggle: true });
  assert.deepEqual([...removed.edges], ['edge:edge:b']);
});

test('primitive key stays stable by type and id', () => {
  assert.equal(getPrimitiveKey({ type: 'face', id: 'cell:0:0:0:top' }), 'face:cell:0:0:0:top');
});

test('click threshold <= 5px is a click', () => {
  assert.equal(isClickGesture({ x: 10, y: 10 }, { x: 15, y: 14 }), true);
});

test('movement > 5px is a drag', () => {
  assert.equal(isClickGesture({ x: 10, y: 10 }, { x: 16, y: 10 }), false);
});

test('edge selection returns chamfer and round only when capability exists', () => {
  const selection = applySelectionClick(createEmptyEditorSelectionState(), { type: 'edge', id: 'edge:a' });
  assert.deepEqual(
    getEditorContextActions(selection, null, { edgeChamfer: true, edgeFillet: true }).map((action) => action.id),
    ['edge_chamfer', 'edge_fillet'],
  );
  assert.deepEqual(
    getEditorContextActions(selection, null, { edgeChamfer: true, edgeFillet: false }).map((action) => action.id),
    ['edge_chamfer'],
  );
});

test('unsupported mixed selection returns no actions', () => {
  let selection = applySelectionClick(createEmptyEditorSelectionState(), { type: 'face', id: 'face:a' });
  selection = applySelectionClick(selection, { type: 'edge', id: 'edge:a' }, { toggle: true });
  assert.deepEqual(getEditorContextActions(selection, null, {
    faceRound: true,
    faceChamfer: true,
    edgeChamfer: true,
    edgeFillet: true,
  }), []);
});

test('locked variants expose no geometry actions', () => {
  const selection = applySelectionClick(createEmptyEditorSelectionState(), { type: 'face', id: 'face:a' });
  assert.deepEqual(
    getEditorContextActions(selection, null, { faceRound: true, faceChamfer: true, locked: true }),
    [],
  );
});
