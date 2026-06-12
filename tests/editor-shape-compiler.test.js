import test from 'node:test';
import assert from 'node:assert/strict';

import { compileEditorCatalog } from '../src/3d/editor/editorShapeCompiler.js';

test('compilation preserves variant and linked catalog data', () => {
  const catalog = {
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    shape_variants: [{
      id: 'shape_1',
      size_id: '4x3x1',
      variant_index: 3,
      generation: {
        mode: 'voxel_grid',
        base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
        operations: [{
          id: 'custom_face_1',
          type: 'custom_face',
          scope: { kind: 'custom_face' },
          points: [
            { x: 0, y: 0, z: 1 },
            { x: 4, y: 0, z: 1 },
            { x: 2, y: 1.5, z: 0.5 },
          ],
        }],
      },
      anchors: [],
      collision: { mode: 'base_box' },
    }],
    catalog_pieces: [{
      id: 'piece_1',
      shape_variant_id: 'shape_1',
      family_id: 'steel',
      size_id: '4x3x1',
      spec_profile_id: 'spec_1',
      recipe_id: 'recipe_1',
    }],
    spec_profiles: [{ id: 'spec_1', family_id: 'steel', size_id: '4x3x1' }],
    recipes: [{ id: 'recipe_1', output_spec_profile_id: 'spec_1' }],
  };

  const result = compileEditorCatalog({
    catalog,
    sizes: catalog.sizes,
    draftStateByShapeId: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.catalog.shape_variants[0].variant_index, 3);
  assert.equal(result.catalog.catalog_pieces[0].id, 'piece_1');
  assert.equal(result.catalog.spec_profiles[0].id, 'spec_1');
  assert.equal(result.catalog.recipes[0].id, 'recipe_1');
  assert.ok(result.catalog.shape_variants[0].preview_mesh.vertices.length > 0);
  assert.ok(result.catalog.shape_variants[0].preview_mesh.faces.length > 0);
});

test('compilation refuses incomplete advanced drafts', () => {
  const result = compileEditorCatalog({
    catalog: { sizes: [], shape_variants: [] },
    sizes: [],
    draftStateByShapeId: {
      shape_1: { edgeCount: 2, faceCount: 0 },
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /draft avancé incomplet/);
});
