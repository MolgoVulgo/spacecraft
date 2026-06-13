import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAssemblyCatalogFromEditorCatalog } from '../src/assembly-catalog-publication.js';

function createEditorCatalog() {
  return {
    schema_version: '1',
    game: { id: 'spacecraft' },
    units: { subgrid_unit: 0.5 },
    definitions: { spec_fields: {} },
    ship_blueprint_schema: {},
    sizes: [
      { id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } },
      { id: '6x3x1', dimensions: { length: 6, width: 3, height: 1 } },
    ],
    families: [
      { id: 'steel' },
      { id: 'alloy' },
    ],
    part_types: [
      { id: 'engine', family_id: 'steel', requires_placement_rules: true },
    ],
    materials: [
      { id: 'steel_material', label_fr: 'Acier' },
      { id: 'unused_material', label_fr: 'Unused' },
    ],
    shape_variants: [
      {
        id: 'shape_draft',
        size_id: '4x3x1',
        status: 'draft',
        generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }], operations: [] },
        anchors: [{ id: 'a1', position: { x: 0.5, y: 0.5, z: 1 }, normal: { x: 0, y: 0, z: 1 }, face: 'top' }],
      },
      {
        id: 'shape_checked',
        size_id: '4x3x1',
        status: 'checked',
        generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }], operations: [] },
        anchors: [{ id: 'a2', position: { x: 0.5, y: 0.5, z: 1 }, normal: { x: 0, y: 0, z: 1 }, face: 'top' }],
      },
      {
        id: 'shape_validated',
        size_id: '4x3x1',
        status: 'validated',
        generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }], operations: [] },
        anchors: [{ id: 'a3', position: { x: 0.5, y: 0.5, z: 1 }, normal: { x: 0, y: 0, z: 1 }, face: 'top' }],
      },
    ],
    spec_profiles: [
      { id: 'spec_ok', size_id: '4x3x1' },
      { id: 'spec_unused', size_id: '6x3x1' },
    ],
    recipes: [
      { id: 'recipe_ok', output_spec_profile_id: 'spec_ok' },
      { id: 'recipe_unused', output_spec_profile_id: 'spec_unused' },
    ],
    catalog_pieces: [
      { id: 'piece_draft', family_id: 'steel', size_id: '4x3x1', shape_variant_id: 'shape_draft', spec_profile_id: 'spec_ok', recipe_id: 'recipe_ok' },
      { id: 'piece_validated', family_id: 'steel', type_id: 'engine', material_id: 'steel_material', size_id: '4x3x1', shape_variant_id: 'shape_validated', spec_profile_id: 'spec_ok', recipe_id: 'recipe_ok' },
    ],
    base_piece_models: [
      { family_id: 'steel', sizes: ['4x3x1', '6x3x1'] },
      { family_id: 'alloy', sizes: ['6x3x1'] },
    ],
  };
}

test('publication keeps validated shapes only', () => {
  const result = buildAssemblyCatalogFromEditorCatalog(createEditorCatalog());

  assert.deepEqual(result.catalog.shape_variants.map((shape) => shape.id), ['shape_validated']);
  assert.equal(result.report.skippedDraft, 1);
  assert.equal(result.report.skippedChecked, 1);
});

test('publication excludes validated but invalid shapes and reports them', () => {
  const catalog = createEditorCatalog();
  catalog.shape_variants.find((shape) => shape.id === 'shape_validated').generation.cells = [];

  const result = buildAssemblyCatalogFromEditorCatalog(catalog);

  assert.equal(result.catalog.shape_variants.length, 0);
  assert.equal(result.report.publishable, false);
  assert.equal(result.report.skippedInvalid, 1);
  assert.equal(result.report.skippedWithErrors[0].shapeId, 'shape_validated');
});

test('publication filters linked pieces and removes orphan specs/recipes', () => {
  const result = buildAssemblyCatalogFromEditorCatalog(createEditorCatalog());

  assert.deepEqual(result.catalog.catalog_pieces.map((piece) => piece.id), ['piece_validated']);
  assert.deepEqual(result.catalog.spec_profiles.map((spec) => spec.id), ['spec_ok']);
  assert.deepEqual(result.catalog.recipes.map((recipe) => recipe.id), ['recipe_ok']);
  assert.deepEqual(result.catalog.part_types.map((partType) => partType.id), ['engine']);
  assert.deepEqual(result.catalog.materials.map((material) => material.id), ['steel_material']);
});

test('publication filters base model sizes to published sizes', () => {
  const result = buildAssemblyCatalogFromEditorCatalog(createEditorCatalog());

  assert.deepEqual(result.catalog.base_piece_models, [{ family_id: 'steel', sizes: ['4x3x1'] }]);
});

test('publication does not mutate the editor catalog input', () => {
  const catalog = createEditorCatalog();
  const before = JSON.parse(JSON.stringify(catalog));

  buildAssemblyCatalogFromEditorCatalog(catalog);

  assert.deepEqual(catalog, before);
});
