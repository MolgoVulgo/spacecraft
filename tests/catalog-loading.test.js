import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CATALOG_FILE_URL = new URL('../public/data/4x3x1_catalog.json', import.meta.url);
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
