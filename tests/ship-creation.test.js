import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHIP_CREATION_SCHEMA_VERSION,
  buildShipCreation,
  prepareImportedShipCreation,
  validateShipCreation,
} from '../src/ship-creation.js';

test('buildShipCreation creates a valid minimal snapshot', () => {
  const catalog = {
    schema_version: '0.1.0',
    definitions: { spec_fields: {} },
  };

  const creation = buildShipCreation({
    catalog,
    localId: 'ship_1',
    pieces: [],
    groups: [],
  });

  assert.equal(creation.schema_version, SHIP_CREATION_SCHEMA_VERSION);
  assert.equal(validateShipCreation(creation).valid, true);
});

test('prepareImportedShipCreation rejects unknown catalog pieces', () => {
  const catalog = {
    schema_version: '0.1.0',
    definitions: { spec_fields: {} },
    catalog_pieces: [{ id: 'known_piece' }],
  };

  const payload = {
    schema_version: SHIP_CREATION_SCHEMA_VERSION,
    catalog_version: '0.1.0',
    local_id: 'legacy_1',
    name: 'Legacy',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ship: {
      pieces: [{
        placed_piece_id: 'placed_1',
        catalog_piece_id: 'missing_piece',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        symmetry: { width: false, length: false, height: false },
        group_id: null,
      }],
      groups: [],
      computed_specs: {},
    },
    metadata: {},
  };

  const prepared = prepareImportedShipCreation(payload, { catalog, currentCatalogVersion: '0.1.0' });

  assert.equal(prepared.valid, false);
  assert.equal(prepared.shipCreation, null);
});
