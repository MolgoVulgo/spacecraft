import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validateCatalogData } from '../src/catalog-validator.js';

test('catalog validator accepts the current catalog', async () => {
  const raw = await readFile(new URL('../public/data/4x3x1_catalog.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(raw);
  const report = validateCatalogData(catalog);

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});

test('catalog validator rejects a missing piece reference', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: {},
    definitions: {},
    sizes: [{ id: '4x3x1' }],
    families: [{ id: 'steel' }],
    shape_variants: [{ id: 'shape_ok', size_id: '4x3x1', generation: { mode: 'primitive_stack' } }],
    spec_profiles: [{ id: 'spec_ok', size_id: '4x3x1' }],
    recipes: [{ id: 'recipe_ok', output_spec_profile_id: 'spec_ok' }],
    catalog_pieces: [{
      id: 'piece_bad',
      family_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'missing_shape',
      spec_profile_id: 'spec_ok',
      recipe_id: 'recipe_ok',
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.path.endsWith('.shape_variant_id')));
});

test('catalog validator rejects obsolete advanced_mesh variants', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: { subgrid_unit: 0.5 },
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'steel' }],
    shape_variants: [{
      id: 'shape_adv',
      size_id: '4x3x1',
      generation: {
        mode: 'advanced_mesh',
        base: { type: 'box', bounds: { length: 4, width: 3, height: 1 } },
        visual_mesh: {
          grid_step: 0.5,
          vertices: [
            { id: 'v001', x: 0, y: 0, z: 0 },
            { id: 'v002', x: 4, y: 0, z: 0 },
            { id: 'v003', x: 4, y: 2, z: 0 },
            { id: 'v004', x: 0, y: 2, z: 0 },
          ],
          faces: [{ id: 'f001', vertices: ['v001', 'v002', 'v003', 'v004'] }],
        },
      },
      collision: { mode: 'base_box' },
      anchors: [],
    }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'obsolete_generation'));
});
