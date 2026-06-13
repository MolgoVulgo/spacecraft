import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSceneSnapshot } from '../src/scene-validator.js';

test('scene validator accepts a minimal valid piece and group snapshot', () => {
  const ship = {
    pieces: [{
      placed_piece_id: 'placed_1',
      catalog_piece_id: 'piece_1',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      symmetry: { width: false, length: false, height: false },
      group_id: 'group_1',
    }],
    groups: [{
      group_id: 'group_1',
      origin: { x: 0, y: 0, z: 0 },
      children: [{
        instance_id: 'placed_1',
        local_position: { x: 0, y: 0, z: 0 },
      }],
    }],
  };

  const report = validateSceneSnapshot(ship, { catalogPieceIds: ['piece_1'] });

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
});

test('scene validator rejects duplicated group membership', () => {
  const ship = {
    pieces: [
      {
        placed_piece_id: 'placed_1',
        catalog_piece_id: 'piece_1',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        symmetry: { width: false, length: false, height: false },
        group_id: 'group_1',
      },
    ],
    groups: [
      {
        group_id: 'group_1',
        origin: { x: 0, y: 0, z: 0 },
        children: [{ instance_id: 'placed_1', local_position: { x: 0, y: 0, z: 0 } }],
      },
      {
        group_id: 'group_2',
        origin: { x: 1, y: 0, z: 0 },
        children: [{ instance_id: 'placed_1', local_position: { x: 1, y: 0, z: 0 } }],
      },
    ],
  };

  const report = validateSceneSnapshot(ship, { catalogPieceIds: ['piece_1'] });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'duplicate_reference'));
});

test('scene validator rejects symmetry forbidden by catalog placement rules', () => {
  const ship = {
    pieces: [{
      placed_piece_id: 'placed_1',
      catalog_piece_id: 'piece_engine',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      symmetry: { width: false, length: true, height: false },
    }],
    groups: [],
  };

  const report = validateSceneSnapshot(ship, {
    catalogPieceIds: ['piece_engine'],
    catalog: {
      catalog_pieces: [{
        id: 'piece_engine',
        shape_variant_id: 'shape_engine',
        placement_rules: {
          allowed_symmetry: { width: true, length: false, height: false },
        },
      }],
      shape_variants: [{ id: 'shape_engine' }],
    },
  });

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'forbidden_symmetry'));
});
