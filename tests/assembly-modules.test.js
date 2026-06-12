import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  applyAssemblySelectionState,
  getAssemblySelectionBatch,
  toggleLoosePieceSelection,
} from '../src/3d/assembly/selection.js';
import {
  getConnectedAssemblyInstanceIds,
  validateAssemblyGroupConnectivity,
} from '../src/3d/assembly/groups.js';
import {
  applyVariantToAssemblyInstance,
  getAssemblyShapePalettePieces,
  getAssemblyShapePaletteVariantMap,
} from '../src/3d/assembly/variants.js';

test('applyVariantToInstance preserves transform and symmetry state', () => {
  const oldMeshGeometry = new THREE.BoxGeometry(1, 1, 1);
  const oldEdgesGeometry = new THREE.BufferGeometry();
  const instance = {
    id: 'placed_001',
    catalogPieceId: 'piece_old',
    label: 'Old',
    symmetry: { width: true, length: false, height: false },
    group: new THREE.Group(),
    mesh: { geometry: oldMeshGeometry },
    edges: { geometry: oldEdgesGeometry, visible: false },
    anchors: { id: 'old-anchor' },
  };
  instance.group.position.set(10, 20, 30);
  instance.group.rotation.set(0.1, 0.2, 0.3);
  instance.group.scale.set(2, 2, 2);
  instance.group.add(instance.anchors);

  let selectedCatalogPieceId = null;
  let refreshCount = 0;
  let dirtyCount = 0;
  let lastMessage = null;
  const newGeometry = new THREE.BoxGeometry(2, 2, 2);
  const newAnchorGroup = { id: 'new-anchor' };

  const result = applyVariantToAssemblyInstance({
    instance,
    currentPiece: { id: 'piece_old', family_id: 'steel', size_id: '4x3x1' },
    nextPiece: { id: 'piece_new', family_id: 'steel', size_id: '4x3x1', label_fr: 'New Piece' },
    buildGeometry: () => newGeometry,
    getReservationBoxForCatalogPiece: () => new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)),
    collidesWithOthers: () => false,
    createAssemblyEdgeGeometry: () => new THREE.BufferGeometry(),
    createAnchorGroup: () => newAnchorGroup,
    disposeAnchorGroup: () => {},
    setSelectedCatalogPieceId: (value) => { selectedCatalogPieceId = value; },
    refreshAfterApply: () => { refreshCount += 1; },
    setMessage: (message) => { lastMessage = message; },
    markShipDirty: () => { dirtyCount += 1; },
  });

  assert.equal(result, true);
  assert.equal(instance.catalogPieceId, 'piece_new');
  assert.deepEqual(instance.symmetry, { width: true, length: false, height: false });
  assert.deepEqual(instance.group.position.toArray(), [10, 20, 30]);
  assert.deepEqual(instance.group.rotation.toArray().slice(0, 3), [0.1, 0.2, 0.3]);
  assert.deepEqual(instance.group.scale.toArray(), [2, 2, 2]);
  assert.equal(selectedCatalogPieceId, 'piece_new');
  assert.equal(refreshCount, 1);
  assert.equal(dirtyCount, 1);
  assert.equal(lastMessage, 'Forme appliquée à la pièce sélectionnée.');
  assert.equal(instance.edges.visible, true);
  assert.equal(instance.anchors, newAnchorGroup);
});

test('getShapePalettePieces uses full catalog and selected piece family/size', () => {
  const pieces = [
    { id: 'piece_a', family_id: 'steel', size_id: '4x3x1', spec_profile_id: 'standard' },
    { id: 'piece_b', family_id: 'steel', size_id: '4x3x1', spec_profile_id: 'standard_2' },
    { id: 'piece_c', family_id: 'steel', size_id: '6x3x1', spec_profile_id: 'standard' },
    { id: 'piece_d', family_id: 'alloy', size_id: '4x3x1', spec_profile_id: 'standard' },
  ];
  const filtered = getAssemblyShapePalettePieces({
    pieces,
    selectedPiece: pieces[0],
    getPieceProfileType: (piece) => (piece.id === 'piece_b' ? 'reinforced' : 'standard'),
  });

  assert.deepEqual(filtered.map((piece) => piece.id), ['piece_a']);
});

test('variant map ignores out-of-range variants', () => {
  const pieces = [
    { id: 'piece_v01', shape_variant_id: 'shape_v01' },
    { id: 'piece_v99', shape_variant_id: 'shape_v99' },
  ];
  const variantMap = getAssemblyShapePaletteVariantMap({
    pieces,
    getShapeVariant: (shapeId) => ({
      shape_v01: { variant_index: 1 },
      shape_v99: { variant_index: 99 },
    }[shapeId] ?? null),
    shapeButtonCount: 14,
  });

  assert.equal(variantMap.get(1)?.id, 'piece_v01');
  assert.equal(variantMap.has(99), false);
});

test('selection helpers keep unique normalized entities', () => {
  const state = {
    selectionBatch: [],
    selectedEntityType: null,
    selectedId: null,
    selectedGroupIds: [],
  };
  const groups = new Map([['group_1', { id: 'group_1' }]]);
  const instances = new Map([
    ['piece_1', { id: 'piece_1', groupId: null }],
    ['piece_2', { id: 'piece_2', groupId: null }],
  ]);
  const deps = {
    getAssemblyGroupById: (id) => groups.get(id) ?? null,
    getInstanceById: (id) => instances.get(id) ?? null,
  };

  applyAssemblySelectionState(state, [
    { type: 'piece', id: 'piece_1' },
    { type: 'piece', id: 'piece_1' },
    { type: 'group', id: 'group_1' },
  ], deps);

  assert.deepEqual(getAssemblySelectionBatch(state, deps), [
    { type: 'piece', id: 'piece_1' },
    { type: 'group', id: 'group_1' },
  ]);
});

test('toggle loose piece selection builds the expected multiselect set', () => {
  const state = {
    selectedGroupIds: ['piece_1'],
    selectedEntityType: null,
    selectedId: null,
  };
  const instances = new Map([
    ['piece_1', { id: 'piece_1', groupId: null }],
    ['piece_2', { id: 'piece_2', groupId: null }],
  ]);

  assert.deepEqual(
    toggleLoosePieceSelection(state, 'piece_2', { getInstanceById: (id) => instances.get(id) ?? null }),
    ['piece_1', 'piece_2'],
  );
});

test('group connectivity validation rejects disconnected selections', () => {
  const instances = [{ id: 'piece_1' }, { id: 'piece_2' }, { id: 'piece_3' }];
  const connected = getConnectedAssemblyInstanceIds(instances, {
    instancesHaveCompatibleAnchors: (a, b) => (
      (a.id === 'piece_1' && b.id === 'piece_2') || (a.id === 'piece_2' && b.id === 'piece_1')
    ),
  });
  const report = validateAssemblyGroupConnectivity(instances, {
    instancesHaveCompatibleAnchors: (a, b) => (
      (a.id === 'piece_1' && b.id === 'piece_2') || (a.id === 'piece_2' && b.id === 'piece_1')
    ),
  });

  assert.deepEqual([...connected].sort(), ['piece_1', 'piece_2']);
  assert.equal(report.valid, false);
});
