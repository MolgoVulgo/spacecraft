import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAllowedOrientations,
  getEffectiveAllowedSymmetry,
  getEffectivePartType,
  getEffectivePlacementRules,
  isPropulsionPart,
} from '../src/catalog/familyRules.js';

test('family rules fallback to legacy structure when type_id is absent', () => {
  const partType = getEffectivePartType({}, { family_id: 'steel', size_id: '4x3x1' });

  assert.equal(partType.id, 'structure_block');
  assert.equal(partType.family_id, 'structure');
});

test('family rules prefer piece placement symmetry over shape symmetry', () => {
  const allowedSymmetry = getEffectiveAllowedSymmetry(
    {
      placement_rules: {
        allowed_symmetry: { length: false, width: true, height: false },
      },
    },
    {
      allowed_symmetry: { length: true, width: true, height: true },
    },
  );

  assert.deepEqual(allowedSymmetry, { length: false, width: true, height: false });
});

test('family rules fallback to shape symmetry when piece placement rules omit it', () => {
  const allowedSymmetry = getEffectiveAllowedSymmetry(
    {},
    { allowed_symmetry: { length: false, width: true, height: true } },
  );

  assert.deepEqual(allowedSymmetry, { length: false, width: true, height: true });
});

test('family rules return a canonical default orientation when missing', () => {
  const orientations = getAllowedOrientations({}, {
    dimensions: { length: 4, width: 3, height: 1 },
  });

  assert.equal(orientations.length, 1);
  assert.deepEqual(orientations[0], {
    id: 'default',
    dimensions: { length: 4, width: 3, height: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  });
});

test('family rules expose placement rules for propulsion parts', () => {
  const catalog = {
    part_types: [{ id: 'engine', family_id: 'propulsion', requires_placement_rules: true }],
  };
  const piece = {
    family_id: 'propulsion',
    type_id: 'engine',
    placement_rules: {
      allowed_symmetry: { length: false, width: true, height: false },
      allowed_orientations: [
        { id: 'flat', dimensions: { length: 4, width: 3, height: 1 }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'vertical', dimensions: { length: 4, width: 1, height: 3 }, rotation: { x: 90, y: 0, z: 0 } },
      ],
      mount_points: [{ id: 'mount_1', face: 'length_max', position: { x: 4, y: 0.75, z: 0.5 }, normal: { x: 1, y: 0, z: 0 } }],
      functional_zones: [{ id: 'exhaust', face: 'length_min', direction: 'length_min', must_be_clear: true, clearance: 1 }],
    },
  };

  assert.equal(isPropulsionPart(catalog, piece), true);
  assert.deepEqual(getEffectivePlacementRules(piece).allowed_symmetry, { length: false, width: true, height: false });
  assert.equal(getEffectivePlacementRules(piece).allowed_orientations.length, 2);
});
