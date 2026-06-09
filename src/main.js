import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ASSEMBLY_MAGNET_ENABLED, ASSEMBLY_MAGNET_STEP_UNITS } from './assembly-config.js';
import { buildShapeGeometry, createCatalogReservationBox, catalogPointVector } from './shape-engine.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNavigationCubeOverlay } from './navigation-cube-overlay.js';
import { createNavigationCubeViewApi } from './navigation-cube.js';
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
  selectedId: null,
  selectedCatalogPieceId: null,
  nextInstanceId: 1,
  drag: null,
  lastMessage: '',
  catalogFilters: { familyId: null, sizeId: null, profileType: null },
  viewMode: 'top',
  showAnchors: false,
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
  catalogSummary: document.querySelector('#catalogSummary'),
  instanceSelect: document.querySelector('#instanceSelect'),
  duplicatePieceBtn: document.querySelector('#duplicatePieceBtn'),
  removePieceBtn: document.querySelector('#removePieceBtn'),
  clearSceneBtn: document.querySelector('#clearSceneBtn'),
  deselectBtn: document.querySelector('#deselectBtn'),
  colorInput: document.querySelector('#colorInput'),
  mirrorLengthBtn: document.querySelector('#mirrorLengthBtn'),
  mirrorWidthBtn: document.querySelector('#mirrorWidthBtn'),
  mirrorHeightBtn: document.querySelector('#mirrorHeightBtn'),
  resetMirrorsBtn: document.querySelector('#resetMirrorsBtn'),
  heightStepInput: document.querySelector('#heightStepInput'),
  heightInput: document.querySelector('#heightInput'),
  moveUpBtn: document.querySelector('#moveUpBtn'),
  moveDownBtn: document.querySelector('#moveDownBtn'),
  gridInput: document.querySelector('#gridInput'),
  showAnchorsInput: document.querySelector('#showAnchorsInput'),
  stats: document.querySelector('#stats'),
  emptyHint: document.querySelector('#emptyHint'),
  dimensionOverlay: document.querySelector('#dimensionOverlay'),
  fitSelectedBtn: document.querySelector('#fitSelectedBtn'),
  fitAllBtn: document.querySelector('#fitAllBtn'),
  screenshotBtn: document.querySelector('#screenshotBtn'),
  exportBlueprintBtn: document.querySelector('#exportBlueprintBtn'),
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

let assemblyViewController = null;
let assemblyNavigationCubeOverlay = null;

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
  renderCatalogEditors();
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
  return state.instances.find((item) => item.id === state.selectedId) ?? null;
}

function cloneSymmetry(source = {}) {
  return {
    length: Boolean(source.length),
    width: Boolean(source.width),
    height: Boolean(source.height),
  };
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
  const id = `placed_${String(state.nextInstanceId++).padStart(3, '0')}`;
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

  const preferredPosition = options.position ? normalizeNewPiecePosition(catalogPiece, options.position) : findAvailablePosition(catalogPiece);
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
    label: `${catalogPiece.label_fr || catalogPiece.id} #${id.replace('placed_', '')}`,
    catalogPieceId: catalogPiece.id,
    symmetry,
    rotation: { axis: 'height', quarter_turns: 0 },
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
  renderCatalogEditors();
  const instance = createInstance(catalogPiece, position ? { position } : {});
  if (instance) fitCameraToObject(instance.group, false);
  return instance;
}

function addSelectedCatalogPiece(position = null) {
  const catalogPiece = getSelectedCatalogPiece();
  if (!catalogPiece) return null;
  return addCatalogPieceById(catalogPiece.id, position);
}

function duplicateSelectedInstance() {
  const selected = getSelectedInstance();
  if (!selected) return;
  const catalogPiece = getCatalogPieceById(selected.catalogPieceId);
  if (!catalogPiece) return;

  const basePosition = selected.group.position.clone();
  const offsets = [
    new THREE.Vector3(40, 0, 0),
    new THREE.Vector3(-40, 0, 0),
    new THREE.Vector3(0, -30, 0),
    new THREE.Vector3(0, 30, 0),
    new THREE.Vector3(0, 0, 10),
  ];

  let position = null;
  for (const offset of offsets) {
    const candidate = basePosition.clone().add(offset);
    const candidateBox = getInstanceReservationBox(selected, candidate);
    if (!collidesWithOthers(candidateBox, null)) {
      position = candidate;
      break;
    }
  }

  const clone = createInstance(catalogPiece, {
    symmetry: selected.symmetry,
    color: `#${selected.material.color.getHexString()}`,
    position: position ?? findAvailablePosition(catalogPiece),
  });

  if (clone) fitCameraToObject(clone.group, false);
}

function disposeInstance(instance) {
  rootGroup.remove(instance.group);
  disposeInstanceResources(instance);
}

function removeSelectedInstance() {
  const selected = getSelectedInstance();
  if (!selected) return;
  disposeInstance(selected);
  state.instances = state.instances.filter((item) => item.id !== selected.id);
  state.selectedId = null;
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateEmptyHint();
  updateAttachmentStates();
  updateSelectionBox();
  updateDimensionOverlay();
}

function clearScene() {
  for (const instance of state.instances) disposeInstance(instance);
  state.instances = [];
  state.selectedId = null;
  refreshInstanceList();
  updateSelectionUi();
  updateStats();
  updateEmptyHint();
  updateAttachmentStates();
  updateSelectionBox();
  updateDimensionOverlay();
  setMessage('');
}

function selectInstance(id) {
  const instance = state.instances.find((item) => item.id === id);
  state.selectedId = instance ? id : null;
  syncAssemblyPaletteToSelectedInstance();
  refreshInstanceList();
  updateSelectionUi();
  renderCatalogPieceOptions();
  renderCatalogEditors();
  updateStats();
  updateSelectionBox();
  updateDimensionOverlay();
}

function refreshInstanceList() {
  dom.instanceSelect.innerHTML = '';
  for (const instance of state.instances) {
    const option = document.createElement('option');
    option.value = instance.id;
    option.textContent = `${instance.label} · sym: ${getSymmetryLabel(instance.symmetry)}`;
    option.selected = instance.id === state.selectedId;
    dom.instanceSelect.append(option);
  }
}

function updateSelectionUi() {
  const selected = getSelectedInstance();
  const hasSelected = Boolean(selected);
  for (const element of selectedControls) element.disabled = !hasSelected;
  dom.duplicatePieceBtn.disabled = !hasSelected;
  dom.removePieceBtn.disabled = !hasSelected;
  dom.deselectBtn.disabled = !hasSelected;
  if (dom.fitSelectedBtn) dom.fitSelectedBtn.disabled = !hasSelected;

  if (!selected) {
    dom.colorInput.value = DEFAULT_COLOR;
    dom.heightInput.value = '0';
    setSymmetryButtonState({ length: false, width: false, height: false });
    return;
  }

  dom.colorInput.value = `#${selected.material.color.getHexString()}`;
  dom.heightInput.value = String(Math.round(selected.group.position.z));
  setSymmetryButtonState(selected.symmetry);
}

function setSymmetryButtonState(symmetry) {
  dom.mirrorLengthBtn.classList.toggle('active', Boolean(symmetry.length));
  dom.mirrorWidthBtn.classList.toggle('active', Boolean(symmetry.width));
  dom.mirrorHeightBtn.classList.toggle('active', Boolean(symmetry.height));
}

function toggleSelectedSymmetry(axis) {
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
  const selected = getSelectedInstance();
  if (!selected) return;
  applySymmetryState(selected, { length: false, width: false, height: false });
}

function applySymmetryState(instance, nextSymmetry) {
  const catalogPiece = getCatalogPieceById(instance.catalogPieceId);
  if (!catalogPiece) return;

  const nextGeometry = buildGeometry(catalogPiece, nextSymmetry);
  const candidateBox = getReservationBoxForCatalogPiece(catalogPiece, instance.group.position);
  if (collidesWithOthers(candidateBox, instance.id)) {
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

function collidesWithOthers(candidateBox, ignoredInstanceId) {
  return state.instances.some((instance) => {
    if (instance.id === ignoredInstanceId) return false;
    return boxesOverlap(candidateBox, getInstanceBox(instance));
  });
}

function hasCollision(instance, position) {
  return collidesWithOthers(getInstanceBox(instance, position), instance.id);
}

function calculateShipStats() {
  const definitions = state.catalog?.definitions?.spec_fields ?? {};
  const result = {};
  const accumulators = {};

  for (const fieldId of Object.keys(definitions)) {
    result[fieldId] = { value: 0, unit: definitions[fieldId].unit ?? null, status: 'confirmed' };
    accumulators[fieldId] = { weightedValue: 0, weight: 0, unknown: false };
  }

  for (const instance of state.instances) {
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

  if (state.instances.length === 0) {
    for (const field of Object.values(result)) field.value = 0;
  }

  return result;
}

function updateStats() {
  const selected = getSelectedInstance();
  const computed = calculateShipStats();
  const definitions = state.catalog?.definitions?.spec_fields ?? {};
  const statsLines = Object.entries(computed).map(([fieldId, item]) => {
    const label = definitions[fieldId]?.label_fr ?? fieldId;
    const value = item.value === null ? 'inconnu' : fmt(item.value);
    return `${label.padEnd(30, ' ')} : ${value}${item.unit ? ` ${item.unit}` : ''} [${item.status}]`;
  });

  if (!selected) {
    dom.stats.textContent = [
      `mode           : ${APP_MODE === 'editor' ? 'édition interne' : 'assembly public'}`,
      `schéma         : ${state.catalog?.schema_version ?? 'inconnu'}`,
      `catalogue      : ${state.catalogSource}`,
      `scène          : ${state.instances.length} pièce(s)`,
      'sélection      : aucune',
      state.lastMessage ? `message        : ${state.lastMessage}` : '',
      '',
      'stats calculées',
      ...statsLines,
    ].filter(Boolean).join('\n');
    return;
  }

  const catalogPiece = getCatalogPieceById(selected.catalogPieceId);
  const shape = getShapeVariant(catalogPiece?.shape_variant_id);
  const size = getSize(catalogPiece?.size_id);
  const spec = getEffectiveSpecProfile(catalogPiece?.spec_profile_id);
  const p = selected.group.position;

  dom.stats.textContent = [
    `mode           : ${APP_MODE === 'editor' ? 'édition interne' : 'assembly public'}`,
    `schéma         : ${state.catalog?.schema_version ?? 'inconnu'}`,
    `catalogue      : ${state.catalogSource}`,
    `scène          : ${state.instances.length} pièce(s)`,
    `instance       : ${selected.label}`,
    `catalog_piece  : ${catalogPiece?.id ?? 'inconnu'}`,
    `shape_variant  : ${shape?.id ?? 'inconnu'}`,
    `spec_profile   : ${spec?.id ?? 'inconnu'}`,
    `symétries      : ${getSymmetryLabel(selected.symmetry)}`,
    `taille logique : ${size?.label ?? catalogPiece?.size_id ?? 'inconnue'}`,
    `ancres         : ${shape?.anchors?.length ?? 0} point(s) · affichage ${state.showAnchors ? 'oui' : 'non'}`,
    `triangles      : ${shape?.mesh_stats?.triangleCount ?? 'n/a'}`,
    `sommets        : ${shape?.mesh_stats?.vertexCount ?? 'n/a'}`,
    `position       : ${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`,
    'rotation       : fixe',
    'échelle        : 1:1',
    'volume réservé : dimensions catalogue fixes',
    'collision      : boîte catalogue fixe',
    state.lastMessage ? `message        : ${state.lastMessage}` : '',
    '',
    'stats calculées',
    ...statsLines,
  ].filter(Boolean).join('\n');
}

function setMessage(message) {
  state.lastMessage = message;
  updateStats();
}

function fmt(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function updateEmptyHint() {
  dom.emptyHint.style.display = state.instances.length === 0 ? 'block' : 'none';
  dom.clearSceneBtn.disabled = state.instances.length === 0;
  if (dom.fitAllBtn) dom.fitAllBtn.disabled = state.instances.length === 0;
  if (dom.exportBlueprintBtn) dom.exportBlueprintBtn.disabled = state.instances.length === 0;
}

function updateSelectionBox() {
  const selected = getSelectedInstance();
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
  updateDimensionOverlay();

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

function updateDimensionOverlay() {
  if (!dom.dimensionOverlay) return;
  const selected = getSelectedInstance();
  if (!selected) {
    dom.dimensionOverlay.hidden = true;
    dom.dimensionOverlay.textContent = '';
    return;
  }
  const catalogPiece = getCatalogPieceById(selected.catalogPieceId);
  const size = getSize(catalogPiece?.size_id);
  const d = size?.dimensions;
  if (!d) {
    dom.dimensionOverlay.hidden = true;
    dom.dimensionOverlay.textContent = '';
    return;
  }
  dom.dimensionOverlay.hidden = false;
  dom.dimensionOverlay.textContent = `Vue ${state.viewMode} · ${size.label ?? catalogPiece.size_id} · X largeur=${d.width} · Y profondeur/longueur=${d.length} · Z hauteur=${d.height}`;
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
    updateDimensionOverlay();
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

function intersectDragPlane(event, target) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, target);
}

function snapValue(value, step) {
  return Math.round(value / step) * step;
}

function normalizeCandidatePosition(instance, position) {
  const next = position.clone();
  next.z = instance.group.position.z;
  snapPositionToHalfUnit(next);

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
  for (const other of state.instances) {
    if (other.id === excludeInstanceId) continue;
    const otherBox = getInstanceReservationBox(other);

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
  if (!instance || state.instances.length <= 1) return null;
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
  for (const other of state.instances) {
    if (other.id === instance.id) continue;
    const otherBox = getInstanceReservationBox(other);
    const otherAnchors = getWorldAttachmentAnchorsForInstance(other).filter(isSideAttachmentAnchor);
    if (!otherAnchors.length) continue;

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
        if (collidesWithOthers(candidateBox, instance.id)) continue;
        if (!reservationBoxesTouch(candidateBox, otherBox)) continue;

        // Recheck exact anchor alignment. The candidate is accepted only if the
        // chosen anchor pair still overlaps after grid snapping.
        const candidateAnchorWorld = localAnchor.position.clone().add(candidate);
        if (candidateAnchorWorld.distanceTo(otherAnchor.position) > Math.max(2, step * 0.12)) continue;

        // Side snap is a lateral correction, not a free 3D teleport. It can only
        // resolve the contact axis and a tiny tangent/height drift.
        const score = primaryDelta + tangentDelta * 2 + verticalDelta * 4;
        if (!best || score < best.score) best = { position: candidate, score };
      }
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
  dom.heightInput.value = String(Math.round(instance.group.position.z));
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
  const moved = tryMoveInstance(instance, next, 'Déplacement refusé : aucune position libre trouvée sur l’axe Z.', { autoVertical: true });
  if (moved) state.drag.lastValidPosition.copy(instance.group.position);
}

function moveSelectedHeight(delta) {
  const selected = getSelectedInstance();
  if (!selected) return;
  const next = selected.group.position.clone();
  next.z = snapValue(next.z + delta, getMagnetStep());
  tryMoveInstance(selected, next, 'Hauteur refusée : collision avec une autre pièce.');
}

function setSelectedHeight(value) {
  const selected = getSelectedInstance();
  if (!selected) return;
  const next = selected.group.position.clone();
  next.z = snapValue(Number(value) || 0, getMagnetStep());
  tryMoveInstance(selected, next, 'Hauteur refusée : collision avec une autre pièce.');
  dom.heightInput.value = String(Math.round(selected.group.position.z));
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

function shouldPreserveSelectionOnPointerDown(target) {
  return Boolean(target?.closest('button, input, select, textarea, label, a'));
}

function onGlobalPointerDown(event) {
  if (event.button !== 0) return;
  if (state.drag) return;
  if (!getSelectedInstance()) return;

  const target = event.target;
  if (target === renderer.domElement) {
    const picked = pickInstance(event);
    if (!picked) selectInstance(null);
    return;
  }

  if (shouldPreserveSelectionOnPointerDown(target)) return;
  selectInstance(null);
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const picked = pickInstance(event);
  if (!picked) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  selectInstance(picked.id);
  dragPlane.set(new THREE.Vector3(0, 0, 1), -picked.group.position.z);

  if (!intersectDragPlane(event, dragHit)) return;

  state.drag = {
    pointerId: event.pointerId,
    instanceId: picked.id,
    startHit: dragHit.clone(),
    startPosition: picked.group.position.clone(),
    offset: picked.group.position.clone().sub(dragHit),
    lastValidPosition: picked.group.position.clone(),
  };

  orbitControls.enabled = false;
  dom.canvas.classList.add('dragging-piece');
  dom.canvas.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const instance = state.instances.find((item) => item.id === state.drag.instanceId);
  if (!instance || !intersectDragPlane(event, dragHit)) return;

  const delta = dragHit.clone().sub(state.drag.startHit);
  const target = state.drag.startPosition.clone().add(delta);
  target.z = state.drag.startPosition.z;
  applyDragPosition(instance, target);
}

function onPointerUp(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  dom.canvas.releasePointerCapture?.(event.pointerId);
  state.drag = null;
  orbitControls.enabled = true;
  dom.canvas.classList.remove('dragging-piece');
  updateStats();
  updateSelectionBox();
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

function getNextVariantIndex(sizeId) {
  const indexes = (state.catalog.shape_variants ?? [])
    .filter((shape) => shape.size_id === sizeId)
    .map((shape) => Number(shape.variant_index) || 0);
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function getShapeVariantLabel(shape) {
  if (!shape) return 'variante inconnue';
  return `${shape.id} · ${shape.label ?? `v${pad2(shape.variant_index)}`} · ${shape.generation?.mode ?? 'mode ?'}`;
}

function populateCreationForms() {
  if (!IS_EDITOR) return;
  renderBasicSelect(dom.variantSizeSelect, state.catalog.sizes ?? [], (size) => size.id, (size) => size.label ?? size.id);
  renderBasicSelect(dom.pieceFamilySelect, state.catalog.families ?? [], (family) => family.id, (family) => family.label_fr ?? family.id);
  renderBasicSelect(dom.pieceSizeSelect, state.catalog.sizes ?? [], (size) => size.id, (size) => size.label ?? size.id);
  renderPieceShapeSelect();
  updateCreatePieceDefaultLabel();
}

function renderBasicSelect(select, items, getValue, getLabel, selectedValue = select?.value) {
  if (!select) return;
  select.innerHTML = '';
  for (const item of items) {
    const option = document.createElement('option');
    option.value = getValue(item);
    option.textContent = getLabel(item);
    option.selected = option.value === selectedValue;
    select.append(option);
  }
}

function renderPieceShapeSelect() {
  if (!IS_EDITOR || !dom.pieceSizeSelect || !dom.pieceShapeSelect) return;
  const sizeId = dom.pieceSizeSelect.value;
  const shapes = (state.catalog.shape_variants ?? [])
    .filter((shape) => shape.size_id === sizeId)
    .sort((a, b) => (Number(a.variant_index) || 0) - (Number(b.variant_index) || 0));
  renderBasicSelect(dom.pieceShapeSelect, shapes, (shape) => shape.id, getShapeVariantLabel);
}

function updateCreatePieceDefaultLabel() {
  if (!IS_EDITOR || !dom.pieceFamilySelect || !dom.pieceSizeSelect || !dom.pieceShapeSelect || !dom.pieceProfileTypeInput || !dom.pieceLabelInput) return;
  const family = getFamily(dom.pieceFamilySelect.value);
  const size = getSize(dom.pieceSizeSelect.value);
  const shape = getShapeVariant(dom.pieceShapeSelect.value);
  const profileType = slugifyId(dom.pieceProfileTypeInput.value || 'standard');
  dom.pieceLabelInput.placeholder = [
    family?.label_fr ?? dom.pieceFamilySelect.value,
    size?.label ?? dom.pieceSizeSelect.value,
    shape ? `v${pad2(shape.variant_index)}` : '',
    profileType !== 'standard' ? profileType : '',
  ].filter(Boolean).join(' ');
}

function createVariantFromForm() {
  if (!IS_EDITOR) return;
  const sizeId = dom.variantSizeSelect.value;
  const size = getSize(sizeId);
  if (!size) {
    setMessage('Création variante refusée : taille introuvable.');
    return;
  }

  const index = getNextVariantIndex(sizeId);
  const id = uniqueId(`shape_${sizeId}_v${pad2(index)}`, new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id)));
  const base = getBaseGenerationFromForm(size);
  const shape = {
    id,
    size_id: sizeId,
    variant_index: index,
    label: dom.variantLabelInput.value.trim() || `${size.label ?? sizeId} variant ${pad2(index)}`,
    shape_family: slugifyId(dom.variantShapeFamilyInput.value || 'block'),
    simplified: true,
    fidelity: {
      target: 'functional_silhouette',
      ignore_cosmetic_details: true,
    },
    generation: base,
    allowed_symmetry: {
      length: true,
      width: true,
      height: true,
    },
    anchors: createDefaultAnchors(size),
    collision: {
      mode: 'generated_from_shape',
      precision: 'simplified',
      allow_overlap: false,
    },
    status: 'draft',
    metadata: {
      source: 'web_editor',
      notes: [],
    },
  };

  state.catalog.shape_variants ??= [];
  state.catalog.shape_variants.push(shape);
  rebuildRepository();
  renderPieceShapeSelect();
  dom.pieceSizeSelect.value = sizeId;
  renderPieceShapeSelect();
  dom.pieceShapeSelect.value = id;
  dom.variantLabelInput.value = '';
  updateCreatePieceDefaultLabel();
  renderValidationReport();
  setMessage(`Variante créée : ${id}.`);
}

function getBaseGenerationFromForm(size) {
  const value = dom.variantBaseTypeSelect.value;
  const bounds = { length: size.dimensions.length, width: size.dimensions.width, height: size.dimensions.height };
  if (value === 'wedge_length_front_to_back') {
    return {
      mode: 'primitive_stack',
      base: { type: 'wedge', bounds, slope_axis: 'length', slope_direction: 'front_to_back' },
      operations: [],
    };
  }
  if (value === 'wedge_width_left_to_right') {
    return {
      mode: 'primitive_stack',
      base: { type: 'wedge', bounds, slope_axis: 'width', slope_direction: 'left_to_right' },
      operations: [],
    };
  }
  return {
    mode: 'primitive_stack',
    base: { type: 'box', bounds },
    operations: [],
  };
}

function createDefaultAnchors(size) {
  const { length, width, height } = size.dimensions;
  const mid = { x: length / 2, y: width / 2, z: height / 2 };
  const defs = [
    ['length_min', { x: 0, y: mid.y, z: mid.z }, { x: -1, y: 0, z: 0 }],
    ['length_max', { x: length, y: mid.y, z: mid.z }, { x: 1, y: 0, z: 0 }],
    ['width_min', { x: mid.x, y: 0, z: mid.z }, { x: 0, y: -1, z: 0 }],
    ['width_max', { x: mid.x, y: width, z: mid.z }, { x: 0, y: 1, z: 0 }],
    ['height_min', { x: mid.x, y: mid.y, z: 0 }, { x: 0, y: 0, z: -1 }],
    ['height_max', { x: mid.x, y: mid.y, z: height }, { x: 0, y: 0, z: 1 }],
  ];
  return defs.map(([face, position, normal], index) => ({
    id: `anchor_${face}_${index + 1}`,
    position,
    normal,
    face,
    type: 'standard',
    enabled: true,
    status: 'draft',
  }));
}

function duplicateSelectedVariant() {
  if (!IS_EDITOR) return;
  const selectedPiece = getSelectedCatalogPiece();
  const source = getShapeVariant(selectedPiece?.shape_variant_id);
  if (!source) {
    setMessage('Duplication variante refusée : aucune variante sélectionnée.');
    return;
  }

  const index = getNextVariantIndex(source.size_id);
  const id = uniqueId(`shape_${source.size_id}_v${pad2(index)}`, new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id)));
  const clone = structuredClone(source);
  clone.id = id;
  clone.variant_index = index;
  clone.label = `${source.label ?? source.id} copie ${pad2(index)}`;
  clone.status = 'draft';
  clone.metadata = {
    ...(clone.metadata ?? {}),
    source: 'web_editor_duplicate',
    duplicated_from: source.id,
  };

  state.catalog.shape_variants.push(clone);
  rebuildRepository();
  dom.pieceSizeSelect.value = clone.size_id;
  renderPieceShapeSelect();
  dom.pieceShapeSelect.value = clone.id;
  updateCreatePieceDefaultLabel();
  renderValidationReport();
  setMessage(`Variante dupliquée : ${id}.`);
}

function createCatalogPieceFromForm() {
  if (!IS_EDITOR) return;
  const familyId = dom.pieceFamilySelect.value;
  const sizeId = dom.pieceSizeSelect.value;
  const shapeId = dom.pieceShapeSelect.value;
  const profileType = slugifyId(dom.pieceProfileTypeInput.value || 'standard');
  const family = getFamily(familyId);
  const size = getSize(sizeId);
  const shape = getShapeVariant(shapeId);

  if (!family || !size || !shape) {
    setMessage('Création pièce refusée : famille, taille ou variante introuvable.');
    return;
  }
  if (shape.size_id !== sizeId) {
    setMessage(`Création pièce refusée : la variante ${shape.id} appartient à ${shape.size_id}, pas ${sizeId}.`);
    return;
  }

  const spec = ensureSpecProfile(familyId, sizeId, profileType);
  const recipe = ensureRecipe(spec.id, familyId, sizeId, profileType);
  const variantCode = `v${pad2(shape.variant_index)}`;
  const idBase = `piece_${familyId}_${sizeId}_${variantCode}_${profileType}`;
  const existingIds = new Set((state.catalog.catalog_pieces ?? []).map((piece) => piece.id));
  const id = uniqueId(idBase, existingIds);
  const label = dom.pieceLabelInput.value.trim() || dom.pieceLabelInput.placeholder || `${family.label_fr ?? familyId} ${size.label ?? sizeId} ${variantCode}`;

  const catalogPiece = {
    id,
    label_fr: label,
    family_id: familyId,
    size_id: sizeId,
    shape_variant_id: shapeId,
    spec_profile_id: spec.id,
    recipe_id: recipe.id,
    fixed_catalog_entry: true,
    availability: {
      status: 'unknown',
      unlock: null,
    },
    metadata: {
      source: 'web_editor',
      notes: [],
    },
  };

  state.catalog.catalog_pieces ??= [];
  state.catalog.catalog_pieces.push(catalogPiece);
  rebuildRepository();
  renderCatalogPieceOptions();
  dom.catalogPieceSelect.value = id;
  renderCatalogEditors();
  dom.pieceLabelInput.value = '';
  setMessage(`Entrée catalogue créée : ${id}.`);
}

function ensureSpecProfile(familyId, sizeId, profileType) {
  const id = `spec_${familyId}_${sizeId}_${profileType}`;
  let spec = getSpecProfile(id);
  if (spec) return spec;

  const definitions = state.catalog.definitions?.spec_fields ?? {};
  spec = {
    id,
    family_id: familyId,
    size_id: sizeId,
    profile_type: profileType,
    label_fr: `${getFamily(familyId)?.label_fr ?? familyId} ${getSize(sizeId)?.label ?? sizeId} ${profileType}`,
    specs: Object.fromEntries(Object.entries(definitions).map(([fieldId, definition]) => [
      fieldId,
      { value: null, unit: definition.unit ?? null, status: 'unknown' },
    ])),
    metadata: {
      source: 'web_editor_placeholder',
      notes: [],
    },
  };
  state.catalog.spec_profiles ??= [];
  state.catalog.spec_profiles.push(spec);
  rebuildRepository();
  return spec;
}

function ensureRecipe(specProfileId, familyId, sizeId, profileType) {
  const id = `recipe_${familyId}_${sizeId}_${profileType}`;
  let recipe = getRecipe(id);
  if (recipe) return recipe;

  recipe = {
    id,
    output_spec_profile_id: specProfileId,
    cost: { value: null, currency: 'C', status: 'unknown' },
    duration: { value: null, unit: state.catalog.units?.craft_duration ?? 'su', status: 'unknown' },
    station: { id: 'unknown', label_fr: 'Inconnue', status: 'unknown' },
    ingredients: [],
    status: 'unknown',
    metadata: {
      source: 'web_editor_placeholder',
      notes: [],
    },
  };
  state.catalog.recipes ??= [];
  state.catalog.recipes.push(recipe);
  rebuildRepository();
  return recipe;
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
    renderCatalogEditors();
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
    renderCatalogEditors();
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
    const dimensionsLabel = dimensions ? `${dimensions.length}×${dimensions.width}×${dimensions.height}` : option.label;
    button.innerHTML = `<span>${option.label}</span><small>${dimensionsLabel}</small>`;

    button.addEventListener('click', () => {
      state.catalogFilters.sizeId = option.value;
      state.catalogFilters.profileType = 'standard';
      renderCatalogPieceOptions();
      renderCatalogEditors();
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
      renderCatalogEditors();
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

    const label = document.createElement('span');
    label.className = 'shape-label';
    label.textContent = piece ? getVariantDisplayLabel(shape, size) : `Variante ${variantIndex}`;

    item.append(icon, label);
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
  renderCatalogEditors();
  updateStats();
  updateSelectionBox();
  setMessage('Forme appliquée à la pièce sélectionnée.');
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

function renderCatalogEditors() {
  const catalogPiece = getSelectedCatalogPiece();
  if (!catalogPiece) return;
  const family = getFamily(catalogPiece.family_id);
  const size = getSize(catalogPiece.size_id);
  const shape = getShapeVariant(catalogPiece.shape_variant_id);
  const spec = getSpecProfile(catalogPiece.spec_profile_id);
  const recipe = getRecipe(catalogPiece.recipe_id);

  if (dom.catalogSummary) {
    const lines = [
      `id               : ${catalogPiece.id}`,
      `label            : ${catalogPiece.label_fr}`,
      `famille          : ${family?.label_fr ?? catalogPiece.family_id}`,
      `taille           : ${size?.label ?? catalogPiece.size_id}`,
      `variante         : ${getVariantDisplayLabel(shape, size)} (${shape?.id ?? catalogPiece.shape_variant_id})`,
      `profil           : ${spec?.id ?? catalogPiece.spec_profile_id}`,
    ];
    if (IS_EDITOR) lines.push(`recette          : ${recipe?.id ?? catalogPiece.recipe_id ?? 'aucune'}`);
    else lines.push(`profil type      : ${spec?.profile_type ?? 'standard'}`);
    dom.catalogSummary.textContent = lines.join('\n');
  }

  if (!IS_EDITOR) return;
  renderShapeEditor(shape);
  renderSpecEditor(spec);
  renderRecipeEditor(recipe);
  renderValidationReport();
}


function renderShapeEditor(shape) {
  if (!IS_EDITOR || !dom.shapeEditor) return;
  if (!shape) {
    dom.shapeEditor.textContent = 'Variante introuvable.';
    return;
  }

  dom.shapeEditor.innerHTML = '';

  const idInfo = document.createElement('div');
  idInfo.className = 'editor-note';
  idInfo.textContent = `id: ${shape.id} · taille: ${shape.size_id} · index: ${shape.variant_index}`;
  dom.shapeEditor.append(idInfo);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.value = shape.label ?? '';
  labelInput.addEventListener('change', () => {
    shape.label = labelInput.value.trim() || shape.id;
    renderCatalogPieceOptions();
    renderCatalogEditors();
  });
  dom.shapeEditor.append(labelBlock('Label variante', labelInput));

  const familyInput = document.createElement('input');
  familyInput.type = 'text';
  familyInput.value = shape.shape_family ?? '';
  familyInput.addEventListener('change', () => {
    shape.shape_family = slugifyId(familyInput.value || 'block');
    renderValidationReport();
  });
  dom.shapeEditor.append(labelBlock('Famille forme', familyInput));

  const baseType = document.createElement('select');
  const currentBase = getShapeBaseTypeValue(shape);
  for (const [value, label] of [
    ['legacy_mesh', 'Mesh legacy'],
    ['box', 'Bloc plein'],
    ['wedge_length_front_to_back', 'Pente longueur'],
    ['wedge_width_left_to_right', 'Pente largeur'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === currentBase;
    baseType.append(option);
  }
  baseType.addEventListener('change', () => {
    if (baseType.value === 'legacy_mesh' && shape.preview_mesh) {
      shape.generation = {
        ...(shape.generation ?? {}),
        mode: 'legacy_mesh',
      };
    } else {
      shape.generation = getGenerationFromBaseType(shape.size_id, baseType.value);
      delete shape.preview_mesh;
      delete shape.mesh_stats;
      delete shape.bounds;
    }
    refreshInstancesUsingShape(shape.id);
    renderCatalogEditors();
  });
  dom.shapeEditor.append(labelBlock('Géométrie base', baseType));

  const statusSelect = document.createElement('select');
  for (const value of ['confirmed', 'draft', 'unknown']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = (shape.status ?? 'draft') === value;
    statusSelect.append(option);
  }
  statusSelect.addEventListener('change', () => {
    shape.status = statusSelect.value;
    renderValidationReport();
  });
  dom.shapeEditor.append(labelBlock('Statut', statusSelect));

  const symmetryGrid = document.createElement('div');
  symmetryGrid.className = 'editor-row';
  for (const axis of ['length', 'width', 'height']) {
    const label = document.createElement('label');
    label.className = 'inline-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = shape.allowed_symmetry?.[axis] !== false;
    input.addEventListener('change', () => {
      shape.allowed_symmetry ??= {};
      shape.allowed_symmetry[axis] = input.checked;
      renderValidationReport();
      updateSelectionUi();
    });
    label.append(input, document.createTextNode(axis));
    symmetryGrid.append(label);
  }
  dom.shapeEditor.append(labelBlock('Symétries autorisées', symmetryGrid));

  const anchors = document.createElement('textarea');
  anchors.rows = 7;
  anchors.value = JSON.stringify(shape.anchors ?? [], null, 2);
  anchors.addEventListener('change', () => {
    try {
      const parsed = JSON.parse(anchors.value);
      if (!Array.isArray(parsed)) throw new Error('anchors must be an array');
      shape.anchors = parsed;
      anchors.classList.remove('invalid');
      refreshInstancesUsingShape(shape.id);
      renderValidationReport();
    } catch {
      anchors.classList.add('invalid');
    }
  });
  dom.shapeEditor.append(labelBlock('Ancres JSON', anchors));
}

function getShapeBaseTypeValue(shape) {
  if (shape?.generation?.mode === 'legacy_mesh') return 'legacy_mesh';
  const base = shape?.generation?.base;
  if (shape?.generation?.mode === 'primitive_stack' && base?.type === 'wedge') {
    return base.slope_axis === 'width' ? 'wedge_width_left_to_right' : 'wedge_length_front_to_back';
  }
  if (shape?.generation?.mode === 'primitive_stack' && base?.type === 'box') return 'box';
  return 'box';
}

function getGenerationFromBaseType(sizeId, baseType) {
  const size = getSize(sizeId);
  const bounds = {
    length: size?.dimensions?.length ?? 4,
    width: size?.dimensions?.width ?? 3,
    height: size?.dimensions?.height ?? 1,
  };
  if (baseType === 'wedge_width_left_to_right') {
    return {
      mode: 'primitive_stack',
      base: { type: 'wedge', bounds, slope_axis: 'width', slope_direction: 'left_to_right' },
      operations: [],
    };
  }
  if (baseType === 'wedge_length_front_to_back') {
    return {
      mode: 'primitive_stack',
      base: { type: 'wedge', bounds, slope_axis: 'length', slope_direction: 'front_to_back' },
      operations: [],
    };
  }
  return {
    mode: 'primitive_stack',
    base: { type: 'box', bounds },
    operations: [],
  };
}

function renderSpecEditor(spec) {
  if (!IS_EDITOR || !dom.specEditor) return;
  const definitions = state.catalog.definitions?.spec_fields ?? {};
  if (!spec) {
    dom.specEditor.textContent = 'Profil introuvable.';
    return;
  }

  dom.specEditor.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'editor-row editor-header';
  header.innerHTML = '<span>Champ</span><span>Valeur</span><span>Statut</span>';
  dom.specEditor.append(header);

  for (const [fieldId, definition] of Object.entries(definitions)) {
    const current = spec.specs?.[fieldId] ?? { value: null, unit: definition.unit ?? null, status: 'unknown' };
    spec.specs ??= {};
    spec.specs[fieldId] = current;

    const row = document.createElement('div');
    row.className = 'editor-row';

    const label = document.createElement('span');
    label.textContent = `${definition.label_fr ?? fieldId}${current.unit ? ` (${current.unit})` : ''}`;

    const value = document.createElement('input');
    value.type = 'number';
    value.step = 'any';
    value.placeholder = 'null';
    value.value = current.value ?? '';
    value.dataset.field = fieldId;
    value.addEventListener('change', () => {
      current.value = value.value === '' ? null : Number(value.value);
      if (current.value === null) current.status = 'unknown';
      renderCatalogEditors();
      updateStats();
    });

    const status = document.createElement('select');
    for (const optionValue of ['confirmed', 'draft', 'unknown']) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = (current.status ?? 'unknown') === optionValue;
      status.append(option);
    }
    status.addEventListener('change', () => {
      current.status = status.value;
      updateStats();
      renderValidationReport();
    });

    row.append(label, value, status);
    dom.specEditor.append(row);
  }
}

function renderRecipeEditor(recipe) {
  if (!IS_EDITOR || !dom.recipeEditor) return;
  if (!recipe) {
    dom.recipeEditor.textContent = 'Recette absente ou inconnue.';
    return;
  }

  dom.recipeEditor.innerHTML = '';
  const rows = [
    ['Coût', 'cost.value', recipe.cost?.value ?? '', 'number'],
    ['Durée', 'duration.value', recipe.duration?.value ?? '', 'number'],
    ['Station', 'station.label_fr', recipe.station?.label_fr ?? '', 'text'],
    ['Statut', 'status', recipe.status ?? 'unknown', 'status'],
  ];

  for (const [labelText, path, valueText, type] of rows) {
    const row = document.createElement('div');
    row.className = 'editor-row two-cols';
    const label = document.createElement('span');
    label.textContent = labelText;

    let input;
    if (type === 'status') {
      input = document.createElement('select');
      for (const optionValue of ['confirmed', 'draft', 'unknown']) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        option.selected = valueText === optionValue;
        input.append(option);
      }
    } else {
      input = document.createElement('input');
      input.type = type;
      input.step = type === 'number' ? 'any' : undefined;
      input.value = valueText ?? '';
      input.placeholder = type === 'number' ? 'null' : '';
    }

    input.addEventListener('change', () => {
      setNestedValue(recipe, path, input.value === '' && type === 'number' ? null : (type === 'number' ? Number(input.value) : input.value));
      if (path === 'cost.value') recipe.cost.status = recipe.cost.value === null ? 'unknown' : 'draft';
      if (path === 'duration.value') recipe.duration.status = recipe.duration.value === null ? 'unknown' : 'draft';
      renderValidationReport();
    });

    row.append(label, input);
    dom.recipeEditor.append(row);
  }

  const ingredients = document.createElement('textarea');
  ingredients.value = JSON.stringify(recipe.ingredients ?? [], null, 2);
  ingredients.rows = 5;
  ingredients.addEventListener('change', () => {
    try {
      const parsed = JSON.parse(ingredients.value);
      recipe.ingredients = Array.isArray(parsed) ? parsed : [];
      ingredients.classList.remove('invalid');
      renderValidationReport();
    } catch {
      ingredients.classList.add('invalid');
    }
  });
  dom.recipeEditor.append(labelBlock('Ingrédients JSON', ingredients));
}

function setNestedValue(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  while (parts.length > 1) {
    const key = parts.shift();
    cursor[key] ??= {};
    cursor = cursor[key];
  }
  cursor[parts[0]] = value;
}

function labelBlock(labelText, element) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-block';
  const label = document.createElement('span');
  label.textContent = labelText;
  wrapper.append(label, element);
  return wrapper;
}

function renderValidationReport() {
  if (!IS_EDITOR || !dom.validationReport) return;
  const report = validateCatalog();
  dom.validationReport.textContent = [
    `erreurs         : ${report.errors.length}`,
    `avertissements  : ${report.warnings.length}`,
    '',
    ...report.errors.map((item) => `ERR  ${item}`),
    ...report.warnings.map((item) => `WARN ${item}`),
    report.errors.length === 0 && report.warnings.length === 0 ? 'OK références et structure de base.' : '',
  ].filter(Boolean).join('\n');
}

function validateCatalog() {
  const errors = [];
  const warnings = [];
  const catalog = state.catalog;
  const repo = state.repo;

  if (!catalog.schema_version) errors.push('schema_version absent.');
  for (const piece of catalog.catalog_pieces ?? []) {
    const family = repo.families.get(piece.family_id);
    const size = repo.sizes.get(piece.size_id);
    const shape = repo.shapeVariants.get(piece.shape_variant_id);
    const spec = repo.specProfiles.get(piece.spec_profile_id);
    const recipe = piece.recipe_id ? repo.recipes.get(piece.recipe_id) : null;

    if (!family) errors.push(`${piece.id}: family_id introuvable (${piece.family_id}).`);
    if (!size) errors.push(`${piece.id}: size_id introuvable (${piece.size_id}).`);
    if (!shape) errors.push(`${piece.id}: shape_variant_id introuvable (${piece.shape_variant_id}).`);
    if (!spec) errors.push(`${piece.id}: spec_profile_id introuvable (${piece.spec_profile_id}).`);
    if (piece.recipe_id && !recipe) errors.push(`${piece.id}: recipe_id introuvable (${piece.recipe_id}).`);
    if (shape && shape.size_id !== piece.size_id) errors.push(`${piece.id}: shape.size_id (${shape.size_id}) != piece.size_id (${piece.size_id}).`);
    if (spec && spec.size_id !== piece.size_id) errors.push(`${piece.id}: spec.size_id (${spec.size_id}) != piece.size_id (${piece.size_id}).`);
    if (!piece.fixed_catalog_entry) warnings.push(`${piece.id}: fixed_catalog_entry devrait rester true pour le catalogue fermé.`);
  }

  for (const shape of catalog.shape_variants ?? []) {
    if (!repo.sizes.get(shape.size_id)) errors.push(`${shape.id}: size_id introuvable.`);
    if (!shape.generation?.mode) errors.push(`${shape.id}: generation.mode absent.`);
    if (shape.generation?.mode === 'legacy_mesh') warnings.push(`${shape.id}: mesh migré temporaire, à remplacer par opérations paramétriques.`);
    for (const anchor of shape.anchors ?? []) {
      if (!anchor.position || !anchor.normal) errors.push(`${shape.id}/${anchor.id}: anchor position/normal absent.`);
    }
  }

  for (const recipe of catalog.recipes ?? []) {
    if (!repo.specProfiles.get(recipe.output_spec_profile_id)) errors.push(`${recipe.id}: output_spec_profile_id introuvable.`);
  }

  return { errors, warnings };
}

function exportCatalog() {
  if (!IS_EDITOR) return;
  downloadJson('spacecraft_rich_catalog.json', state.catalog);
}

function exportBlueprint() {
  const blueprint = {
    id: `ship_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    name: 'Draft Ship',
    schema_version: state.catalog.ship_blueprint_schema?.version ?? state.catalog.schema_version,
    placed_pieces: state.instances.map((instance) => ({
      id: instance.id,
      catalog_piece_id: instance.catalogPieceId,
      position: {
        x: round3(instance.group.position.x),
        y: round3(instance.group.position.y),
        z: round3(instance.group.position.z),
      },
      rotation: { ...instance.rotation },
      symmetry: { ...instance.symmetry },
      anchor_links: [],
      metadata: { locked: false, notes: [] },
    })),
    computed_stats: calculateShipStats(),
    metadata: { created_with: 'spacecraft_c1_web_editor', notes: [] },
  };
  downloadJson(`${blueprint.id}.json`, blueprint);
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
  state.repo = buildRepository(state.catalog);

  if (!Array.isArray(state.catalog.catalog_pieces)) {
    throw new Error('Catalogue invalide : catalog_pieces absent. Ancien format {catalog,pieces} non accepté.');
  }

  updateAssemblyGrid();
  renderCatalogPieceOptions();
  populateCreationForms();
  renderCatalogEditors();
  selectInstance(null);
  updateEmptyHint();
  bindEvents();
  mountAssemblyNavigationCube();
  setAssemblyView('top', false);
  updateOrthographicFrustum(1000);
  animate();
}

function bindEvents() {
  dom.catalogPieceSelect?.addEventListener('change', () => setSelectedCatalogPiece(dom.catalogPieceSelect.value));

  if (IS_EDITOR) {
    dom.variantSizeSelect?.addEventListener('change', updateCreatePieceDefaultLabel);
    dom.createVariantBtn?.addEventListener('click', createVariantFromForm);
    dom.duplicateVariantBtn?.addEventListener('click', duplicateSelectedVariant);
    dom.pieceFamilySelect?.addEventListener('change', updateCreatePieceDefaultLabel);
    dom.pieceSizeSelect?.addEventListener('change', () => {
      renderPieceShapeSelect();
      updateCreatePieceDefaultLabel();
    });
    dom.pieceShapeSelect?.addEventListener('change', updateCreatePieceDefaultLabel);
    dom.pieceProfileTypeInput?.addEventListener('input', updateCreatePieceDefaultLabel);
    dom.createCatalogPieceBtn?.addEventListener('click', createCatalogPieceFromForm);
    dom.exportCatalogBtn?.addEventListener('click', exportCatalog);
  }

  dom.instanceSelect.addEventListener('change', () => selectInstance(dom.instanceSelect.value));
  dom.duplicatePieceBtn.addEventListener('click', duplicateSelectedInstance);
  dom.removePieceBtn.addEventListener('click', removeSelectedInstance);
  dom.clearSceneBtn.addEventListener('click', clearScene);
  dom.deselectBtn.addEventListener('click', () => selectInstance(null));
  dom.exportBlueprintBtn?.addEventListener('click', exportBlueprint);

  dom.colorInput.addEventListener('input', () => {
    const selected = getSelectedInstance();
    if (!selected) return;
    selected.material.color.set(dom.colorInput.value);
  });

  dom.mirrorLengthBtn.addEventListener('click', () => toggleSelectedSymmetry('length'));
  dom.mirrorWidthBtn.addEventListener('click', () => toggleSelectedSymmetry('width'));
  dom.mirrorHeightBtn.addEventListener('click', () => toggleSelectedSymmetry('height'));
  dom.resetMirrorsBtn.addEventListener('click', resetSelectedSymmetries);

  dom.moveUpBtn.addEventListener('click', () => moveSelectedHeight(getHeightStep()));
  dom.moveDownBtn.addEventListener('click', () => moveSelectedHeight(-getHeightStep()));
  dom.heightInput.addEventListener('change', () => setSelectedHeight(dom.heightInput.value));

  dom.gridInput.checked = true;
  dom.gridInput?.addEventListener('change', () => {
    if (!ASSEMBLY_MAGNET_ENABLED) return;
    grid.visible = dom.gridInput.checked;
  });

  dom.showAnchorsInput?.addEventListener('change', () => {
    state.showAnchors = dom.showAnchorsInput.checked;
    updateAnchorVisibility();
  });

  dom.fitSelectedBtn?.addEventListener('click', () => fitCameraToObject(getSelectedInstance()?.group));
  dom.fitAllBtn?.addEventListener('click', fitCameraToAll);
  dom.screenshotBtn?.addEventListener('click', takeScreenshot);

  document.addEventListener('pointerdown', onGlobalPointerDown, true);
  renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
  renderer.domElement.addEventListener('pointermove', onPointerMove, true);
  renderer.domElement.addEventListener('pointerup', onPointerUp, true);
  renderer.domElement.addEventListener('pointercancel', onPointerUp, true);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  renderer.domElement.addEventListener('dragover', onCanvasDragOver);
  renderer.domElement.addEventListener('dragleave', onCanvasDragLeave);
  renderer.domElement.addEventListener('drop', onCanvasDrop);

  window.addEventListener('keydown', (event) => {
    const tagName = document.activeElement?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;

    if (event.key.toLowerCase() === 'f') {
      const selected = getSelectedInstance();
      if (selected) fitCameraToObject(selected.group);
      else fitCameraToAll();
    }
    if (event.key.toLowerCase() === 'r') resetView();
    if (event.key === 'PageUp') moveSelectedHeight(getHeightStep());
    if (event.key === 'PageDown') moveSelectedHeight(-getHeightStep());
    if (event.key === 'Escape') selectInstance(null);
    if (event.key === 'Delete' || event.key === 'Backspace') removeSelectedInstance();
  });
}

init().catch((error) => {
  console.error(error);
  dom.stats.textContent = String(error.message || error);
});
