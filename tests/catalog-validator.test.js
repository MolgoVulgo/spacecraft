import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validateCatalogData } from '../src/catalog-validator.js';

async function readCatalog(path) {
  const raw = await readFile(new URL(path, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('catalog validator accepts the current assembly catalog', async () => {
  const report = validateCatalogData(await readCatalog('../public/data/assembly_catalog.json'));

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});

test('catalog validator accepts the current editor catalog', async () => {
  const report = validateCatalogData(await readCatalog('../public/data/editor_catalog.json'));

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

test('catalog validator accepts functional family entries with placement rules', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: { subgrid_unit: 0.5 },
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'propulsion' }],
    part_types: [{ id: 'engine', family_id: 'propulsion', requires_placement_rules: true }],
    materials: [{ id: 'steel' }],
    shape_variants: [{
      id: 'shape_engine',
      size_id: '4x3x1',
      generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }] },
      anchors: [{ id: 'anchor_back_left', position: { x: 4, y: 0.75, z: 0.5 }, normal: { x: 1, y: 0, z: 0 } }],
    }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [{
      id: 'piece_engine',
      family_id: 'propulsion',
      type_id: 'engine',
      material_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'shape_engine',
      placement_rules: {
        allowed_orientations: [
          { id: 'flat', dimensions: { length: 4, width: 3, height: 1 }, rotation: { x: 0, y: 0, z: 0 } },
          { id: 'vertical', dimensions: { length: 4, width: 1, height: 3 }, rotation: { x: 90, y: 0, z: 0 } },
        ],
        allowed_symmetry: { length: false, width: true, height: false },
        mount_points: [
          { id: 'mount_back_left', face: 'length_max', position: { x: 4, y: 0.75, z: 0.5 }, normal: { x: 1, y: 0, z: 0 }, required: true },
        ],
        functional_zones: [
          { id: 'exhaust', face: 'length_min', direction: 'length_min', must_be_clear: true, clearance: 1 },
        ],
      },
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});

test('catalog validator keeps legacy structural pieces valid without type_id or placement_rules', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: {},
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'steel' }],
    shape_variants: [{ id: 'shape_ok', size_id: '4x3x1', generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }] }, anchors: [] }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [{
      id: 'piece_legacy',
      family_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'shape_ok',
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, true);
});

test('catalog validator rejects malformed allowed_orientations', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: {},
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'propulsion' }],
    part_types: [{ id: 'engine', family_id: 'propulsion', requires_placement_rules: true }],
    materials: [{ id: 'steel' }],
    shape_variants: [{ id: 'shape_ok', size_id: '4x3x1', generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }] }, anchors: [] }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [{
      id: 'piece_engine',
      family_id: 'propulsion',
      type_id: 'engine',
      material_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'shape_ok',
      placement_rules: {
        allowed_orientations: [{ id: 'flat', dimensions: { length: 4, width: 3 }, rotation: { x: 0, y: 0, z: 0 } }],
      },
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'invalid_orientation'));
});

test('catalog validator rejects malformed mount_points and functional_zones', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: {},
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'propulsion' }],
    part_types: [{ id: 'engine', family_id: 'propulsion', requires_placement_rules: true }],
    materials: [{ id: 'steel' }],
    shape_variants: [{ id: 'shape_ok', size_id: '4x3x1', generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }] }, anchors: [] }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [{
      id: 'piece_engine',
      family_id: 'propulsion',
      type_id: 'engine',
      material_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'shape_ok',
      placement_rules: {
        allowed_orientations: [{ id: 'flat', dimensions: { length: 4, width: 3, height: 1 }, rotation: { x: 0, y: 0, z: 0 } }],
        mount_points: [{ id: 'mount_bad', face: 'length_max', position: { x: 4, y: 0.75 }, normal: { x: 1, y: 0, z: 0 } }],
        functional_zones: [{ id: 'zone_bad', face: 'length_min', must_be_clear: 'yes' }],
      },
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'invalid_mount_point'));
  assert.ok(report.errors.some((issue) => issue.code === 'invalid_functional_zone'));
});

test('catalog validator rejects invalid family and type relation', () => {
  const catalog = {
    schema_version: '1',
    game: {},
    units: {},
    definitions: {},
    sizes: [{ id: '4x3x1', dimensions: { length: 4, width: 3, height: 1 } }],
    families: [{ id: 'propulsion' }, { id: 'steel' }],
    part_types: [{ id: 'engine', family_id: 'propulsion', requires_placement_rules: true }],
    materials: [{ id: 'steel' }],
    shape_variants: [{ id: 'shape_ok', size_id: '4x3x1', generation: { mode: 'voxel_grid', cells: [{ x: 0, y: 0, z: 0, enabled: true }] }, anchors: [] }],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [{
      id: 'piece_engine',
      family_id: 'steel',
      type_id: 'engine',
      material_id: 'steel',
      size_id: '4x3x1',
      shape_variant_id: 'shape_ok',
      placement_rules: {
        allowed_orientations: [{ id: 'flat', dimensions: { length: 4, width: 3, height: 1 }, rotation: { x: 0, y: 0, z: 0 } }],
      },
      fixed_catalog_entry: true,
    }],
    ship_blueprint_schema: {},
  };

  const report = validateCatalogData(catalog);

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'family_type_mismatch'));
});
