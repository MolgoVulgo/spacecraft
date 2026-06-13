import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { getEffectiveAttachmentAnchors } from '../src/3d/core/anchors.js';
import { getGeometrySize } from '../src/3d/core/bounds.js';
import { createCatalogLookup, findCatalogPieceByFamilySizeVariant } from '../src/3d/core/catalogLookup.js';
import { buildShapeGeometry } from '../src/3d/core/meshGeneration.js';

test('catalog lookup finds a piece by family, size and variant index', () => {
  const catalog = {
    sizes: [{ id: '4x3x1' }],
    families: [{ id: 'steel' }],
    part_types: [{ id: 'engine' }],
    materials: [{ id: 'steel_material' }],
    shape_variants: [
      { id: 'shape_base', size_id: '4x3x1', variant_index: 0 },
      { id: 'shape_v01', size_id: '4x3x1', variant_index: 1 },
    ],
    spec_profiles: [],
    recipes: [],
    catalog_pieces: [
      { id: 'piece_base', family_id: 'steel', size_id: '4x3x1', shape_variant_id: 'shape_base' },
      { id: 'piece_v01', family_id: 'steel', size_id: '4x3x1', shape_variant_id: 'shape_v01' },
    ],
  };

  const lookup = createCatalogLookup(catalog);
  assert.equal(lookup.catalogPieces.get('piece_v01')?.id, 'piece_v01');
  assert.equal(lookup.partTypes.get('engine')?.id, 'engine');
  assert.equal(lookup.materials.get('steel_material')?.id, 'steel_material');
  assert.equal(findCatalogPieceByFamilySizeVariant(catalog, 'steel', '4x3x1', 1)?.id, 'piece_v01');
});

test('meshGeneration keeps the expected size for a standard 4x3x1 box', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(getGeometrySize(geometry), new THREE.Vector3(300, 400, 100));
});

test('meshGeneration keeps the expected size for a standard 6x3x1 box', () => {
  const geometry = buildShapeGeometry({
    shape: { generation: { mode: 'primitive_stack', base: { type: 'box' }, operations: [] } },
    size: { dimensions: { length: 6, width: 3, height: 1 } },
    scale: 100,
  });

  assert.deepEqual(getGeometrySize(geometry), new THREE.Vector3(300, 600, 100));
});

test('anchor helper expands a six-face placeholder set into generated anchors', () => {
  const anchors = getEffectiveAttachmentAnchors({
    anchors: [
      { id: 'anchor_length_min', enabled: true },
      { id: 'anchor_length_max', enabled: true },
      { id: 'anchor_width_min', enabled: true },
      { id: 'anchor_width_max', enabled: true },
      { id: 'anchor_height_min', enabled: true },
      { id: 'anchor_height_max', enabled: true },
    ],
  }, { length: 4, width: 3, height: 1 });

  assert.ok(anchors.length > 6);
  assert.ok(anchors.some((anchor) => anchor.face === 'height_max'));
});
