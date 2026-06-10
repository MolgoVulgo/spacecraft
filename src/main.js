import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ASSEMBLY_MAGNET_ENABLED, ASSEMBLY_MAGNET_STEP_UNITS } from './assembly-config.js';
import { buildShapeGeometry, createCatalogReservationBox, catalogPointVector } from './shape-engine.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNavigationCubeOverlay } from './navigation-cube-overlay.js';
import { createNavigationCubeViewApi } from './navigation-cube.js';
import { createAssemblyPersistenceController } from './assembly-persistence-controller.js';
import { createAssemblyInteractionController } from './assembly-drag-controller.js';
import { createAssemblyMovementController } from './assembly-movement.js';
import { validateCatalogData } from './catalog-validator.js';
import { createCommandStack } from './history/command-stack.js';
import { createMoveCommand } from './history/commands/move-command.js';
import { buildShipCreation } from './ship-creation.js';
import {
  LEGACY_ASSEMBLY_SIDE_VIEW_ID,
  createAssemblyViewController,
  getAssemblyProjectionPlane,
  getLegacyAssemblyButtonViewId,
  normalizeViewId,
} from './view-controller.js';

const CATALOG_URL = '/data/4x3x1_catalog.json';
const DEFAULT_COLOR = '#d46a2c';
const COLLISION_EPSILON = 1e-5;
const DRAG_WORLD_LIMIT = 20000;
const SIDE_SNAP_TANGENT_LIMIT_MULTIPLIER = 1.25;
const SHAPE_BUTTON_COUNT = 14;
const SHAPE_BUTTON_ICONS = Array.from({ length: SHAPE_BUTTON_COUNT }, (_, index) => `/ui/shape-buttons/button_${String(index + 1).padStart(2, '0')}.png`);
const SYMMETRY_BUTTON_ICONS = {
  width: '/ui/shape-buttons/symmetry_width.png',
  length: '/ui/shape-buttons/symmetry_length.png',
  height: '/ui/shape-buttons/symmetry_height.png',
};
const THEME_COLORS = {
  anchor: 0xd82020,
  edgeValid: 0x000000,
  edgeInvalid: 0xff2d2d,
  selectionHitbox: 0x2f80ff,
};
const ANCHOR_COLOR = THEME_COLORS.anchor;
const EDGE_COLOR_VALID = THEME_COLORS.edgeValid;
const EDGE_COLOR_INVALID = THEME_COLORS.edgeInvalid;
const SELECTION_HITBOX_COLOR = THEME_COLORS.selectionHitbox;
const APP_MODE = document.body.dataset.appMode === 'editor' ? 'editor' : 'assembly';
const IS_EDITOR = APP_MODE === 'editor';

const state = {
  catalog: null,
  catalogSource: 'fichier public/data',
  repo: null,
  instances: [],
  assemblyGroups: [],
  selectedEntityType: null,
  selectedId: null,
  selectedGroupIds: [],
  selectionBatch: [],
  copiedSelection: null,
  selectedCatalogPieceId: null,
  nextInstanceId: 1,
  nextGroupId: 1,
  drag: null,
  lastMessage: '',
  catalogFilters: { familyId: null, sizeId: null, profileType: null },
  viewMode: 'top',
  showAnchors: false,
  persistence: null,
};

const dom = {
  canvas: document.querySelector('#viewer'),
  viewportStage: document.querySelector('.viewport-stage'),
  catalogPieceSelect: document.querySelector('#catalogPieceSelect'),
  catalogPieceList: document.querySelector('#catalogPieceList'),
  catalogShapePalettePanel: document.querySelector('#catalogShapePalettePanel'),
  catalogFamilyFilter: document.querySelector('#catalogFamilyFilter'),
  catalogSizeFilter: document.querySelector('#catalogSizeFilter'),
  catalogSizeList: document.querySelector('#catalogSizeList'),
  catalogProfileFilter: document.querySelector('#catalogProfileFilter'),
  instanceSelect: document.querySelector('#instanceSelect'),
  clearSceneBtn: document.querySelector('#clearSceneBtn'),
  colorInput: document.querySelector('#colorInput'),
  mirrorLengthBtn: document.querySelector('#mirrorLengthBtn'),
  mirrorWidthBtn: document.querySelector('#mirrorWidthBtn'),
  mirrorHeightBtn: document.querySelector('#mirrorHeightBtn'),
  resetMirrorsBtn: document.querySelector('#resetMirrorsBtn'),
  gridInput: document.querySelector('#gridInput'),
  showAnchorsInput: document.querySelector('#showAnchorsInput'),
  shipStatsOverlay: document.querySelector('.ship-stats-overlay'),
  selectionStatsOverlay: document.querySelector('.selection-stats-overlay'),
  selectionStatsTitle: document.querySelector('#selectionStatsTitle'),
  shipStats: document.querySelector('#shipStats'),
  selectionStats: document.querySelector('#selectionStats'),
  emptyHint: document.querySelector('#emptyHint'),
  screenshotBtn: document.querySelector('#screenshotBtn'),
  exportBlueprintBtn: document.querySelector('#exportBlueprintBtn'),
  shipList: document.querySelector('#shipList'),
  shipNameInput: document.querySelector('#shipNameInput'),
  shipStorageStatus: document.querySelector('#shipStorageStatus'),
  creationsPanel: document.querySelector('#creationsPanel'),
  creationsPanelBody: document.querySelector('#creationsPanelBody'),
  toggleCreationsPanelBtn: document.querySelector('#toggleCreationsPanelBtn'),
  toggleCreationsPanelIcon: document.querySelector('#toggleCreationsPanelIcon'),
  placedPanel: document.querySelector('#placedPanel'),
  placedPanelBody: document.querySelector('#placedPanelBody'),
  togglePlacedPanelBtn: document.querySelector('#togglePlacedPanelBtn'),
  togglePlacedPanelIcon: document.querySelector('#togglePlacedPanelIcon'),
  catalogPanel: document.querySelector('#catalogPanel'),
  catalogPanelBody: document.querySelector('#catalogPanelBody'),
  toggleCatalogPanelBtn: document.querySelector('#toggleCatalogPanelBtn'),
  toggleCatalogPanelIcon: document.querySelector('#toggleCatalogPanelIcon'),
  helpPanel: document.querySelector('#helpPanel'),
  helpPanelBody: document.querySelector('#helpPanelBody'),
  toggleHelpPanelBtn: document.querySelector('#toggleHelpPanelBtn'),
  toggleHelpPanelIcon: document.querySelector('#toggleHelpPanelIcon'),
  newShipBtn: document.querySelector('#newShipBtn'),
  openShipBtn: document.querySelector('#openShipBtn'),
  renameShipBtn: document.querySelector('#renameShipBtn'),
  deleteShipBtn: document.querySelector('#deleteShipBtn'),
  duplicateShipBtn: document.querySelector('#duplicateShipBtn'),
  exportShipBtn: document.querySelector('#exportShipBtn'),
  importShipBtn: document.querySelector('#importShipBtn'),
  importShipInput: document.querySelector('#importShipInput'),
  exportCatalogBtn: document.querySelector('#exportCatalogBtn'),
  validationReport: document.querySelector('#validationReport'),
  variantSizeSelect: document.querySelector('#variantSizeSelect'),
  variantBaseTypeSelect: document.querySelector('#variantBaseTypeSelect'),
  variantShapeFamilyInput: document.querySelector('#variantShapeFamilyInput'),
  variantLabelInput: document.querySelector('#variantLabelInput'),
  createVariantBtn: document.querySelector('#createVariantBtn'),
  duplicateVariantBtn: document.querySelector('#duplicateVariantBtn'),
  pieceFamilySelect: document.querySelector('#pieceFamilySelect'),
  pieceSizeSelect: document.querySelector('#pieceSizeSelect'),
  pieceShapeSelect: document.querySelector('#pieceShapeSelect'),
  pieceProfileTypeInput: document.querySelector('#pieceProfileTypeInput'),
  pieceLabelInput: document.querySelector('#pieceLabelInput'),
  createCatalogPieceBtn: document.querySelector('#createCatalogPieceBtn'),
  shapeEditor: document.querySelector('#shapeEditor'),
  specEditor: document.querySelector('#specEditor'),
  recipeEditor: document.querySelector('#recipeEditor'),
};

const selectedControls = [...document.querySelectorAll('.selected-control input, .selected-control select, .selected-control button')];

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(dom.canvas.clientWidth, dom.canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);

const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 8000);
camera.position.set(0, 0, 1200);
camera.up.set(0, 1, 0);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.screenSpacePanning = true;
orbitControls.target.set(0, 0, 0);
orbitControls.mouseButtons.LEFT = null;
orbitControls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

let assemblyViewController = null;
let assemblyNavigationCubeOverlay = null;
let assemblyInteractionController = null;
let assemblyMovementController = null;
const historyStack = createCommandStack({ limit: 10 });

const rootGroup = new THREE.Group();
scene.add(rootGroup);

let grid = createAssemblyGrid(4000, 50);
scene.add(grid);

// Assembly uses flat, homogeneous colours. No directional lighting/shadows:
// part readability comes from the material colour plus explicit black outer edges.

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragHit = new THREE.Vector3();
const selectionBox = new THREE.Box3Helper(new THREE.Box3(), SELECTION_HITBOX_COLOR);
selectionBox.visible = false;
selectionBox.renderOrder = 1000;
selectionBox.material.depthTest = true;
selectionBox.material.depthWrite = false;
selectionBox.material.transparent = true;
selectionBox.material.opacity = 1;
scene.add(selectionBox);

function createAssemblyGrid(size = 4000, step = 50) {
  const half = size / 2;
  const positions = [];
  for (let v = -half; v <= half + 0.001; v += step) {
    positions.push(-half, v, 0, half, v, 0);
    positions.push(v, -half, 0, v, half, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x303640, transparent: true, opacity: 0.9 });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'assembly_xy_grid';
  return lines;
}

function updateAssemblyGrid() {
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  const maxLength = Math.max(8, ...(state.catalog?.sizes ?? []).map((size) => Number(size.dimensions?.length) || 0));
  const maxWidth = Math.max(6, ...(state.catalog?.sizes ?? []).map((size) => Number(size.dimensions?.width) || 0));
  const gridSize = Math.max(2400, Math.ceil(Math.max(maxLength, maxWidth) * scale * 4 / 100) * 100);
  const step = getMagnetStep();
  const nextGrid = createAssemblyGrid(gridSize, step);
  nextGrid.visible = dom.gridInput?.checked ?? true;
  scene.remove(grid);
  grid.geometry.dispose();
  grid.material.dispose();
  grid = nextGrid;
  scene.add(grid);
}

function getMagnetStep() {
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  return scale * ASSEMBLY_MAGNET_STEP_UNITS;
}


async function loadAssemblyCatalog() {
  const response = await fetch(CATALOG_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Impossible de charger ${CATALOG_URL}`);
  state.catalogSource = 'fichier public/data';
  return response.json();
}

function buildRepository(catalog) {
  const mapById = (items = []) => new Map(items.map((item) => [item.id, item]));
  return {
    sizes: mapById(catalog.sizes),
    families: mapById(catalog.families),
    shapeVariants: mapById(catalog.shape_variants),
    specProfiles: mapById(catalog.spec_profiles),
    recipes: mapById(catalog.recipes),
    catalogPieces: mapById(catalog.catalog_pieces),
  };
}

function getCatalogPieceById(pieceId) {
  return state.repo?.catalogPieces.get(pieceId) ?? null;
}

function getSelectedCatalogPiece() {
  return getCatalogPieceById(state.selectedCatalogPieceId ?? dom.catalogPieceSelect?.value);
}

function getSceneSelectedCatalogPiece() {
  const selected = getSelectedInstance();
  return selected ? getCatalogPieceById(selected.catalogPieceId) : null;
}

function setSelectedCatalogPiece(pieceId) {
  const piece = getCatalogPieceById(pieceId);
  if (!piece) return;
  state.selectedCatalogPieceId = pieceId;
  state.catalogFilters.familyId = piece.family_id;
  state.catalogFilters.sizeId = piece.size_id;
  state.catalogFilters.profileType = getPieceProfileType(piece);
  if (dom.catalogPieceSelect) dom.catalogPieceSelect.value = pieceId;
  renderCatalogPieceOptions();
}

function getFamily(id) {
  return state.repo?.families.get(id) ?? null;
}

function getSize(id) {
  return state.repo?.sizes.get(id) ?? null;
}

function getShapeVariant(id) {
  return state.repo?.shapeVariants.get(id) ?? null;
}

function getSpecProfile(id) {
  return state.repo?.specProfiles.get(id) ?? null;
}

function getRecipe(id) {
  return state.repo?.recipes.get(id) ?? null;
}

function getSelectedInstance() {
  if (state.selectedEntityType !== 'piece') return null;
  return state.instances.find((item) => item.id === state.selectedId) ?? null;
}

function getAssemblyGroupById(groupId) {
  return state.assemblyGroups.find((item) => item.id === groupId) ?? null;
}

function getSelectedAssemblyGroup() {
  if (state.selectedEntityType !== 'group') return null;
  return getAssemblyGroupById(state.selectedId);
}

function normalizeSelectionEntity(entity) {
  if (!entity?.type || !entity?.id) return null;
  if (entity.type === 'group') return getAssemblyGroupById(entity.id) ? { type: 'group', id: entity.id } : null;
  const instance = getInstanceById(entity.id);
  if (!instance || instance.groupId) return null;
  return { type: 'piece', id: entity.id };
}

function getSelectionBatch() {
  if (Array.isArray(state.selectionBatch) && state.selectionBatch.length) {
    return state.selectionBatch.map(normalizeSelectionEntity).filter(Boolean);
  }
  if (state.selectedEntityType === 'group' && state.selectedId) return [{ type: 'group', id: state.selectedId }];
  if (state.selectedEntityType === 'piece' && state.selectedId) return [{ type: 'piece', id: state.selectedId }];
  if (Array.isArray(state.selectedGroupIds) && state.selectedGroupIds.length) {
    return state.selectedGroupIds.map((id) => normalizeSelectionEntity({ type: 'piece', id })).filter(Boolean);
  }
  return [];
}

function hasSelection() {
  return getSelectionBatch().length > 0;
}

function getSelectedEntityInstanceIds() {
  const ids = new Set();
  for (const entity of getSelectionBatch()) {
    if (entity.type === 'group') {
      const group = getAssemblyGroupById(entity.id);
      for (const child of group?.children ?? []) ids.add(child.instanceId);
      continue;
    }
    ids.add(entity.id);
  }
  return ids;
}

function selectionContainsEntity(entity) {
  const candidate = normalizeSelectionEntity(entity);
  if (!candidate) return false;
  return getSelectionBatch().some((item) => item.type === candidate.type && item.id === candidate.id);
}

function applySelectionState(entities = []) {
  const normalized = [];
  const seen = new Set();
  for (const entity of entities) {
    const resolved = normalizeSelectionEntity(entity);
    if (!resolved) continue;
    const key = `${resolved.type}:${resolved.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(resolved);
  }

  state.selectionBatch = normalized;
  state.selectedEntityType = null;
  state.selectedId = null;
  state.selectedGroupIds = normalized.filter((entity) => entity.type === 'piece').map((entity) => entity.id);

  if (normalized.length === 1) {
    state.selectedEntityType = normalized[0].type;
    state.selectedId = normalized[0].id;
    if (normalized[0].type === 'group') state.selectedGroupIds = [];
    if (normalized[0].type === 'piece') syncAssemblyPaletteToSelectedInstance();
  }
}

function getInstanceById(instanceId) {
  return state.instances.find((item) => item.id === instanceId) ?? null;
}

function isInstanceGrouped(instance) {
  return Boolean(instance?.groupId);
}

function getLooseInstances() {
  return state.instances.filter((instance) => !instance.groupId);
}

function getVisibleAssemblyEntries() {
  return [
    ...state.assemblyGroups.map((group) => ({ type: 'group', id: group.id, label: group.name })),
    ...getLooseInstances().map((instance) => ({ type: 'piece', id: instance.id, label: instance.label })),
  ];
}

function cloneSymmetry(source = {}) {
  return {
    length: Boolean(source.length),
    width: Boolean(source.width),
    height: Boolean(source.height),
  };
}

function cloneVector3Like(source = {}) {
  return new THREE.Vector3(
    Number(source.x) || 0,
    Number(source.y) || 0,
    Number(source.z) || 0,
  );
}

function vectorToPlain(position) {
  return {
    x: round3(position.x),
    y: round3(position.y),
    z: round3(position.z),
  };
}

function createNextGroupId(options = {}) {
  const id = String(options.id ?? `group_${String(state.nextGroupId++).padStart(3, '0')}`);
  const forcedIndex = Number.parseInt(id.replace(/^group_/, ''), 10);
  if (Number.isFinite(forcedIndex)) state.nextGroupId = Math.max(state.nextGroupId, forcedIndex + 1);
  return id;
}

function getSymmetryLabel(symmetry) {
  const parts = [];
  if (symmetry.length) parts.push('longueur');
  if (symmetry.width) parts.push('largeur');
  if (symmetry.height) parts.push('hauteur');
  return parts.length ? parts.join(' + ') : 'aucune';
}

function getEffectiveSpecProfile(profileId, visited = new Set()) {
  const profile = getSpecProfile(profileId);
  if (!profile) return null;
  if (visited.has(profileId)) throw new Error(`Héritage circulaire de profil: ${profileId}`);
  visited.add(profileId);

  if (!profile.inherits_from) return structuredClone(profile);

  const base = getEffectiveSpecProfile(profile.inherits_from, visited);
  if (!base) return structuredClone(profile);
  return {
    ...base,
    ...profile,
    specs: {
      ...(base.specs ?? {}),
      ...(profile.specs ?? {}),
    },
  };
}

function getVariantDisplayLabel(shape, size) {
  if (!shape) return 'variante inconnue';
  const raw = shape.label ?? shape.id;
  const sizeLabel = size?.label ?? shape.size_id ?? '';
  const cleaned = String(raw)
    .replace(new RegExp(`^${escapeRegExp(sizeLabel)}\\s*[·-]\\s*`, 'i'), '')
    .replace(/^\d+x\d+x\d+\s*[·-]\s*/i, '')
    .replace(/\s+acier\s+\d+x\d+x\d+$/i, '')
    .trim();
  if (shape.variant_index === 0 || /base voxel/i.test(cleaned)) return 'Base';
  return cleaned || `Variante ${pad2(shape.variant_index ?? '?')}`;
}

function getDisplayLabel(catalogPiece) {
  const family = getFamily(catalogPiece.family_id);
  const size = getSize(catalogPiece.size_id);
  const shape = getShapeVariant(catalogPiece.shape_variant_id);
  const spec = getSpecProfile(catalogPiece.spec_profile_id);
  const profile = spec?.profile_type && spec.profile_type !== 'standard' ? ` · ${spec.profile_type}` : '';
  return [
    family?.label_fr ?? catalogPiece.family_id,
    size?.label ?? catalogPiece.size_id,
    getVariantDisplayLabel(shape, size),
  ].join(' · ') + profile;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCatalogGroupLabel(catalogPiece) {
  const family = getFamily(catalogPiece.family_id)?.label_fr ?? catalogPiece.family_id;
  const size = getSize(catalogPiece.size_id)?.label ?? catalogPiece.size_id;
  return `${family} · ${size}`;
}

function buildGeometry(catalogPiece, symmetry = {}) {
  const shape = getShapeVariant(catalogPiece.shape_variant_id);
  const size = getSize(shape?.size_id ?? catalogPiece.size_id);
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  return buildShapeGeometry({ shape, size, scale, symmetry, showVoxels: IS_EDITOR });
}

function createAssemblyEdgeGeometry(catalogPiece, geometry) {
  if (IS_EDITOR) return new THREE.EdgesGeometry(geometry, 18);
  return createOutlineEdgesOnly(geometry);
}

function createFixedCatalogueBoxEdges(size, scale) {
  // Assembly coordinate convention: X = width, Y = depth/length, Z = height.
  const w = (Number(size.width) || 1) * scale;
  const l = (Number(size.length) || 1) * scale;
  const h = (Number(size.height) || 1) * scale;
  const x = w / 2;
  const y = l / 2;
  const z = h / 2;
  const vertices = [
    [-x, -y, -z], [ x, -y, -z], [ x,  y, -z], [-x,  y, -z],
    [-x, -y,  z], [ x, -y,  z], [ x,  y,  z], [-x,  y,  z],
  ];
  const edgePairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const positions = [];
  for (const [a, b] of edgePairs) {
    positions.push(...vertices[a], ...vertices[b]);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
}

function createOutlineEdgesOnly(geometry) {
  // Assembly must not display editor/voxel seams. Merge equal vertices before extracting hard edges:
  // this removes coplanar internal lines created by voxel-derived shape operations.
  const source = mergeVertices(geometry.clone(), 1e-4);
  source.computeVertexNormals();
  const edges = new THREE.EdgesGeometry(source, 35);
  source.dispose();
  return edges;
}

function createMaterial(color = DEFAULT_COLOR) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
  });
}

function createAnchorGroup(catalogPiece, symmetry = {}) {
  const shape = getShapeVariant(catalogPiece.shape_variant_id);
  const size = getSize(catalogPiece.size_id)?.dimensions ?? { length: 1, width: 1, height: 1 };
  const anchors = getEffectiveAttachmentAnchors(shape, size);
  const group = new THREE.Group();
  group.name = 'anchors';
  if (!anchors.length) return group;

  const sphereRadius = Math.max(getShapeApproxSize(shape) / 70, 1.8);
  const markerGeometry = new THREE.SphereGeometry(sphereRadius, 12, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: ANCHOR_COLOR, depthTest: true });

  for (const anchor of anchors) {
    if (anchor.enabled === false) continue;
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(anchorToMeshPosition(catalogPiece, shape, anchor, symmetry));
    marker.userData.anchorId = anchor.id;
    group.add(marker);
  }

  group.userData.sharedGeometry = markerGeometry;
  group.userData.sharedMaterial = markerMaterial;
  group.visible = IS_EDITOR || state.showAnchors;
  return group;
}

function getShapeApproxSize(shape) {
  const d = shape?.bounds?.dimensions;
  if (Array.isArray(d)) return Math.max(...d.map((value) => Math.abs(Number(value) || 0)), 1);
  return 100;
}

function anchorToMeshPosition(catalogPiece, shape, anchor, symmetry) {
  const size = getSize(catalogPiece.size_id)?.dimensions ?? { length: 1, width: 1, height: 1 };
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  const vector = catalogPointVector(anchor.position ?? { x: 0, y: 0, z: 0 }, size, scale);

  if (symmetry.length) vector.y = -vector.y;
  if (symmetry.width) vector.x = -vector.x;
  if (symmetry.height) vector.z = -vector.z;

  return vector;
}

function safeRatio(value, max) {
  const n = Number(value);
  const m = Number(max);
  if (!Number.isFinite(n) || !Number.isFinite(m) || m === 0) return 0;
  return Math.min(1, Math.max(0, n / m));
}

function updateAnchorVisibility() {
  for (const instance of state.instances) {
    if (instance.anchors) instance.anchors.visible = IS_EDITOR || state.showAnchors;
  }
  if (dom.showAnchorsInput) dom.showAnchorsInput.checked = state.showAnchors;
  updateStats();
}

function disposeAnchorGroup(group) {
  if (!group) return;
  group.userData.sharedGeometry?.dispose?.();
  group.userData.sharedMaterial?.dispose?.();
}

function createInstance(catalogPiece, options = {}) {
  const id = String(options.id ?? `placed_${String(state.nextInstanceId++).padStart(3, '0')}`);
  const forcedIndex = Number.parseInt(id.replace(/^placed_/, ''), 10);
  if (Number.isFinite(forcedIndex)) state.nextInstanceId = Math.max(state.nextInstanceId, forcedIndex + 1);
  const symmetry = cloneSymmetry(options.symmetry);
  const geometry = buildGeometry(catalogPiece, symmetry);
  const material = createMaterial(options.color ?? dom.colorInput.value ?? DEFAULT_COLOR);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${catalogPiece.id}_${id}`;
  mesh.userData.instanceId = id;

  const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR_VALID, transparent: true, opacity: 0.9 });
  const edges = new THREE.LineSegments(createAssemblyEdgeGeometry(catalogPiece, geometry), edgeMaterial);
  edges.visible = true;
  edges.userData.instanceId = id;

  const anchors = createAnchorGroup(catalogPiece, symmetry);

  const group = new THREE.Group();
  group.name = id;
  group.userData.instanceId = id;
  group.add(mesh);
  group.add(edges);
  group.add(anchors);

  const preferredPosition = options.position
    ? (options.preservePosition ? options.position.clone() : normalizeNewPiecePosition(catalogPiece, options.position))
    : findAvailablePosition(catalogPiece);
  if (!preferredPosition) {
    setMessage('Ajout impossible : aucun emplacement libre trouvé.');
    geometry.dispose();
    edges.geometry.dispose();
    disposeAnchorGroup(anchors);
    material.dispose();
    edgeMaterial.dispose();
    return null;
  }

  group.position.copy(preferredPosition);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);

  const instance = {
    id,
    label: options.label ?? `${catalogPiece.label_fr || catalogPiece.id} #${id.replace('placed_', '')}`,
    catalogPieceId: catalogPiece.id,
    groupId: options.groupId ?? null,
    symmetry,
    rotation: { axis: 'height', quarter_turns: 0, ...(options.rotation ?? {}) },
    group,
    mesh,
    edges,
    anchors,
    material,
    edgeMaterial,
  };

  if (hasCollision(instance, group.position)) {
    setMessage('Ajout impossible : l’emplacement demandé chevauche une autre pièce.');
    disposeInstanceResources(instance);
    return null;
  }

  state.instances.push(instance);
  rootGroup.add(group);
  updateAttachmentStates();
  refreshInstanceList();
  selectInstance(id);
  updateEmptyHint();
  setMessage('');
  return instance;
}

function disposeInstanceResources(instance) {
  instance.mesh.geometry?.dispose?.();
  instance.edges.geometry?.dispose?.();
  instance.material?.dispose?.();
  instance.edgeMaterial?.dispose?.();
  disposeAnchorGroup(instance.anchors);
}

function findAvailablePosition(catalogPiece) {
  const origin = new THREE.Vector3(0, 0, 0);
  if (!state.instances.length) {
    const originBox = getReservationBoxForCatalogPiece(catalogPiece, origin);
    if (!collidesWithOthers(originBox, null)) return origin;
  }

  const targetSize = getReservationBoxForCatalogPiece(catalogPiece, origin).getSize(new THREE.Vector3());
  const reference = getSelectedInstance() ?? state.instances[state.instances.length - 1];
  if (reference) {
    const referenceBox = getInstanceReservationBox(reference);
    const candidates = [
      // Primary rule: add behind the current/last piece on Y. X stays aligned.
      new THREE.Vector3(reference.group.position.x, referenceBox.max.y + targetSize.y / 2, reference.group.position.z),
      // Secondary: in front, still aligned on X.
      new THREE.Vector3(reference.group.position.x, referenceBox.min.y - targetSize.y / 2, reference.group.position.z),
      // Fallbacks aligned on the ship centreline.
      new THREE.Vector3(0, referenceBox.max.y + targetSize.y / 2, reference.group.position.z),
      new THREE.Vector3(0, referenceBox.min.y - targetSize.y / 2, reference.group.position.z),
    ];
    for (const candidate of candidates) {
      if (!collidesWithOthers(getReservationBoxForCatalogPiece(catalogPiece, candidate), null)) return candidate;
    }
  }

  const stepX = Math.max(10, Math.ceil(targetSize.x));
  const stepY = Math.max(10, Math.ceil(targetSize.y));
  const stepZ = Math.max(10, Math.ceil(targetSize.z));
  const levels = [0, stepZ, stepZ * 2, stepZ * 3, stepZ * 4, stepZ * 5];

  for (const z of levels) {
    for (let radius = 0; radius < 20; radius += 1) {
      for (let iy = -radius; iy <= radius; iy += 1) {
        for (let ix = -radius; ix <= radius; ix += 1) {
          if (Math.max(Math.abs(ix), Math.abs(iy)) !== radius) continue;
          const position = new THREE.Vector3(ix * stepX, iy * stepY, z);
          const candidateBox = getReservationBoxForCatalogPiece(catalogPiece, position);
          if (!collidesWithOthers(candidateBox, null)) return position;
        }
      }
    }
  }
  return null;
}

function addCatalogPieceById(pieceId, position = null) {
  const catalogPiece = getCatalogPieceById(pieceId);
  if (!catalogPiece) return null;
  state.selectedCatalogPieceId = catalogPiece.id;
  if (dom.catalogPieceSelect) dom.catalogPieceSelect.value = catalogPiece.id;
  renderCatalogPieceOptions();
  const instance = createInstance(catalogPiece, position ? { position } : {});
  if (instance) {
    fitCameraToObject(instance.group, false);
    markShipDirty();
  }
  return instance;
}

function addSelectedCatalogPiece(position = null) {
  const catalogPiece = getSelectedCatalogPiece();
  if (!catalogPiece) return null;
  return addCatalogPieceById(catalogPiece.id, position);
}

function disposeInstance(instance) {
  rootGroup.remove(instance.group);
  disposeInstanceResources(instance);
}

function removeSelectedInstance() {
  if (getSelectionBatch().length === 1 && state.selectedEntityType === 'group') {
    removeSelectedAssemblyGroup();
    return;
  }

  const selectedInstances = getSelectedInstancesForCommands();
  if (!selectedInstances.length) return;
  for (const instance of selectedInstances) disposeInstance(instance);
  state.instances = state.instances.filter((item) => !selectedInstances.some((selected) => selected.id === item.id));
  clearSelection();
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateEmptyHint();
  updateAttachmentStates();
  updateSelectionBox();
  markShipDirty();
}

function clearScene(options = {}) {
  for (const instance of state.instances) disposeInstance(instance);
  state.instances = [];
  state.assemblyGroups = [];
  state.nextInstanceId = 1;
  state.nextGroupId = 1;
  clearSelection();
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateEmptyHint();
  updateAttachmentStates();
  updateSelectionBox();
  setMessage('');
  if (!options.skipPersist) markShipDirty();
}

function clearSelection() {
  applySelectionState([]);
}

function selectPiece(id) {
  applySelectionState(id ? [{ type: 'piece', id }] : []);
  refreshInstanceList();
  updateSelectionUi();
  renderCatalogPieceOptions();
  updateStats();
  updateSelectionBox();
}

function selectAssemblyGroup(groupId) {
  applySelectionState(groupId ? [{ type: 'group', id: groupId }] : []);
  refreshInstanceList();
  updateSelectionUi();
  renderCatalogPieceOptions();
  updateStats();
  updateSelectionBox();
}

function selectPieceMulti(ids = []) {
  applySelectionState(ids.map((id) => ({ type: 'piece', id })));
  refreshInstanceList();
  updateSelectionUi();
  renderCatalogPieceOptions();
  updateStats();
  updateSelectionBox();
}

function togglePieceInMultiSelection(instanceId) {
  const instance = getInstanceById(instanceId);
  if (!instance || instance.groupId) return;
  const baseIds = state.selectedGroupIds.length
    ? [...state.selectedGroupIds]
    : (state.selectedEntityType === 'piece' && state.selectedId && !getInstanceById(state.selectedId)?.groupId
      ? [state.selectedId]
      : []);
  const nextIds = baseIds.includes(instanceId)
    ? baseIds.filter((id) => id !== instanceId)
    : [...baseIds, instanceId];
  selectPieceMulti(nextIds);
}

function getConnectedInstanceIds(instances) {
  if (!instances.length) return new Set();
  const selectedIds = new Set(instances.map((instance) => instance.id));
  const adjacency = new Map(instances.map((instance) => [instance.id, new Set()]));
  for (let i = 0; i < instances.length; i += 1) {
    for (let j = i + 1; j < instances.length; j += 1) {
      const a = instances[i];
      const b = instances[j];
      if (!instancesHaveCompatibleAnchors(a, b)) continue;
      adjacency.get(a.id)?.add(b.id);
      adjacency.get(b.id)?.add(a.id);
    }
  }

  const connected = new Set();
  const queue = [instances[0].id];
  while (queue.length) {
    const current = queue.shift();
    if (connected.has(current) || !selectedIds.has(current)) continue;
    connected.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!connected.has(next)) queue.push(next);
    }
  }
  return connected;
}

function validateAssemblyGroupConnectivity(instances) {
  if (instances.length < 2) return { valid: false, message: 'Groupe refusé : sélectionne au moins 2 pièces libres.' };
  const connectedIds = getConnectedInstanceIds(instances);
  if (connectedIds.size === instances.length) return { valid: true, message: '' };
  return {
    valid: false,
    message: 'Groupe refusé : toutes les pièces du groupe doivent être reliées entre elles par des ancres compatibles.',
  };
}

function selectInstance(id) {
  selectPiece(id);
}

function createAssemblyGroupFromSelection() {
  const selectedIds = [...new Set(state.selectedGroupIds.filter(Boolean))];
  if (selectedIds.length < 2) {
    setMessage('Groupe refusé : sélectionne au moins 2 pièces libres.');
    return null;
  }
  const instances = selectedIds.map(getInstanceById).filter(Boolean);
  if (instances.length !== selectedIds.length || instances.some((instance) => instance.groupId)) {
    setMessage('Groupe refusé : la sélection contient une pièce déjà groupée.');
    return null;
  }
  const connectivity = validateAssemblyGroupConnectivity(instances);
  if (!connectivity.valid) {
    setMessage(connectivity.message);
    return null;
  }

  const bbox = computeBoundingBoxFromBoxes(instances.map((instance) => getInstanceBox(instance)));
  const origin = bbox.min.clone();
  const group = {
    id: createNextGroupId(),
    type: 'group',
    name: `Groupe ${String(state.nextGroupId - 1).padStart(3, '0')}`,
    origin,
    pivot: computeBoundingCenter(bbox),
    bbox,
    children: instances.map((instance) => ({
      instanceId: instance.id,
      localPosition: instance.group.position.clone().sub(origin),
    })),
    metadata: {
      createdFromSelection: true,
      canUngroup: true,
      savedAsModel: false,
    },
  };

  for (const instance of instances) instance.groupId = group.id;
  state.assemblyGroups.push(group);
  refreshAssemblyGroupRuntime(group);
  syncGroupInstanceWorldPositions(group);
  selectAssemblyGroup(group.id);
  updateAttachmentStates();
  markShipDirty();
  return group;
}

function ungroupAssemblyGroup(group, options = {}) {
  if (!group) return false;
  for (const childRef of group.children) {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) continue;
    instance.groupId = null;
    instance.group.position.copy(group.origin.clone().add(childRef.localPosition));
  }
  state.assemblyGroups = state.assemblyGroups.filter((item) => item.id !== group.id);
  if (!options.skipSelection) selectPieceMulti(group.children.map((child) => child.instanceId));
  return true;
}

function ungroupSelectedAssemblyGroup() {
  const group = getSelectedAssemblyGroup();
  if (!group) return;
  if (!ungroupAssemblyGroup(group)) return;
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateSelectionBox();
  updateAttachmentStates();
  markShipDirty();
}

function removeSelectedAssemblyGroup() {
  const group = getSelectedAssemblyGroup();
  if (!group) return;
  const childIds = new Set(group.children.map((child) => child.instanceId));
  for (const instance of state.instances.filter((item) => childIds.has(item.id))) disposeInstance(instance);
  state.instances = state.instances.filter((item) => !childIds.has(item.id));
  state.assemblyGroups = state.assemblyGroups.filter((item) => item.id !== group.id);
  clearSelection();
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateEmptyHint();
  updateAttachmentStates();
  updateSelectionBox();
  markShipDirty();
}

function refreshInstanceList() {
  dom.instanceSelect.innerHTML = '';
  for (const entry of getVisibleAssemblyEntries()) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.dataset.entryType = entry.type;
    if (entry.type === 'group') {
      const group = getAssemblyGroupById(entry.id);
      option.textContent = `${group?.name ?? entry.label} · groupe · ${group?.children.length ?? 0} pièce(s)`;
      option.selected = state.selectedEntityType === 'group' && state.selectedId === entry.id;
    } else {
      const instance = getInstanceById(entry.id);
      option.textContent = `${entry.label} · sym: ${getSymmetryLabel(instance?.symmetry ?? {})}`;
      option.selected = state.selectedEntityType === 'piece'
        ? state.selectedId === entry.id
        : state.selectedGroupIds.includes(entry.id);
    }
    dom.instanceSelect.append(option);
  }
}

function updateSelectionUi() {
  const selectedBatch = getSelectionBatch();
  const selected = selectedBatch.length === 1 ? getSelectedInstance() : null;
  const selectedAssemblyGroup = selectedBatch.length === 1 ? getSelectedAssemblyGroup() : null;
  const hasSelected = selectedBatch.length > 0;
  for (const element of selectedControls) element.disabled = !hasSelected;

  if (!hasSelected) {
    dom.colorInput.value = DEFAULT_COLOR;
    setSymmetryButtonState({ length: false, width: false, height: false });
    return;
  }

  if (selected) {
    dom.colorInput.value = `#${selected.material.color.getHexString()}`;
    setSymmetryButtonState(selected.symmetry);
    return;
  }

  if (!selectedAssemblyGroup) {
    dom.colorInput.value = DEFAULT_COLOR;
    setSymmetryButtonState({ length: false, width: false, height: false });
    return;
  }

  const firstChild = getInstanceById(selectedAssemblyGroup.children[0]?.instanceId);
  dom.colorInput.value = firstChild ? `#${firstChild.material.color.getHexString()}` : DEFAULT_COLOR;
  setSymmetryButtonState({ length: false, width: false, height: false });
}

function setSymmetryButtonState(symmetry) {
  dom.mirrorLengthBtn.classList.toggle('active', Boolean(symmetry.length));
  dom.mirrorWidthBtn.classList.toggle('active', Boolean(symmetry.width));
  dom.mirrorHeightBtn.classList.toggle('active', Boolean(symmetry.height));
}

function mountSymmetryButtonIcons() {
  const entries = [
    { button: dom.mirrorWidthBtn, axis: 'width', title: 'Symétrie largeur' },
    { button: dom.mirrorLengthBtn, axis: 'length', title: 'Symétrie longueur' },
    { button: dom.mirrorHeightBtn, axis: 'height', title: 'Symétrie hauteur' },
  ];
  for (const { button, axis, title } of entries) {
    if (!button) continue;
    button.textContent = '';
    button.title = title;
    const icon = document.createElement('img');
    icon.className = 'shape-symmetry-icon';
    icon.src = SYMMETRY_BUTTON_ICONS[axis];
    icon.alt = title;
    icon.draggable = false;
    button.append(icon);
  }
}

function toggleSelectedSymmetry(axis) {
  const selectedGroup = getSelectedAssemblyGroup();
  if (selectedGroup) {
    applyAssemblyGroupSymmetry(selectedGroup, axis);
    return;
  }

  const selected = getSelectedInstance();
  if (!selected) return;

  const catalogPiece = getCatalogPieceById(selected.catalogPieceId);
  const shape = getShapeVariant(catalogPiece?.shape_variant_id);
  if (shape?.allowed_symmetry?.[axis] === false) {
    setMessage(`Symétrie ${axis} désactivée pour cette variante.`);
    return;
  }

  const nextSymmetry = cloneSymmetry(selected.symmetry);
  nextSymmetry[axis] = !nextSymmetry[axis];
  applySymmetryState(selected, nextSymmetry);
}

function resetSelectedSymmetries() {
  const selectedGroup = getSelectedAssemblyGroup();
  if (selectedGroup) return;
  const selected = getSelectedInstance();
  if (!selected) return;
  applySymmetryState(selected, { length: false, width: false, height: false });
}

function applyAssemblyGroupSymmetry(group, axis) {
  if (!group) return;
  refreshAssemblyGroupRuntime(group);
  const size = group.bbox.getSize(new THREE.Vector3());
  const axisKey = axis === 'width' ? 'x' : axis === 'length' ? 'y' : 'z';
  const axisSizeKey = axis === 'width' ? 'x' : axis === 'length' ? 'y' : 'z';
  const nextChildren = group.children.map((childRef) => {
    const instance = getInstanceById(childRef.instanceId);
    const nextLocal = childRef.localPosition.clone();
    if (!instance) return { ...childRef };
    const pieceSize = getInstanceBoxSize(instance);
    nextLocal[axisKey] = size[axisSizeKey] - childRef.localPosition[axisKey] - pieceSize[axisSizeKey];
    return {
      instanceId: childRef.instanceId,
      localPosition: nextLocal,
      nextSymmetry: {
        ...instance.symmetry,
        [axis]: !instance.symmetry?.[axis],
      },
    };
  });

  const candidateBoxes = nextChildren.map((childRef) => {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) return null;
    return getInstanceBox(instance, group.origin.clone().add(childRef.localPosition));
  }).filter(Boolean);
  const ignoredInstanceIds = new Set(group.children.map((child) => child.instanceId));
  if (collidesBoxesWithScene(candidateBoxes, { ignoredInstanceIds, ignoredGroupId: group.id })) {
    setMessage('Symétrie groupe refusée : collision avec une autre pièce.');
    return;
  }

  for (const childRef of nextChildren) {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) continue;
    applySymmetryState(instance, childRef.nextSymmetry, { skipCollisionCheck: true, skipDirtyMark: true });
  }
  group.children = nextChildren.map(({ instanceId, localPosition }) => ({ instanceId, localPosition }));
  refreshAssemblyGroupRuntime(group);
  syncGroupInstanceWorldPositions(group);
  refreshInstanceList();
  updateStats();
  updateSelectionBox();
  setMessage('');
  markShipDirty();
}

function applySymmetryState(instance, nextSymmetry, options = {}) {
  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  if (!catalogPiece) return;

  const nextGeometry = buildGeometry(catalogPiece, nextSymmetry);
  const candidateBox = getReservationBoxForCatalogPiece(catalogPiece, instance.group.position);
  if (!options.skipCollisionCheck && collidesWithOthers(candidateBox, instance.id, { ignoredGroupId: instance.groupId ?? null })) {
    nextGeometry.dispose();
    setMessage('Symétrie refusée : collision avec une autre pièce.');
    return;
  }

  const oldMeshGeometry = instance.mesh.geometry;
  const oldEdgesGeometry = instance.edges.geometry;
  const oldAnchorGroup = instance.anchors;

  instance.mesh.geometry = nextGeometry;
  instance.edges.geometry = createAssemblyEdgeGeometry(catalogPiece, nextGeometry);
  instance.edges.visible = true;
  instance.anchors = createAnchorGroup(catalogPiece, nextSymmetry);
  instance.group.remove(oldAnchorGroup);
  instance.group.add(instance.anchors);
  updateAnchorVisibility();
  instance.symmetry = cloneSymmetry(nextSymmetry);

  oldMeshGeometry?.dispose?.();
  oldEdgesGeometry?.dispose?.();
  disposeAnchorGroup(oldAnchorGroup);

  setSymmetryButtonState(instance.symmetry);
  refreshInstanceList();
  updateStats();
  updateSelectionBox();
  setMessage('');
  if (!options.skipDirtyMark) markShipDirty();
}

function getBoxAt(geometry, position) {
  geometry.computeBoundingBox();
  return geometry.boundingBox.clone().translate(position);
}

function getReservationBoxForCatalogPiece(catalogPiece, position = new THREE.Vector3()) {
  const size = getSize(catalogPiece?.size_id) ?? { dimensions: { length: 4, width: 3, height: 1 } };
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  return createCatalogReservationBox(size, scale, position);
}

function getInstanceReservationBox(instance, position = instance.group.position) {
  const catalogPiece = getCatalogPieceById(instance?.catalogPieceId);
  return getReservationBoxForCatalogPiece(catalogPiece, position);
}

function getInstanceBox(instance, position = instance.group.position) {
  return getInstanceReservationBox(instance, position);
}

function getInstanceBoxSize(instance) {
  return getInstanceReservationBox(instance).getSize(new THREE.Vector3());
}

function getGroupChildWorldPosition(group, childRef, origin = group.origin) {
  return origin.clone().add(childRef.localPosition);
}

function getGroupChildBoxes(group, origin = group.origin) {
  return group.children.map((childRef) => {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) return null;
    return getInstanceBox(instance, getGroupChildWorldPosition(group, childRef, origin));
  }).filter(Boolean);
}

function computeBoundingBoxFromBoxes(boxes) {
  const box = new THREE.Box3();
  for (const childBox of boxes) box.union(childBox);
  return box;
}

function computeGroupBoundingBox(group, origin = group.origin) {
  return computeBoundingBoxFromBoxes(getGroupChildBoxes(group, origin));
}

function computeBoundingCenter(box) {
  return box.getCenter(new THREE.Vector3());
}

function syncGroupInstanceWorldPositions(group, origin = group.origin) {
  for (const childRef of group.children) {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) continue;
    instance.group.position.copy(getGroupChildWorldPosition(group, childRef, origin));
  }
}

function refreshAssemblyGroupRuntime(group) {
  group.bbox = computeGroupBoundingBox(group, group.origin);
  group.pivot = computeBoundingCenter(group.bbox);
}

function setGroupWorldPosition(group, nextOrigin) {
  group.origin.copy(nextOrigin);
  refreshAssemblyGroupRuntime(group);
  syncGroupInstanceWorldPositions(group);
}

function getGroupExternalAnchors(group, origin = group.origin) {
  const groupBoxes = group.children.map((childRef) => {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) return null;
    return {
      instanceId: childRef.instanceId,
      box: getInstanceBox(instance, getGroupChildWorldPosition(group, childRef, origin)),
    };
  }).filter(Boolean);
  const step = getMagnetStep();
  const outwardDistance = Math.max(step * 0.26, 1);
  const anchors = [];

  for (const childRef of group.children) {
    const instance = getInstanceById(childRef.instanceId);
    if (!instance) continue;
    const childOrigin = getGroupChildWorldPosition(group, childRef, origin);
    const childAnchors = getWorldAttachmentAnchors(getCatalogPieceById(instance.catalogPieceId), instance.symmetry, childOrigin);
    for (const anchor of childAnchors) {
      const outwardPoint = anchor.position.clone().add(anchor.normal.clone().multiplyScalar(outwardDistance));
      const blockedInsideGroup = groupBoxes.some(({ instanceId, box }) => instanceId !== instance.id && box.containsPoint(outwardPoint));
      if (blockedInsideGroup) continue;
      anchors.push({
        ...anchor,
        ownerType: 'group',
        ownerId: group.id,
        sourcePieceId: instance.id,
      });
    }
  }

  return anchors;
}

function isGroupPlacementValid(group, origin = group.origin, options = {}) {
  const candidateBoxes = getGroupChildBoxes(group, origin);
  const ignoredIds = new Set(group.children.map((child) => child.instanceId));
  if (options.extraIgnoredIds) {
    for (const id of options.extraIgnoredIds) ignoredIds.add(id);
  }
  return !collidesBoxesWithScene(candidateBoxes, { ignoredInstanceIds: ignoredIds, ignoredGroupId: group.id });
}

function boxesOverlap(a, b) {
  return (
    a.min.x < b.max.x - COLLISION_EPSILON &&
    a.max.x > b.min.x + COLLISION_EPSILON &&
    a.min.y < b.max.y - COLLISION_EPSILON &&
    a.max.y > b.min.y + COLLISION_EPSILON &&
    a.min.z < b.max.z - COLLISION_EPSILON &&
    a.max.z > b.min.z + COLLISION_EPSILON
  );
}

function collidesBoxesWithScene(candidateBoxes, options = {}) {
  const boxes = Array.isArray(candidateBoxes) ? candidateBoxes : [candidateBoxes];
  const ignoredInstanceIds = options.ignoredInstanceIds ?? new Set();
  const ignoredGroupId = options.ignoredGroupId ?? null;
  for (const instance of state.instances) {
    if (ignoredInstanceIds.has(instance.id)) continue;
    if (instance.groupId) continue;
    const instanceBox = getInstanceBox(instance);
    if (boxes.some((candidateBox) => boxesOverlap(candidateBox, instanceBox))) return true;
  }

  for (const group of state.assemblyGroups) {
    if (group.id === ignoredGroupId) continue;
    const groupBoxes = getGroupChildBoxes(group);
    for (const candidateBox of boxes) {
      if (groupBoxes.some((groupBox) => boxesOverlap(candidateBox, groupBox))) return true;
    }
  }
  return false;
}

function collidesWithOthers(candidateBox, ignoredInstanceId, options = {}) {
  const ignoredInstanceIds = new Set(options.ignoredInstanceIds ?? []);
  if (ignoredInstanceId) ignoredInstanceIds.add(ignoredInstanceId);
  return collidesBoxesWithScene([candidateBox], {
    ignoredInstanceIds,
    ignoredGroupId: options.ignoredGroupId ?? null,
  });
}

function hasCollision(instance, position) {
  return collidesWithOthers(getInstanceBox(instance, position), instance.id, {
    ignoredGroupId: instance.groupId ?? null,
  });
}

function calculateShipStatsForInstances(instances) {
  const definitions = state.catalog?.definitions?.spec_fields ?? {};
  const result = {};
  const accumulators = {};

  for (const fieldId of Object.keys(definitions)) {
    result[fieldId] = { value: 0, unit: definitions[fieldId].unit ?? null, status: 'confirmed' };
    accumulators[fieldId] = { weightedValue: 0, weight: 0, unknown: false };
  }

  for (const instance of instances) {
    const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
    const profile = getEffectiveSpecProfile(catalogPiece?.spec_profile_id);
    const specs = profile?.specs ?? {};

    for (const [fieldId, definition] of Object.entries(definitions)) {
      const spec = specs[fieldId];
      const aggregation = definition.aggregation ?? 'sum';
      const value = spec?.value;
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        if (spec?.status !== 'confirmed') result[fieldId].status = 'unknown';
        if (aggregation === 'weighted_average') accumulators[fieldId].unknown = true;
        continue;
      }

      if (aggregation === 'weighted_average') {
        const weightField = definition.weighted_by ?? 'mass';
        const weight = Number(specs[weightField]?.value);
        if (!Number.isFinite(weight) || weight <= 0) {
          accumulators[fieldId].unknown = true;
          continue;
        }
        accumulators[fieldId].weightedValue += Number(value) * weight;
        accumulators[fieldId].weight += weight;
      } else {
        result[fieldId].value += Number(value);
      }
    }
  }

  for (const [fieldId, definition] of Object.entries(definitions)) {
    if (definition.aggregation !== 'weighted_average') continue;
    const acc = accumulators[fieldId];
    if (acc.weight > 0) {
      result[fieldId].value = acc.weightedValue / acc.weight;
      result[fieldId].status = acc.unknown ? 'partial' : 'confirmed';
    } else {
      result[fieldId].value = null;
      result[fieldId].status = 'unknown';
    }
  }

  if (instances.length === 0) {
    for (const [fieldId, field] of Object.entries(result)) {
      if (definitions[fieldId]?.aggregation === 'weighted_average') field.value = null;
      else field.value = 0;
    }
  }

  return result;
}

function calculateShipStats() {
  return calculateShipStatsForInstances(state.instances);
}

function getActiveStatsSelection() {
  const selectedEntities = getSelectionBatch();
  if (selectedEntities.length === 1 && selectedEntities[0].type === 'group') {
    const selectedAssemblyGroup = getAssemblyGroupById(selectedEntities[0].id);
    if (!selectedAssemblyGroup) return { label: null, instances: state.instances, fallbackMissingToZero: false };
    return {
      label: `${selectedAssemblyGroup.name} (${selectedAssemblyGroup.children.length} pièce(s))`,
      instances: selectedAssemblyGroup.children.map((child) => getInstanceById(child.instanceId)).filter(Boolean),
      fallbackMissingToZero: false,
    };
  }

  if (selectedEntities.length > 1) {
    const selectedInstances = getSelectedInstancesForCommands();
    return {
      label: `Sélection (${selectedInstances.length} pièce(s))`,
      instances: selectedInstances,
      fallbackMissingToZero: false,
    };
  }

  const selected = selectedEntities.length === 1 && selectedEntities[0].type === 'piece'
    ? getInstanceById(selectedEntities[0].id)
    : null;
  if (selected) {
    return {
      label: selected.label,
      instances: [selected],
      fallbackMissingToZero: true,
    };
  }

  return {
    label: null,
    instances: state.instances,
    fallbackMissingToZero: false,
  };
}

function formatStatsLines(computed, options = {}) {
  const { fallbackMissingToZero = false } = options;
  const definitions = state.catalog?.definitions?.spec_fields ?? {};
  return Object.entries(definitions).map(([fieldId, definition]) => {
    const item = computed[fieldId] ?? { value: null, unit: definition.unit ?? null };
    const value = item.value === null
      ? (fallbackMissingToZero ? '0' : 'inconnu')
      : fmt(item.value);
    return `${definition.label_fr} : ${value}${item.unit ? ` ${item.unit}` : ''}`;
  });
}

function updateStats() {
  const selection = getActiveStatsSelection();
  const shipStatsLines = formatStatsLines(calculateShipStats(), { fallbackMissingToZero: false });
  const selectionStatsLines = selection.label
    ? formatStatsLines(
      calculateShipStatsForInstances(selection.instances),
      { fallbackMissingToZero: selection.fallbackMissingToZero },
    )
    : [];

  if (dom.shipStats) {
    dom.shipStats.textContent = [
      ...shipStatsLines,
      state.lastMessage ? '' : null,
      state.lastMessage || null,
    ].filter(Boolean).join('\n');
  }

  if (!selection.label) {
    if (dom.selectionStatsOverlay) dom.selectionStatsOverlay.hidden = true;
    if (dom.selectionStatsTitle) dom.selectionStatsTitle.textContent = 'Info pièce';
    if (dom.selectionStats) dom.selectionStats.textContent = 'Aucune sélection active.';
    return;
  }

  if (dom.selectionStatsOverlay) dom.selectionStatsOverlay.hidden = false;
  if (dom.selectionStatsTitle) {
    dom.selectionStatsTitle.textContent = getSelectionBatch().length !== 1 || getSelectedAssemblyGroup() ? 'Info groupe' : 'Info pièce';
  }
  if (dom.selectionStats) {
    dom.selectionStats.textContent = [
    selection.label,
    '',
    ...selectionStatsLines,
    state.lastMessage ? '' : null,
    state.lastMessage || null,
  ].filter(Boolean).join('\n');
  }
}

function setMessage(message) {
  state.lastMessage = message;
  updateStats();
}

function markShipDirty() {
  const task = state.persistence?.markSceneDirty?.();
  task?.catch((error) => {
    setMessage(error?.message ?? 'Autosave impossible.');
  });
}

function getHistoryEntitySelection(entities = []) {
  if (entities.length) return entities.map((entity) => ({ type: entity.type, id: entity.id }));
  const selection = getSelectionBatch();
  if (selection.length) return selection.map((entity) => ({ type: entity.type, id: entity.id }));
  return [];
}

function captureMovementSnapshot(entities = []) {
  return getHistoryEntitySelection(entities).map((entity) => {
    if (entity.type === 'group') {
      const group = getAssemblyGroupById(entity.id);
      return group ? {
        type: 'group',
        id: group.id,
        position: vectorToPlain(group.origin),
      } : null;
    }
    const instance = getInstanceById(entity.id);
    return instance ? {
      type: 'piece',
      id: instance.id,
      position: vectorToPlain(instance.group.position),
    } : null;
  }).filter(Boolean);
}

function applyMovementSnapshot(snapshot = []) {
  for (const item of snapshot) {
    const position = cloneVector3Like(item.position);
    if (item.type === 'group') {
      const group = getAssemblyGroupById(item.id);
      if (!group) continue;
      setGroupWorldPosition(group, position);
      continue;
    }
    const instance = getInstanceById(item.id);
    if (!instance) continue;
    instance.group.position.copy(position);
  }
  updateAttachmentStates();
  updateStats();
  updateSelectionBox();
  setMessage('');
  markShipDirty();
}

function recordMovementCommand(before, after, entities = [], label = 'Move selection') {
  if (!before?.length || !after?.length) return false;
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  return historyStack.push(createMoveCommand({
    label,
    affectedIds: entities.map((entity) => entity.id),
    before,
    after,
    applySnapshot: applyMovementSnapshot,
  }));
}

function runPersistenceTask(task, fallbackMessage) {
  task?.catch((error) => {
    setMessage(error?.message ?? fallbackMessage);
  });
}

function fmt(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function getSelectedInstancesForCommands() {
  const instances = [];
  const seen = new Set();
  for (const entity of getSelectionBatch()) {
    if (entity.type === 'group') {
      const group = getAssemblyGroupById(entity.id);
      for (const child of group?.children ?? []) {
        if (seen.has(child.instanceId)) continue;
        const instance = getInstanceById(child.instanceId);
        if (!instance) continue;
        seen.add(instance.id);
        instances.push(instance);
      }
      continue;
    }

    if (seen.has(entity.id)) continue;
    const instance = getInstanceById(entity.id);
    if (!instance) continue;
    seen.add(instance.id);
    instances.push(instance);
  }
  return instances;
}

function copySelectedInstances() {
  const instances = getSelectedInstancesForCommands();
  if (!instances.length) return false;

  state.copiedSelection = instances.map((instance) => ({
    catalogPieceId: instance.catalogPieceId,
    symmetry: cloneSymmetry(instance.symmetry),
    color: `#${instance.material.color.getHexString()}`,
    position: instance.group.position.clone(),
  }));
  setMessage(`${instances.length} pièce(s) copiée(s).`);
  return true;
}

function pasteCopiedInstances() {
  const copiedSelection = Array.isArray(state.copiedSelection) ? state.copiedSelection : [];
  if (!copiedSelection.length) return false;

  const created = [];
  const offset = new THREE.Vector3(40, 0, 0);
  const basePosition = copiedSelection[0].position.clone();
  for (const item of copiedSelection) {
    const catalogPiece = getCatalogPieceById(item.catalogPieceId);
    if (!catalogPiece) continue;

    const relativePosition = item.position.clone().sub(basePosition);
    const preferredPosition = basePosition.clone().add(offset).add(relativePosition);
    const candidateBox = getReservationBoxForCatalogPiece(catalogPiece, preferredPosition);
    const position = collidesWithOthers(candidateBox, null)
      ? findAvailablePosition(catalogPiece)
      : preferredPosition;

    const clone = createInstance(catalogPiece, {
      symmetry: item.symmetry,
      color: item.color,
      position,
    });
    if (clone) created.push(clone);
  }

  if (!created.length) return false;
  fitCameraToObject(created[0].group, false);
  markShipDirty();
  setMessage(`${created.length} pièce(s) collée(s).`);
  return true;
}

function updateEmptyHint() {
  dom.emptyHint.style.display = state.instances.length === 0 ? 'block' : 'none';
  dom.clearSceneBtn.disabled = state.instances.length === 0;
}

function updateSelectionBox() {
  const selectedEntities = getSelectionBatch();
  if (selectedEntities.length === 1 && selectedEntities[0].type === 'group') {
    const selectedGroup = getAssemblyGroupById(selectedEntities[0].id);
    if (!selectedGroup) return;
    refreshAssemblyGroupRuntime(selectedGroup);
    selectionBox.box.copy(selectedGroup.bbox);
    selectionBox.visible = true;
    return;
  }

  const selectedInstances = getSelectedInstancesForCommands();
  if (selectedInstances.length > 1) {
    selectionBox.box.copy(computeBoundingBoxFromBoxes(selectedInstances.map((instance) => getInstanceReservationBox(instance))));
    selectionBox.visible = true;
    return;
  }

  const selected = selectedInstances[0] ?? null;
  if (!selected) {
    selectionBox.visible = false;
    return;
  }
  selectionBox.box.copy(getInstanceReservationBox(selected));
  selectionBox.visible = true;
}

function fitCameraToObject(object, renderNow = true) {
  if (!object) return;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  fitOrthographicBox(box, 1.35);
  orbitControls.target.copy(center);
  positionCameraForCurrentView(center);
  orbitControls.update();

  if (renderNow) renderer.render(scene, camera);
}

function fitCameraToAll(renderNow = true) {
  if (state.instances.length === 0) {
    setAssemblyView(state.viewMode || 'top', false);
    updateOrthographicFrustum(1000);
    return;
  }
  const box = new THREE.Box3().setFromObject(rootGroup);
  if (box.isEmpty()) return;
  fitOrthographicBox(box, 1.25);
  const center = box.getCenter(new THREE.Vector3());
  orbitControls.target.copy(center);
  positionCameraForCurrentView(center);
  orbitControls.update();
  if (renderNow) renderer.render(scene, camera);
}

function fitCurrentSelection(renderNow = true) {
  const selectedEntities = getSelectionBatch();
  if (selectedEntities.length === 1 && selectedEntities[0].type === 'group') {
    const selectedGroup = getAssemblyGroupById(selectedEntities[0].id);
    if (!selectedGroup) return;
    refreshAssemblyGroupRuntime(selectedGroup);
    fitOrthographicBox(selectedGroup.bbox, 1.35);
    const center = selectedGroup.bbox.getCenter(new THREE.Vector3());
    orbitControls.target.copy(center);
    positionCameraForCurrentView(center);
    orbitControls.update();
    if (renderNow) renderer.render(scene, camera);
    return;
  }

  const selectedInstances = getSelectedInstancesForCommands();
  if (selectedInstances.length > 1) {
    const box = computeBoundingBoxFromBoxes(selectedInstances.map((instance) => getInstanceReservationBox(instance)));
    fitOrthographicBox(box, 1.35);
    const center = box.getCenter(new THREE.Vector3());
    orbitControls.target.copy(center);
    positionCameraForCurrentView(center);
    orbitControls.update();
    if (renderNow) renderer.render(scene, camera);
    return;
  }

  const selected = selectedInstances[0] ?? null;
  if (selected) fitCameraToObject(selected.group, renderNow);
}

function fitOrthographicBox(box, padding = 1.25) {
  const size = box.getSize(new THREE.Vector3());
  let viewWidth = Math.max(size.x, 100);
  let viewHeight = Math.max(size.y, 100);
  const projectionPlane = getAssemblyProjectionPlane(state.viewMode);
  if (projectionPlane === 'xz') {
    viewWidth = Math.max(size.x, 100);
    viewHeight = Math.max(size.z, 100);
  } else if (projectionPlane === 'yz') {
    viewWidth = Math.max(size.y, 100);
    viewHeight = Math.max(size.z, 100);
  }
  const canvasWidth = Math.max(1, dom.canvas.clientWidth || 1);
  const canvasHeight = Math.max(1, dom.canvas.clientHeight || 1);
  const aspect = canvasWidth / canvasHeight;
  const requiredViewSize = Math.max(viewHeight, viewWidth / aspect) * padding;
  updateOrthographicFrustum(Math.max(240, requiredViewSize));
}

function resetView() {
  assemblyViewController?.resetView(true);
}

function takeScreenshot() {
  const link = document.createElement('a');
  const selected = getSelectedInstance();
  link.download = selected ? `${selected.label.replaceAll(' ', '_')}.png` : 'spacecraft_scene.png';
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
}

function setAssemblyView(mode = 'top', fit = true) {
  assemblyViewController?.setView(mode, fit);
}

function positionCameraForCurrentView(center) {
  assemblyViewController?.positionCameraForTarget(center);
}

function setActiveViewButton(mode) {
  const legacyMode = getLegacyAssemblyButtonViewId(mode);
  for (const [button, value] of [[null, 'top'], [null, 'front'], [null, LEGACY_ASSEMBLY_SIDE_VIEW_ID]]) {
    button?.classList.toggle('active', value === legacyMode);
  }
}

function resize() {
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  const expectedWidth = Math.floor(width * renderer.getPixelRatio());
  const expectedHeight = Math.floor(height * renderer.getPixelRatio());
  const needsResize = dom.canvas.width !== expectedWidth || dom.canvas.height !== expectedHeight;
  if (needsResize) {
    renderer.setSize(width, height, false);
    updateOrthographicFrustum();
  }
}

function updateOrthographicFrustum(viewSize = camera.userData.viewSize ?? 1000) {
  const width = Math.max(1, dom.canvas.clientWidth || 1);
  const height = Math.max(1, dom.canvas.clientHeight || 1);
  const aspect = width / height;
  camera.userData.viewSize = viewSize;
  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}

function mountAssemblyNavigationCube() {
  if (!dom.viewportStage || assemblyNavigationCubeOverlay) return;
  const viewApi = createNavigationCubeViewApi({
    setView(viewId) {
      assemblyViewController?.setView(viewId, true);
    },
    resetView() {
      assemblyViewController?.resetView(true);
    },
    getActiveViewId() {
      return state.viewMode;
    },
  });
  assemblyNavigationCubeOverlay = createNavigationCubeOverlay({
    container: dom.viewportStage,
    viewApi,
  });
  assemblyNavigationCubeOverlay.mount();
  if (dom.gridInput) {
    dom.gridInput.hidden = false;
    const gridToggle = document.createElement('label');
    gridToggle.className = 'navigation-cube-grid-toggle';
    gridToggle.append(dom.gridInput, document.createTextNode('Grille'));
    assemblyNavigationCubeOverlay.element.querySelector('.navigation-cube-card')?.append(gridToggle);
  }
  if (dom.showAnchorsInput) {
    dom.showAnchorsInput.hidden = false;
    const anchorsToggle = document.createElement('label');
    anchorsToggle.className = 'navigation-cube-grid-toggle';
    anchorsToggle.append(dom.showAnchorsInput, document.createTextNode('Afficher ancres'));
    assemblyNavigationCubeOverlay.element.querySelector('.navigation-cube-card')?.append(anchorsToggle);
  }
  assemblyNavigationCubeOverlay.setActiveViewId(state.viewMode);
  updateAnchorVisibility();
}

assemblyViewController = createAssemblyViewController({
  camera,
  orbitControls,
  getTarget: () => (orbitControls.target.lengthSq() ? orbitControls.target.clone() : new THREE.Vector3(0, 0, 0)),
  getActiveViewId: () => state.viewMode,
  setActiveViewId: (viewId) => {
    state.viewMode = normalizeViewId(viewId);
  },
  fitView: () => fitCameraToAll(false),
  updateProjection: () => updateOrthographicFrustum(camera.userData.viewSize ?? 1000),
  updateAfterViewChange: (viewId) => {
    setActiveViewButton(viewId);
    assemblyNavigationCubeOverlay?.setActiveViewId(viewId);
  },
});

function animate() {
  requestAnimationFrame(animate);
  resize();
  orbitControls.update();
  updateSelectionBox();
  renderer.render(scene, camera);
}

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickInstance(event) {
  if (state.instances.length === 0) return null;
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const meshes = state.instances.map((instance) => instance.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;
  const instanceId = hits[0].object.userData.instanceId;
  return state.instances.find((item) => item.id === instanceId) ?? null;
}

function getSelectableEntityFromInstance(instance) {
  if (!instance) return null;
  if (instance.groupId) return { type: 'group', id: instance.groupId, instanceId: instance.id };
  return { type: 'piece', id: instance.id, instanceId: instance.id };
}

function pickSelectableEntity(event) {
  return getSelectableEntityFromInstance(pickInstance(event));
}

function isInteractionBlockedTarget(target) {
  return Boolean(target?.closest?.('.stats-overlay, .help-overlay, .navigation-cube-card, .left-panel'));
}

function refreshSelectionAfterChange() {
  refreshInstanceList();
  updateSelectionUi();
  renderCatalogPieceOptions();
  updateStats();
  updateSelectionBox();
}

function selectEntities(entities) {
  applySelectionState(entities);
  refreshSelectionAfterChange();
}

function clearSelectionAndRefresh() {
  clearSelection();
  refreshSelectionAfterChange();
}

function toggleSelectionEntity(entity) {
  const resolved = normalizeSelectionEntity(entity);
  if (!resolved) return;
  const next = getSelectionBatch();
  const index = next.findIndex((item) => item.type === resolved.type && item.id === resolved.id);
  if (index >= 0) next.splice(index, 1);
  else next.push(resolved);
  selectEntities(next);
}

function resolveDragSelection(selectable) {
  if (selectionContainsEntity(selectable) && getSelectionBatch().length > 1) return getSelectionBatch();
  return [selectable];
}

function projectWorldPointToViewport(point) {
  const viewportRect = dom.viewportStage.getBoundingClientRect();
  const projected = point.clone().project(camera);
  return {
    x: ((projected.x + 1) * 0.5) * viewportRect.width,
    y: ((1 - projected.y) * 0.5) * viewportRect.height,
    visible: projected.z >= -1 && projected.z <= 1,
  };
}

function isScreenPointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function collectMarqueeSelection(rect, minAnchorCount = 3) {
  const selected = [];

  for (const group of state.assemblyGroups) {
    const anchors = getGroupExternalAnchors(group);
    let count = 0;
    for (const anchor of anchors) {
      const projected = projectWorldPointToViewport(anchor.position);
      if (projected.visible && isScreenPointInsideRect(projected, rect)) count += 1;
      if (count >= minAnchorCount) break;
    }
    if (count >= minAnchorCount) selected.push({ type: 'group', id: group.id });
  }

  for (const instance of getLooseInstances()) {
    const anchors = getWorldAttachmentAnchorsForInstance(instance);
    let count = 0;
    for (const anchor of anchors) {
      const projected = projectWorldPointToViewport(anchor.position);
      if (projected.visible && isScreenPointInsideRect(projected, rect)) count += 1;
      if (count >= minAnchorCount) break;
    }
    if (count >= minAnchorCount) selected.push({ type: 'piece', id: instance.id });
  }

  return selected;
}

function intersectDragPlane(event, target) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, target);
}

function getActiveDragProjectionPlane() {
  return getAssemblyProjectionPlane(state.viewMode);
}

function getProjectionPlaneNormal(plane) {
  if (plane === 'xz') return new THREE.Vector3(0, 1, 0);
  if (plane === 'yz') return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(0, 0, 1);
}

function constrainTargetToProjectionPlane(target, startPosition, plane = getActiveDragProjectionPlane()) {
  const next = target.clone();
  if (plane === 'xz') {
    next.y = startPosition.y;
    return next;
  }
  if (plane === 'yz') {
    next.x = startPosition.x;
    return next;
  }
  next.z = startPosition.z;
  return next;
}

function snapValue(value, step) {
  return Math.round(value / step) * step;
}

function normalizeCandidatePosition(instance, position) {
  const next = position.clone();
  const projectionPlane = getActiveDragProjectionPlane();
  constrainTargetToProjectionPlane(next, instance.group.position, projectionPlane);
  snapPositionToHalfUnit(next);

  if (projectionPlane !== 'xy') return next;

  // Priority 1 during drag: resolve a lateral anchor snap only while the pointer
  // is still close to the side contact position. Once the pointer moves one
  // half-grid step into the neighbour, side snap must release so auto-Z can lift
  // the piece above/below the obstacle.
  const sideSnap = resolveSideAnchorSnapPosition(instance, next, {
    maxDistance: getSideSnapHoldDistance(),
    tangentLimit: Math.max(getMagnetStep() * SIDE_SNAP_TANGENT_LIMIT_MULTIPLIER, 62.5),
  });
  if (sideSnap) return sideSnap;

  return applyMagneticSnap(instance, next);
}

function getSideSnapHoldDistance() {
  return Math.max(getMagnetStep() * 0.49, 1);
}

function normalizeNewPiecePosition(catalogPiece, position) {
  const next = position.clone();
  snapPositionToHalfUnit(next);
  return applyMagneticSnapForCatalogPiece(catalogPiece, next, null);
}

function snapPositionToHalfUnit(position) {
  const step = getMagnetStep();
  position.x = snapValue(position.x, step);
  position.y = snapValue(position.y, step);
  position.z = snapValue(position.z, step);
  return position;
}

function isFiniteVector(position) {
  return position
    && Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && Number.isFinite(position.z);
}

function isSaneWorldPosition(position) {
  if (!isFiniteVector(position)) return false;
  return Math.abs(position.x) <= DRAG_WORLD_LIMIT
    && Math.abs(position.y) <= DRAG_WORLD_LIMIT
    && Math.abs(position.z) <= DRAG_WORLD_LIMIT;
}

function isSaneDragTarget(targetPosition, startPosition) {
  if (!isSaneWorldPosition(targetPosition)) return false;
  if (!startPosition || !isFiniteVector(startPosition)) return true;
  return Math.abs(targetPosition.x - startPosition.x) <= DRAG_WORLD_LIMIT
    && Math.abs(targetPosition.y - startPosition.y) <= DRAG_WORLD_LIMIT
    && Math.abs(targetPosition.z - startPosition.z) <= DRAG_WORLD_LIMIT;
}

function sanitizeCandidatePosition(position, fallback = null) {
  if (isSaneWorldPosition(position)) return position;
  return fallback?.clone?.() ?? null;
}

function applyMagneticSnap(instance, position) {
  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  return applyMagneticSnapForCatalogPiece(catalogPiece, position, instance.id);
}

function getSceneSnapBoxes(options = {}) {
  const boxes = [];
  const ignoredInstanceIds = options.ignoredInstanceIds ?? new Set();
  const ignoredGroupId = options.ignoredGroupId ?? null;
  for (const instance of state.instances) {
    if (ignoredInstanceIds.has(instance.id)) continue;
    if (instance.groupId) continue;
    boxes.push(getInstanceReservationBox(instance));
  }
  for (const group of state.assemblyGroups) {
    if (group.id === ignoredGroupId) continue;
    boxes.push(...getGroupChildBoxes(group));
  }
  return boxes;
}

function getSceneAnchorTargets(options = {}) {
  const targets = [];
  const ignoredInstanceIds = options.ignoredInstanceIds ?? new Set();
  const ignoredGroupId = options.ignoredGroupId ?? null;
  for (const instance of state.instances) {
    if (ignoredInstanceIds.has(instance.id)) continue;
    if (instance.groupId) continue;
    targets.push(...getWorldAttachmentAnchorsForInstance(instance));
  }
  for (const group of state.assemblyGroups) {
    if (group.id === ignoredGroupId) continue;
    targets.push(...getGroupExternalAnchors(group));
  }
  return targets;
}

function applyMagneticSnapForCatalogPiece(catalogPiece, position, excludeInstanceId = null) {
  if (!catalogPiece) return position;
  const step = getMagnetStep();
  const threshold = Math.max(step * 0.75, 24);
  let best = null;

  const evaluate = (axis, delta, correction) => {
    const distance = Math.abs(delta);
    if (distance > threshold) return;
    const candidate = position.clone();
    candidate[axis] += correction;
    snapPositionToHalfUnit(candidate);
    const candidateBox = getReservationBoxForCatalogPiece(catalogPiece, candidate);
    if (collidesWithOthers(candidateBox, excludeInstanceId)) return;
    const score = distance;
    if (!best || score < best.score) best = { position: candidate, score };
  };

  const box = getReservationBoxForCatalogPiece(catalogPiece, position);
  for (const otherBox of getSceneSnapBoxes({ ignoredInstanceIds: new Set(excludeInstanceId ? [excludeInstanceId] : []) })) {

    evaluate('x', box.min.x - otherBox.max.x, otherBox.max.x - box.min.x);
    evaluate('x', box.max.x - otherBox.min.x, otherBox.min.x - box.max.x);
    evaluate('y', box.min.y - otherBox.max.y, otherBox.max.y - box.min.y);
    evaluate('y', box.max.y - otherBox.min.y, otherBox.min.y - box.max.y);
    evaluate('z', box.min.z - otherBox.max.z, otherBox.max.z - box.min.z);
    evaluate('z', box.max.z - otherBox.min.z, otherBox.min.z - box.max.z);
  }

  return best?.position ?? position;
}


function resolveSideAnchorSnapPosition(instance, targetPosition, options = {}) {
  if (!instance || (state.instances.length + state.assemblyGroups.length) <= 1) return null;
  if (!isSaneWorldPosition(targetPosition)) return null;

  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  if (!catalogPiece) return null;

  const step = getMagnetStep();
  const maxDistance = options.maxDistance ?? Math.max(step * 3.5, 175);
  const tangentLimit = options.tangentLimit ?? Math.max(step * SIDE_SNAP_TANGENT_LIMIT_MULTIPLIER, 62.5);
  const maxVerticalDistance = options.maxVerticalDistance ?? Math.max(step * 0.75, 37.5);
  const localAnchors = getWorldAttachmentAnchors(catalogPiece, instance.symmetry, new THREE.Vector3())
    .filter(isSideAttachmentAnchor);
  if (!localAnchors.length) return null;

  let best = null;
  const otherAnchors = getSceneAnchorTargets({ ignoredInstanceIds: new Set([instance.id]), ignoredGroupId: instance.groupId ?? null })
    .filter(isSideAttachmentAnchor);
  const otherBoxes = getSceneSnapBoxes({ ignoredInstanceIds: new Set([instance.id]), ignoredGroupId: instance.groupId ?? null });

  for (const localAnchor of localAnchors) {
    for (const otherAnchor of otherAnchors) {
      if (!areOpposedAnchors(localAnchor, otherAnchor)) continue;

      const contactAxis = getSideSnapContactAxis(localAnchor, otherAnchor);
      if (!contactAxis) continue;

      const candidate = otherAnchor.position.clone().sub(localAnchor.position);
      snapPositionToHalfUnit(candidate);
      if (!isSaneWorldPosition(candidate)) continue;

      const tangentAxis = contactAxis === 'x' ? 'y' : 'x';
      const primaryDelta = Math.abs(candidate[contactAxis] - targetPosition[contactAxis]);
      const tangentDelta = Math.abs(candidate[tangentAxis] - targetPosition[tangentAxis]);
      const verticalDelta = Math.abs(candidate.z - targetPosition.z);

      if (primaryDelta > maxDistance) continue;
      if (tangentDelta > tangentLimit) continue;
      if (verticalDelta > maxVerticalDistance) continue;

      const candidateBox = getInstanceReservationBox(instance, candidate);
      if (collidesWithOthers(candidateBox, instance.id, { ignoredGroupId: instance.groupId ?? null })) continue;
      if (!otherBoxes.some((otherBox) => reservationBoxesTouch(candidateBox, otherBox))) continue;

      const candidateAnchorWorld = localAnchor.position.clone().add(candidate);
      if (candidateAnchorWorld.distanceTo(otherAnchor.position) > Math.max(2, step * 0.12)) continue;

      const score = primaryDelta + tangentDelta * 2 + verticalDelta * 4;
      if (!best || score < best.score) best = { position: candidate, score };
    }
  }

  return best?.position ?? null;
}

function getSideSnapContactAxis(localAnchor, otherAnchor) {
  const n = localAnchor?.normal;
  const o = otherAnchor?.normal;
  if (!n || !o) return null;
  if (Math.abs(n.x) > 0.9 && Math.abs(o.x) > 0.9) return 'x';
  if (Math.abs(n.y) > 0.9 && Math.abs(o.y) > 0.9) return 'y';
  return null;
}

function isSideAttachmentAnchor(anchor) {
  const normal = anchor?.normal;
  if (!normal) return false;
  return Math.abs(normal.z) < 0.1 && (Math.abs(normal.x) > 0.9 || Math.abs(normal.y) > 0.9);
}

function areOpposedAnchors(a, b) {
  if (!isSideAttachmentAnchor(a) || !isSideAttachmentAnchor(b)) return false;
  return a.normal.dot(b.normal) < -0.98;
}


function updateAttachmentStates() {
  const connected = getAnchorConnectedRootSet();
  for (const instance of state.instances) {
    const valid = connected.has(instance.id);
    instance.invalidAttachment = !valid;
    instance.attachmentReason = valid ? 'connected_to_root' : 'not_connected_to_root';
    instance.edgeMaterial?.color?.setHex?.(valid ? EDGE_COLOR_VALID : EDGE_COLOR_INVALID);
    if (instance.edges) instance.edges.visible = true;
  }
}

function getAnchorConnectedRootSet() {
  const connected = new Set();
  if (!state.instances.length) return connected;

  const root = state.instances[0];
  connected.add(root.id);
  if (state.instances.length === 1) return connected;

  const adjacency = new Map(state.instances.map((instance) => [instance.id, new Set()]));
  for (let i = 0; i < state.instances.length; i += 1) {
    for (let j = i + 1; j < state.instances.length; j += 1) {
      const a = state.instances[i];
      const b = state.instances[j];
      if (instancesHaveCompatibleAnchors(a, b)) {
        adjacency.get(a.id)?.add(b.id);
        adjacency.get(b.id)?.add(a.id);
      }
    }
  }

  const queue = [root.id];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (connected.has(next)) continue;
      connected.add(next);
      queue.push(next);
    }
  }
  return connected;
}

function instancesHaveCompatibleAnchors(instance, other) {
  if (!reservationBoxesTouch(getInstanceReservationBox(instance), getInstanceReservationBox(other))) return false;

  const anchors = getWorldAttachmentAnchorsForInstance(instance);
  const otherAnchors = getWorldAttachmentAnchorsForInstance(other);
  if (!anchors.length || !otherAnchors.length) return false;

  const tolerance = Math.max(2, getMagnetStep() * 0.12);
  for (const a of anchors) {
    for (const b of otherAnchors) {
      if (a.normal.dot(b.normal) > -0.98) continue;
      if (a.position.distanceTo(b.position) <= tolerance) return true;
    }
  }
  return false;
}

function getAttachmentValidity(instance) {
  if (!instance) return { valid: true, reason: 'none' };
  if (state.instances.length <= 1) return { valid: true, reason: 'first_piece' };
  const connected = getAnchorConnectedRootSet();
  return connected.has(instance.id)
    ? { valid: true, reason: 'connected_to_root' }
    : { valid: false, reason: 'not_connected_to_root' };
}

function reservationBoxesTouch(a, b) {
  const eps = Math.max(1e-4, getMagnetStep() * 0.02);
  const overlapX = a.min.x < b.max.x - eps && a.max.x > b.min.x + eps;
  const overlapY = a.min.y < b.max.y - eps && a.max.y > b.min.y + eps;
  const overlapZ = a.min.z < b.max.z - eps && a.max.z > b.min.z + eps;
  const touchX = Math.abs(a.max.x - b.min.x) <= eps || Math.abs(a.min.x - b.max.x) <= eps;
  const touchY = Math.abs(a.max.y - b.min.y) <= eps || Math.abs(a.min.y - b.max.y) <= eps;
  const touchZ = Math.abs(a.max.z - b.min.z) <= eps || Math.abs(a.min.z - b.max.z) <= eps;
  return (touchX && overlapY && overlapZ) || (touchY && overlapX && overlapZ) || (touchZ && overlapX && overlapY);
}

function getWorldAttachmentAnchorsForInstance(instance) {
  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  return getWorldAttachmentAnchors(catalogPiece, instance.symmetry, instance.group.position);
}

function getWorldAttachmentAnchors(catalogPiece, symmetry = {}, position = new THREE.Vector3()) {
  const shape = getShapeVariant(catalogPiece?.shape_variant_id);
  const size = getSize(catalogPiece?.size_id)?.dimensions ?? { length: 1, width: 1, height: 1 };
  const scale = state.catalog?.units?.mesh_unit_scale ?? 100;
  const anchors = getEffectiveAttachmentAnchors(shape, size);
  return anchors.map((anchor) => {
    const local = anchorToMeshPosition(catalogPiece, shape, anchor, symmetry);
    const normal = catalogNormalToWorld(anchor.normal ?? { x: 0, y: 0, z: 0 }, symmetry);
    return {
      id: anchor.id,
      position: local.add(position),
      normal,
    };
  });
}

function catalogNormalToWorld(normal, symmetry = {}) {
  const vector = new THREE.Vector3(
    Number(normal.y) || 0,
    Number(normal.x) || 0,
    Number(normal.z) || 0,
  );
  if (symmetry.width) vector.x = -vector.x;
  if (symmetry.length) vector.y = -vector.y;
  if (symmetry.height) vector.z = -vector.z;
  return vector.normalize();
}

function getEffectiveAttachmentAnchors(shape, size) {
  const anchors = (shape?.anchors ?? []).filter((anchor) => anchor.enabled !== false);
  if (!anchors.length) return [];
  if (isSixFacePlaceholderAnchorSet(anchors)) return generateHalfStepFaceAnchors(size);
  return anchors;
}

function isSixFacePlaceholderAnchorSet(anchors) {
  if (anchors.length !== 6) return false;
  return anchors.every((anchor) => /^anchor_(length|width|height)_(min|max)$/.test(String(anchor.id ?? '')));
}

function generateHalfStepFaceAnchors(size) {
  const L = Number(size.length) || 1;
  const W = Number(size.width) || 1;
  const H = Number(size.height) || 1;
  const anchors = [];
  const values = (max) => {
    const result = [];
    for (let v = 0.25; v < max - 1e-9; v += 0.5) result.push(Number(v.toFixed(3)));
    return result.length ? result : [max / 2];
  };
  const xs = values(L);
  const ys = values(W);
  const zs = values(H);
  const push = (id, position, normal, face) => anchors.push({ id, position, normal, face, type: 'standard', enabled: true, status: 'generated' });

  for (const y of ys) for (const z of zs) {
    push(`anchor_length_min_${y}_${z}`, { x: 0, y, z }, { x: -1, y: 0, z: 0 }, 'length_min');
    push(`anchor_length_max_${y}_${z}`, { x: L, y, z }, { x: 1, y: 0, z: 0 }, 'length_max');
  }
  for (const x of xs) for (const z of zs) {
    push(`anchor_width_min_${x}_${z}`, { x, y: 0, z }, { x: 0, y: -1, z: 0 }, 'width_min');
    push(`anchor_width_max_${x}_${z}`, { x, y: W, z }, { x: 0, y: 1, z: 0 }, 'width_max');
  }
  for (const x of xs) for (const y of ys) {
    push(`anchor_height_min_${x}_${y}`, { x, y, z: 0 }, { x: 0, y: 0, z: -1 }, 'height_min');
    push(`anchor_height_max_${x}_${y}`, { x, y, z: H }, { x: 0, y: 0, z: 1 }, 'height_max');
  }
  return anchors;
}

function getGroupBoundingBoxAt(group, origin) {
  return computeGroupBoundingBox(group, origin);
}

function applyMagneticSnapForGroup(group, origin) {
  const step = getMagnetStep();
  const threshold = Math.max(step * 0.75, 24);
  let best = null;
  const box = getGroupBoundingBoxAt(group, origin);

  const evaluate = (axis, delta, correction) => {
    const distance = Math.abs(delta);
    if (distance > threshold) return;
    const candidate = origin.clone();
    candidate[axis] += correction;
    snapPositionToHalfUnit(candidate);
    if (!isGroupPlacementValid(group, candidate)) return;
    if (!best || distance < best.score) best = { position: candidate, score: distance };
  };

  for (const otherBox of getSceneSnapBoxes({ ignoredInstanceIds: new Set(group.children.map((child) => child.instanceId)), ignoredGroupId: group.id })) {
    evaluate('x', box.min.x - otherBox.max.x, otherBox.max.x - box.min.x);
    evaluate('x', box.max.x - otherBox.min.x, otherBox.min.x - box.max.x);
    evaluate('y', box.min.y - otherBox.max.y, otherBox.max.y - box.min.y);
    evaluate('y', box.max.y - otherBox.min.y, otherBox.min.y - box.max.y);
    evaluate('z', box.min.z - otherBox.max.z, otherBox.max.z - box.min.z);
    evaluate('z', box.max.z - otherBox.min.z, otherBox.min.z - box.max.z);
  }

  return best?.position ?? origin;
}

function resolveSideAnchorSnapPositionForGroup(group, targetOrigin, options = {}) {
  if (!group || (state.instances.length + state.assemblyGroups.length) <= 1) return null;
  const step = getMagnetStep();
  const maxDistance = options.maxDistance ?? Math.max(step * 3.5, 175);
  const tangentLimit = options.tangentLimit ?? Math.max(step * SIDE_SNAP_TANGENT_LIMIT_MULTIPLIER, 62.5);
  const maxVerticalDistance = options.maxVerticalDistance ?? Math.max(step * 0.75, 37.5);
  const localAnchors = getGroupExternalAnchors(group, new THREE.Vector3()).filter(isSideAttachmentAnchor);
  if (!localAnchors.length) return null;

  let best = null;
  const otherAnchors = getSceneAnchorTargets({
    ignoredInstanceIds: new Set(group.children.map((child) => child.instanceId)),
    ignoredGroupId: group.id,
  }).filter(isSideAttachmentAnchor);
  const otherBoxes = getSceneSnapBoxes({
    ignoredInstanceIds: new Set(group.children.map((child) => child.instanceId)),
    ignoredGroupId: group.id,
  });

  for (const localAnchor of localAnchors) {
    for (const otherAnchor of otherAnchors) {
      if (!areOpposedAnchors(localAnchor, otherAnchor)) continue;
      const contactAxis = getSideSnapContactAxis(localAnchor, otherAnchor);
      if (!contactAxis) continue;

      const candidate = otherAnchor.position.clone().sub(localAnchor.position);
      snapPositionToHalfUnit(candidate);
      const tangentAxis = contactAxis === 'x' ? 'y' : 'x';
      const primaryDelta = Math.abs(candidate[contactAxis] - targetOrigin[contactAxis]);
      const tangentDelta = Math.abs(candidate[tangentAxis] - targetOrigin[tangentAxis]);
      const verticalDelta = Math.abs(candidate.z - targetOrigin.z);
      if (primaryDelta > maxDistance || tangentDelta > tangentLimit || verticalDelta > maxVerticalDistance) continue;
      if (!isGroupPlacementValid(group, candidate)) continue;

      const candidateBox = getGroupBoundingBoxAt(group, candidate);
      if (!otherBoxes.some((otherBox) => reservationBoxesTouch(candidateBox, otherBox))) continue;

      const candidateAnchorWorld = localAnchor.position.clone().add(candidate);
      if (candidateAnchorWorld.distanceTo(otherAnchor.position) > Math.max(2, step * 0.12)) continue;

      const score = primaryDelta + tangentDelta * 2 + verticalDelta * 4;
      if (!best || score < best.score) best = { position: candidate, score };
    }
  }

  return best?.position ?? null;
}

function normalizeCandidateGroupOrigin(group, origin) {
  const next = origin.clone();
  const projectionPlane = getActiveDragProjectionPlane();
  constrainTargetToProjectionPlane(next, group.origin, projectionPlane);
  snapPositionToHalfUnit(next);
  if (projectionPlane !== 'xy') return next;
  const sideSnap = resolveSideAnchorSnapPositionForGroup(group, next, {
    maxDistance: getSideSnapHoldDistance(),
    tangentLimit: Math.max(getMagnetStep() * SIDE_SNAP_TANGENT_LIMIT_MULTIPLIER, 62.5),
  });
  if (sideSnap) return sideSnap;
  return applyMagneticSnapForGroup(group, next);
}

function resolveVerticalCollisionOriginForGroup(group, targetOrigin) {
  if (isGroupPlacementValid(group, targetOrigin)) return targetOrigin;
  const direction = getAutoVerticalDirection();
  if (!direction) return targetOrigin;
  const step = getMagnetStep();
  for (let i = 1; i <= 12; i += 1) {
    const candidate = targetOrigin.clone();
    candidate.z = snapValue(targetOrigin.z + direction * step * i, step);
    if (isGroupPlacementValid(group, candidate)) return candidate;
  }
  return targetOrigin;
}

function tryMoveAssemblyGroup(group, targetOrigin, options = {}) {
  return assemblyMovementController?.tryMoveAssemblyGroup(group, targetOrigin, options) ?? false;
}

function tryMoveInstance(instance, targetPosition, reason = 'Déplacement refusé : collision avec une autre pièce.', options = {}) {
  // Side-anchor snap is handled before this function, with a narrow hold
  // distance. Do not re-apply a wide side snap here, otherwise it pins the piece
  // to the side contact forever and prevents auto-Z from resolving overlap.
  const primaryPosition = targetPosition;
  const resolvedPosition = options.autoVertical
    ? resolveVerticalCollisionPosition(instance, primaryPosition)
    : primaryPosition;
  if (!isSaneWorldPosition(resolvedPosition)) {
    setMessage('Déplacement refusé : position calculée invalide.');
    return false;
  }
  const candidateBox = getInstanceBox(instance, resolvedPosition);
  if (collidesWithOthers(candidateBox, instance.id)) {
    setMessage(reason);
    return false;
  }

  instance.group.position.copy(resolvedPosition);
  updateAttachmentStates();
  if (instance.invalidAttachment) setMessage('Placement sans ancrage compatible : contour rouge.');
  else setMessage('');
  updateStats();
  updateSelectionBox();
  return true;
}

function resolveVerticalCollisionPosition(instance, targetPosition) {
  if (!isSaneWorldPosition(targetPosition)) return instance.group.position.clone();
  const direct = targetPosition.clone();
  if (!collidesWithOthers(getInstanceBox(instance, direct), instance.id)) return direct;

  const direction = getAutoVerticalDirection();
  if (!direction) return direct;

  const step = getMagnetStep();
  const maxSteps = 12;
  for (let i = 1; i <= maxSteps; i += 1) {
    const candidate = targetPosition.clone();
    candidate.z = snapValue(targetPosition.z + direction * step * i, step);
    if (!collidesWithOthers(getInstanceBox(instance, candidate), instance.id)) return candidate;
  }
  return direct;
}

function getAutoVerticalDirection() {
  if (state.viewMode === 'bottom') return -1;
  if (state.viewMode === 'top') {
    return camera.position.z >= 0 ? 1 : -1;
  }
  return 0;
}

function applyDragPosition(instance, position) {
  if (!isSaneDragTarget(position, state.drag?.startPosition)) {
    setMessage('Déplacement ignoré : cible hors limites.');
    return;
  }
  const next = normalizeCandidatePosition(instance, position);
  if (!isSaneDragTarget(next, state.drag?.startPosition)) {
    setMessage('Déplacement ignoré : résolution hors limites.');
    return;
  }
  const moved = tryMoveInstance(
    instance,
    next,
    'Déplacement refusé : aucune position libre trouvée sur l’axe Z.',
    { autoVertical: getActiveDragProjectionPlane() === 'xy' },
  );
  if (moved) state.drag.lastValidPosition.copy(instance.group.position);
}

function applyGroupDragPosition(group, origin) {
  if (!isSaneDragTarget(origin, state.drag?.startPosition)) {
    setMessage('Déplacement ignoré : cible hors limites.');
    return;
  }
  const next = normalizeCandidateGroupOrigin(group, origin);
  if (!isSaneDragTarget(next, state.drag?.startPosition)) {
    setMessage('Déplacement ignoré : résolution hors limites.');
    return;
  }
  const moved = tryMoveAssemblyGroup(group, next, { autoVertical: getActiveDragProjectionPlane() === 'xy' });
  if (moved) state.drag.lastValidPosition.copy(group.origin);
}

function applySelectionBatchDragPosition(entities, delta, plane = getActiveDragProjectionPlane()) {
  const nextDelta = delta.clone();
  if (plane === 'xz') nextDelta.y = 0;
  else if (plane === 'yz') nextDelta.x = 0;
  else nextDelta.z = 0;
  snapPositionToHalfUnit(nextDelta);
  if (tryMoveSelectionBatch(entities, nextDelta)) {
    state.drag.lastValidPosition.copy(state.drag.startPosition.clone().add(nextDelta));
  }
}

function tryMoveLooseSelection(instances, delta) {
  if (!instances.length) return false;
  const ignoredInstanceIds = new Set(instances.map((instance) => instance.id));
  const candidateBoxes = instances.map((instance) => getInstanceBox(instance, instance.group.position.clone().add(delta)));
  if (collidesBoxesWithScene(candidateBoxes, { ignoredInstanceIds })) {
    setMessage('Déplacement refusé : collision avec une autre pièce.');
    return false;
  }

  for (const instance of instances) {
    instance.group.position.add(delta);
  }
  updateAttachmentStates();
  updateStats();
  updateSelectionBox();
  setMessage('');
  return true;
}

function tryMoveSelectionBatch(entities, delta) {
  return assemblyMovementController?.tryMoveSelectionBatch(entities, delta) ?? false;
}

function moveSelectedByDelta(delta) {
  const selectedEntities = getSelectionBatch();
  if (!selectedEntities.length) return;
  const before = captureMovementSnapshot(selectedEntities);

  if (selectedEntities.length > 1) {
    const snappedDelta = delta.clone();
    snapPositionToHalfUnit(snappedDelta);
    if (tryMoveSelectionBatch(selectedEntities, snappedDelta)) {
      const after = captureMovementSnapshot(selectedEntities);
      if (recordMovementCommand(before, after, selectedEntities, 'Move selection')) markShipDirty();
    }
    return;
  }

  const selectedGroup = getSelectedAssemblyGroup();
  if (selectedGroup) {
    const next = snapPositionToHalfUnit(selectedGroup.origin.clone().add(delta.clone()));
    if (tryMoveAssemblyGroup(selectedGroup, next)) {
      const after = captureMovementSnapshot(selectedEntities);
      if (recordMovementCommand(before, after, selectedEntities, 'Move group')) markShipDirty();
    }
    return;
  }

  const selectedLooseInstances = state.selectedGroupIds.map((id) => getInstanceById(id)).filter(Boolean);
  if (selectedLooseInstances.length > 1) {
    const snappedDelta = delta.clone();
    snapPositionToHalfUnit(snappedDelta);
    if (tryMoveLooseSelection(selectedLooseInstances, snappedDelta)) {
      const after = captureMovementSnapshot(selectedEntities);
      if (recordMovementCommand(before, after, selectedEntities, 'Move selection')) markShipDirty();
    }
    return;
  }

  const selected = getSelectedInstance();
  if (!selected) return;
  const next = snapPositionToHalfUnit(selected.group.position.clone().add(delta.clone()));
  if (tryMoveInstance(selected, next, 'Déplacement refusé : collision avec une autre pièce.')) {
    const after = captureMovementSnapshot(selectedEntities);
    if (recordMovementCommand(before, after, selectedEntities, 'Move piece')) markShipDirty();
  }
}

function panSceneByDelta(delta) {
  camera.position.add(delta);
  orbitControls.target.add(delta);
  orbitControls.update();
}

function moveSelectedHeight(delta) {
  moveSelectedByDelta(new THREE.Vector3(0, 0, delta));
}

function getHeightStep() {
  return getMagnetStep();
}

function getCatalogPieceIdFromDrop(event) {
  return event.dataTransfer?.getData('application/x-spacecraft-catalog-piece')
    || event.dataTransfer?.getData('text/plain')
    || '';
}

function getDropScenePosition(event) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const target = new THREE.Vector3();
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(plane, target)) return null;
  target.z = 0;
  snapPositionToHalfUnit(target);
  return target;
}

function onCanvasDragOver(event) {
  const pieceId = getCatalogPieceIdFromDrop(event);
  if (!pieceId || !getCatalogPieceById(pieceId)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  dom.canvas.classList.add('catalog-drop-target');
}

function onCanvasDragLeave() {
  dom.canvas.classList.remove('catalog-drop-target');
}

function onCanvasDrop(event) {
  const pieceId = getCatalogPieceIdFromDrop(event);
  const catalogPiece = getCatalogPieceById(pieceId);
  if (!catalogPiece) return;
  event.preventDefault();
  event.stopPropagation();
  dom.canvas.classList.remove('catalog-drop-target');
  const position = getDropScenePosition(event);
  addCatalogPieceById(pieceId, position);
}

function onGlobalPointerDown(event) {
  if (event.button !== 0) return;
  if (state.drag) return;
  if (!getSelectedInstance() && !getSelectedAssemblyGroup() && !state.selectedGroupIds.length) return;

  const target = event.target;
  if (target?.closest?.('.stats-overlay, .help-overlay, .navigation-cube-card, .left-panel')) return;
  if (target === renderer.domElement) {
    const picked = pickInstance(event);
    if (!picked) {
      clearSelection();
      refreshInstanceList();
      updateSelectionUi();
      updateStats();
      updateSelectionBox();
    }
    return;
  }
}

function beginSelectionDrag(event, selectable, dragEntities) {
  const picked = getInstanceById(selectable?.instanceId ?? selectable?.id);
  if (!picked) return false;
  const pickedGroup = selectable?.type === 'group' ? getAssemblyGroupById(selectable.id) : null;
  return beginDragFromPick(event, picked, pickedGroup, 'pointer', dragEntities);
}

function updateSelectionDrag(event) {
  onPointerMove(event);
}

function endSelectionDrag(event) {
  onPointerUp(event);
}

function beginCameraPointerDrag() {
  orbitControls.enabled = true;
}

function endCameraPointerDrag() {
  orbitControls.enabled = true;
}

function beginDragFromPick(event, picked, pickedGroup, inputType = 'pointer', dragEntities = []) {
  const projectionPlane = getActiveDragProjectionPlane();
  if (pickedGroup) {
    dragPlane.set(getProjectionPlaneNormal(projectionPlane), -getProjectionPlaneNormal(projectionPlane).dot(pickedGroup.origin));
  } else {
    dragPlane.set(getProjectionPlaneNormal(projectionPlane), -getProjectionPlaneNormal(projectionPlane).dot(picked.group.position));
  }

  if (!intersectDragPlane(event, dragHit)) return false;

  const historyEntities = dragEntities.length
    ? dragEntities.map((entity) => ({ type: entity.type, id: entity.id }))
    : [{ type: pickedGroup ? 'group' : 'piece', id: pickedGroup?.id ?? picked.id }];

  state.drag = {
    inputType,
    pointerId: inputType === 'pointer' ? event.pointerId : null,
    entityType: pickedGroup ? 'group' : 'piece',
    instanceId: picked.id,
    groupId: pickedGroup?.id ?? null,
    entities: historyEntities,
    startHit: dragHit.clone(),
    startPosition: pickedGroup ? pickedGroup.origin.clone() : picked.group.position.clone(),
    offset: (pickedGroup ? pickedGroup.origin.clone() : picked.group.position.clone()).sub(dragHit),
    lastValidPosition: pickedGroup ? pickedGroup.origin.clone() : picked.group.position.clone(),
    historyBefore: captureMovementSnapshot(historyEntities),
  };

  orbitControls.enabled = false;
  dom.canvas.classList.add('dragging-piece');
  if (inputType === 'pointer') dom.canvas.setPointerCapture?.(event.pointerId);
  return true;
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const picked = pickInstance(event);
  if (!picked) {
    clearSelection();
    refreshInstanceList();
    updateSelectionUi();
    updateStats();
    updateSelectionBox();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (event.shiftKey) {
    if (!picked.groupId) togglePieceInMultiSelection(picked.id);
    return;
  }

  const pickedGroup = picked.groupId ? getAssemblyGroupById(picked.groupId) : null;
  if (pickedGroup) {
    selectAssemblyGroup(pickedGroup.id);
  } else {
    selectInstance(picked.id);
  }
}

function onMouseDown(event) {
  if (event.button !== 2) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const picked = pickInstance(event);
  if (!picked) return;
  const pickedGroup = picked.groupId ? getAssemblyGroupById(picked.groupId) : null;
  beginDragFromPick(event, picked, pickedGroup, 'mouse');
}

function onPointerMove(event) {
  if (!state.drag || state.drag.inputType !== 'pointer' || event.pointerId !== state.drag.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const instance = state.instances.find((item) => item.id === state.drag.instanceId);
  const group = state.drag.groupId ? getAssemblyGroupById(state.drag.groupId) : null;
  if ((!instance && !group) || !intersectDragPlane(event, dragHit)) return;

  const delta = dragHit.clone().sub(state.drag.startHit);
  const target = constrainTargetToProjectionPlane(
    state.drag.startPosition.clone().add(delta),
    state.drag.startPosition,
    getActiveDragProjectionPlane(),
  );
  if (state.drag.entities?.length > 1) applySelectionBatchDragPosition(state.drag.entities, delta, getActiveDragProjectionPlane());
  else if (state.drag.entityType === 'group' && group) applyGroupDragPosition(group, target);
  else if (instance) applyDragPosition(instance, target);
}

function onPointerUp(event) {
  if (!state.drag || state.drag.inputType !== 'pointer' || event.pointerId !== state.drag.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const moved = !state.drag.startPosition.equals(state.drag.lastValidPosition);
  const historyBefore = state.drag.historyBefore;
  const historyEntities = state.drag.entities;
  dom.canvas.releasePointerCapture?.(event.pointerId);
  state.drag = null;
  orbitControls.enabled = true;
  dom.canvas.classList.remove('dragging-piece');
  updateStats();
  updateSelectionBox();
  if (moved) {
    const after = captureMovementSnapshot(historyEntities);
    if (recordMovementCommand(historyBefore, after, historyEntities, historyEntities.length === 1 && historyEntities[0].type === 'group' ? 'Move group' : 'Move selection')) {
      markShipDirty();
    }
  }
}

function onMouseMove(event) {
  if (!state.drag || state.drag.inputType !== 'mouse') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const instance = state.instances.find((item) => item.id === state.drag.instanceId);
  const group = state.drag.groupId ? getAssemblyGroupById(state.drag.groupId) : null;
  if ((!instance && !group) || !intersectDragPlane(event, dragHit)) return;

  const delta = dragHit.clone().sub(state.drag.startHit);
  const target = constrainTargetToProjectionPlane(
    state.drag.startPosition.clone().add(delta),
    state.drag.startPosition,
    getActiveDragProjectionPlane(),
  );
  if (state.drag.entities?.length > 1) applySelectionBatchDragPosition(state.drag.entities, delta, getActiveDragProjectionPlane());
  else if (state.drag.entityType === 'group' && group) applyGroupDragPosition(group, target);
  else if (instance) applyDragPosition(instance, target);
}

function onMouseUp(event) {
  if (!state.drag || state.drag.inputType !== 'mouse' || event.button !== 2) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const moved = !state.drag.startPosition.equals(state.drag.lastValidPosition);
  const historyBefore = state.drag.historyBefore;
  const historyEntities = state.drag.entities;
  state.drag = null;
  orbitControls.enabled = true;
  dom.canvas.classList.remove('dragging-piece');
  updateStats();
  updateSelectionBox();
  if (moved) {
    const after = captureMovementSnapshot(historyEntities);
    if (recordMovementCommand(historyBefore, after, historyEntities, historyEntities.length === 1 && historyEntities[0].type === 'group' ? 'Move group' : 'Move selection')) {
      markShipDirty();
    }
  }
}


function rebuildRepository() {
  state.repo = buildRepository(state.catalog);
}

function slugifyId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function uniqueId(base, existingIds) {
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}_${suffix++}`;
  }
  return candidate;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function refreshInstancesUsingShape(shapeId) {
  for (const instance of state.instances) {
    const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
    if (catalogPiece?.shape_variant_id !== shapeId) continue;
    rebuildInstanceGeometry(instance, catalogPiece);
  }
  updateSelectionBox();
  updateStats();
}

function rebuildInstanceGeometry(instance, catalogPiece) {
  const nextGeometry = buildGeometry(catalogPiece, instance.symmetry);
  const oldMeshGeometry = instance.mesh.geometry;
  const oldEdgesGeometry = instance.edges.geometry;
  const oldAnchorGroup = instance.anchors;

  instance.mesh.geometry = nextGeometry;
  instance.edges.geometry = createAssemblyEdgeGeometry(catalogPiece, nextGeometry);
  instance.edges.visible = true;
  instance.anchors = createAnchorGroup(catalogPiece, instance.symmetry);
  instance.group.remove(oldAnchorGroup);
  instance.group.add(instance.anchors);

  oldMeshGeometry?.dispose?.();
  oldEdgesGeometry?.dispose?.();
  disposeAnchorGroup(oldAnchorGroup);

  if (hasCollision(instance, instance.group.position)) {
    setMessage(`Attention : ${instance.id} chevauche après modification de variante.`);
  }
  updateAttachmentStates();
}

function renderCatalogPieceOptions() {
  const pieces = getAvailableCatalogPieces();
  if (dom.catalogPieceSelect) dom.catalogPieceSelect.innerHTML = '';
  if (dom.catalogPieceList) dom.catalogPieceList.innerHTML = '';

  if (!pieces.length) {
    if (dom.catalogPieceList) {
      const empty = document.createElement('div');
      empty.className = 'catalog-empty-state';
      empty.textContent = 'Catalogue vide ou invalide. Publie un catalogue depuis editor.html ou vérifie public/data/4x3x1_catalog.json.';
      dom.catalogPieceList.append(empty);
    }
    return;
  }

  normalizeAssemblyCatalogFilters(pieces);
  renderAssemblyCatalogFilters(pieces);

  const filteredPieces = getFilteredCatalogPieces(pieces);
  if (!filteredPieces.some((piece) => piece.id === state.selectedCatalogPieceId)) {
    state.selectedCatalogPieceId = filteredPieces[0]?.id ?? pieces[0]?.id ?? null;
  }

  populateHiddenCatalogSelect(pieces);
  renderShapePalette(filteredPieces);

  if (dom.catalogPieceSelect && state.selectedCatalogPieceId) dom.catalogPieceSelect.value = state.selectedCatalogPieceId;
}

function getAvailableCatalogPieces() {
  return [...(state.catalog?.catalog_pieces ?? [])]
    .filter((piece) => getShapeVariant(piece.shape_variant_id) && getSize(piece.size_id) && getFamily(piece.family_id))
    .sort((a, b) => {
      const familyCmp = (getFamily(a.family_id)?.label_fr ?? a.family_id).localeCompare(getFamily(b.family_id)?.label_fr ?? b.family_id, 'fr');
      if (familyCmp !== 0) return familyCmp;
      const sizeCmp = getSizeSortValue(a.size_id) - getSizeSortValue(b.size_id);
      if (sizeCmp !== 0) return sizeCmp;
      return getVariantSortKey(a).localeCompare(getVariantSortKey(b), 'fr', { numeric: true });
    });
}

function normalizeAssemblyCatalogFilters(pieces) {
  const selected = state.selectedCatalogPieceId ? getCatalogPieceById(state.selectedCatalogPieceId) : null;
  const first = selected && pieces.some((piece) => piece.id === selected.id) ? selected : pieces[0];
  const families = new Set(pieces.map((piece) => piece.family_id));
  state.catalogFilters.familyId = families.has(state.catalogFilters.familyId) ? state.catalogFilters.familyId : first.family_id;

  const familyPieces = pieces.filter((piece) => piece.family_id === state.catalogFilters.familyId);
  const sizes = new Set(familyPieces.map((piece) => piece.size_id));
  state.catalogFilters.sizeId = sizes.has(state.catalogFilters.sizeId) ? state.catalogFilters.sizeId : familyPieces[0]?.size_id ?? first.size_id;

  state.catalogFilters.profileType = 'standard';
}

function renderAssemblyCatalogFilters(pieces) {
  renderFilterSelect(dom.catalogFamilyFilter, uniqueBy(pieces, (piece) => piece.family_id).map((piece) => ({
    value: piece.family_id,
    label: getFamily(piece.family_id)?.label_fr ?? piece.family_id,
  })), state.catalogFilters.familyId, (value) => {
    state.catalogFilters.familyId = value;
    state.catalogFilters.sizeId = null;
    state.catalogFilters.profileType = 'standard';
    renderCatalogPieceOptions();
  });

  const familyPieces = pieces.filter((piece) => piece.family_id === state.catalogFilters.familyId);
  const sizeOptions = uniqueBy(familyPieces, (piece) => piece.size_id).map((piece) => ({
    value: piece.size_id,
    label: getSize(piece.size_id)?.label ?? piece.size_id,
    sort: getSizeSortValue(piece.size_id),
    piece,
  })).sort((a, b) => a.sort - b.sort);

  if (!sizeOptions.some((item) => item.value === state.catalogFilters.sizeId)) {
    state.catalogFilters.sizeId = sizeOptions[0]?.value ?? null;
  }
  state.catalogFilters.profileType = 'standard';

  renderFilterSelect(dom.catalogSizeFilter, sizeOptions, state.catalogFilters.sizeId, (value) => {
    state.catalogFilters.sizeId = value;
    state.catalogFilters.profileType = 'standard';
    renderCatalogPieceOptions();
  });

  renderSizeList(sizeOptions);

  // Kept hidden for compatibility with older code paths. Assembly no longer exposes profile selection.
  const familySizePieces = familyPieces.filter((piece) => piece.size_id === state.catalogFilters.sizeId);
  const profileOptions = uniqueBy(familySizePieces, getPieceProfileType).map((piece) => {
    const type = getPieceProfileType(piece);
    return { value: type, label: type };
  });
  renderFilterSelect(dom.catalogProfileFilter, profileOptions, 'standard', () => {});
}

function renderSizeList(sizeOptions) {
  if (!dom.catalogSizeList) return;
  dom.catalogSizeList.innerHTML = '';
  if (!sizeOptions.length) {
    const empty = document.createElement('div');
    empty.className = 'catalog-empty-state';
    empty.textContent = 'Aucune taille disponible pour cette famille.';
    dom.catalogSizeList.append(empty);
    return;
  }

  for (const option of sizeOptions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-size-item';
    button.draggable = true;
    button.dataset.sizeId = option.value;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(option.value === state.catalogFilters.sizeId));
    if (option.value === state.catalogFilters.sizeId) button.classList.add('active');

    const dimensions = getSize(option.value)?.dimensions;
    button.textContent = option.label;
    button.title = dimensions
      ? `${option.label}\n${dimensions.length}×${dimensions.width}×${dimensions.height}`
      : option.label;

    button.addEventListener('click', () => {
      state.catalogFilters.sizeId = option.value;
      state.catalogFilters.profileType = 'standard';
      renderCatalogPieceOptions();
    });

    button.addEventListener('dblclick', () => {
      const piece = getDefaultCatalogPieceForFamilySize(state.catalogFilters.familyId, option.value);
      if (piece) addCatalogPieceById(piece.id);
    });

    button.addEventListener('dragstart', (event) => {
      const piece = getDefaultCatalogPieceForFamilySize(state.catalogFilters.familyId, option.value);
      if (!piece) return;
      state.catalogFilters.sizeId = option.value;
      state.selectedCatalogPieceId = piece.id;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', piece.id);
      event.dataTransfer.setData('application/x-spacecraft-catalog-piece', piece.id);
      renderCatalogPieceOptions();
    });

    dom.catalogSizeList.append(button);
  }
}

function getDefaultCatalogPieceForFamilySize(familyId, sizeId) {
  const candidates = (state.catalog?.catalog_pieces ?? []).filter((piece) => piece.family_id === familyId && piece.size_id === sizeId);
  if (!candidates.length) return null;
  const scored = candidates.map((piece) => {
    const shape = getShapeVariant(piece.shape_variant_id);
    const variantLabel = getVariantDisplayLabel(shape, getSize(piece.size_id)).toLowerCase();
    let score = 0;
    if (getPieceProfileType(piece) === 'standard') score += 20;
    if (shape?.shape_family === 'base' || shape?.generation?.base?.type === 'box') score += 10;
    if (variantLabel.includes('base') || variantLabel.includes('standard')) score += 8;
    return { piece, score };
  }).sort((a, b) => b.score - a.score || String(a.piece.id).localeCompare(String(b.piece.id)));
  return scored[0]?.piece ?? candidates[0];
}

function renderFilterSelect(select, options, selectedValue, onChange) {
  if (!select) return;
  select.innerHTML = '';
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.selected = optionData.value === selectedValue;
    select.append(option);
  }
  select.onchange = () => onChange(select.value);
}

function populateHiddenCatalogSelect(pieces) {
  if (!dom.catalogPieceSelect) return;
  const groups = new Map();
  dom.catalogPieceSelect.innerHTML = '';
  for (const piece of pieces) {
    const groupLabel = getCatalogGroupLabel(piece);
    if (!groups.has(groupLabel)) {
      const group = document.createElement('optgroup');
      group.label = groupLabel;
      groups.set(groupLabel, group);
      dom.catalogPieceSelect.append(group);
    }
    const option = document.createElement('option');
    option.value = piece.id;
    option.textContent = getDisplayLabel(piece);
    option.selected = piece.id === state.selectedCatalogPieceId;
    groups.get(groupLabel).append(option);
  }
}

function renderShapePalette(pieces) {
  if (!dom.catalogPieceList) return;
  dom.catalogPieceList.innerHTML = '';

  const selectedInstancePiece = getSceneSelectedCatalogPiece();
  if (dom.catalogShapePalettePanel) dom.catalogShapePalettePanel.hidden = !selectedInstancePiece;
  if (!selectedInstancePiece) {
    return;
  }

  const variantMap = getShapePaletteVariantMap(getShapePalettePieces(pieces));
  for (let variantIndex = 1; variantIndex <= SHAPE_BUTTON_COUNT; variantIndex += 1) {
    const piece = variantMap.get(variantIndex) ?? null;
    const shape = getShapeVariant(piece?.shape_variant_id);
    const size = getSize(piece?.size_id ?? selectedInstancePiece.size_id);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'shape-palette-item catalog-piece-item';
    item.dataset.variantIndex = String(variantIndex);
    item.setAttribute('role', 'option');
    item.title = piece
      ? `${getDisplayLabel(piece)}\nClic : appliquer cette forme à la pièce sélectionnée`
      : `Variante ${variantIndex} indisponible pour cette taille`;

    const isActive = Boolean(piece)
      && selectedInstancePiece.shape_variant_id === piece.shape_variant_id
      && selectedInstancePiece.family_id === piece.family_id
      && selectedInstancePiece.size_id === piece.size_id;
    item.setAttribute('aria-selected', String(isActive));
    if (isActive) item.classList.add('active');
    if (!piece) item.disabled = true;

    const icon = document.createElement('img');
    icon.className = 'shape-icon';
    icon.src = SHAPE_BUTTON_ICONS[variantIndex - 1];
    icon.alt = piece ? getVariantDisplayLabel(shape, size) : `Variante ${variantIndex}`;
    icon.draggable = false;
    item.append(icon);
    if (piece) item.addEventListener('click', () => applyCatalogShapeToSelectedInstance(piece.id));
    dom.catalogPieceList.append(item);
  }
}

function applyCatalogShapeToSelectedInstance(pieceId) {
  const selected = getSelectedInstance();
  const nextPiece = getCatalogPieceById(pieceId);
  if (!selected || !nextPiece) {
    setMessage('Sélectionne une pièce dans la scène avant de choisir une forme.');
    return;
  }

  const currentPiece = getCatalogPieceById(selected.catalogPieceId);
  if (!currentPiece) return;

  if (currentPiece.family_id !== nextPiece.family_id || currentPiece.size_id !== nextPiece.size_id) {
    setMessage('Forme refusée : famille ou taille différente de la pièce sélectionnée.');
    return;
  }

  const nextGeometry = buildGeometry(nextPiece, selected.symmetry);
  const candidateBox = getReservationBoxForCatalogPiece(nextPiece, selected.group.position);
  if (collidesWithOthers(candidateBox, selected.id)) {
    nextGeometry.dispose();
    setMessage('Forme refusée : collision avec une autre pièce.');
    return;
  }

  const oldMeshGeometry = selected.mesh.geometry;
  const oldEdgesGeometry = selected.edges.geometry;
  const oldAnchorGroup = selected.anchors;

  selected.catalogPieceId = nextPiece.id;
  selected.label = `${nextPiece.label_fr || nextPiece.id} #${selected.id.replace('placed_', '')}`;
  selected.mesh.geometry = nextGeometry;
  selected.edges.geometry = createAssemblyEdgeGeometry(nextPiece, nextGeometry);
  selected.edges.visible = true;
  selected.anchors = createAnchorGroup(nextPiece, selected.symmetry);
  selected.group.remove(oldAnchorGroup);
  selected.group.add(selected.anchors);

  oldMeshGeometry?.dispose?.();
  oldEdgesGeometry?.dispose?.();
  disposeAnchorGroup(oldAnchorGroup);

  state.selectedCatalogPieceId = nextPiece.id;
  refreshInstanceList();
  renderCatalogPieceOptions();
  updateStats();
  updateSelectionBox();
  setMessage('Forme appliquée à la pièce sélectionnée.');
  markShipDirty();
}

function getFilteredCatalogPieces(pieces) {
  const filtered = pieces.filter((piece) => (
    piece.family_id === state.catalogFilters.familyId
    && piece.size_id === state.catalogFilters.sizeId
  ));
  const standard = filtered.filter((piece) => getPieceProfileType(piece) === 'standard');
  return standard.length ? standard : filtered;
}

function syncAssemblyPaletteToSelectedInstance() {
  if (IS_EDITOR) return;
  const selectedPiece = getSceneSelectedCatalogPiece();
  if (!selectedPiece) return;
  state.selectedCatalogPieceId = selectedPiece.id;
  state.catalogFilters.familyId = selectedPiece.family_id;
  state.catalogFilters.sizeId = selectedPiece.size_id;
  state.catalogFilters.profileType = getPieceProfileType(selectedPiece);
}

function getShapePalettePieces(pieces) {
  const selectedPiece = getSceneSelectedCatalogPiece();
  if (!selectedPiece) return [];
  return pieces.filter((piece) => (
    piece.family_id === selectedPiece.family_id
    && piece.size_id === selectedPiece.size_id
    && getPieceProfileType(piece) === 'standard'
  ));
}

function getShapePaletteVariantMap(pieces) {
  const variantMap = new Map();
  for (const piece of pieces) {
    const variantIndex = Number(getShapeVariant(piece.shape_variant_id)?.variant_index);
    if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > SHAPE_BUTTON_COUNT) continue;
    if (!variantMap.has(variantIndex)) variantMap.set(variantIndex, piece);
  }
  return variantMap;
}

function getPieceProfileType(piece) {
  return getSpecProfile(piece.spec_profile_id)?.profile_type ?? 'standard';
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function getSizeSortValue(sizeId) {
  const d = getSize(sizeId)?.dimensions;
  if (!d) return Number.MAX_SAFE_INTEGER;
  return (Number(d.length) || 0) * 10000 + (Number(d.width) || 0) * 100 + (Number(d.height) || 0);
}

function getShapeIconSvg(shape) {
  const type = getShapeIconType(shape);
  const common = 'viewBox="0 0 64 44" aria-hidden="true" focusable="false"';
  if (type === 'point_1') return `<svg ${common}><path d="M8 36 L8 28 L20 10 L56 8 L56 36 Z"/><path d="M13 33 L23 17 L48 14" class="shape-icon-line"/></svg>`;
  if (type === 'point_2') return `<svg ${common}><path d="M8 36 L8 8 L56 8 L56 36 Z"/><path d="M8 36 L34 8" class="shape-icon-line"/></svg>`;
  if (type === 'point_3') return `<svg ${common}><path d="M8 36 L56 36 L56 8 Z"/><path d="M16 32 L49 15" class="shape-icon-line"/></svg>`;
  if (type === 'wedge') return `<svg ${common}><path d="M8 36 L56 36 L56 12 L8 28 Z"/><path d="M12 31 L52 17" class="shape-icon-line"/></svg>`;
  if (type === 'round') return `<svg ${common}><path d="M10 36 L10 8 L42 8 Q56 8 56 22 L56 36 Z"/><path d="M40 12 Q52 13 52 24" class="shape-icon-line"/></svg>`;
  if (type === 'chamfer') return `<svg ${common}><path d="M8 36 L8 8 L48 8 L56 16 L56 36 Z"/><path d="M45 12 L52 19" class="shape-icon-line"/></svg>`;
  return `<svg ${common}><path d="M9 35 L9 9 L55 9 L55 35 Z"/><path d="M14 14 L50 14 L50 30 L14 30 Z" class="shape-icon-line"/></svg>`;
}

function getShapeIconType(shape) {
  const baseType = shape?.generation?.base?.type ?? '';
  const family = shape?.shape_family ?? '';
  const label = `${shape?.label ?? ''} ${shape?.id ?? ''}`.toLowerCase();
  if (['point_1', 'point_2', 'point_3', 'wedge'].includes(baseType)) return baseType;
  if (['point_1', 'point_2', 'point_3', 'wedge'].includes(family)) return family;
  if (/point[ _-]?1|pente[ _-]?1/.test(label)) return 'point_1';
  if (/point[ _-]?2|pente[ _-]?2|pent2|pointe[ _-]?2/.test(label)) return 'point_2';
  if (/point[ _-]?3|pente[ _-]?3|pointe[ _-]?3/.test(label)) return 'point_3';
  if (/arrondi|round/.test(label) || /rounded/.test(family)) return 'round';
  if (/chanfr|chamfer/.test(label) || /chamfer/.test(family)) return 'chamfer';
  if (/wedge|slope|pente/.test(label) || /slope/.test(family)) return 'wedge';
  return 'box';
}

function getVariantSortKey(catalogPiece) {
  const shape = getShapeVariant(catalogPiece.shape_variant_id);
  const index = String(Number(shape?.variant_index) || 0).padStart(4, '0');
  return `${index}-${getVariantDisplayLabel(shape, getSize(catalogPiece.size_id))}-${catalogPiece.id}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function serializePlacedPiece(instance) {
  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  return {
    placed_piece_id: instance.id,
    label: instance.label,
    catalog_piece_id: instance.catalogPieceId,
    family_id: catalogPiece?.family_id ?? null,
    size_id: catalogPiece?.size_id ?? null,
    shape_variant_id: catalogPiece?.shape_variant_id ?? null,
    spec_profile_id: catalogPiece?.spec_profile_id ?? null,
    recipe_id: catalogPiece?.recipe_id ?? null,
    position: {
      x: round3(instance.group.position.x),
      y: round3(instance.group.position.y),
      z: round3(instance.group.position.z),
    },
    rotation: { ...instance.rotation },
    symmetry: { ...instance.symmetry },
    group_id: instance.groupId ?? null,
    material: {
      color: `#${instance.material.color.getHexString()}`,
    },
    anchor_links: [],
    components: [],
    modifiers: [],
    metadata: { locked: false, notes: [] },
  };
}

function serializeAssemblyGroup(group) {
  refreshAssemblyGroupRuntime(group);
  return {
    group_id: group.id,
    type: 'group',
    name: group.name,
    origin: vectorToPlain(group.origin),
    pivot: vectorToPlain(group.pivot),
    bbox: {
      min: vectorToPlain(group.bbox.min),
      max: vectorToPlain(group.bbox.max),
    },
    children: group.children.map((child) => ({
      instance_id: child.instanceId,
      local_position: vectorToPlain(child.localPosition),
    })),
    metadata: {
      created_from_selection: Boolean(group.metadata?.createdFromSelection),
      can_ungroup: group.metadata?.canUngroup !== false,
      saved_as_model: Boolean(group.metadata?.savedAsModel),
    },
  };
}

function serializeCurrentShip({ localId, name, createdAt }) {
  return buildShipCreation({
    catalog: state.catalog,
    localId,
    name,
    createdAt,
    updatedAt: new Date().toISOString(),
    pieces: state.instances.map(serializePlacedPiece),
    groups: state.assemblyGroups.map(serializeAssemblyGroup),
    computedSpecs: calculateShipStats(),
    metadata: {
      created_with: 'spacecraft_c1_web_editor',
      notes: [],
    },
  });
}

function loadShipCreationIntoScene(shipCreation) {
  clearScene({ skipPersist: true });
  state.nextInstanceId = 1;
  state.nextGroupId = 1;

  for (const piece of shipCreation.ship?.pieces ?? []) {
    const catalogPiece = getCatalogPieceById(piece.catalog_piece_id);
    if (!catalogPiece) continue;
    const instance = createInstance(catalogPiece, {
      id: piece.placed_piece_id,
      label: piece.label,
      symmetry: piece.symmetry,
      rotation: piece.rotation,
      color: piece.material?.color,
      preservePosition: true,
      position: new THREE.Vector3(
        Number(piece.position?.x) || 0,
        Number(piece.position?.y) || 0,
        Number(piece.position?.z) || 0,
      ),
    });
    if (instance) instance.groupId = piece.group_id ?? null;
  }

  for (const rawGroup of shipCreation.ship?.groups ?? []) {
    const group = {
      id: createNextGroupId({ id: rawGroup.group_id }),
      type: 'group',
      name: rawGroup.name || rawGroup.group_id,
      origin: cloneVector3Like(rawGroup.origin),
      pivot: cloneVector3Like(rawGroup.pivot),
      bbox: new THREE.Box3(
        cloneVector3Like(rawGroup.bbox?.min),
        cloneVector3Like(rawGroup.bbox?.max),
      ),
      children: (rawGroup.children ?? []).map((child) => ({
        instanceId: child.instance_id,
        localPosition: cloneVector3Like(child.local_position),
      })).filter((child) => getInstanceById(child.instanceId)),
      metadata: {
        createdFromSelection: rawGroup.metadata?.created_from_selection !== false,
        canUngroup: rawGroup.metadata?.can_ungroup !== false,
        savedAsModel: Boolean(rawGroup.metadata?.saved_as_model),
      },
    };
    if (!group.children.length) continue;
    for (const child of group.children) {
      const instance = getInstanceById(child.instanceId);
      if (instance) instance.groupId = group.id;
    }
    state.assemblyGroups.push(group);
    syncGroupInstanceWorldPositions(group, group.origin);
    refreshAssemblyGroupRuntime(group);
  }

  if (state.assemblyGroups[0]) selectAssemblyGroup(state.assemblyGroups[0].id);
  else selectInstance(getLooseInstances()[0]?.id ?? null);
  updateStats();
  fitCameraToAll(false);
  setMessage('');
}

function formatDateTime(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR');
}

function renderShipPersistenceState(persistenceState) {
  if (!dom.shipStorageStatus || !dom.shipList || !dom.shipNameInput) return;

  dom.shipNameInput.value = persistenceState.currentShipName ?? 'Unnamed';
  dom.shipList.innerHTML = '';

  for (const ship of persistenceState.ships) {
    const option = document.createElement('option');
    option.value = ship.local_id;
    option.textContent = `${ship.name} · ${ship.piece_count} pièce(s) · ${formatDateTime(ship.updated_at)}`;
    option.selected = ship.local_id === persistenceState.currentShipId;
    dom.shipList.append(option);
  }

  if (persistenceState.currentShipId) dom.shipList.value = persistenceState.currentShipId;
  if (dom.openShipBtn) dom.openShipBtn.disabled = !dom.shipList.value;
  if (dom.renameShipBtn) dom.renameShipBtn.disabled = !persistenceState.currentShipId;
  if (dom.deleteShipBtn) dom.deleteShipBtn.disabled = !dom.shipList.value;
  if (dom.duplicateShipBtn) dom.duplicateShipBtn.disabled = !dom.shipList.value;
  if (dom.exportShipBtn) dom.exportShipBtn.disabled = !persistenceState.currentShipId;

  const saveState = persistenceState.saveInProgress
    ? 'sauvegarde en cours'
    : (persistenceState.isDirty ? 'modifications en attente' : 'à jour');
  dom.shipStorageStatus.textContent = [
    `mode              : ${persistenceState.storageMode}`,
    `création active   : ${persistenceState.currentShipName ?? 'n/a'}`,
    `état sauvegarde   : ${saveState}`,
    `dernier save      : ${formatDateTime(persistenceState.lastSavedAt)}`,
    `erreur            : ${persistenceState.lastSaveError || 'aucune'}`,
    `info stockage     : ${persistenceState.lastWarning || 'aucune'}`,
  ].join('\n');
}

function setPanelCollapsed(panel, body, button, icon, collapsed) {
  if (!panel || !button || !body) return;
  panel.classList.toggle('is-collapsed', collapsed);
  body.hidden = collapsed;
  button.setAttribute('aria-expanded', String(!collapsed));
  if (icon) icon.textContent = collapsed ? '[+]' : '[-]';
}

function setCreationsPanelCollapsed(collapsed) {
  setPanelCollapsed(dom.creationsPanel, dom.creationsPanelBody, dom.toggleCreationsPanelBtn, dom.toggleCreationsPanelIcon, collapsed);
}

function setPlacedPanelCollapsed(collapsed) {
  setPanelCollapsed(dom.placedPanel, dom.placedPanelBody, dom.togglePlacedPanelBtn, dom.togglePlacedPanelIcon, collapsed);
}

function setCatalogPanelCollapsed(collapsed) {
  setPanelCollapsed(dom.catalogPanel, dom.catalogPanelBody, dom.toggleCatalogPanelBtn, dom.toggleCatalogPanelIcon, collapsed);
}

function setHelpPanelCollapsed(collapsed) {
  setPanelCollapsed(dom.helpPanel, dom.helpPanelBody, dom.toggleHelpPanelBtn, dom.toggleHelpPanelIcon, collapsed);
}

function exportBlueprint() {
  runPersistenceTask(state.persistence?.exportCurrentShip?.(), 'Export impossible.');
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function init() {
  state.catalog = await loadAssemblyCatalog();
  const catalogValidation = validateCatalogData(state.catalog);
  if (!catalogValidation.valid) {
    throw new Error(`Catalogue invalide: ${catalogValidation.errors.map((issue) => `${issue.path}: ${issue.message}`).join(' ')}`);
  }
  state.repo = buildRepository(state.catalog);
  assemblyMovementController = createAssemblyMovementController({
    collidesBoxesWithScene,
    getAssemblyGroupById,
    getGroupChildBoxes,
    getInstanceBox,
    getInstanceById,
    isGroupPlacementValid,
    isSaneWorldPosition,
    resolveVerticalCollisionOriginForGroup,
    setGroupWorldPosition,
    setMessage,
    updateAttachmentStates,
    updateSelectionBox,
    updateStats,
  });
  updateAssemblyGrid();
  state.persistence = createAssemblyPersistenceController({
    catalog: state.catalog,
    serializeCurrentShip,
    loadShipCreation: loadShipCreationIntoScene,
    onStateChange: renderShipPersistenceState,
    downloadJson,
  });

  renderCatalogPieceOptions();
  selectInstance(null);
  updateEmptyHint();
  bindEvents();
  setCreationsPanelCollapsed(true);
  setPlacedPanelCollapsed(true);
  setCatalogPanelCollapsed(true);
  setHelpPanelCollapsed(true);
  await state.persistence.init();
  mountAssemblyNavigationCube();
  setAssemblyView('top', false);
  updateOrthographicFrustum(1000);
  animate();
}

function bindEvents() {
  mountSymmetryButtonIcons();
  dom.catalogPieceSelect?.addEventListener('change', () => setSelectedCatalogPiece(dom.catalogPieceSelect.value));

  dom.instanceSelect.addEventListener('change', () => {
    const selectedOptions = [...dom.instanceSelect.selectedOptions];
    if (!selectedOptions.length) {
      clearSelection();
      refreshInstanceList();
      updateSelectionUi();
      updateStats();
      updateSelectionBox();
      return;
    }
    if (selectedOptions.length === 1) {
      const option = selectedOptions[0];
      if (option.dataset.entryType === 'group') selectAssemblyGroup(option.value);
      else selectPiece(option.value);
      return;
    }
    selectPieceMulti(selectedOptions.filter((option) => option.dataset.entryType === 'piece').map((option) => option.value));
  });
  dom.clearSceneBtn.addEventListener('click', clearScene);
  dom.shipList?.addEventListener('change', () => {
    dom.openShipBtn.disabled = !dom.shipList.value;
  });
  dom.toggleCreationsPanelBtn?.addEventListener('click', () => {
    const collapsed = dom.creationsPanel?.classList.contains('is-collapsed');
    setCreationsPanelCollapsed(!collapsed);
  });
  dom.togglePlacedPanelBtn?.addEventListener('click', () => {
    const collapsed = dom.placedPanel?.classList.contains('is-collapsed');
    setPlacedPanelCollapsed(!collapsed);
  });
  dom.toggleCatalogPanelBtn?.addEventListener('click', () => {
    const collapsed = dom.catalogPanel?.classList.contains('is-collapsed');
    setCatalogPanelCollapsed(!collapsed);
  });
  dom.toggleHelpPanelBtn?.addEventListener('click', () => {
    const collapsed = dom.helpPanel?.classList.contains('is-collapsed');
    setHelpPanelCollapsed(!collapsed);
  });
  dom.openShipBtn?.addEventListener('click', () => {
    if (!dom.shipList.value) return;
    runPersistenceTask(state.persistence?.openShip(dom.shipList.value), 'Ouverture impossible.');
  });
  dom.newShipBtn?.addEventListener('click', () => {
    runPersistenceTask(state.persistence?.createShip('Unnamed'), 'Création impossible.');
  });
  dom.renameShipBtn?.addEventListener('click', () => {
    runPersistenceTask(state.persistence?.renameCurrentShip(dom.shipNameInput.value), 'Renommage impossible.');
  });
  dom.shipNameInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runPersistenceTask(state.persistence?.renameCurrentShip(dom.shipNameInput.value), 'Renommage impossible.');
  });
  dom.duplicateShipBtn?.addEventListener('click', () => {
    const localId = dom.shipList.value || state.persistence?.getState()?.currentShipId;
    runPersistenceTask(state.persistence?.duplicateShip(localId), 'Duplication impossible.');
  });
  dom.deleteShipBtn?.addEventListener('click', () => {
    const localId = dom.shipList.value || state.persistence?.getState()?.currentShipId;
    if (!localId) return;
    runPersistenceTask(state.persistence?.deleteShip(localId), 'Suppression impossible.');
  });
  dom.exportShipBtn?.addEventListener('click', () => {
    runPersistenceTask(state.persistence?.exportCurrentShip?.(), 'Export impossible.');
  });
  dom.importShipBtn?.addEventListener('click', () => {
    dom.importShipInput?.click();
  });
  dom.importShipInput?.addEventListener('change', async () => {
    const [file] = dom.importShipInput.files ?? [];
    if (!file) return;
    try {
      if (!state.persistence?.importShip) throw new Error('Import indisponible.');
      await state.persistence.importShip(file);
    } catch (error) {
      setMessage(error?.message ?? 'Import impossible.');
    } finally {
      dom.importShipInput.value = '';
    }
  });

  dom.colorInput.addEventListener('input', () => {
    const selectedInstances = getSelectedInstancesForCommands();
    if (!selectedInstances.length) return;
    for (const selected of selectedInstances) selected.material.color.set(dom.colorInput.value);
    markShipDirty();
  });

  dom.mirrorLengthBtn?.addEventListener('click', () => toggleSelectedSymmetry('length'));
  dom.mirrorWidthBtn?.addEventListener('click', () => toggleSelectedSymmetry('width'));
  dom.mirrorHeightBtn?.addEventListener('click', () => toggleSelectedSymmetry('height'));

  dom.gridInput.checked = true;
  dom.gridInput?.addEventListener('change', () => {
    if (!ASSEMBLY_MAGNET_ENABLED) return;
    grid.visible = dom.gridInput.checked;
  });

  dom.showAnchorsInput?.addEventListener('change', () => {
    state.showAnchors = dom.showAnchorsInput.checked;
    updateAnchorVisibility();
  });

  dom.screenshotBtn?.addEventListener('click', takeScreenshot);
  // Legacy input handlers audited in `main.js`: `onGlobalPointerDown`, `onPointerDown`,
  // `onPointerMove`, `onPointerUp`, `onMouseDown`, `onMouseMove`, `onMouseUp`.
  // They stay as movement primitives, but input ownership is now centralized below.
  assemblyInteractionController = createAssemblyInteractionController({
    canvas: renderer.domElement,
    viewportStage: dom.viewportStage,
    orbitControls,
    isBlockedTarget: isInteractionBlockedTarget,
    pickSelectable: pickSelectableEntity,
    resolveDragSelection,
    selectEntities,
    toggleSelectionEntity,
    clearSelection: clearSelectionAndRefresh,
    hasSelection,
    beginObjectDrag: beginSelectionDrag,
    updateObjectDrag: updateSelectionDrag,
    endObjectDrag: endSelectionDrag,
    beginCameraDrag: beginCameraPointerDrag,
    endCameraDrag: endCameraPointerDrag,
    collectMarqueeSelection,
    moveSelectedByDelta,
    moveSceneByDelta: panSceneByDelta,
    getMoveStep: getMagnetStep,
  });
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (assemblyInteractionController.onPointerDown(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (assemblyInteractionController.onPointerMove(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (assemblyInteractionController.onPointerUp(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  renderer.domElement.addEventListener('pointercancel', (event) => {
    assemblyInteractionController.onPointerCancel(event);
  }, true);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  renderer.domElement.addEventListener('dragover', onCanvasDragOver);
  renderer.domElement.addEventListener('dragleave', onCanvasDragLeave);
  renderer.domElement.addEventListener('drop', onCanvasDrop);

  window.addEventListener('keydown', (event) => {
    const tagName = document.activeElement?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;
    const key = event.key.toLowerCase();
    const selectionActive = hasSelection();

    if ((event.ctrlKey || event.metaKey) && !event.altKey && key === 'z') {
      if (event.shiftKey) {
        if (historyStack.redo()) event.preventDefault();
      } else if (historyStack.undo()) {
        event.preventDefault();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && key === 'y') {
      if (historyStack.redo()) event.preventDefault();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      if (copySelectedInstances()) event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'v') {
      if (pasteCopiedInstances()) event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'g') {
      if (createAssemblyGroupFromSelection()) event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'b') {
      if (getSelectedAssemblyGroup()) {
        ungroupSelectedAssemblyGroup();
        event.preventDefault();
      }
      return;
    }

    if (assemblyInteractionController.onKeyDown(event)) {
      event.preventDefault();
      return;
    }

    if (key === 'f') {
      if (selectionActive) fitCurrentSelection();
      else fitCameraToAll();
    }
    if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
      if (selectionActive) fitCurrentSelection();
    }
    if (key === 'r') resetView();
    if (event.key === 'Escape') {
      clearSelectionAndRefresh();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') removeSelectedInstance();
  });
}

init().catch((error) => {
  console.error(error);
  if (dom.shipStats) dom.shipStats.textContent = String(error.message || error);
  if (dom.selectionStats) dom.selectionStats.textContent = 'Aucune sélection active.';
});
