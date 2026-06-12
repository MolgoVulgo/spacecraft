import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEditorCatalogAutosaveController,
  loadPendingEditorCatalogBackup,
} from '../src/editor-catalog-persistence.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('autosave controller marks dirty and clears it after successful save', async () => {
  globalThis.localStorage = createLocalStorageMock();
  const stateChanges = [];
  const controller = createEditorCatalogAutosaveController({
    getCatalog: () => ({ schema_version: '1' }),
    writeCatalog: async () => {},
    onStateChange: (snapshot) => stateChanges.push(snapshot),
    debounceMs: 5,
    now: () => '2026-06-12T10:00:00.000Z',
  });

  controller.markDirty('edit');
  const result = await controller.saveNow('manual_save');

  assert.equal(result.ok, true);
  assert.equal(controller.getState().dirty, false);
  assert.equal(controller.getState().lastSavedAt, '2026-06-12T10:00:00.000Z');
  assert.ok(stateChanges.some((snapshot) => snapshot.dirty === true));
});

test('autosave controller keeps dirty state and stores backup after failed save', async () => {
  globalThis.localStorage = createLocalStorageMock();
  const controller = createEditorCatalogAutosaveController({
    getCatalog: () => ({ schema_version: '1', catalog_pieces: [], shape_variants: [] }),
    writeCatalog: async () => {
      throw new Error('write failed');
    },
    debounceMs: 5,
    now: () => '2026-06-12T10:00:00.000Z',
  });

  const result = await controller.saveNow('manual_save');

  assert.equal(result.ok, false);
  assert.equal(controller.getState().dirty, true);
  assert.equal(controller.getState().lastError.message, 'write failed');
  assert.equal(loadPendingEditorCatalogBackup()?.reason, 'manual_save');
});

test('autosave controller debounces consecutive schedule calls', async () => {
  globalThis.localStorage = createLocalStorageMock();
  let writeCount = 0;
  const controller = createEditorCatalogAutosaveController({
    getCatalog: () => ({ schema_version: '1', writeCount }),
    writeCatalog: async () => {
      writeCount += 1;
    },
    debounceMs: 10,
  });

  controller.schedule('a');
  controller.schedule('b');
  controller.schedule('c');
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(writeCount, 1);
  assert.equal(controller.getState().dirty, false);
});
