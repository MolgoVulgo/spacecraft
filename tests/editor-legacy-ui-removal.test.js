import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('editor.html no longer exposes legacy advanced mesh UI', async () => {
  const html = await readFile(new URL('../editor.html', import.meta.url), 'utf8');

  for (const token of [
    'Advanced mesh',
    'Vertices',
    'Grid step',
    'variantGeometryModeSelect',
    'advancedMeshGridStepInput',
    'advancedVertexXInput',
    'advancedVertexYInput',
    'advancedVertexZInput',
    'advancedVertexListSelect',
    'advancedFaceListSelect',
    'Mode simple',
    'Mode avancé',
  ]) {
    assert.equal(html.includes(token), false, `legacy token still present: ${token}`);
  }

  assert.equal(html.includes('Édition géométrique'), true);
  assert.equal(html.includes('editorModeToggleBtn'), false);
  assert.equal(html.includes('editorAdvancedControls'), true);
  assert.equal(html.includes('editableEdgeSelectionSummary'), true);
  assert.equal(html.includes('chamferSelectedEdgesBtn'), true);
  assert.equal(html.includes('filletSelectedEdgesBtn'), true);
});
