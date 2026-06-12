import test from 'node:test';
import assert from 'node:assert/strict';

import { getRenderableEditorAnchors } from '../src/3d/editor/editorAnchors.js';
import {
  deriveAdvancedModePreviewSummary,
  EDITOR_MODES,
  isEditorAdvancedMode,
  normalizeEditorMode,
  switchEditorModeState,
} from '../src/3d/editor/editorMode.js';
import { deriveEditorPreviewState } from '../src/3d/editor/editorSimpleMode.js';
import { createEditorFitPreviewPlan, getEditorPreviewDistance, getEditorPreviewTargetZ } from '../src/3d/editor/editorViewport.js';
import {
  getEditorAvailableVariantIndexes,
  getEditorCatalogPiecesForBase,
  getEditorRecipesForBase,
  getEditorShapesForBase,
  getEditorSpecsForBase,
  shapeBelongsToEditorBase,
} from '../src/3d/editor/variantSelection.js';

test('shape selector keeps shapes linked to the selected base and sorts by variant', () => {
  const catalog = {
    shape_variants: [
      { id: 'shape_steel_4x3x1_v02', size_id: '4x3x1', variant_index: 2, metadata: { based_on: 'steel:4x3x1' } },
      { id: 'shape_steel_4x3x1_v01', size_id: '4x3x1', variant_index: 1, metadata: { based_on: 'steel:4x3x1' } },
      { id: 'shape_alloy_4x3x1_v01', size_id: '4x3x1', variant_index: 1, metadata: { based_on: 'alloy:4x3x1' } },
    ],
    catalog_pieces: [
      { id: 'piece_1', family_id: 'steel', size_id: '4x3x1', shape_variant_id: 'shape_steel_4x3x1_v02', label_fr: 'v02' },
    ],
    spec_profiles: [],
    recipes: [],
  };

  assert.equal(shapeBelongsToEditorBase(catalog.shape_variants[0], 'steel', '4x3x1'), true);
  assert.deepEqual(
    getEditorShapesForBase(catalog, 'steel', '4x3x1').map((shape) => shape.id),
    ['shape_steel_4x3x1_v01', 'shape_steel_4x3x1_v02'],
  );
});

test('catalog/spec/recipe selectors stay scoped to one editor base', () => {
  const catalog = {
    catalog_pieces: [
      { id: 'piece_1', family_id: 'steel', size_id: '4x3x1', shape_variant_id: 'shape_1', label_fr: 'A' },
      { id: 'piece_2', family_id: 'steel', size_id: '6x3x1', shape_variant_id: 'shape_2', label_fr: 'B' },
    ],
    spec_profiles: [
      { id: 'spec_1', family_id: 'steel', size_id: '4x3x1' },
      { id: 'spec_2', family_id: 'steel', size_id: '6x3x1' },
    ],
    recipes: [
      { id: 'recipe_1', output_spec_profile_id: 'spec_1' },
      { id: 'recipe_2', output_spec_profile_id: 'spec_2' },
    ],
    shape_variants: [],
  };

  assert.deepEqual(getEditorCatalogPiecesForBase(catalog, 'steel', '4x3x1').map((piece) => piece.id), ['piece_1']);
  assert.deepEqual(getEditorSpecsForBase(catalog, 'steel', '4x3x1').map((spec) => spec.id), ['spec_1']);
  assert.deepEqual(getEditorRecipesForBase(catalog, 'steel', '4x3x1').map((recipe) => recipe.id), ['recipe_1']);
});

test('available editor variant indexes skip already used variant buttons', () => {
  const catalog = {
    shape_variants: [
      { id: 'shape_steel_4x3x1_v01', size_id: '4x3x1', variant_index: 1, metadata: { based_on: 'steel:4x3x1' } },
      { id: 'shape_steel_4x3x1_v03', size_id: '4x3x1', variant_index: 3, metadata: { based_on: 'steel:4x3x1' } },
    ],
    catalog_pieces: [],
    spec_profiles: [],
    recipes: [],
  };

  assert.deepEqual(getEditorAvailableVariantIndexes(catalog, 'steel', '4x3x1', 5), [2, 4, 5]);
});

test('editor viewport helpers compute stable target and distance', () => {
  const size = { dimensions: { length: 6, width: 3, height: 2 } };
  assert.equal(getEditorPreviewTargetZ(size, 36), 36);
  assert.equal(getEditorPreviewDistance(size, 36), 518.4);
  const plan = createEditorFitPreviewPlan(size, 36);
  assert.deepEqual(plan.target.toArray(), [0, 0, 36]);
});

test('editor simple mode preview state keeps visible cells and mesh rules', () => {
  const shape = {
    generation: {
      operations: [{ type: 'round' }],
      visual_mesh: { faces: [{ id: 'f1' }] },
    },
  };
  const size = { dimensions: { length: 4, width: 3, height: 1 } };
  const state = deriveEditorPreviewState({
    shape,
    size,
    advanced: false,
    fullCells: () => [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
    getShapeCells: () => [{ x: 0, y: 0, z: 0, enabled: true }, { x: 1, y: 0, z: 0, enabled: true }],
    getSuppressedCellKeysForOperations: () => new Set(['1:0:0']),
    cellKey: (x, y, z) => `${x}:${y}:${z}`,
    getAdvancedMeshValidation: () => ({ valid: true }),
  });

  assert.equal(state.shouldRenderMesh, true);
  assert.equal(state.shouldRenderVoxelGuide, true);
  assert.deepEqual(state.visibleCells, [{ x: 0, y: 0, z: 0, enabled: true }]);
});

test('renderable anchors ignore disabled anchors', () => {
  const anchors = getRenderableEditorAnchors({
    anchors: [
      { id: 'a1', enabled: true },
      { id: 'a2', enabled: false },
      { id: 'a3' },
    ],
  });

  assert.deepEqual(anchors.map((anchor) => anchor.id), ['a1', 'a3']);
});

test('editor mode defaults to simple and only advanced matches advanced mode', () => {
  assert.equal(normalizeEditorMode(undefined), EDITOR_MODES.SIMPLE);
  assert.equal(normalizeEditorMode('simple'), EDITOR_MODES.SIMPLE);
  assert.equal(normalizeEditorMode('advanced'), EDITOR_MODES.ADVANCED);
  assert.equal(isEditorAdvancedMode('advanced'), true);
  assert.equal(isEditorAdvancedMode('simple'), false);
});

test('advanced mode summary is read-only and does not depend on catalog mutation', () => {
  const summary = deriveAdvancedModePreviewSummary({
    shape: { id: 'shape_steel_4x3x1_v01', generation: { mode: 'voxel_grid' } },
    size: { dimensions: { length: 4, width: 3, height: 1 } },
    selectedCatalogPieceId: 'piece_1',
    selectedBase: { family_id: 'steel', size_id: '4x3x1' },
    subgridUnit: 0.5,
    pointGridSummary: { total: 189, boundaryCount: 146, interiorCount: 43 },
    edgeCount: 2,
    faceCount: 1,
  });

  assert.match(summary, /mode       : avancé \(preview\)/);
  assert.match(summary, /variante   : shape_steel_4x3x1_v01/);
  assert.match(summary, /grid       : 0.5 \(preview inactive\)/);
  assert.match(summary, /points     : 189 \(146 surface, 43 internes\)/);
  assert.match(summary, /lignes     : 2/);
  assert.match(summary, /faces      : 1/);
});

test('switching editor mode keeps active variant and catalog reference untouched', () => {
  const catalog = { shape_variants: [{ id: 'shape_1' }] };
  const previousState = {
    editorMode: 'simple',
    selectedShapeId: 'shape_1',
    selectedCatalogPieceId: 'piece_1',
    catalog,
  };

  const nextState = switchEditorModeState(previousState, 'advanced');

  assert.equal(nextState.editorMode, 'advanced');
  assert.equal(nextState.selectedShapeId, 'shape_1');
  assert.equal(nextState.selectedCatalogPieceId, 'piece_1');
  assert.equal(nextState.catalog, catalog);
});
