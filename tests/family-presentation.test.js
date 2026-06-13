import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDisplayLabel,
  resolveFamilyColor,
  resolveFamilyGroupLabel,
} from '../src/catalog/familyPresentation.js';
import { normalizeUserSettings } from '../src/user-settings.js';

const catalog = {
  families: [
    { id: 'propulsion', label_fr: 'Propulsion', group_label_fr: 'SYSTÈMES DE PROPULSION', default_color: '#d9822b' },
    { id: 'steel', label_fr: 'Acier' },
  ],
};

test('resolveFamilyColor prefers user override', () => {
  const settings = normalizeUserSettings({
    editor: {
      familyColors: {
        propulsion: '#ff8a00',
      },
    },
  });

  assert.equal(resolveFamilyColor('propulsion', settings, catalog), '#ff8a00');
});

test('resolveFamilyColor falls back to catalog default color', () => {
  assert.equal(resolveFamilyColor('propulsion', normalizeUserSettings({}), catalog), '#d9822b');
});

test('resolveFamilyColor falls back to registry or safe gray for unknown family', () => {
  assert.equal(resolveFamilyColor('unknown_family', normalizeUserSettings({}), catalog), '#888888');
});

test('resolveDisplayLabel prefers user override', () => {
  const settings = normalizeUserSettings({
    editor: {
      labels: {
        families: {
          propulsion: 'Moteurs',
        },
      },
    },
  });

  assert.equal(resolveDisplayLabel('families', 'propulsion', settings, 'Propulsion'), 'Moteurs');
});

test('resolveDisplayLabel falls back to catalog default then id', () => {
  const settings = normalizeUserSettings({});
  assert.equal(resolveDisplayLabel('parts', 'piece_engine', settings, 'Moteur 4x3x1'), 'Moteur 4x3x1');
  assert.equal(resolveDisplayLabel('variants', 'variant_01', settings, ''), 'variant_01');
});

test('resolveFamilyGroupLabel applies user label override consistently', () => {
  const settings = normalizeUserSettings({
    editor: {
      labels: {
        families: {
          steel: 'Coque',
        },
      },
    },
  });

  assert.equal(resolveFamilyGroupLabel('steel', settings, catalog), 'COQUE');
});

test('normalizeUserSettings keeps valid family colors and drops invalid ones', () => {
  const settings = normalizeUserSettings({
    editor: {
      familyColors: {
        propulsion: '#FF8A00',
        broken: 'orange',
      },
      labels: {
        variants: {
          variant_flat_01: ' Standard ',
        },
      },
    },
  });

  assert.deepEqual(settings.editor.familyColors, { propulsion: '#ff8a00' });
  assert.deepEqual(settings.editor.labels.variants, { variant_flat_01: 'Standard' });
});

