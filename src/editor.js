import './style.css';
import 'remixicon/fonts/remixicon.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildShapeGeometry, catalogCellCenterVector, catalogPointVector, createCatalogReservationBox } from './shape-engine.js';
import { createNavigationCubeOverlay } from './navigation-cube-overlay.js';
import { NAVIGATION_CUBE_VIEW_IDS, createNavigationCubeViewApi } from './navigation-cube.js';
import { resolveRuntimePath } from './runtime-paths.js';
import { createEditorViewController } from './view-controller.js';

const CATALOG_URL = resolveRuntimePath('data/4x3x1_catalog.json');
const CATALOG_WRITE_URL = '/api/catalog/write';
const CELL_SCALE = 36;
const ANCHOR_COLOR = 0xd82020;
const CELL_COLOR = 0xd46a2c;
const SELECTED_COLOR = 0xf0c75e;
const OPERATION_ROUND_COLOR = 0xf0c75e;
const OPERATION_CHAMFER_COLOR = 0x72c7ff;
const EDITOR_CELL_CURSOR_KEYS = {
  forward: new Set(['KeyW', 'w']),
  backward: new Set(['KeyS', 's']),
  left: new Set(['KeyA', 'a']),
  right: new Set(['KeyD', 'd']),
};
const EDITOR_ANCHOR_TOGGLE_KEYS = new Set(['Space', ' ']);
const EDITOR_USER_PREFERENCES_STORAGE_KEY = 'spacecraft.editor_user_preferences.v1';
const DEFAULT_EDITOR_USER_PREFERENCES = {
  showDeleteButtons: false,
};

const state = {
  catalog: null,
  repo: null,
  selectedBase: null,
  selectedShapeId: null,
  selectedCatalogPieceId: null,
  selectedAnchorId: null,
  selectedFace: null,
  selectedOperationIndex: null,
  message: '',
  activeViewId: NAVIGATION_CUBE_VIEW_IDS.home,
  editorUserPreferences: loadEditorUserPreferences(),
  baseReferenceFamilyId: null,
  variantModalSelection: null,
};

const dom = {
  baseModelTree: document.querySelector('#baseModelTree'),
  selectedBaseSummary: document.querySelector('#selectedBaseSummary'),
  shapeVariantSelect: document.querySelector('#shapeVariantSelect'),
  catalogPieceSelect: document.querySelector('#catalogPieceSelect'),
  newVariantTypeSelect: document.querySelector('#newVariantTypeSelect'),
  createVariantBtn: document.querySelector('#createVariantBtn'),
  duplicateVariantBtn: document.querySelector('#duplicateVariantBtn'),
  deleteVariantBtn: document.querySelector('#deleteVariantBtn'),
  createCatalogPieceBtn: document.querySelector('#createCatalogPieceBtn'),
  deleteCatalogPieceBtn: document.querySelector('#deleteCatalogPieceBtn'),
  resetPreviewBtn: document.querySelector('#resetPreviewBtn'),
  fitPreviewBtn: document.querySelector('#fitPreviewBtn'),
  exportCatalogBtn: document.querySelector('#exportCatalogBtn'),
  saveDraftBtn: document.querySelector('#saveDraftBtn'),
  publishAssemblyCatalogBtn: document.querySelector('#publishAssemblyCatalogBtn'),
  controlShapeBtn: document.querySelector('#controlShapeBtn'),
  validateShapeBtn: document.querySelector('#validateShapeBtn'),
  stats: document.querySelector('#editorStats'),
  canvas: document.querySelector('#editorViewer'),
  viewportWrap: document.querySelector('.editor-viewport-wrap'),
  openEditorUserConfigBtn: document.querySelector('#openEditorUserConfigBtn'),
  editorUserConfigModal: document.querySelector('#editorUserConfigModal'),
  closeEditorUserConfigBtn: document.querySelector('#closeEditorUserConfigBtn'),
  cancelEditorUserConfigBtn: document.querySelector('#cancelEditorUserConfigBtn'),
  saveEditorUserConfigBtn: document.querySelector('#saveEditorUserConfigBtn'),
  resetEditorUserConfigBtn: document.querySelector('#resetEditorUserConfigBtn'),
  editorShowDeleteButtonsToggle: document.querySelector('#editorShowDeleteButtonsToggle'),

  shapeIdInput: document.querySelector('#shapeIdInput'),
  shapeLabelInput: document.querySelector('#shapeLabelInput'),
  shapeFamilyInput: document.querySelector('#shapeFamilyInput'),
  shapeStatusSelect: document.querySelector('#shapeStatusSelect'),
  cellXInput: document.querySelector('#cellXInput'),
  cellYInput: document.querySelector('#cellYInput'),
  cellZInput: document.querySelector('#cellZInput'),
  addCellBtn: document.querySelector('#addCellBtn'),
  removeCellBtn: document.querySelector('#removeCellBtn'),
  resetFullBoxBtn: document.querySelector('#resetFullBoxBtn'),
  clearCellsBtn: document.querySelector('#clearCellsBtn'),
  cellSummary: document.querySelector('#cellSummary'),
  variantFaceSummary: document.querySelector('#variantFaceSummary'),
  roundFaceBtn: document.querySelector('#roundFaceBtn'),
  chamferFaceBtn: document.querySelector('#chamferFaceBtn'),
  deleteFaceOperationBtn: document.querySelector('#deleteFaceOperationBtn'),
  operationListSelect: document.querySelector('#operationListSelect'),

  selectedFaceSummary: document.querySelector('#selectedFaceSummary'),
  addAnchorBtn: document.querySelector('#addAnchorBtn'),
  deleteAnchorBtn: document.querySelector('#deleteAnchorBtn'),
  anchorListSelect: document.querySelector('#anchorListSelect'),

  specModal: document.querySelector('#specModal'),
  specModalContext: document.querySelector('#specModalContext'),
  closeSpecModalBtn: document.querySelector('#closeSpecModalBtn'),
  specProfileSelect: document.querySelector('#specProfileSelect'),
  specEditor: document.querySelector('#specEditor'),
  recipeModal: document.querySelector('#recipeModal'),
  recipeModalContext: document.querySelector('#recipeModalContext'),
  closeRecipeModalBtn: document.querySelector('#closeRecipeModalBtn'),
  recipeSelect: document.querySelector('#recipeSelect'),
  recipeEditor: document.querySelector('#recipeEditor'),
  baseReferenceModal: document.querySelector('#baseReferenceModal'),
  baseReferenceModalContext: document.querySelector('#baseReferenceModalContext'),
  closeBaseReferenceModalBtn: document.querySelector('#closeBaseReferenceModalBtn'),
  newBaseLengthInput: document.querySelector('#newBaseLengthInput'),
  newBaseWidthInput: document.querySelector('#newBaseWidthInput'),
  newBaseHeightInput: document.querySelector('#newBaseHeightInput'),
  createBaseReferenceBtn: document.querySelector('#createBaseReferenceBtn'),
  variantCreationModal: document.querySelector('#variantCreationModal'),
  variantCreationModalContext: document.querySelector('#variantCreationModalContext'),
  closeVariantCreationModalBtn: document.querySelector('#closeVariantCreationModalBtn'),
  newVariantFamilySelect: document.querySelector('#newVariantFamilySelect'),
  newVariantSizeSelect: document.querySelector('#newVariantSizeSelect'),
  newVariantIconGrid: document.querySelector('#newVariantIconGrid'),
  createVariantFromModalBtn: document.querySelector('#createVariantFromModalBtn'),
  validationReport: document.querySelector('#validationReport'),
};

function bindElement(element, type, handler, options) {
  element?.addEventListener(type, handler, options);
}

function setElementText(element, text) {
  if (element) element.textContent = text;
}

function clearElement(element) {
  if (element) element.innerHTML = '';
}

function appendElement(element, child) {
  if (element) element.append(child);
}

function loadEditorUserPreferences() {
  try {
    const raw = globalThis.localStorage?.getItem(EDITOR_USER_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EDITOR_USER_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      showDeleteButtons: Boolean(parsed?.showDeleteButtons),
    };
  } catch {
    return { ...DEFAULT_EDITOR_USER_PREFERENCES };
  }
}

function saveEditorUserPreferences(preferences) {
  const normalized = {
    showDeleteButtons: Boolean(preferences?.showDeleteButtons),
  };
  globalThis.localStorage?.setItem(EDITOR_USER_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  state.editorUserPreferences = normalized;
  return normalized;
}

function queryFirst(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function refreshEditorUserConfigDomRefs() {
  dom.openEditorUserConfigBtn = queryFirst(['#openEditorUserConfigBtn', '#openEditorPreferencesBtn']);
  dom.editorUserConfigModal = queryFirst(['#editorUserConfigModal', '#editorPreferencesModal']);
  dom.closeEditorUserConfigBtn = queryFirst(['#closeEditorUserConfigBtn', '#closeEditorPreferencesBtn']);
  dom.cancelEditorUserConfigBtn = queryFirst(['#cancelEditorUserConfigBtn', '#cancelEditorPreferencesBtn']);
  dom.saveEditorUserConfigBtn = queryFirst(['#saveEditorUserConfigBtn', '#saveEditorPreferencesBtn']);
  dom.resetEditorUserConfigBtn = queryFirst(['#resetEditorUserConfigBtn', '#resetEditorPreferencesBtn']);
  dom.editorShowDeleteButtonsToggle = queryFirst(['#editorShowDeleteButtonsToggle', '#showDeleteReferenceButtonsToggle']);
}

function normalizeEditorUserConfigMarkup() {
  const idMap = new Map([
    ['openEditorPreferencesBtn', 'openEditorUserConfigBtn'],
    ['editorPreferencesModal', 'editorUserConfigModal'],
    ['closeEditorPreferencesBtn', 'closeEditorUserConfigBtn'],
    ['cancelEditorPreferencesBtn', 'cancelEditorUserConfigBtn'],
    ['saveEditorPreferencesBtn', 'saveEditorUserConfigBtn'],
    ['resetEditorPreferencesBtn', 'resetEditorUserConfigBtn'],
    ['showDeleteReferenceButtonsToggle', 'editorShowDeleteButtonsToggle'],
  ]);

  for (const [legacyId, nextId] of idMap.entries()) {
    const element = document.getElementById(legacyId);
    if (element && !document.getElementById(nextId)) element.id = nextId;
  }
}

function ensureEditorUserConfigUi() {
  normalizeEditorUserConfigMarkup();
  const header = document.querySelector('#editorApp .editor-left-panel > header, #editorApp aside header, .editor-left-panel header');
  if (header && !document.querySelector('#openEditorUserConfigBtn')) {
    header.classList.add('panel-header-with-action');
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
    const button = document.createElement('button');
    button.id = 'openEditorUserConfigBtn';
    button.type = 'button';
    button.className = 'icon-button editor-user-config-button';
    button.title = 'Préférences utilisateur';
    button.setAttribute('aria-label', 'Préférences utilisateur');
    button.innerHTML = '<i class="ri-expand-vertical-fill" aria-hidden="true"></i>';
    header.append(button);
  }

  if (!document.querySelector('#editorUserConfigModal')) {
    const modal = document.createElement('div');
    modal.id = 'editorUserConfigModal';
    modal.className = 'modal-shell';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-card user-config-modal-card" role="dialog" aria-modal="true" aria-labelledby="editorUserConfigModalTitle">
        <header class="modal-header">
          <h2 id="editorUserConfigModalTitle">Préférences Editor</h2>
          <button id="closeEditorUserConfigBtn" type="button">Fermer</button>
        </header>
        <div class="summary-box modal-context">Préférences locales de l’éditeur.</div>
        <section class="control-block user-config-page">
          <div class="user-config-section">
            <h3>Interface</h3>
            <div class="user-config-grid">
              <label class="toggle-row" for="editorShowDeleteButtonsToggle">
                <span>Afficher les boutons suppr</span>
                <input id="editorShowDeleteButtonsToggle" type="checkbox" />
              </label>
            </div>
          </div>
          <div class="user-config-actions">
            <button id="resetEditorUserConfigBtn" type="button">Défauts</button>
            <button id="cancelEditorUserConfigBtn" type="button">Annuler</button>
            <button id="saveEditorUserConfigBtn" type="button" class="primary">Enregistrer</button>
          </div>
        </section>
      </div>`;
    document.body.append(modal);
  }

  refreshEditorUserConfigDomRefs();
}

function fillEditorUserConfigForm(preferences = state.editorUserPreferences) {
  if (dom.editorShowDeleteButtonsToggle) {
    dom.editorShowDeleteButtonsToggle.checked = Boolean(preferences?.showDeleteButtons);
  }
}

function applyEditorUserPreferences(preferences = state.editorUserPreferences) {
  const showDeleteButtons = Boolean(preferences?.showDeleteButtons);
  document.body.dataset.editorShowDeleteButtons = showDeleteButtons ? 'true' : 'false';
  const deleteControls = document.querySelectorAll([
    '#deleteVariantBtn',
    '#deleteCatalogPieceBtn',
    '#removeCellBtn',
    '#clearCellsBtn',
    '#deleteFaceOperationBtn',
    '#deleteAnchorBtn',
    '.editor-delete-action',
    '.editor-delete-button',
    '.editor-variant-delete-btn',
    '.delete-reference-btn',
    '.base-model-delete-btn',
    '[data-editor-delete-action]',
    '[data-delete-action]',
  ].join(','));
  for (const control of deleteControls) {
    control.hidden = !showDeleteButtons;
    control.setAttribute('aria-hidden', String(!showDeleteButtons));
    control.tabIndex = showDeleteButtons ? 0 : -1;
  }
}

function setEditorUserConfigModalOpen(open) {
  if (!dom.editorUserConfigModal) return;
  if (open) fillEditorUserConfigForm(state.editorUserPreferences);
  dom.editorUserConfigModal.classList.toggle('open', open);
  dom.editorUserConfigModal.setAttribute('aria-hidden', String(!open));
  if (open) dom.editorShowDeleteButtonsToggle?.focus();
}

function resetEditorUserConfigForm() {
  fillEditorUserConfigForm(DEFAULT_EDITOR_USER_PREFERENCES);
}

function persistEditorDeleteButtonPreference() {
  const nextPreferences = saveEditorUserPreferences({
    showDeleteButtons: dom.editorShowDeleteButtonsToggle?.checked,
  });
  applyEditorUserPreferences(nextPreferences);
  return nextPreferences;
}

function saveEditorUserConfigForm() {
  persistEditorDeleteButtonPreference();
  setEditorUserConfigModalOpen(false);
}

function setCellInputValues(cell) {
  if (!cell) return;
  if (dom.cellXInput) dom.cellXInput.value = cell.x;
  if (dom.cellYInput) dom.cellYInput.value = cell.y;
  if (dom.cellZInput) dom.cellZInput.value = cell.z;
}

function readCellInputValues() {
  const fallback = state.selectedFace?.cell ?? { x: 0, y: 0, z: 0 };
  return {
    x: Math.floor(Number(dom.cellXInput?.value ?? fallback.x)),
    y: Math.floor(Number(dom.cellYInput?.value ?? fallback.y)),
    z: Math.floor(Number(dom.cellZInput?.value ?? fallback.z)),
  };
}

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);

// Viewer coordinate convention shared with assembly:
// X = width / left-right, Y = depth / length, Z = height / vertical.
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
camera.position.set(220, -260, 180);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.screenSpacePanning = true;
orbit.target.set(0, 0, 0);

let editorViewController = null;
let editorNavigationCubeOverlay = null;

const root = new THREE.Group();
scene.add(root);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cellPickTargets = [];
let pointerDown = null;

const grid = new THREE.GridHelper(420, 42, 0x5c6370, 0x303640);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

scene.add(new THREE.HemisphereLight(0xffffff, 0x2f3340, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(80, -90, 120);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.8);
fill.position.set(-80, 70, 80);
scene.add(fill);

editorViewController = createEditorViewController({
  camera,
  orbitControls: orbit,
  getTarget: () => orbit.target.clone(),
  getActiveViewId: () => state.activeViewId,
  setActiveViewId: (viewId) => {
    state.activeViewId = viewId;
  },
  defaultHomeDirection: [220, -260, 180],
  defaultHomeDistance: new THREE.Vector3(220, -260, 180).length(),
});

function syncEditorNavigationCubeActiveView() {
  editorNavigationCubeOverlay?.setActiveViewId(editorViewController?.getActiveViewId?.() ?? state.activeViewId);
}

function mountEditorNavigationCube() {
  if (!dom.viewportWrap || editorNavigationCubeOverlay) return;
  const viewApi = createNavigationCubeViewApi({
    setView(viewId) {
      editorViewController?.setView(viewId, { target: orbit.target.clone() });
      syncEditorNavigationCubeActiveView();
    },
    resetView() {
      resetPreview();
    },
    getActiveViewId() {
      return editorViewController?.getActiveViewId?.() ?? state.activeViewId;
    },
  });
  editorNavigationCubeOverlay = createNavigationCubeOverlay({
    container: dom.viewportWrap,
    viewApi,
  });
  editorNavigationCubeOverlay.mount();
  syncEditorNavigationCubeActiveView();
}

function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function rebuildRepo() {
  state.repo = {
    sizes: mapById(state.catalog.sizes),
    families: mapById(state.catalog.families),
    shapes: mapById(state.catalog.shape_variants),
    specs: mapById(state.catalog.spec_profiles),
    recipes: mapById(state.catalog.recipes),
    pieces: mapById(state.catalog.catalog_pieces),
  };
}

function getSize(id) { return state.repo?.sizes.get(id) ?? null; }
function getFamily(id) { return state.repo?.families.get(id) ?? null; }
function getShape(id) { return state.repo?.shapes.get(id) ?? null; }
function getSpec(id) { return state.repo?.specs.get(id) ?? null; }
function getRecipe(id) { return state.repo?.recipes.get(id) ?? null; }
function getPiece(id) { return state.repo?.pieces.get(id) ?? null; }
function selectedShape() { return getShape(state.selectedShapeId); }
function selectedPiece() { return getPiece(state.selectedCatalogPieceId); }

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
  let id = base;
  let n = 2;
  while (existingIds.has(id)) id = `${base}_${n++}`;
  return id;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getBaseGroups() {
  if (Array.isArray(state.catalog.base_piece_models)) return state.catalog.base_piece_models;
  return [
    { id: 'steel', label_fr: 'ACIER', family_id: 'steel', piece_label_fr: 'Acier', sizes: ['4x3x1', '6x3x1', '8x3x1', '4x3x2', '6x3x2', '8x3x2', '8x6x2'] },
    { id: 'titanium_superior', label_fr: 'TITANE SUPÉRIEUR', family_id: 'titanium_superior', piece_label_fr: 'Titane', sizes: ['4x3x1', '6x3x1', '8x3x1', '4x3x2', '6x3x2', '8x3x2', '8x6x2', '12x6x2', '16x6x2'] },
    { id: 'solid_chassis', label_fr: 'CHÂSSIS AVANCÉS', family_id: 'solid_chassis', piece_label_fr: 'Châssis solide', sizes: ['4x3x1', '6x3x1', '8x3x1', '8x6x2', '12x6x2', '16x6x2'] },
    { id: 'levinium', label_fr: 'ALLIAGES ULTRA LÉGERS', family_id: 'levinium', piece_label_fr: 'Lévinium', sizes: ['4x3x2', '6x3x2', '8x3x2'] },
  ];
}

function getBaseGroupByFamilyId(familyId) {
  return getBaseGroups().find((group) => group.family_id === familyId) ?? null;
}

function getFamilyLabel(familyId) {
  return getBaseGroupByFamilyId(familyId)?.piece_label_fr ?? getFamily(familyId)?.label_fr ?? familyId;
}

function makeSizeId(length, width, height) {
  return `${length}x${width}x${height}`;
}

function compareSizeIds(a, b) {
  const parse = (value) => String(value).split('x').map((part) => Number(part) || 0);
  const [al, aw, ah] = parse(a);
  const [bl, bw, bh] = parse(b);
  return (al - bl) || (aw - bw) || (ah - bh) || String(a).localeCompare(String(b));
}

function ensureBaseGroupSize(familyId, sizeId) {
  const group = getBaseGroupByFamilyId(familyId);
  if (!group) return;
  group.sizes ??= [];
  if (!group.sizes.includes(sizeId)) {
    group.sizes.push(sizeId);
    group.sizes.sort(compareSizeIds);
  }
}

function removeBaseGroupSize(familyId, sizeId) {
  const group = getBaseGroupByFamilyId(familyId);
  if (!group?.sizes) return;
  group.sizes = group.sizes.filter((item) => item !== sizeId);
}

function renderBaseModels() {
  clearElement(dom.baseModelTree);
  const groups = getBaseGroups();
  for (const group of groups) {
    const familyDetails = document.createElement('details');
    familyDetails.className = 'tree-family';
    familyDetails.open = state.selectedBase?.family_id === group.family_id || group === groups[0];

    const familySummary = document.createElement('summary');
    familySummary.className = 'tree-family-summary';
    const familyTitle = document.createElement('span');
    familyTitle.className = 'tree-family-title';
    familyTitle.textContent = group.label_fr;
    const addBaseBtn = document.createElement('button');
    addBaseBtn.type = 'button';
    addBaseBtn.className = 'tree-family-add-action';
    addBaseBtn.textContent = '[+]';
    addBaseBtn.title = `Créer une référence dans ${group.label_fr}`;
    addBaseBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBaseReferenceModal(group.family_id);
    });
    familySummary.append(familyTitle, addBaseBtn);
    familyDetails.append(familySummary);

    for (const sizeId of group.sizes) {
      const isBaseActive = state.selectedBase?.family_id === group.family_id && state.selectedBase?.size_id === sizeId;
      const sizeDetails = document.createElement('details');
      sizeDetails.className = 'tree-size';
      sizeDetails.open = isBaseActive;

      const sizeSummary = document.createElement('summary');
      sizeSummary.className = isBaseActive ? 'active' : '';

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'tree-node-button';
      selectBtn.textContent = `${group.piece_label_fr} ${sizeId}`;
      selectBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId);
      });

      const specBtn = document.createElement('button');
      specBtn.type = 'button';
      specBtn.className = 'tree-mini-action';
      specBtn.title = 'Ouvrir les specs du modèle';
      specBtn.textContent = '+ spec';
      specBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId, { keepView: true });
        openSpecModal();
      });

      const recipeBtn = document.createElement('button');
      recipeBtn.type = 'button';
      recipeBtn.className = 'tree-mini-action';
      recipeBtn.title = 'Ouvrir la recette du modèle';
      recipeBtn.textContent = '+ recette';
      recipeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId, { keepView: true });
        openRecipeModal();
      });

      const createVariantBtn = document.createElement('button');
      createVariantBtn.type = 'button';
      createVariantBtn.className = 'tree-mini-action';
      createVariantBtn.title = 'Créer une variante';
      createVariantBtn.textContent = '+ variant';
      createVariantBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openVariantCreationModal(group.family_id, sizeId);
      });

      const deleteRootBtn = document.createElement('button');
      deleteRootBtn.type = 'button';
      deleteRootBtn.className = 'tree-mini-action danger editor-delete-button editor-root-delete-btn';
      deleteRootBtn.textContent = 'Suppr';
      deleteRootBtn.title = `Supprimer l'entrée catalogue ${group.piece_label_fr} ${sizeId}`;
      deleteRootBtn.dataset.editorDeleteAction = 'delete-root-piece';
      deleteRootBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteBaseReferenceByFamilyAndSize(group.family_id, sizeId);
      });

      sizeSummary.append(selectBtn, specBtn, recipeBtn, createVariantBtn, deleteRootBtn);
      sizeDetails.append(sizeSummary);

      const variants = document.createElement('div');
      variants.className = 'tree-variants';
      for (const shape of findShapesForBase(group.family_id, sizeId)) {
        const variantRow = document.createElement('div');
        variantRow.className = 'tree-variant-row';

        const variant = document.createElement('button');
        variant.type = 'button';
        variant.className = 'tree-variant-button';
        if (isBaseActive && shape.id === state.selectedShapeId) variant.classList.add('active');
        variant.textContent = `↳ ${shape.label ?? shape.id}`;
        variant.addEventListener('click', () => {
          selectBaseModel(group, sizeId, { keepView: true });
          state.selectedShapeId = shape.id;
          const piece = findCatalogPiecesForBase().find((item) => item.shape_variant_id === shape.id);
          if (piece) state.selectedCatalogPieceId = piece.id;
          state.selectedFace = null;
          renderAll();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'tree-mini-action danger editor-delete-button editor-variant-delete-btn';
        deleteBtn.textContent = 'Suppr';
        deleteBtn.title = `Supprimer la variante ${shape.label ?? shape.id}`;
        deleteBtn.dataset.editorDeleteAction = 'delete-variant';
        deleteBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteVariantById(shape.id);
        });

        variantRow.append(variant, deleteBtn);
        variants.append(variantRow);
      }
      sizeDetails.append(variants);
      familyDetails.append(sizeDetails);
    }
    appendElement(dom.baseModelTree, familyDetails);
  }
}

function selectBaseModel(group, sizeId, options = {}) {
  state.selectedBase = {
    group_id: group.id,
    group_label_fr: group.label_fr,
    family_id: group.family_id,
    piece_label_fr: group.piece_label_fr,
    size_id: sizeId,
  };

  const basePiece = findCatalogPiecesForBase()[0] ?? null;
  if (basePiece) state.selectedCatalogPieceId = basePiece.id;

  const shape = basePiece ? getShape(basePiece.shape_variant_id) : findShapesForBase(group.family_id, sizeId)[0];
  state.selectedShapeId = shape?.id ?? null;
  state.selectedFace = null;

  renderAll();
  if (!options.keepView) fitPreview(false);
}

function findShapesForSize(sizeId = state.selectedBase?.size_id) {
  return (state.catalog.shape_variants ?? [])
    .filter((shape) => shape.size_id === sizeId)
    .sort((a, b) => (Number(a.variant_index) || 0) - (Number(b.variant_index) || 0) || a.id.localeCompare(b.id));
}

function shapeBelongsToBase(shape, familyId, sizeId) {
  if (!shape || !familyId || !sizeId || shape.size_id !== sizeId) return false;
  const basedOn = shape.metadata?.based_on;
  if (basedOn === `${familyId}:${sizeId}`) return true;
  return String(shape.id ?? '').startsWith(`shape_${familyId}_${sizeId}_`);
}

function findCatalogPiecesForBase() {
  if (!state.selectedBase) return [];
  return (state.catalog.catalog_pieces ?? [])
    .filter((piece) => piece.family_id === state.selectedBase.family_id && piece.size_id === state.selectedBase.size_id)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
}

function findShapesForBase(familyId = state.selectedBase?.family_id, sizeId = state.selectedBase?.size_id) {
  if (!familyId || !sizeId) return [];
  const linkedIds = new Set(
    (state.catalog.catalog_pieces ?? [])
      .filter((piece) => piece.family_id === familyId && piece.size_id === sizeId)
      .map((piece) => piece.shape_variant_id),
  );
  return (state.catalog.shape_variants ?? [])
    .filter((shape) => linkedIds.has(shape.id) || shapeBelongsToBase(shape, familyId, sizeId))
    .sort((a, b) => (Number(a.variant_index) || 0) - (Number(b.variant_index) || 0) || a.id.localeCompare(b.id));
}

function getCatalogPiecesForBase(familyId, sizeId) {
  return (state.catalog.catalog_pieces ?? [])
    .filter((piece) => piece.family_id === familyId && piece.size_id === sizeId)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
}

function getSpecsForBase(familyId, sizeId) {
  return (state.catalog.spec_profiles ?? [])
    .filter((spec) => spec.family_id === familyId && spec.size_id === sizeId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getRecipesForBase(familyId, sizeId) {
  const specIds = new Set(getSpecsForBase(familyId, sizeId).map((spec) => spec.id));
  return (state.catalog.recipes ?? [])
    .filter((recipe) => specIds.has(recipe.output_spec_profile_id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function renderShapeSelect() {
  if (!dom.shapeVariantSelect) return;
  const shapes = findShapesForBase();
  clearElement(dom.shapeVariantSelect);
  for (const shape of shapes) {
    const option = document.createElement('option');
    option.value = shape.id;
    option.textContent = `${shape.id} · ${shape.label ?? `v${pad2(shape.variant_index)}`} · ${shape.generation?.mode ?? '?'}`;
    option.selected = shape.id === state.selectedShapeId;
    appendElement(dom.shapeVariantSelect, option);
  }
}

function renderCatalogPieceSelect() {
  if (!dom.catalogPieceSelect) return;
  const pieces = findCatalogPiecesForBase();
  clearElement(dom.catalogPieceSelect);
  for (const piece of pieces) {
    const option = document.createElement('option');
    option.value = piece.id;
    option.textContent = `${piece.label_fr} · ${piece.shape_variant_id} · ${piece.spec_profile_id}`;
    option.selected = piece.id === state.selectedCatalogPieceId;
    appendElement(dom.catalogPieceSelect, option);
  }
}

function renderSelectedBaseSummary() {
  if (!dom.selectedBaseSummary) return;
  const base = state.selectedBase;
  const shape = selectedShape();
  const piece = selectedPiece();
  const size = getSize(base?.size_id);
  const cells = shape ? getShapeCells(shape, size) : [];
  setElementText(dom.selectedBaseSummary, base ? [
    `modèle       : ${base.piece_label_fr} ${base.size_id}`,
    `family_id    : ${base.family_id}`,
    `shape        : ${shape?.id ?? 'aucune'}`,
    `catalog      : ${piece?.id ?? 'aucune entrée liée'}`,
    `dimensions   : ${size?.dimensions ? `${size.dimensions.length}×${size.dimensions.width}×${size.dimensions.height}` : 'n/a'}`,
    `cellules     : ${cells.length}`,
  ].join('\n') : 'Aucun modèle sélectionné.');
}

function fullCells(size) {
  const dim = size?.dimensions;
  if (!dim) return [];
  const cells = [];
  for (let x = 0; x < dim.length; x += 1) {
    for (let y = 0; y < dim.width; y += 1) {
      for (let z = 0; z < dim.height; z += 1) {
        cells.push({ x, y, z, enabled: true });
      }
    }
  }
  return cells;
}

function getShapeCells(shape, size = getSize(shape?.size_id)) {
  const cells = shape?.generation?.cells;
  if (Array.isArray(cells)) return normalizeCells(cells, size);
  return fullCells(size);
}

function getVisibleShapeCells(shape, size = getSize(shape?.size_id)) {
  if (!shape || !size) return [];
  const operations = shape.generation?.operations ?? [];
  const suppressed = getSuppressedCellKeysForOperations(operations, size);
  return getShapeCells(shape, size)
    .filter((cell) => cell.enabled !== false)
    .filter((cell) => !suppressed.has(cellKey(cell.x, cell.y, cell.z)));
}

function hasVisibleCell(cells, cell) {
  const key = cellKey(cell.x, cell.y, cell.z);
  return cells.some((item) => cellKey(item.x, item.y, item.z) === key);
}

function addCellVectors(a, b) {
  return {
    x: Number(a?.x) + Number(b?.x),
    y: Number(a?.y) + Number(b?.y),
    z: Number(a?.z) + Number(b?.z),
  };
}

function oppositeFace(face) {
  return {
    left: 'right',
    right: 'left',
    front: 'back',
    back: 'front',
    bottom: 'top',
    top: 'bottom',
  }[face] ?? 'top';
}

function faceForCellDelta(delta) {
  if (delta.x > 0) return 'right';
  if (delta.x < 0) return 'left';
  if (delta.y > 0) return 'back';
  if (delta.y < 0) return 'front';
  if (delta.z > 0) return 'top';
  if (delta.z < 0) return 'bottom';
  return null;
}

function isSelectableCellFace(cells, cell, face) {
  if (!hasVisibleCell(cells, cell)) return false;
  const normal = getNormalForFace(face);
  const neighbor = addCellVectors(cell, normal);
  return !hasVisibleCell(cells, neighbor);
}

function firstSelectableFaceForCell(cells, cell, preferredFaces = []) {
  const faces = [...preferredFaces, 'top', 'front', 'back', 'left', 'right', 'bottom'];
  const seen = new Set();
  for (const face of faces) {
    if (seen.has(face)) continue;
    seen.add(face);
    if (isSelectableCellFace(cells, cell, face)) return face;
  }
  return null;
}

function sortCellsForInitialFace(cells) {
  return [...cells].sort((a, b) => (b.z - a.z) || (a.x - b.x) || (a.y - b.y));
}

function normalizeCells(cells, size) {
  const dim = size?.dimensions;
  const seen = new Set();
  const result = [];
  for (const cell of cells ?? []) {
    const x = Math.floor(Number(cell.x));
    const y = Math.floor(Number(cell.y));
    const z = Math.floor(Number(cell.z));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (dim && (x < 0 || y < 0 || z < 0 || x >= dim.length || y >= dim.width || z >= dim.height)) continue;
    const key = `${x}:${y}:${z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ x, y, z, enabled: cell.enabled !== false });
  }
  return result.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
}

function isParametricShape(shape) {
  return shape?.generation?.mode === 'parametric_shape';
}

function ensureVoxelGeneration(shape) {
  const size = getSize(shape.size_id);
  if (isParametricShape(shape)) {
    shape.generation.cells = normalizeCells(shape.generation.cells?.length ? shape.generation.cells : fullCells(size), size);
    shape.generation.operations ??= [];
    shape.collision ??= { mode: 'generated_from_shape', precision: 'parametric_simplified', allow_overlap: false };
    return;
  }
  if (!shape.generation || shape.generation.mode !== 'voxel_grid') {
    const previous = structuredClone(shape.generation ?? {});
    const legacyOperations = operationsFromLegacyShape(previous.legacy_shape, size);
    shape.generation = {
      mode: 'voxel_grid',
      base: { type: 'box', bounds: size?.dimensions ?? {} },
      cells: fullCells(size),
      operations: [
        ...(Array.isArray(previous.operations) ? previous.operations : []),
        ...legacyOperations,
      ],
      legacy_generation: previous,
    };
    shape.collision = { mode: 'generated_from_shape', precision: 'voxel_1x1x1', allow_overlap: false };
    shape.metadata ??= {};
    if (previous.mode) shape.metadata.migrated_from_generation_mode = previous.mode;
  }
  shape.generation.cells = normalizeCells(shape.generation.cells, size);
  shape.generation.operations ??= [];
}

function operationsFromLegacyShape(legacyShape, size) {
  const d = size?.dimensions;
  if (!legacyShape || !d) return [];
  const params = legacyShape.params ?? {};
  const kind = legacyShape.kind;
  const side = normalizeSideName(params.side ?? 'front');
  const ops = [];
  if (kind === 'round_side') {
    ops.push(createSideOperation('round', side, size, {
      radius: 1.0,
      source: 'legacy_round_side',
    }));
  } else if (kind === 'chamfer') {
    ops.push(createSideOperation('chamfer', side, size, {
      size: 0.5,
      source: 'legacy_chamfer',
    }));
    if (Number(params.count) >= 2) {
      ops.push(createSideOperation('chamfer', side === 'front' ? 'right' : 'back', size, {
        size: 0.5,
        source: 'legacy_chamfer_second_side',
      }));
    }
  } else if (kind === 'slope') {
    ops.push({
      type: 'slope',
      target: 'full_shape',
      selection: { cell: { x: 0, y: 0, z: 0 }, face: 'top', position: { x: d.length / 2, y: d.width / 2, z: d.height } },
      scope: { kind: 'full_shape', label_fr: 'pente legacy', axis: params.axis ?? 'length', center: { x: d.length / 2, y: d.width / 2, z: d.height / 2 } },
      status: 'draft',
      metadata: { source: 'legacy_slope', legacy: legacyShape },
    });
  }
  return ops.filter(Boolean);
}

function normalizeSideName(side) {
  return {
    length_min: 'left',
    length_max: 'right',
    width_min: 'front',
    width_max: 'back',
    height_min: 'bottom',
    height_max: 'top',
  }[side] ?? side;
}

function createSideOperation(type, side, size, options = {}) {
  const d = size?.dimensions;
  if (!d) return null;
  const isLengthAxis = side === 'front' || side === 'back';
  const scope = {
    kind: 'edge_line',
    label_fr: `ligne ${side}`,
    axis: isLengthAxis ? 'length' : 'width',
    side,
    affected_faces: [side],
    vertical_span: true,
    center: {
      x: side === 'left' ? 0 : side === 'right' ? d.length : d.length / 2,
      y: side === 'front' ? 0 : side === 'back' ? d.width : d.width / 2,
      z: d.height / 2,
    },
  };
  const op = {
    type,
    target: scope.kind,
    selection: { cell: sideToRepresentativeCell(side, d), face: side, position: scope.center },
    scope,
    status: 'draft',
    metadata: { source: options.source ?? 'editor_side_operation' },
  };
  if (type === 'round') op.radius = 1.0;
  if (type === 'chamfer') op.size = 0.5;
  return op;
}

function sideToRepresentativeCell(side, d) {
  return {
    x: side === 'right' ? d.length - 1 : 0,
    y: side === 'back' ? d.width - 1 : 0,
    z: d.height - 1,
  };
}

function markShapeDirty(shape, reason = 'edit') {
  if (!shape) return;
  shape.metadata ??= {};
  shape.metadata.updated_at = new Date().toISOString();
  shape.metadata.last_edit_reason = reason;
  if (shape.status === 'checked' || shape.status === 'validated' || shape.status === 'confirmed') {
    shape.status = 'draft';
  }
}

function cellKey(x, y, z) { return `${x}:${y}:${z}`; }

function setCell(enabled) {
  const shape = selectedShape();
  if (!shape) return;
  ensureVoxelGeneration(shape);
  const size = getSize(shape.size_id);
  const { x, y, z } = readCellInputValues();
  if (!isCellInside(size, x, y, z)) {
    setMessage(`Cellule hors limites pour ${shape.size_id}.`);
    return;
  }
  const cells = normalizeCells(shape.generation.cells, size).filter((cell) => cellKey(cell.x, cell.y, cell.z) !== cellKey(x, y, z));
  if (enabled) cells.push({ x, y, z, enabled: true });
  shape.generation.cells = normalizeCells(cells, size);
  markShapeDirty(shape, enabled ? 'cell_added' : 'cell_removed');
  renderAll();
}

function isCellInside(size, x, y, z) {
  const d = size?.dimensions;
  return d && x >= 0 && y >= 0 && z >= 0 && x < d.length && y < d.width && z < d.height;
}

function resetFullBox() {
  const shape = selectedShape();
  if (!shape) return;
  ensureVoxelGeneration(shape);
  shape.generation.cells = fullCells(getSize(shape.size_id));
  markShapeDirty(shape, 'cells_reset_full_box');
  renderAll();
}

function clearCells() {
  const shape = selectedShape();
  if (!shape) return;
  ensureVoxelGeneration(shape);
  shape.generation.cells = [];
  markShapeDirty(shape, 'cells_cleared');
  renderAll();
}

function createDefaultAnchors(size) {
  const d = size?.dimensions;
  if (!d) return [];
  const mid = { x: d.length / 2, y: d.width / 2, z: d.height / 2 };
  return [
    ['left', { x: 0, y: mid.y, z: mid.z }, { x: -1, y: 0, z: 0 }],
    ['right', { x: d.length, y: mid.y, z: mid.z }, { x: 1, y: 0, z: 0 }],
    ['front', { x: mid.x, y: 0, z: mid.z }, { x: 0, y: -1, z: 0 }],
    ['back', { x: mid.x, y: d.width, z: mid.z }, { x: 0, y: 1, z: 0 }],
    ['bottom', { x: mid.x, y: mid.y, z: 0 }, { x: 0, y: 0, z: -1 }],
    ['top', { x: mid.x, y: mid.y, z: d.height }, { x: 0, y: 0, z: 1 }],
  ].map(([face, position, normal]) => ({
    id: `anchor_${face}`,
    position,
    normal,
    face,
    type: 'standard',
    enabled: true,
    status: 'draft',
  }));
}

function getVariantTypeLabel(type) {
  return {
    block: 'Bloc standard',
    point_1: 'Point 1',
    point_2: 'Pointe 2',
    point_3: 'Pointe 3',
  }[type] ?? type;
}

function createGenerationForVariantType(type, size) {
  const dimensions = structuredClone(size?.dimensions ?? {});
  if (type === 'point_1' || type === 'point_2' || type === 'point_3') {
    return {
      mode: 'parametric_shape',
      base: {
        type,
        bounds: dimensions,
        axis: 'length',
        orientation: 'front',
        fixed_catalog_dimensions: true,
        tip_side: type === 'point_3' ? null : 'left',
      },
      cells: fullCells(size),
      operations: [],
    };
  }
  return {
    mode: 'voxel_grid',
    base: { type: 'box', bounds: dimensions },
    cells: fullCells(size),
    operations: [],
  };
}

function getCurrentNewVariantType() {
  return dom.newVariantTypeSelect?.value || 'block';
}

function createVariantFromBase() {
  if (!state.selectedBase) return;
  const size = getSize(state.selectedBase.size_id);
  const existingIds = new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id));
  const next = getNextVariantIndex(size.id);
  const variantType = getCurrentNewVariantType();
  const id = uniqueId(`shape_${size.id}_${variantType}_v${pad2(next)}`, existingIds);
  const shape = {
    id,
    size_id: size.id,
    variant_index: next,
    label: `${size.label ?? size.id} · ${getVariantTypeLabel(variantType)} ${pad2(next)}`,
    shape_family: variantType === 'block' ? 'block' : variantType,
    simplified: true,
    fidelity: { target: 'functional_silhouette', ignore_cosmetic_details: true },
    generation: createGenerationForVariantType(variantType, size),
    allowed_symmetry: { length: true, width: true, height: true },
    anchors: createDefaultAnchors(size),
    collision: {
      mode: 'generated_from_shape',
      precision: variantType === 'block' ? 'voxel_1x1x1' : 'parametric_simplified',
      allow_overlap: false,
    },
    status: 'draft',
    metadata: { source: 'catalog_editor', based_on: `${state.selectedBase.family_id}:${size.id}`, variant_type: variantType, notes: [] },
  };
  state.catalog.shape_variants ??= [];
  state.catalog.shape_variants.push(shape);
  rebuildRepo();
  state.selectedShapeId = id;
  setMessage(`Variante créée : ${id} (${getVariantTypeLabel(variantType)}).`);
  renderAll();
}

function getNextVariantIndex(sizeId) {
  const indexes = (state.catalog.shape_variants ?? [])
    .filter((shape) => shape.size_id === sizeId)
    .map((shape) => Number(shape.variant_index) || 0);
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function duplicateVariant() {
  const source = selectedShape();
  if (!source) return;
  const next = getNextVariantIndex(source.size_id);
  const id = uniqueId(`shape_${source.size_id}_v${pad2(next)}`, new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id)));
  const clone = structuredClone(source);
  clone.id = id;
  clone.variant_index = next;
  clone.label = `${source.label ?? source.id} copie ${pad2(next)}`;
  clone.status = 'draft';
  clone.metadata = { ...(clone.metadata ?? {}), source: 'catalog_editor_duplicate', duplicated_from: source.id };
  state.catalog.shape_variants.push(clone);
  rebuildRepo();
  state.selectedShapeId = id;
  setMessage(`Variante dupliquée : ${id}.`);
  renderAll();
}

function deleteVariantById(shapeId = state.selectedShapeId) {
  const shape = getShape(shapeId);
  if (!shape) return;
  const linkedPieces = (state.catalog.catalog_pieces ?? []).filter((piece) => piece.shape_variant_id === shape.id);
  removeCatalogPiecesByIds(linkedPieces.map((piece) => piece.id));
  removeShapesByIds([shape.id]);
  rebuildRepo();
  if (state.selectedShapeId === shape.id) {
    state.selectedShapeId = findShapesForBase(state.selectedBase?.family_id, shape.size_id)[0]?.id ?? null;
  }
  if (state.selectedCatalogPieceId && !getPiece(state.selectedCatalogPieceId)) {
    state.selectedCatalogPieceId = findCatalogPiecesForBase()[0]?.id ?? null;
  }
  setMessage(`Variante supprimée : ${shape.id}.`);
  renderAll();
}

function deleteVariant() {
  deleteVariantById(state.selectedShapeId);
}

function ensureSpecProfile(familyId, sizeId, profileType = 'standard') {
  const id = `spec_${familyId}_${sizeId}_${profileType}`;
  let spec = getSpec(id);
  if (spec) return spec;
  const family = getFamily(familyId);
  const definitions = state.catalog.definitions?.spec_fields ?? {};
  spec = {
    id,
    family_id: familyId,
    size_id: sizeId,
    profile_type: profileType,
    label_fr: `${family?.label_fr ?? familyId} ${sizeId}`,
    specs: Object.fromEntries(Object.entries(definitions).map(([fieldId, definition]) => [
      fieldId,
      { value: null, unit: definition.unit ?? null, status: 'unknown' },
    ])),
    metadata: { source: 'catalog_editor_placeholder', notes: [] },
  };
  state.catalog.spec_profiles ??= [];
  state.catalog.spec_profiles.push(spec);
  rebuildRepo();
  return spec;
}

function ensureRecipe(spec, familyId, sizeId, profileType = 'standard') {
  const id = `recipe_${familyId}_${sizeId}_${profileType}`;
  let recipe = getRecipe(id);
  if (recipe) return recipe;
  recipe = {
    id,
    output_spec_profile_id: spec.id,
    cost: { value: null, currency: 'C', status: 'unknown' },
    duration: { value: null, unit: 'su', status: 'unknown' },
    station: { id: 'workshop', label_fr: 'Atelier', status: 'unknown' },
    ingredients: [],
    metadata: { source: 'catalog_editor_placeholder', notes: [] },
  };
  state.catalog.recipes ??= [];
  state.catalog.recipes.push(recipe);
  rebuildRepo();
  return recipe;
}

function createCatalogPiece() {
  if (!state.selectedBase || !state.selectedShapeId) return;
  const family = getFamily(state.selectedBase.family_id);
  const size = getSize(state.selectedBase.size_id);
  const shape = selectedShape();
  if (!family || !size || !shape) return;
  if (shape.size_id !== size.id) {
    setMessage(`Création refusée : variante ${shape.id} incompatible avec ${size.id}.`);
    renderStats();
    return;
  }
  const profileType = 'standard';
  const spec = ensureSpecProfile(family.id, size.id, profileType);
  const recipe = ensureRecipe(spec, family.id, size.id, profileType);
  const variantCode = shape.variant_index === 0 ? 'base' : `v${pad2(shape.variant_index)}`;
  const id = uniqueId(`piece_${family.id}_${size.id}_${variantCode}_${profileType}`, new Set((state.catalog.catalog_pieces ?? []).map((piece) => piece.id)));
  const piece = {
    id,
    label_fr: `${state.selectedBase.piece_label_fr} ${size.id}${shape.variant_index ? ` ${variantCode}` : ''}`,
    family_id: family.id,
    size_id: size.id,
    shape_variant_id: shape.id,
    spec_profile_id: spec.id,
    recipe_id: recipe.id,
    fixed_catalog_entry: true,
    availability: { status: 'unknown', unlock: null },
    metadata: { source: 'catalog_editor', base_model: true, notes: [] },
  };
  state.catalog.catalog_pieces ??= [];
  state.catalog.catalog_pieces.push(piece);
  rebuildRepo();
  state.selectedCatalogPieceId = id;
  setMessage(`Entrée catalogue créée : ${id}.`);
  renderAll();
}

function createCatalogPieceForShape({ familyId, sizeId, shapeId, pieceLabelFr, variantIndex, profileType = 'standard' }) {
  const existing = getCatalogPiecesForBase(familyId, sizeId).find((piece) => piece.shape_variant_id === shapeId);
  if (existing) return existing;
  const spec = ensureSpecProfile(familyId, sizeId, profileType);
  const recipe = ensureRecipe(spec, familyId, sizeId, profileType);
  const variantCode = Number(variantIndex) <= 1 ? 'base' : `v${pad2(variantIndex)}`;
  const id = uniqueId(
    `piece_${familyId}_${sizeId}_${variantCode}_${profileType}`,
    new Set((state.catalog.catalog_pieces ?? []).map((piece) => piece.id)),
  );
  const piece = {
    id,
    label_fr: `${pieceLabelFr} ${sizeId}${Number(variantIndex) > 1 ? ` v${pad2(variantIndex)}` : ''}`,
    family_id: familyId,
    size_id: sizeId,
    shape_variant_id: shapeId,
    spec_profile_id: spec.id,
    recipe_id: recipe.id,
    fixed_catalog_entry: true,
    availability: { status: 'unknown', unlock: null },
    metadata: { source: 'catalog_editor', base_model: Number(variantIndex) <= 1, notes: [] },
  };
  state.catalog.catalog_pieces ??= [];
  state.catalog.catalog_pieces.push(piece);
  rebuildRepo();
  return piece;
}

function removeShapesByIds(shapeIds) {
  const ids = new Set(shapeIds);
  state.catalog.shape_variants = (state.catalog.shape_variants ?? []).filter((shape) => !ids.has(shape.id));
}

function removeCatalogPiecesByIds(pieceIds) {
  const ids = new Set(pieceIds);
  state.catalog.catalog_pieces = (state.catalog.catalog_pieces ?? []).filter((piece) => !ids.has(piece.id));
}

function deleteBaseReferenceByFamilyAndSize(familyId, sizeId, { confirm: askConfirmation = true } = {}) {
  const pieces = getCatalogPiecesForBase(familyId, sizeId);
  const shapes = findShapesForBase(familyId, sizeId);
  const specs = getSpecsForBase(familyId, sizeId);
  const recipes = getRecipesForBase(familyId, sizeId);
  if (!pieces.length && !shapes.length && !specs.length && !recipes.length) {
    setMessage(`Suppression refusée : aucune référence pour ${getFamilyLabel(familyId)} ${sizeId}.`);
    renderStats();
    return false;
  }

  if (askConfirmation) {
    const confirmed = globalThis.confirm(
      [
        `Supprimer ${getFamilyLabel(familyId)} ${sizeId} ?`,
        `${shapes.length} variante(s)`,
        `${pieces.length} entrée(s) catalogue`,
        `${specs.length} spec(s)`,
        `${recipes.length} recette(s)`,
      ].join('\n'),
    );
    if (!confirmed) return false;
  }

  removeCatalogPiecesByIds(pieces.map((piece) => piece.id));
  removeShapesByIds(shapes.map((shape) => shape.id));
  const specIds = new Set(specs.map((spec) => spec.id));
  state.catalog.spec_profiles = (state.catalog.spec_profiles ?? []).filter((spec) => !specIds.has(spec.id));
  state.catalog.recipes = (state.catalog.recipes ?? []).filter((recipe) => !specIds.has(recipe.output_spec_profile_id));
  removeBaseGroupSize(familyId, sizeId);
  rebuildRepo();

  if (state.selectedBase?.family_id === familyId && state.selectedBase?.size_id === sizeId) {
    state.selectedCatalogPieceId = null;
    state.selectedShapeId = null;
    state.selectedFace = null;
    const group = [getBaseGroupByFamilyId(familyId), ...getBaseGroups()].find((item) => item?.sizes?.length) ?? null;
    const fallbackSizeId = group?.sizes?.[0] ?? null;
    if (group && fallbackSizeId) {
      selectBaseModel(group, fallbackSizeId, { keepView: true });
      setMessage(`Référence supprimée : ${getFamilyLabel(familyId)} ${sizeId}.`);
      return true;
    }
    state.selectedBase = null;
  }

  setMessage(`Référence supprimée : ${getFamilyLabel(familyId)} ${sizeId}.`);
  renderAll();
  return true;
}

function deleteCatalogPieceById(pieceId = state.selectedCatalogPieceId) {
  const piece = getPiece(pieceId);
  if (!piece) return;
  removeCatalogPiecesByIds([piece.id]);
  rebuildRepo();
  const remainingPieces = (state.catalog.catalog_pieces ?? [])
    .filter((item) => item.family_id === piece.family_id && item.size_id === piece.size_id)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
  state.selectedCatalogPieceId = remainingPieces[0]?.id ?? null;
  if (state.selectedCatalogPieceId) {
    state.selectedShapeId = getPiece(state.selectedCatalogPieceId)?.shape_variant_id ?? state.selectedShapeId;
  } else if (state.selectedShapeId === piece.shape_variant_id) {
    state.selectedShapeId = findShapesForBase(piece.family_id, piece.size_id)[0]?.id ?? null;
  }
  setMessage(`Entrée catalogue supprimée : ${piece.id}.`);
  renderAll();
}

function deleteCatalogPiece() {
  deleteCatalogPieceById(state.selectedCatalogPieceId);
}

function renderShapeForm() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (dom.shapeIdInput) dom.shapeIdInput.value = shape?.id ?? '';
  if (dom.shapeLabelInput) dom.shapeLabelInput.value = shape?.label ?? '';
  if (dom.shapeFamilyInput) dom.shapeFamilyInput.value = shape?.shape_family ?? '';
  if (dom.shapeStatusSelect) dom.shapeStatusSelect.value = shape?.status ?? 'draft';
  if (!dom.cellSummary) return;
  const cells = shape ? getShapeCells(shape, size) : [];
  setElementText(dom.cellSummary, shape ? [
    `taille       : ${shape.size_id}`,
    `dimensions   : ${size?.dimensions?.length ?? '?'}×${size?.dimensions?.width ?? '?'}×${size?.dimensions?.height ?? '?'}`,
    `cellules     : ${cells.length}`,
    `mode         : ${shape.generation?.mode ?? 'n/a'}`,
    isParametricShape(shape) ? `type global  : ${shape.generation?.base?.type ?? shape.shape_family}` : '',
    shape.generation?.mode !== 'voxel_grid' && !isParametricShape(shape) ? 'note         : converti en voxel_grid dès modification cellule' : '',
  ].filter(Boolean).join('\n') : 'Aucune variante sélectionnée.');
}

function updateShapeIdentity() {
  const shape = selectedShape();
  if (!shape) return;
  if (dom.shapeLabelInput) shape.label = dom.shapeLabelInput.value.trim();
  if (dom.shapeFamilyInput) shape.shape_family = slugifyId(dom.shapeFamilyInput.value || shape.shape_family || 'block');
  if (dom.shapeStatusSelect) shape.status = dom.shapeStatusSelect.value;
  shape.metadata ??= {};
  shape.metadata.updated_at = new Date().toISOString();
  renderAll(false);
}

function renderOperations() {
  const shape = selectedShape();
  const operations = shape?.generation?.operations ?? [];
  clearElement(dom.operationListSelect);
  operations.forEach((op, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${describeShapeOperation(op)}`;
    option.selected = state.selectedOperationIndex === index;
    appendElement(dom.operationListSelect, option);
  });
  renderVariantFaceSummary();
}

function describeShapeOperation(op) {
  const cell = op.selection?.cell;
  const face = op.selection?.face ?? op.face ?? '?';
  const cellText = cell ? `${cell.x},${cell.y},${cell.z}` : '?';
  const value = op.type === 'chamfer' ? `0.5` : op.type === 'round' ? `R1` : (op.value ?? '');
  const scope = op.scope?.label_fr ?? op.scope?.kind ?? op.target ?? 'face';
  return `${op.type} · ${value} · ${scope} · face ${face} · cellule ${cellText}`;
}

function faceOperationKey(cell, face, type = '') {
  if (!cell || !face) return null;
  return `${type}:${cell.x}:${cell.y}:${cell.z}:${face}`;
}

function operationMatchesSelectedFace(op, selectedFace = state.selectedFace) {
  if (!selectedFace) return false;
  const size = getSize(selectedShape()?.size_id);
  const derived = { type: op.type, selection: { cell: selectedFace.cell, face: selectedFace.face }, scope: deriveFaceOperationScope(selectedFace, size) };
  return operationScopeKey(op) === operationScopeKey(derived);
}

function deriveFaceOperationScope(selectedFace, size) {
  const { cell, face } = selectedFace;
  const d = size?.dimensions;
  if (!d) return { kind: 'face_cell', label_fr: 'face sélectionnée', center: selectedFace.position, cells: [{ ...cell }] };

  const atXMin = cell.x === 0;
  const atXMax = cell.x === d.length - 1;
  const atYMin = cell.y === 0;
  const atYMax = cell.y === d.width - 1;
  const atZMin = cell.z === 0;
  const atZMax = cell.z === d.height - 1;
  const xSide = atXMin ? 'left' : atXMax ? 'right' : null;
  const ySide = atYMin ? 'front' : atYMax ? 'back' : null;
  const verticalCells = (x, y) => Array.from({ length: d.height }, (_, z) => ({ x, y, z }));

  if ((face === 'top' || face === 'bottom') && xSide && ySide) {
    return {
      kind: 'corner',
      label_fr: `angle ${xSide}/${ySide} · colonne hauteur ${d.height}`,
      affected_faces: [xSide, ySide],
      vertical_span: d.height > 1,
      center: { x: cell.x + 0.5, y: cell.y + 0.5, z: d.height / 2 },
      cells: verticalCells(cell.x, cell.y),
    };
  }

  if ((face === 'top' || face === 'bottom') && xSide) {
    return {
      kind: 'edge_line',
      label_fr: `ligne ${xSide} · hauteur ${d.height}`,
      axis: 'width',
      side: xSide,
      vertical_span: true,
      center: { x: atXMin ? 0 : d.length, y: d.width / 2, z: d.height / 2 },
    };
  }

  if ((face === 'top' || face === 'bottom') && ySide) {
    return {
      kind: 'edge_line',
      label_fr: `ligne ${ySide} · hauteur ${d.height}`,
      axis: 'length',
      side: ySide,
      vertical_span: true,
      center: { x: d.length / 2, y: atYMin ? 0 : d.width, z: d.height / 2 },
    };
  }

  if (['front', 'back'].includes(face)) {
    return {
      kind: atZMax ? 'top_side_line' : 'side_line',
      label_fr: atZMax ? `ligne haute ${face}` : `ligne latérale ${face} · hauteur ${d.height}`,
      axis: 'length',
      side: face,
      vertical_span: !atZMax && d.height > 1,
      center: { x: d.length / 2, y: face === 'front' ? 0 : d.width, z: atZMax ? d.height : d.height / 2 },
    };
  }

  if (['left', 'right'].includes(face)) {
    return {
      kind: atZMax ? 'top_side_line' : 'side_line',
      label_fr: atZMax ? `ligne haute ${face}` : `ligne latérale ${face} · hauteur ${d.height}`,
      axis: 'width',
      side: face,
      vertical_span: !atZMax && d.height > 1,
      center: { x: face === 'left' ? 0 : d.length, y: d.width / 2, z: atZMax ? d.height : d.height / 2 },
    };
  }

  return {
    kind: 'face_cell',
    label_fr: 'face sélectionnée',
    center: selectedFace.position,
    cells: [{ ...cell }],
  };
}

function operationScopeKey(op) {
  const scope = op?.scope ?? {};
  const cell = op?.selection?.cell ?? {};
  const parts = [op?.type, scope.kind, scope.side, scope.axis, (scope.affected_faces ?? []).join('/')];
  if (scope.kind === 'corner') parts.push(cell.x, cell.y, 'all_z');
  else if (scope.side) parts.push(scope.side, 'line');
  else parts.push(cell.x, cell.y, cell.z, op?.selection?.face);
  return parts.filter((part) => part !== undefined && part !== null).join(':');
}

function createOperationFromSelectedFace(type) {
  const shape = selectedShape();
  const selectedFace = state.selectedFace;
  if (!shape || !selectedFace) {
    setMessage('Correction refusée : aucune face sélectionnée.');
    renderOperations();
    return;
  }
  ensureVoxelGeneration(shape);
  const size = getSize(shape.size_id);
  const scope = deriveFaceOperationScope(selectedFace, size);
  const existing = (shape.generation.operations ?? []).find((op) => (
    op.type === type && operationMatchesSelectedFace(op, selectedFace)
  ));
  if (existing) {
    setMessage(`Correction déjà présente sur cette face : ${describeShapeOperation(existing)}.`);
    renderAll();
    return;
  }
  const op = {
    type,
    target: scope.kind,
    selection: {
      cell: { ...selectedFace.cell },
      face: selectedFace.face,
      position: { ...selectedFace.position },
    },
    scope,
    status: 'draft',
    metadata: { source: 'editor_face_selection' },
  };
  if (type === 'round') op.radius = 1.0;
  if (type === 'chamfer') op.size = 0.5;
  shape.generation.operations.push(op);
  markShapeDirty(shape, `operation_${type}_added`);
  state.selectedOperationIndex = shape.generation.operations.length - 1;
  setMessage(`Correction ajoutée : ${describeShapeOperation(op)}.`);
  renderAll();
}

function removeFaceOperation() {
  const shape = selectedShape();
  if (!shape) return;
  ensureVoxelGeneration(shape);
  const operations = shape.generation.operations ?? [];
  let index = -1;
  if (state.selectedFace) {
    index = operations.findIndex((op) => operationMatchesSelectedFace(op, state.selectedFace));
  }
  if (index < 0) {
    const selected = Number(dom.operationListSelect?.value ?? state.selectedOperationIndex);
    if (Number.isInteger(selected) && selected >= 0) index = selected;
  }
  if (index < 0) {
    setMessage('Suppression correction refusée : aucune correction liée à la face sélectionnée.');
    renderOperations();
    return;
  }
  const [removed] = operations.splice(index, 1);
  markShapeDirty(shape, 'operation_removed');
  state.selectedOperationIndex = null;
  setMessage(`Correction supprimée : ${describeShapeOperation(removed)}.`);
  renderAll();
}

function renderVariantFaceSummary() {
  if (!dom.variantFaceSummary) return;
  const face = state.selectedFace;
  if (!face) {
    setElementText(dom.variantFaceSummary, 'Aucune face sélectionnée. Clique une face de cellule dans la vue 3D.');
    return;
  }
  const size = getSize(selectedShape()?.size_id);
  const scope = deriveFaceOperationScope(face, size);
  const existing = (selectedShape()?.generation?.operations ?? []).filter((op) => operationMatchesSelectedFace(op, face));
  setElementText(dom.variantFaceSummary, [
    `cellule   : ${face.cell.x}, ${face.cell.y}, ${face.cell.z}`,
    `face      : ${face.face}`,
    `action    : arrondi R1 ou chanfrein 0.5`,
    `portée    : ${scope.label_fr ?? scope.kind}`,
    `correction: ${existing.length ? existing.map(describeShapeOperation).join(' | ') : 'aucune'}`,
  ].join('\n'));
}

function renderAnchors() {
  const shape = selectedShape();
  const anchors = shape?.anchors ?? [];
  clearElement(dom.anchorListSelect);
  for (const anchor of anchors) {
    const option = document.createElement('option');
    option.value = anchor.id;
    const p = anchor.position ?? {};
    const cell = anchor.metadata?.cell;
    const cellText = cell ? `cell ${cell.x},${cell.y},${cell.z}` : 'cell ?';
    option.textContent = `${anchor.id} · ${anchor.face ?? '?'} · ${cellText} · ${p.x ?? '?'},${p.y ?? '?'},${p.z ?? '?'}`;
    option.selected = anchor.id === state.selectedAnchorId;
    appendElement(dom.anchorListSelect, option);
  }
  renderSelectedFaceSummary();
}

function getNormalForFace(face) {
  return {
    left: { x: -1, y: 0, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    front: { x: 0, y: -1, z: 0 },
    back: { x: 0, y: 1, z: 0 },
    bottom: { x: 0, y: 0, z: -1 },
    top: { x: 0, y: 0, z: 1 },
  }[face] ?? { x: 0, y: 0, z: 1 };
}

function anchorPositionForCellFace(cell, face) {
  const x = Number(cell.x);
  const y = Number(cell.y);
  const z = Number(cell.z);
  return {
    left: { x, y: y + 0.5, z: z + 0.5 },
    right: { x: x + 1, y: y + 0.5, z: z + 0.5 },
    front: { x: x + 0.5, y, z: z + 0.5 },
    back: { x: x + 0.5, y: y + 1, z: z + 0.5 },
    bottom: { x: x + 0.5, y: y + 0.5, z },
    top: { x: x + 0.5, y: y + 0.5, z: z + 1 },
  }[face] ?? { x: x + 0.5, y: y + 0.5, z: z + 1 };
}

function anchorFaceKey(cell, face) {
  if (!cell || !face) return null;
  return `${cell.x}:${cell.y}:${cell.z}:${face}`;
}

function anchorMatchesSelectedFace(anchor, selectedFace = state.selectedFace) {
  if (!selectedFace) return false;
  const cell = anchor.metadata?.cell;
  if (cell) return anchorFaceKey(cell, anchor.face) === anchorFaceKey(selectedFace.cell, selectedFace.face);
  const expected = anchorPositionForCellFace(selectedFace.cell, selectedFace.face);
  const p = anchor.position ?? {};
  return anchor.face === selectedFace.face
    && Math.abs(Number(p.x) - expected.x) < 0.001
    && Math.abs(Number(p.y) - expected.y) < 0.001
    && Math.abs(Number(p.z) - expected.z) < 0.001;
}

function renderSelectedFaceSummary() {
  renderVariantFaceSummary();
  if (!dom.selectedFaceSummary) return;
  const face = state.selectedFace;
  if (!face) {
    setElementText(dom.selectedFaceSummary, 'Aucune face sélectionnée. Clique une face de cellule dans la vue 3D.');
    return;
  }
  const existing = (selectedShape()?.anchors ?? []).find((anchor) => anchorMatchesSelectedFace(anchor, face));
  setElementText(dom.selectedFaceSummary, [
    `cellule : ${face.cell.x}, ${face.cell.y}, ${face.cell.z}`,
    `face    : ${face.face}`,
    `position: ${face.position.x}, ${face.position.y}, ${face.position.z}`,
    `ancre   : ${existing ? existing.id : 'aucune'}`,
  ].join('\n'));
}

function addAnchor() {
  const shape = selectedShape();
  const selectedFace = state.selectedFace;
  if (!shape || !selectedFace) {
    setMessage('Ajout ancre refusé : aucune face sélectionnée.');
    renderAnchors();
    return;
  }
  const anchors = shape.anchors ??= [];
  const existing = anchors.find((anchor) => anchorMatchesSelectedFace(anchor, selectedFace));
  if (existing) {
    state.selectedAnchorId = existing.id;
    setMessage(`Ancre déjà présente sur cette face : ${existing.id}.`);
    renderAll();
    return;
  }
  const id = uniqueId(
    `anchor_${selectedFace.cell.x}_${selectedFace.cell.y}_${selectedFace.cell.z}_${selectedFace.face}`,
    new Set(anchors.map((anchor) => anchor.id)),
  );
  const anchor = {
    id,
    position: selectedFace.position,
    normal: getNormalForFace(selectedFace.face),
    face: selectedFace.face,
    type: 'standard',
    enabled: true,
    status: 'draft',
    metadata: {
      source: 'editor_face_selection',
      cell: selectedFace.cell,
    },
  };
  anchors.push(anchor);
  markShapeDirty(shape, 'anchor_added');
  state.selectedAnchorId = id;
  setMessage(`Ancre ajoutée : ${id}.`);
  renderAll();
}

function deleteAnchor() {
  const shape = selectedShape();
  if (!shape) return;
  const anchors = shape.anchors ?? [];
  let target = null;
  if (state.selectedFace) target = anchors.find((anchor) => anchorMatchesSelectedFace(anchor));
  if (!target && state.selectedAnchorId) target = anchors.find((anchor) => anchor.id === state.selectedAnchorId);
  if (!target) {
    setMessage('Suppression ancre refusée : aucune ancre sur la face sélectionnée.');
    renderAnchors();
    return;
  }
  shape.anchors = anchors.filter((anchor) => anchor.id !== target.id);
  markShapeDirty(shape, 'anchor_removed');
  state.selectedAnchorId = null;
  setMessage(`Ancre supprimée : ${target.id}.`);
  renderAll();
}

function toggleAnchorOnSelectedFace() {
  const shape = selectedShape();
  if (!shape || !state.selectedFace) return false;
  const existing = (shape.anchors ?? []).find((anchor) => anchorMatchesSelectedFace(anchor));
  if (existing) {
    deleteAnchor();
  } else {
    addAnchor();
  }
  return true;
}

function fillAnchorForm(anchorId) {
  const shape = selectedShape();
  const anchor = (shape?.anchors ?? []).find((item) => item.id === anchorId);
  if (!anchor) return;
  state.selectedAnchorId = anchor.id;
  if (anchor.metadata?.cell) {
    state.selectedFace = {
      cell: anchor.metadata.cell,
      face: anchor.face,
      position: anchor.position,
    };
  }
  renderAnchors();
  renderPreview();
}


function getSpecsForSelectedBase() {
  if (!state.selectedBase) return [];
  return (state.catalog.spec_profiles ?? [])
    .filter((spec) => spec.family_id === state.selectedBase.family_id && spec.size_id === state.selectedBase.size_id)
    .sort((a, b) => (a.profile_type ?? '').localeCompare(b.profile_type ?? '') || a.id.localeCompare(b.id));
}

function getRecipesForSelectedBase() {
  const specIds = new Set(getSpecsForSelectedBase().map((spec) => spec.id));
  return (state.catalog.recipes ?? [])
    .filter((recipe) => specIds.has(recipe.output_spec_profile_id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function ensureBaseSpecAndRecipe() {
  if (!state.selectedBase) return { spec: null, recipe: null };
  const spec = ensureSpecProfile(state.selectedBase.family_id, state.selectedBase.size_id, 'standard');
  const recipe = ensureRecipe(spec, state.selectedBase.family_id, state.selectedBase.size_id, 'standard');
  return { spec, recipe };
}

function renderSpecProfileSelect() {
  if (!dom.specProfileSelect) return;
  ensureBaseSpecAndRecipe();
  const specs = getSpecsForSelectedBase();
  clearElement(dom.specProfileSelect);
  for (const spec of specs) {
    const option = document.createElement('option');
    option.value = spec.id;
    option.textContent = `${spec.label_fr ?? spec.id} · ${spec.profile_type ?? 'standard'}`;
    appendElement(dom.specProfileSelect, option);
  }
  renderModalContexts();
}

function renderSpecEditor() {
  if (!dom.specEditor) return;
  clearElement(dom.specEditor);
  const spec = getSpec(dom.specProfileSelect?.value) ?? getSpecsForSelectedBase()[0] ?? null;
  if (!spec) {
    setElementText(dom.specEditor, 'Aucun profil technique lié au modèle de base.');
    return;
  }
  const definitions = state.catalog.definitions?.spec_fields ?? {};
  for (const [fieldId, value] of Object.entries(spec.specs ?? {})) {
    const row = document.createElement('div');
    row.className = 'editor-row';
    const label = document.createElement('span');
    label.textContent = definitions[fieldId]?.label_fr ?? fieldId;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = value.value ?? '';
    input.placeholder = 'unknown';
    input.addEventListener('change', () => {
      const raw = input.value.trim();
      value.value = raw === '' ? null : Number(raw);
      value.status = value.value === null ? 'unknown' : 'draft';
      renderStats();
      renderValidationReport();
    });
    row.append(label, input);
    appendElement(dom.specEditor, row);
  }
}

function renderRecipeSelect() {
  if (!dom.recipeSelect) return;
  ensureBaseSpecAndRecipe();
  const recipes = getRecipesForSelectedBase();
  clearElement(dom.recipeSelect);
  for (const recipe of recipes) {
    const option = document.createElement('option');
    option.value = recipe.id;
    option.textContent = recipe.id;
    appendElement(dom.recipeSelect, option);
  }
  renderModalContexts();
}

function renderRecipeEditor() {
  if (!dom.recipeEditor) return;
  clearElement(dom.recipeEditor);
  const recipe = getRecipe(dom.recipeSelect?.value) ?? getRecipesForSelectedBase()[0] ?? null;
  if (!recipe) {
    setElementText(dom.recipeEditor, 'Aucune recette liée au modèle de base.');
    return;
  }
  const fields = [
    ['Coût', 'cost.value', 'number'],
    ['Durée', 'duration.value', 'number'],
    ['Station ID', 'station.id', 'text'],
    ['Station label', 'station.label_fr', 'text'],
  ];
  for (const [labelText, path, type] of fields) {
    const row = document.createElement('div');
    row.className = 'editor-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.value = getNested(recipe, path) ?? '';
    input.addEventListener('change', () => {
      const value = type === 'number' ? (input.value.trim() === '' ? null : Number(input.value)) : input.value.trim();
      setNested(recipe, path, value);
      if (path === 'cost.value') recipe.cost.status = value === null ? 'unknown' : 'draft';
      if (path === 'duration.value') recipe.duration.status = value === null ? 'unknown' : 'draft';
      renderValidationReport();
    });
    row.append(label, input);
    appendElement(dom.recipeEditor, row);
  }
  const area = document.createElement('textarea');
  area.rows = 6;
  area.value = JSON.stringify(recipe.ingredients ?? [], null, 2);
  area.addEventListener('change', () => {
    try {
      const parsed = JSON.parse(area.value);
      recipe.ingredients = Array.isArray(parsed) ? parsed : [];
      area.classList.remove('invalid');
      renderValidationReport();
    } catch {
      area.classList.add('invalid');
    }
  });
  const block = document.createElement('div');
  block.className = 'field-block';
  const label = document.createElement('span');
  label.textContent = 'Ingrédients JSON';
  block.append(label, area);
  appendElement(dom.recipeEditor, block);
}

function renderModalContexts() {
  const text = state.selectedBase
    ? `${state.selectedBase.group_label_fr}\n${state.selectedBase.piece_label_fr} ${state.selectedBase.size_id}\nfamily_id: ${state.selectedBase.family_id}\nsize_id: ${state.selectedBase.size_id}`
    : 'Aucun modèle sélectionné.';
  if (dom.specModalContext) dom.specModalContext.textContent = text;
  if (dom.recipeModalContext) dom.recipeModalContext.textContent = text;
}

function openSpecModal() {
  ensureBaseSpecAndRecipe();
  renderSpecProfileSelect();
  renderSpecEditor();
  dom.specModal?.classList.add('open');
  dom.specModal?.setAttribute('aria-hidden', 'false');
}

function closeSpecModal() {
  dom.specModal?.classList.remove('open');
  dom.specModal?.setAttribute('aria-hidden', 'true');
}

function openRecipeModal() {
  ensureBaseSpecAndRecipe();
  renderRecipeSelect();
  renderRecipeEditor();
  dom.recipeModal?.classList.add('open');
  dom.recipeModal?.setAttribute('aria-hidden', 'false');
}

function closeRecipeModal() {
  dom.recipeModal?.classList.remove('open');
  dom.recipeModal?.setAttribute('aria-hidden', 'true');
}

function setModalOpen(modal, open) {
  modal?.classList.toggle('open', open);
  modal?.setAttribute('aria-hidden', String(!open));
}

function openBaseReferenceModal(familyId) {
  state.baseReferenceFamilyId = familyId;
  const familyLabel = getFamilyLabel(familyId);
  setElementText(dom.baseReferenceModalContext, `${familyLabel}\nCréer une référence famille/taille.`);
  dom.newBaseLengthInput && (dom.newBaseLengthInput.value = '4');
  dom.newBaseWidthInput && (dom.newBaseWidthInput.value = '3');
  dom.newBaseHeightInput && (dom.newBaseHeightInput.value = '1');
  setModalOpen(dom.baseReferenceModal, true);
  dom.newBaseLengthInput?.focus();
}

function closeBaseReferenceModal() {
  setModalOpen(dom.baseReferenceModal, false);
}

function ensureSizeDefinition(length, width, height) {
  const sizeId = makeSizeId(length, width, height);
  let size = getSize(sizeId);
  if (size) return size;
  size = {
    id: sizeId,
    label: sizeId,
    dimensions: { length, width, height },
    status: 'draft',
  };
  state.catalog.sizes ??= [];
  state.catalog.sizes.push(size);
  rebuildRepo();
  return size;
}

function createBaseReferenceFromModal() {
  const familyId = state.baseReferenceFamilyId;
  const group = getBaseGroupByFamilyId(familyId);
  if (!familyId || !group) return;

  const length = Math.floor(Number(dom.newBaseLengthInput?.value));
  const width = Math.floor(Number(dom.newBaseWidthInput?.value));
  const height = Math.floor(Number(dom.newBaseHeightInput?.value));
  if (![length, width, height].every((value) => Number.isInteger(value) && value > 0)) {
    setMessage('Création refusée : dimensions invalides.');
    renderStats();
    return;
  }

  const size = ensureSizeDefinition(length, width, height);
  const sizeId = size.id;
  if (getCatalogPiecesForBase(familyId, sizeId).length || findShapesForBase(familyId, sizeId).length) {
    setMessage(`Création refusée : ${group.piece_label_fr} ${sizeId} existe déjà.`);
    renderStats();
    return;
  }

  ensureBaseGroupSize(familyId, sizeId);
  const shapeId = uniqueId(`shape_${familyId}_${sizeId}_v01`, new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id)));
  const shape = {
    id: shapeId,
    size_id: sizeId,
    variant_index: 1,
    label: 'Variante 01 — Standard',
    shape_family: 'standard_block',
    simplified: true,
    fidelity: { target: 'functional_silhouette', ignore_cosmetic_details: true },
    generation: createGenerationForVariantType('block', size),
    allowed_symmetry: { length: true, width: true, height: true },
    anchors: createDefaultAnchors(size),
    collision: { mode: 'generated_from_shape', precision: 'voxel_1x1x1', allow_overlap: false },
    status: 'draft',
    metadata: { source: 'catalog_editor', based_on: `${familyId}:${sizeId}`, variant_type: 'block', notes: [] },
  };
  state.catalog.shape_variants ??= [];
  state.catalog.shape_variants.push(shape);
  rebuildRepo();
  const piece = createCatalogPieceForShape({
    familyId,
    sizeId,
    shapeId,
    pieceLabelFr: group.piece_label_fr,
    variantIndex: 1,
  });
  closeBaseReferenceModal();
  selectBaseModel(group, sizeId, { keepView: true });
  state.selectedShapeId = shape.id;
  state.selectedCatalogPieceId = piece.id;
  setMessage(`Référence créée : ${group.piece_label_fr} ${sizeId}.`);
  renderAll();
}

function getAvailableVariantIndexes(familyId, sizeId, maxIndex = 14) {
  const used = new Set(findShapesForBase(familyId, sizeId).map((shape) => Number(shape.variant_index) || 0));
  const available = [];
  for (let index = 2; index <= maxIndex; index += 1) {
    if (!used.has(index)) available.push(index);
  }
  return available;
}

function renderVariantIconGrid() {
  if (!dom.newVariantIconGrid) return;
  clearElement(dom.newVariantIconGrid);
  const familyId = dom.newVariantFamilySelect?.value;
  const sizeId = dom.newVariantSizeSelect?.value;
  const available = getAvailableVariantIndexes(familyId, sizeId);
  if (!available.length) {
    setElementText(dom.newVariantIconGrid, 'Aucune variante disponible.');
    state.variantModalSelection = null;
    if (dom.createVariantFromModalBtn) dom.createVariantFromModalBtn.disabled = true;
    return;
  }
  if (dom.createVariantFromModalBtn) dom.createVariantFromModalBtn.disabled = false;
  if (!available.includes(state.variantModalSelection)) state.variantModalSelection = available[0];
  for (const index of available) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `variant-icon-option${state.variantModalSelection === index ? ' active' : ''}`;
    const image = document.createElement('img');
    image.className = 'variant-icon';
    image.alt = `Icône variante ${index}`;
    image.src = resolveRuntimePath(`ui/shape-buttons/button_${pad2(index)}.png`);
    const label = document.createElement('span');
    label.textContent = `v${pad2(index)}`;
    button.append(image, label);
    button.addEventListener('click', () => {
      state.variantModalSelection = index;
      renderVariantIconGrid();
    });
    appendElement(dom.newVariantIconGrid, button);
  }
}

function fillVariantCreationSelectors(familyId, sizeId) {
  clearElement(dom.newVariantFamilySelect);
  clearElement(dom.newVariantSizeSelect);
  for (const group of getBaseGroups()) {
    const option = document.createElement('option');
    option.value = group.family_id;
    option.textContent = group.label_fr;
    option.selected = group.family_id === familyId;
    appendElement(dom.newVariantFamilySelect, option);
  }
  const group = getBaseGroupByFamilyId(familyId);
  for (const itemSizeId of group?.sizes ?? []) {
    const option = document.createElement('option');
    option.value = itemSizeId;
    option.textContent = itemSizeId;
    option.selected = itemSizeId === sizeId;
    appendElement(dom.newVariantSizeSelect, option);
  }
}

function openVariantCreationModal(familyId = state.selectedBase?.family_id, sizeId = state.selectedBase?.size_id) {
  fillVariantCreationSelectors(familyId, sizeId);
  setElementText(dom.variantCreationModalContext, `${getFamilyLabel(familyId)}\n${sizeId}\nCréer une nouvelle variante.`);
  state.variantModalSelection = getAvailableVariantIndexes(familyId, sizeId)[0] ?? null;
  renderVariantIconGrid();
  setModalOpen(dom.variantCreationModal, true);
  dom.newVariantFamilySelect?.focus();
}

function closeVariantCreationModal() {
  setModalOpen(dom.variantCreationModal, false);
}

function createVariantFromModal() {
  const familyId = dom.newVariantFamilySelect?.value;
  const sizeId = dom.newVariantSizeSelect?.value;
  const variantIndex = Number(state.variantModalSelection);
  const group = getBaseGroupByFamilyId(familyId);
  const size = getSize(sizeId);
  if (!group || !size || !Number.isInteger(variantIndex) || variantIndex < 2) {
    setMessage('Création variante refusée : sélection incomplète.');
    renderStats();
    return;
  }
  if (findShapesForBase(familyId, sizeId).some((shape) => Number(shape.variant_index) === variantIndex)) {
    setMessage(`Création variante refusée : v${pad2(variantIndex)} existe déjà pour ${group.piece_label_fr} ${sizeId}.`);
    renderStats();
    return;
  }
  const shapeId = uniqueId(`shape_${familyId}_${sizeId}_v${pad2(variantIndex)}`, new Set((state.catalog.shape_variants ?? []).map((shape) => shape.id)));
  const shape = {
    id: shapeId,
    size_id: sizeId,
    variant_index: variantIndex,
    label: `Variante ${pad2(variantIndex)}`,
    shape_family: 'standard_block',
    simplified: true,
    fidelity: { target: 'functional_silhouette', ignore_cosmetic_details: true },
    generation: createGenerationForVariantType('block', size),
    allowed_symmetry: { length: true, width: true, height: true },
    anchors: createDefaultAnchors(size),
    collision: { mode: 'generated_from_shape', precision: 'voxel_1x1x1', allow_overlap: false },
    status: 'draft',
    metadata: {
      source: 'catalog_editor',
      based_on: `${familyId}:${sizeId}`,
      variant_type: 'block',
      icon_index: variantIndex,
      notes: [],
    },
  };
  state.catalog.shape_variants ??= [];
  state.catalog.shape_variants.push(shape);
  rebuildRepo();
  const piece = createCatalogPieceForShape({
    familyId,
    sizeId,
    shapeId,
    pieceLabelFr: group.piece_label_fr,
    variantIndex,
  });
  closeVariantCreationModal();
  selectBaseModel(group, sizeId, { keepView: true });
  state.selectedShapeId = shape.id;
  state.selectedCatalogPieceId = piece.id;
  setMessage(`Variante créée : ${shape.id}.`);
  renderAll();
}


function getNested(target, path) {
  return path.split('.').reduce((obj, key) => obj?.[key], target);
}

function setNested(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  while (parts.length > 1) {
    const key = parts.shift();
    cursor[key] ??= {};
    cursor = cursor[key];
  }
  cursor[parts[0]] = value;
}

function renderPreview() {
  while (root.children.length) {
    const child = root.children.pop();
    child.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose?.());
      else obj.material?.dispose?.();
    });
  }

  cellPickTargets.length = 0;

  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size) return;

  ensureVoxelGeneration(shape);
  const operations = shape.generation?.operations ?? [];
  const suppressed = getSuppressedCellKeysForOperations(operations, size);

  const allCells = getShapeCells(shape, size).filter((cell) => cell.enabled !== false);
  const visibleCells = allCells.filter((cell) => !suppressed.has(cellKey(cell.x, cell.y, cell.z)));

  const previewGeometry = buildShapeGeometry({
    shape,
    size,
    scale: CELL_SCALE,
    symmetry: {},
    showVoxels: true,
  });
  const preview = meshWithEdges(
    previewGeometry,
    createOperationMaterial(),
    new THREE.LineBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.72 }),
  );
  root.add(preview);

  if (isParametricShape(shape)) renderVoxelGuide(visibleCells, size);
  renderCellPickProxies(visibleCells, size);

  const boundsBox = createCatalogReservationBox(size, CELL_SCALE, new THREE.Vector3());
  const bounds = new THREE.Box3Helper(boundsBox, SELECTED_COLOR);
  root.add(bounds);

  const anchorGeom = new THREE.SphereGeometry(CELL_SCALE * 0.1, 16, 10);
  const anchorMat = new THREE.MeshBasicMaterial({ color: ANCHOR_COLOR });
  for (const anchor of shape.anchors ?? []) {
    if (anchor.enabled === false) continue;
    const dot = new THREE.Mesh(anchorGeom, anchorMat);
    dot.position.copy(anchorToWorld(anchor, size));
    root.add(dot);
  }

  renderSelectedFaceHint(size);
}

function renderCellPickProxies(cells, size) {
  const proxyGeom = new THREE.BoxGeometry(CELL_SCALE, CELL_SCALE, CELL_SCALE);
  const proxyMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (const cell of cells) {
    const proxy = new THREE.Mesh(proxyGeom, proxyMat);
    proxy.position.copy(cellCenterToWorld(cell, size));
    proxy.userData = { type: 'cell', cell: { x: cell.x, y: cell.y, z: cell.z } };
    cellPickTargets.push(proxy);
    root.add(proxy);
  }
}

function getSuppressedCellKeysForOperations(operations, size) {
  const keys = new Set();
  for (const op of operations ?? []) {
    for (const cell of getOperationAffectedCells(op, size)) {
      keys.add(cellKey(cell.x, cell.y, cell.z));
    }
  }
  return keys;
}

function getOperationAffectedCells(op, size) {
  const d = size?.dimensions;
  if (!d) return [];
  const scope = op.scope ?? {};
  if (Array.isArray(scope.cells) && scope.cells.length && scope.kind === 'corner') return normalizeCells(scope.cells, size);

  const cells = [];
  const add = (x, y, z) => { if (isCellInside(size, x, y, z)) cells.push({ x, y, z }); };
  const allZ = [...Array(d.height).keys()];

  if (scope.kind === 'corner') {
    const base = op.selection?.cell ?? { x: 0, y: 0 };
    for (const z of allZ) add(base.x, base.y, z);
    return cells;
  }

  const selectedFace = op.selection?.face;
  const zLevels = (scope.kind === 'edge_line' && (selectedFace === 'top' || selectedFace === 'bottom'))
    ? [selectedFace === 'top' ? d.height - 1 : 0]
    : allZ;

  if (scope.side === 'front') {
    for (let x = 0; x < d.length; x += 1) for (const z of zLevels) add(x, 0, z);
  } else if (scope.side === 'back') {
    for (let x = 0; x < d.length; x += 1) for (const z of zLevels) add(x, d.width - 1, z);
  } else if (scope.side === 'left') {
    for (let y = 0; y < d.width; y += 1) for (const z of zLevels) add(0, y, z);
  } else if (scope.side === 'right') {
    for (let y = 0; y < d.width; y += 1) for (const z of zLevels) add(d.length - 1, y, z);
  }
  return cells;
}

function renderVoxelGuide(cells, size) {
  const guideGeom = new THREE.BoxGeometry(CELL_SCALE, CELL_SCALE, CELL_SCALE);
  const guideMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 });
  for (const cell of cells) {
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(guideGeom), guideMat);
    wire.position.copy(cellCenterToWorld(cell, size));
    root.add(wire);
  }
}

function createOperationMaterial() {
  return new THREE.MeshBasicMaterial({
    color: CELL_COLOR,
    side: THREE.DoubleSide,
  });
}

function createOperationEdgeMaterial(op) {
  return new THREE.LineBasicMaterial({
    color: op?.type === 'chamfer' ? OPERATION_CHAMFER_COLOR : OPERATION_ROUND_COLOR,
    transparent: true,
    opacity: 0.82,
  });
}

function meshWithEdges(geometry, material, edgeMaterial) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), edgeMaterial);
  group.add(edges);
  return group;
}
function cellCenterToWorld(cell, size) {
  return catalogCellCenterVector(cell, size.dimensions, CELL_SCALE);
}

function anchorToWorld(anchor, size) {
  return catalogPointVector(anchor.position ?? { x: 0, y: 0, z: 0 }, size.dimensions, CELL_SCALE);
}

function selectedFaceToWorld(size, selectedFace = state.selectedFace) {
  if (!selectedFace) return null;
  return catalogPointVector(selectedFace.position, size.dimensions, CELL_SCALE);
}


function catalogNormalToWorld(normal) {
  return { x: Number(normal.y) || 0, y: Number(normal.x) || 0, z: Number(normal.z) || 0 };
}

function renderSelectedFaceHint(size) {
  const selectedFace = state.selectedFace;
  if (!selectedFace) return;
  renderSelectedCellOutline(size, selectedFace);
  const normal = catalogNormalToWorld(getNormalForFace(selectedFace.face));
  const dims = { x: CELL_SCALE * 0.72, y: CELL_SCALE * 0.72, z: CELL_SCALE * 0.72 };
  if (Math.abs(normal.x)) dims.x = CELL_SCALE * 0.045;
  if (Math.abs(normal.y)) dims.y = CELL_SCALE * 0.045;
  if (Math.abs(normal.z)) dims.z = CELL_SCALE * 0.045;
  const geom = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
  const mat = new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, transparent: true, opacity: 0.55 });
  const marker = new THREE.Mesh(geom, mat);
  const position = selectedFaceToWorld(size, selectedFace);
  marker.position.set(
    position.x + normal.x * CELL_SCALE * 0.035,
    position.y + normal.y * CELL_SCALE * 0.035,
    position.z + normal.z * CELL_SCALE * 0.035,
  );
  root.add(marker);
}

function renderSelectedCellOutline(size, selectedFace = state.selectedFace) {
  if (!selectedFace) return;
  const geom = new THREE.BoxGeometry(CELL_SCALE * 1.04, CELL_SCALE * 1.04, CELL_SCALE * 1.04);
  const edges = new THREE.EdgesGeometry(geom);
  geom.dispose();
  const mat = new THREE.LineBasicMaterial({ color: SELECTED_COLOR, transparent: true, opacity: 0.95 });
  const outline = new THREE.LineSegments(edges, mat);
  outline.position.copy(cellCenterToWorld(selectedFace.cell, size));
  root.add(outline);
}

function catalogPositionToWorld(position, size) {
  return catalogPointVector(position, size.dimensions, CELL_SCALE);
}



function fitPreview(renderNow = true) {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!size) return;
  const maxSize = Math.max(size.dimensions.length, size.dimensions.width, size.dimensions.height) * CELL_SCALE;
  const center = new THREE.Vector3(0, 0, (Number(size.dimensions.height) || 1) * CELL_SCALE / 2);
  const distance = Math.max(180, maxSize * 2.4);
  editorViewController?.resetView({ target: center, distance });
  syncEditorNavigationCubeActiveView();
  if (renderNow) renderer.render(scene, camera);
}

function resetPreview() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  const targetZ = size ? (Number(size.dimensions.height) || 1) * CELL_SCALE / 2 : 0;
  editorViewController?.resetView({ target: new THREE.Vector3(0, 0, targetZ) });
  syncEditorNavigationCubeActiveView();
}

function renderStats() {
  const base = state.selectedBase;
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  const cells = shape ? getShapeCells(shape, size) : [];
  setElementText(dom.stats, [
    `mode       : éditeur catalogue`,
    `schéma     : ${state.catalog?.schema_version ?? 'inconnu'}`,
    `modèle     : ${base ? `${base.piece_label_fr} ${base.size_id}` : 'aucun'}`,
    `famille    : ${base?.family_id ?? 'n/a'}`,
    `shape      : ${shape?.id ?? 'n/a'}`,
    `cellules   : ${cells.length}`,
    `ancres     : ${shape?.anchors?.length ?? 0}`,
    `ops forme  : ${shape?.generation?.operations?.length ?? 0}`,
    `catalog    : ${state.selectedCatalogPieceId ?? 'n/a'}`,
    state.message ? `message    : ${state.message}` : '',
  ].filter(Boolean).join('\n'));
}

function renderValidationReport() {
  const report = validateCatalog();
  const shapeReport = validateSelectedShape();
  const shape = selectedShape();
  const lines = [];
  lines.push(`État variante : ${shape?.status ?? 'n/a'}`);
  lines.push('');
  lines.push('Workflow : draft → checked → validated');
  lines.push('Enregistrer brouillon : télécharge un JSON draft. Publier vers Assembly : écrit public/data/4x3x1_catalog.json via le serveur dev, sinon télécharge le JSON à remplacer.');
  lines.push('');
  lines.push(`Contrôle variante sélectionnée : ${shapeReport.errors.length} erreur(s), ${shapeReport.warnings.length} avertissement(s)`);
  for (const error of shapeReport.errors) lines.push(`- ERROR variante: ${error}`);
  for (const warning of shapeReport.warnings) lines.push(`- WARN variante: ${warning}`);
  lines.push('');
  lines.push(`Contrôle catalogue global : ${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s)`);
  for (const error of report.errors) lines.push(`- ERROR: ${error}`);
  for (const warning of report.warnings) lines.push(`- WARN: ${warning}`);
  if (!report.errors.length && !report.warnings.length && !shapeReport.errors.length && !shapeReport.warnings.length) lines.push('OK.');
  setElementText(dom.validationReport, lines.join('\n'));
}


function validateCatalog() {
  const errors = [];
  const warnings = [];
  const c = state.catalog;
  const r = state.repo;
  for (const piece of c.catalog_pieces ?? []) {
    const family = r.families.get(piece.family_id);
    const size = r.sizes.get(piece.size_id);
    const shape = r.shapes.get(piece.shape_variant_id);
    const spec = r.specs.get(piece.spec_profile_id);
    const recipe = piece.recipe_id ? r.recipes.get(piece.recipe_id) : null;
    if (!family) errors.push(`${piece.id}: family_id introuvable (${piece.family_id}).`);
    if (!size) errors.push(`${piece.id}: size_id introuvable (${piece.size_id}).`);
    if (!shape) errors.push(`${piece.id}: shape_variant_id introuvable (${piece.shape_variant_id}).`);
    if (!spec) errors.push(`${piece.id}: spec_profile_id introuvable (${piece.spec_profile_id}).`);
    if (piece.recipe_id && !recipe) errors.push(`${piece.id}: recipe_id introuvable (${piece.recipe_id}).`);
    if (shape && shape.size_id !== piece.size_id) errors.push(`${piece.id}: shape.size_id != piece.size_id.`);
    if (spec && spec.size_id !== piece.size_id) errors.push(`${piece.id}: spec.size_id != piece.size_id.`);
  }
  for (const shape of c.shape_variants ?? []) {
    const size = r.sizes.get(shape.size_id);
    if (!size) errors.push(`${shape.id}: size_id introuvable.`);
    if (!shape.generation?.mode) errors.push(`${shape.id}: generation.mode absent.`);
    if (shape.generation?.mode === 'legacy_mesh') warnings.push(`${shape.id}: legacy_mesh à convertir/corriger en voxel_grid ou opérations paramétriques.`);
    const cells = getShapeCells(shape, size);
    if (shape.generation?.mode === 'voxel_grid' && cells.length === 0) warnings.push(`${shape.id}: aucune cellule active.`);
    if (shape.generation?.mode === 'parametric_shape' && !['point_1', 'point_2', 'point_3'].includes(shape.generation?.base?.type)) errors.push(`${shape.id}: type paramétrique inconnu.`);
    for (const anchor of shape.anchors ?? []) {
      if (!anchor.position || !anchor.normal) errors.push(`${shape.id}/${anchor.id}: position ou normal absent.`);
    }
  }
  for (const recipe of c.recipes ?? []) {
    if (!r.specs.get(recipe.output_spec_profile_id)) errors.push(`${recipe.id}: output_spec_profile_id introuvable.`);
  }
  return { errors, warnings };
}

function validateSelectedShape() {
  const errors = [];
  const warnings = [];
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape) return { errors: ['Aucune variante sélectionnée.'], warnings };
  if (!size) errors.push(`${shape.id}: taille introuvable.`);
  ensureVoxelGeneration(shape);
  const cells = getShapeCells(shape, size);
  if (!cells.length) errors.push(`${shape.id}: aucune cellule active.`);
  for (const op of shape.generation.operations ?? []) {
    if (!['round', 'chamfer', 'slope', 'cut'].includes(op.type)) errors.push(`${shape.id}: opération inconnue ${op.type}.`);
    if (op.type === 'round' && Number(op.radius) !== 1) errors.push(`${shape.id}: arrondi avec rayon différent de 1.`);
    if (op.type === 'chamfer' && Number(op.size) !== 0.5) errors.push(`${shape.id}: chanfrein avec taille différente de 0.5.`);
    if (!op.scope?.kind) warnings.push(`${shape.id}: opération ${op.type} sans scope détaillé.`);
  }
  for (const anchor of shape.anchors ?? []) {
    if (!anchor.position || !anchor.face) errors.push(`${shape.id}/${anchor.id}: ancre sans position ou face.`);
    const p = anchor.position ?? {};
    const d = size?.dimensions;
    if (d && (p.x < 0 || p.y < 0 || p.z < 0 || p.x > d.length || p.y > d.width || p.z > d.height)) {
      errors.push(`${shape.id}/${anchor.id}: ancre hors volume.`);
    }
  }
  const linkedPieces = (state.catalog.catalog_pieces ?? []).filter((piece) => piece.shape_variant_id === shape.id);
  if (!linkedPieces.length) warnings.push(`${shape.id}: aucune entrée catalogue ne référence cette variante.`);
  return { errors, warnings };
}

function getCatalogFileName(suffix = '') {
  const base = '4x3x1_catalog';
  return suffix ? `${base}.${suffix}.json` : `${base}.json`;
}

function downloadCatalogFile(filename = getCatalogFileName()) {
  const blob = new Blob([`${JSON.stringify(state.catalog, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function writeCatalogToProjectFile() {
  const response = await fetch(CATALOG_WRITE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.catalog),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return response.json();
}

function saveDraft() {
  const shape = selectedShape();
  if (shape) {
    shape.status = 'draft';
    markShapeDirty(shape, 'draft_saved');
  }
  downloadCatalogFile(getCatalogFileName('draft'));
  setMessage('Brouillon exporté en fichier JSON. Aucun stockage navigateur utilisé.');
  renderAll();
}

async function publishCatalogToAssembly() {
  const validation = validateCatalog(state.catalog);
  if (validation.errors.length) {
    setMessage(`Publication Assembly refusée : ${validation.errors.length} erreur(s) catalogue.`);
    renderValidationReport();
    return;
  }

  try {
    const result = await writeCatalogToProjectFile();
    setMessage(`Catalogue écrit dans ${result.path ?? 'public/data/4x3x1_catalog.json'} : ${state.catalog.catalog_pieces?.length ?? 0} entrée(s), ${state.catalog.shape_variants?.length ?? 0} variante(s). Recharge Assembly pour lire ce fichier.`);
  } catch (error) {
    downloadCatalogFile(getCatalogFileName('publish'));
    setMessage(`Écriture directe indisponible. Catalogue téléchargé : remplace public/data/4x3x1_catalog.json manuellement. Détail : ${error.message}`);
  }

  renderAll(false);
}

function controlSelectedShape() {
  const shape = selectedShape();
  if (!shape) return;
  const report = validateSelectedShape();
  if (report.errors.length) {
    shape.status = 'draft';
    setMessage(`Contrôle refusé : ${report.errors.length} erreur(s).`);
  } else {
    shape.status = 'checked';
    shape.metadata ??= {};
    shape.metadata.checked_at = new Date().toISOString();
    setMessage(`Contrôle OK : ${report.warnings.length} avertissement(s).`);
  }
  renderAll();
}

function validateSelectedShapeStatus() {
  const shape = selectedShape();
  if (!shape) return;
  const report = validateSelectedShape();
  if (report.errors.length) {
    shape.status = 'draft';
    setMessage(`Validation refusée : ${report.errors.length} erreur(s).`);
  } else {
    shape.status = 'validated';
    shape.metadata ??= {};
    shape.metadata.validated_at = new Date().toISOString();
    setMessage('Variante validée. Export catalogue pour écrire le JSON final.');
  }
  renderAll();
}

function renderAll(redrawPreview = true) {
  renderBaseModels();
  renderShapeSelect();
  renderCatalogPieceSelect();
  renderSelectedBaseSummary();
  renderShapeForm();
  renderOperations();
  renderAnchors();
  renderSpecProfileSelect();
  renderSpecEditor();
  renderRecipeSelect();
  renderRecipeEditor();
  renderValidationReport();
  renderStats();
  applyEditorUserPreferences();
  if (redrawPreview) renderPreview();
}

function setMessage(message) {
  state.message = message;
  renderSelectedBaseSummary();
  renderStats();
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCatalog() {
  downloadJson('spacecraft_rich_catalog.json', state.catalog);
}

function faceFromIntersection(intersection) {
  const normal = intersection.face?.normal?.clone();
  if (!normal) return 'top';
  normal.transformDirection(intersection.object.matrixWorld);
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) return normal.x < 0 ? 'left' : 'right';
  if (ay >= ax && ay >= az) return normal.y < 0 ? 'front' : 'back';
  return normal.z < 0 ? 'bottom' : 'top';
}

function pickVoxelFace(event) {
  if (!cellPickTargets.length) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cellPickTargets, false);
  if (!hits.length) return;
  const hit = hits[0];
  const cell = structuredClone(hit.object.userData.cell);
  const face = faceFromIntersection(hit);
  state.selectedFace = {
    cell,
    face,
    position: anchorPositionForCellFace(cell, face),
  };
  const shape = selectedShape();
  const existing = (shape?.anchors ?? []).find((anchor) => anchorMatchesSelectedFace(anchor));
  state.selectedAnchorId = existing?.id ?? null;
  setCellInputValues(cell);
  renderAnchors();
  renderPreview();
}

function selectVoxelFace(cell, face = state.selectedFace?.face ?? 'top') {
  const normalizedCell = {
    x: Math.floor(Number(cell.x)),
    y: Math.floor(Number(cell.y)),
    z: Math.floor(Number(cell.z)),
  };
  state.selectedFace = {
    cell: normalizedCell,
    face,
    position: anchorPositionForCellFace(normalizedCell, face),
  };
  const shape = selectedShape();
  const existing = (shape?.anchors ?? []).find((anchor) => anchorMatchesSelectedFace(anchor));
  state.selectedAnchorId = existing?.id ?? null;
  setCellInputValues(normalizedCell);
  renderAnchors();
  renderPreview();
}

function resolveInitialCursorSelection(cells) {
  const fromInputs = readCellInputValues();
  if (Number.isFinite(fromInputs.x) && Number.isFinite(fromInputs.y) && Number.isFinite(fromInputs.z) && hasVisibleCell(cells, fromInputs)) {
    const face = firstSelectableFaceForCell(cells, fromInputs, [state.selectedFace?.face].filter(Boolean));
    if (face) return { cell: fromInputs, face };
  }

  for (const cell of sortCellsForInitialFace(cells)) {
    const face = firstSelectableFaceForCell(cells, cell, ['top']);
    if (face) return { cell: { x: cell.x, y: cell.y, z: cell.z }, face };
  }

  return null;
}

function keyboardDirectionForEvent(event) {
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  const code = typeof event.code === 'string' ? event.code : '';
  for (const [direction, keys] of Object.entries(EDITOR_CELL_CURSOR_KEYS)) {
    if (keys.has(code) || keys.has(key)) return direction;
  }
  return null;
}

function cursorDeltaForFace(direction, face) {
  if (!direction) return null;

  if (face === 'front' || face === 'back') {
    return {
      forward: { x: 0, y: 0, z: 1 },
      backward: { x: 0, y: 0, z: -1 },
      left: { x: -1, y: 0, z: 0 },
      right: { x: 1, y: 0, z: 0 },
    }[direction] ?? null;
  }

  if (face === 'left' || face === 'right') {
    return {
      forward: { x: 0, y: 0, z: 1 },
      backward: { x: 0, y: 0, z: -1 },
      left: { x: 0, y: -1, z: 0 },
      right: { x: 0, y: 1, z: 0 },
    }[direction] ?? null;
  }

  return {
    forward: { x: 1, y: 0, z: 0 },
    backward: { x: -1, y: 0, z: 0 },
    left: { x: 0, y: -1, z: 0 },
    right: { x: 0, y: 1, z: 0 },
  }[direction] ?? null;
}

function resolveNextFaceSelection(cells, selectedFace, direction) {
  if (!selectedFace) return null;
  const delta = cursorDeltaForFace(direction, selectedFace.face);
  if (!delta) return null;

  const currentCell = selectedFace.cell;
  const sameFaceCandidate = addCellVectors(currentCell, delta);
  if (isSelectableCellFace(cells, sameFaceCandidate, selectedFace.face)) {
    return { cell: sameFaceCandidate, face: selectedFace.face };
  }

  const edgeFace = faceForCellDelta(delta);
  if (edgeFace && isSelectableCellFace(cells, currentCell, edgeFace)) {
    return { cell: { ...currentCell }, face: edgeFace };
  }

  const currentNormal = getNormalForFace(selectedFace.face);
  const stepUpCandidate = addCellVectors(addCellVectors(currentCell, delta), currentNormal);
  const stepUpFace = edgeFace ? oppositeFace(edgeFace) : null;
  if (stepUpFace && isSelectableCellFace(cells, stepUpCandidate, stepUpFace)) {
    return { cell: stepUpCandidate, face: stepUpFace };
  }

  return null;
}

function moveSelectedFaceCursor(direction) {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size) return false;
  ensureVoxelGeneration(shape);
  const visibleCells = getVisibleShapeCells(shape, size);
  if (!visibleCells.length) return false;

  if (!state.selectedFace || !isSelectableCellFace(visibleCells, state.selectedFace.cell, state.selectedFace.face)) {
    const initialSelection = resolveInitialCursorSelection(visibleCells);
    if (!initialSelection) return false;
    selectVoxelFace(initialSelection.cell, initialSelection.face);
    return true;
  }

  const nextSelection = resolveNextFaceSelection(visibleCells, state.selectedFace, direction);
  if (!nextSelection) return false;
  selectVoxelFace(nextSelection.cell, nextSelection.face);
  return true;
}

function isEditorTextInputTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || Boolean(target?.isContentEditable);
}

function isAnchorToggleKey(event) {
  return EDITOR_ANCHOR_TOGGLE_KEYS.has(event.code) || EDITOR_ANCHOR_TOGGLE_KEYS.has(event.key);
}

function bindEditorCellKeyboardNavigation() {
  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && dom.baseReferenceModal?.classList.contains('open')) {
      closeBaseReferenceModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape' && dom.variantCreationModal?.classList.contains('open')) {
      closeVariantCreationModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape' && dom.editorUserConfigModal?.classList.contains('open')) {
      setEditorUserConfigModalOpen(false);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (dom.editorUserConfigModal?.classList.contains('open')
      || dom.baseReferenceModal?.classList.contains('open')
      || dom.variantCreationModal?.classList.contains('open')) return;
    if (event.ctrlKey || event.altKey || event.metaKey || isEditorTextInputTarget(event.target)) return;

    if (isAnchorToggleKey(event)) {
      if (toggleAnchorOnSelectedFace()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    const direction = keyboardDirectionForEvent(event);
    if (!direction) return;
    if (moveSelectedFaceCursor(direction)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener('keydown', handleKeyDown, { capture: true });
}

function bindFacePicking() {
  renderer.domElement.addEventListener('pointerdown', (event) => {
    renderer.domElement.focus({ preventScroll: true });
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.button !== 0 || !pointerDown) return;
    const dx = Math.abs(event.clientX - pointerDown.x);
    const dy = Math.abs(event.clientY - pointerDown.y);
    pointerDown = null;
    if (dx <= 5 && dy <= 5) pickVoxelFace(event);
  });
}

function bindEvents() {
  bindElement(dom.openEditorUserConfigBtn, 'click', () => setEditorUserConfigModalOpen(true));
  bindElement(dom.closeEditorUserConfigBtn, 'click', () => setEditorUserConfigModalOpen(false));
  bindElement(dom.cancelEditorUserConfigBtn, 'click', () => setEditorUserConfigModalOpen(false));
  bindElement(dom.resetEditorUserConfigBtn, 'click', resetEditorUserConfigForm);
  bindElement(dom.saveEditorUserConfigBtn, 'click', saveEditorUserConfigForm);
  bindElement(dom.editorShowDeleteButtonsToggle, 'change', persistEditorDeleteButtonPreference);
  bindElement(dom.editorUserConfigModal, 'click', (event) => {
    if (event.target === dom.editorUserConfigModal) setEditorUserConfigModalOpen(false);
  });

  bindElement(dom.shapeVariantSelect, 'change', () => {
    state.selectedShapeId = dom.shapeVariantSelect.value;
    state.selectedFace = null;
    const piece = findCatalogPiecesForBase().find((item) => item.shape_variant_id === state.selectedShapeId);
    if (piece) state.selectedCatalogPieceId = piece.id;
    renderAll();
  });
  bindElement(dom.catalogPieceSelect, 'change', () => {
    state.selectedCatalogPieceId = dom.catalogPieceSelect.value;
    state.selectedFace = null;
    const piece = selectedPiece();
    if (piece) state.selectedShapeId = piece.shape_variant_id;
    renderAll();
  });
  bindElement(dom.createVariantBtn, 'click', createVariantFromBase);
  bindElement(dom.duplicateVariantBtn, 'click', duplicateVariant);
  bindElement(dom.deleteVariantBtn, 'click', deleteVariant);
  bindElement(dom.createCatalogPieceBtn, 'click', createCatalogPiece);
  bindElement(dom.deleteCatalogPieceBtn, 'click', deleteCatalogPiece);
  bindElement(dom.resetPreviewBtn, 'click', resetPreview);
  bindElement(dom.fitPreviewBtn, 'click', fitPreview);
  bindElement(dom.exportCatalogBtn, 'click', exportCatalog);
  bindElement(dom.saveDraftBtn, 'click', saveDraft);
  bindElement(dom.publishAssemblyCatalogBtn, 'click', publishCatalogToAssembly);
  bindElement(dom.controlShapeBtn, 'click', controlSelectedShape);
  bindElement(dom.validateShapeBtn, 'click', validateSelectedShapeStatus);

  bindElement(dom.shapeLabelInput, 'change', updateShapeIdentity);
  bindElement(dom.shapeFamilyInput, 'change', updateShapeIdentity);
  bindElement(dom.shapeStatusSelect, 'change', updateShapeIdentity);
  bindElement(dom.addCellBtn, 'click', () => setCell(true));
  bindElement(dom.removeCellBtn, 'click', () => setCell(false));
  bindElement(dom.resetFullBoxBtn, 'click', resetFullBox);
  bindElement(dom.clearCellsBtn, 'click', clearCells);
  bindElement(dom.roundFaceBtn, 'click', () => createOperationFromSelectedFace('round'));
  bindElement(dom.chamferFaceBtn, 'click', () => createOperationFromSelectedFace('chamfer'));
  bindElement(dom.deleteFaceOperationBtn, 'click', removeFaceOperation);
  bindElement(dom.operationListSelect, 'change', () => { state.selectedOperationIndex = Number(dom.operationListSelect?.value ?? -1); renderOperations(); });

  bindElement(dom.addAnchorBtn, 'click', addAnchor);
  bindElement(dom.deleteAnchorBtn, 'click', deleteAnchor);
  bindElement(dom.anchorListSelect, 'change', () => fillAnchorForm(dom.anchorListSelect?.value));

  bindElement(dom.specProfileSelect, 'change', renderSpecEditor);
  bindElement(dom.recipeSelect, 'change', renderRecipeEditor);
  bindElement(dom.closeBaseReferenceModalBtn, 'click', closeBaseReferenceModal);
  bindElement(dom.baseReferenceModal, 'click', (event) => { if (event.target === dom.baseReferenceModal) closeBaseReferenceModal(); });
  bindElement(dom.createBaseReferenceBtn, 'click', createBaseReferenceFromModal);
  bindElement(dom.closeVariantCreationModalBtn, 'click', closeVariantCreationModal);
  bindElement(dom.variantCreationModal, 'click', (event) => { if (event.target === dom.variantCreationModal) closeVariantCreationModal(); });
  bindElement(dom.newVariantFamilySelect, 'change', () => {
    const familyId = dom.newVariantFamilySelect?.value;
    const nextSizeId = getBaseGroupByFamilyId(familyId)?.sizes?.[0] ?? '';
    fillVariantCreationSelectors(familyId, nextSizeId);
    setElementText(dom.variantCreationModalContext, `${getFamilyLabel(familyId)}\n${nextSizeId}\nCréer une nouvelle variante.`);
    state.variantModalSelection = getAvailableVariantIndexes(familyId, nextSizeId)[0] ?? null;
    renderVariantIconGrid();
  });
  bindElement(dom.newVariantSizeSelect, 'change', () => {
    const familyId = dom.newVariantFamilySelect?.value;
    const sizeId = dom.newVariantSizeSelect?.value;
    setElementText(dom.variantCreationModalContext, `${getFamilyLabel(familyId)}\n${sizeId}\nCréer une nouvelle variante.`);
    state.variantModalSelection = getAvailableVariantIndexes(familyId, sizeId)[0] ?? null;
    renderVariantIconGrid();
  });
  bindElement(dom.createVariantFromModalBtn, 'click', createVariantFromModal);
  bindElement(dom.closeSpecModalBtn, 'click', closeSpecModal);
  bindElement(dom.closeRecipeModalBtn, 'click', closeRecipeModal);
  bindElement(dom.specModal, 'click', (event) => { if (event.target === dom.specModal) closeSpecModal(); });
  bindElement(dom.recipeModal, 'click', (event) => { if (event.target === dom.recipeModal) closeRecipeModal(); });

  for (const button of document.querySelectorAll('.tab-button')) {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#${button.dataset.tab}`)?.classList.add('active');
    });
  }

  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
  bindFacePicking();
  bindEditorCellKeyboardNavigation();
}

function migrateLegacyShapesForEditor() {
  for (const shape of state.catalog.shape_variants ?? []) {
    if (shape.generation?.mode === 'legacy_mesh') ensureVoxelGeneration(shape);
  }
}

function resize() {
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  const expectedWidth = Math.floor(width * renderer.getPixelRatio());
  const expectedHeight = Math.floor(height * renderer.getPixelRatio());
  if (dom.canvas.width !== expectedWidth || dom.canvas.height !== expectedHeight) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  orbit.update();
  renderer.render(scene, camera);
}

async function init() {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`Impossible de charger ${CATALOG_URL}`);
  state.catalog = await response.json();
  if (!Array.isArray(state.catalog.catalog_pieces)) throw new Error('Catalogue riche requis : catalog_pieces absent.');
  rebuildRepo();
  migrateLegacyShapesForEditor();
  rebuildRepo();
  ensureEditorUserConfigUi();
  applyEditorUserPreferences();
  const firstGroup = getBaseGroups()[0];
  selectBaseModel(firstGroup, firstGroup.sizes[0]);
  bindEvents();
  mountEditorNavigationCube();
  animate();
}

init().catch((error) => {
  console.error(error);
  setElementText(dom.stats, String(error.message || error));
});
