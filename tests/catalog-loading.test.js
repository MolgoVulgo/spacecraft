import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CATALOG_FILE_URL = new URL('../public/data/assembly_catalog.json', import.meta.url);
const ASSEMBLY_ICON_VARIANT_MIN = 1;
const ASSEMBLY_ICON_VARIANT_MAX = 14;

async function loadCatalog() {
  const raw = await readFile(CATALOG_FILE_URL, 'utf8');
  return JSON.parse(raw);
}

test('public catalog JSON parses', async () => {
  const catalog = await loadCatalog();

  assert.equal(typeof catalog, 'object');
  assert.ok(Array.isArray(catalog.shape_variants));
  assert.ok(Array.isArray(catalog.catalog_pieces));
});

test('each catalog piece references an existing shape variant with matching size', async () => {
  const catalog = await loadCatalog();
  const shapeById = new Map((catalog.shape_variants ?? []).map((shape) => [shape.id, shape]));

  for (const piece of catalog.catalog_pieces ?? []) {
    const shape = shapeById.get(piece.shape_variant_id);
    assert.ok(shape, `Missing shape variant for piece ${piece.id}: ${piece.shape_variant_id}`);
    assert.equal(
      shape.size_id,
      piece.size_id,
      `Size mismatch for piece ${piece.id}: shape=${shape?.size_id} piece=${piece.size_id}`,
    );
  }
});

test('assembly-consumed variant indexes stay within icon range', async () => {
  const catalog = await loadCatalog();
  const shapeById = new Map((catalog.shape_variants ?? []).map((shape) => [shape.id, shape]));

  for (const piece of catalog.catalog_pieces ?? []) {
    const shape = shapeById.get(piece.shape_variant_id);
    const variantIndex = Number(shape?.variant_index);
    assert.ok(
      Number.isInteger(variantIndex),
      `Invalid variant_index for piece ${piece.id}: ${shape?.variant_index}`,
    );
    assert.ok(
      variantIndex >= ASSEMBLY_ICON_VARIANT_MIN && variantIndex <= ASSEMBLY_ICON_VARIANT_MAX,
      `Out-of-range assembly variant_index for piece ${piece.id}: ${variantIndex}`,
    );
  }
});

test('functional propulsion sample is present and references a valid shared shape', async () => {
  const catalog = await loadCatalog();
  const piece = (catalog.catalog_pieces ?? []).find((item) => item.id === 'piece_engine_4x3x1_basic');
  const shape = (catalog.shape_variants ?? []).find((item) => item.id === piece?.shape_variant_id);
  const partType = (catalog.part_types ?? []).find((item) => item.id === piece?.type_id);
  const material = (catalog.materials ?? []).find((item) => item.id === piece?.material_id);

  assert.ok(piece, 'Missing propulsion sample piece');
  assert.equal(piece.family_id, 'propulsion');
  assert.equal(partType?.family_id, 'propulsion');
  assert.equal(material?.id, 'steel');
  assert.ok(shape, `Missing shared shape variant for propulsion sample: ${piece?.shape_variant_id}`);
  assert.equal(piece.placement_rules.allowed_orientations.length, 2);
  assert.deepEqual(piece.placement_rules.allowed_symmetry, { length: false, width: true, height: false });
});
