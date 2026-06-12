import './style.css';
import 'remixicon/fonts/remixicon.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { catalogAnchorToWorld } from './3d/core/anchors.js';
import { createCatalogLookup } from './3d/core/catalogLookup.js';
import { catalogCellCenterVector, createCatalogReservationBox } from './3d/core/bounds.js';
import { buildShapeGeometry, catalogPointVector } from './3d/core/meshGeneration.js';
import { getRenderableEditorAnchors } from './3d/editor/editorAnchors.js';
import {
  deriveAdvancedModePreviewSummary,
  EDITOR_MODES,
  isEditorAdvancedMode,
  normalizeEditorMode,
  switchEditorModeState,
} from './3d/editor/editorMode.js';
import {
  createEdgeChamferOperation,
  createEdgeFilletOperation,
  deriveEditableBBoxEdges,
  normalizeEdgeCorrectionOperations,
  selectEditableEdge,
  upsertEdgeCorrection,
  validateEdgeChamferOperation,
  validateEdgeCorrectionExclusivity,
  validateEdgeFilletOperation,
} from './3d/editor/editorGeometryEdges.js';
import { generateEditorPointGrid, summarizeEditorPointGrid } from './3d/editor/editorPointGrid.js';
import {
  clearAdvancedPointSelection,
  selectAdvancedPoint,
  summarizeAdvancedPointSelection,
} from './3d/editor/editorPointSelection.js';
import {
  createAdvancedDraftEdge,
  createAdvancedDraftEdgesFromSelection,
  getAdvancedDraftEdgesForShape,
  normalizeAdvancedEdgeSelection,
  removeAdvancedDraftEdgesById,
  selectAdvancedEdge,
} from './3d/editor/editorEdges.js';
import {
  createAdvancedDraftFace,
  getAdvancedDraftFacesForShape,
  removeInvalidDraftFaces,
} from './3d/editor/editorFaces.js';
import {
  createCustomFaceOperation,
  getCustomFaceOperations,
  removeCustomFaceOperationById,
  validateCustomFaceOperation,
} from './3d/editor/editorCustomFaceOperations.js';
import {
  createCutOperation,
  getCutOperations,
  validateCutOperation,
} from './3d/editor/editorCutOperations.js';
import { deriveEditorPreviewState } from './3d/editor/editorSimpleMode.js';
import { createEditorFitPreviewPlan, getEditorPreviewTargetZ } from './3d/editor/editorViewport.js';
import {
  getEditorAvailableVariantIndexes,
  getEditorCatalogPiecesForBase,
  getEditorRecipesForBase,
  getEditorShapesForBase,
  getEditorSpecsForBase,
  shapeBelongsToEditorBase,
} from './3d/editor/variantSelection.js';
import { compileEditorCatalog } from './3d/editor/editorShapeCompiler.js';
import { createNavigationCubeOverlay } from './navigation-cube-overlay.js';
import { NAVIGATION_CUBE_VIEW_IDS, createNavigationCubeViewApi } from './navigation-cube.js';
import { resolveRuntimePath } from './runtime-paths.js';
import { createEditorViewController } from './view-controller.js';
import { createEditorInteractionController } from './editor-interaction-controller.js';
import { createEmptyEditorSelectionState, getEditorContextActions, getPrimitiveKey } from './editor-interaction-state.js';
import {
  createEditorCatalogAutosaveController,
  loadPendingEditorCatalogBackup,
} from './editor-catalog-persistence.js';
import { buildAssemblyCatalogFromEditorCatalog } from './assembly-catalog-publication.js';
import { validateCatalogData, formatValidationIssues } from './catalog-validator.js';
import { loadUserSettings } from './user-settings.js';

const EDITOR_CATALOG_URL = resolveRuntimePath('data/editor_catalog.json');
const ASSEMBLY_CATALOG_URL = resolveRuntimePath('data/assembly_catalog.json');
const EDITOR_CATALOG_WRITE_URL = '/api/editor-catalog/write';
const ASSEMBLY_CATALOG_WRITE_URL = '/api/assembly-catalog/write';
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
const EDITOR_SUBGRID_DEFAULT_STEP = 0.5;
const ADVANCED_PIECE_DISPLAY_MODES = {
  PIECE: 'piece',
  POINTS: 'points',
};
const EDITOR_CAMERA_SETTINGS = loadUserSettings().camera;

const state = {
  catalog: null,
  repo: null,
  editorMode: EDITOR_MODES.ADVANCED,
  selectedBase: null,
  selectedShapeId: null,
  selectedCatalogPieceId: null,
  selectedAnchorId: null,
  selectedFace: null,
  selectedOperationIndex: null,
  selectedAdvancedPointIds: [],
  selectedAdvancedEdgeIds: [],
  selectedEditableEdgeIds: [],
  selectedEditableEdgeShapeId: null,
  selectedAdvancedDraftFaceId: null,
  selectedAdvancedCustomFaceOperationId: null,
  advancedDraftOperationType: 'custom_face',
  advancedCutKeepSide: 'normal',
  advancedDraftEdgesByShapeId: {},
  advancedDraftFacesByShapeId: {},
  advancedPieceDisplayMode: ADVANCED_PIECE_DISPLAY_MODES.PIECE,
  message: '',
  activeViewId: NAVIGATION_CUBE_VIEW_IDS.home,
  editorUserPreferences: loadEditorUserPreferences(),
  baseReferenceFamilyId: null,
  variantModalSelection: null,
  editorSave: {
    dirty: false,
    saving: false,
    lastSavedAt: null,
    lastError: null,
    autosaveTimer: null,
  },
};

const dom = {
  editorAdvancedModePanel: document.querySelector('#editorAdvancedModePanel'),
  editorAdvancedControls: document.querySelector('#editorAdvancedControls'),
  editorAdvancedModeSummary: document.querySelector('#editorAdvancedModeSummary'),
  editableEdgeSelectionSummary: document.querySelector('#editableEdgeSelectionSummary'),
  chamferSelectedEdgesBtn: document.querySelector('#chamferSelectedEdgesBtn'),
  filletSelectedEdgesBtn: document.querySelector('#filletSelectedEdgesBtn'),
  clearEditableEdgeSelectionBtn: document.querySelector('#clearEditableEdgeSelectionBtn'),
  advancedPieceDisplayPieceInput: document.querySelector('#advancedPieceDisplayPieceInput'),
  advancedPieceDisplayPointsInput: document.querySelector('#advancedPieceDisplayPointsInput'),
  advancedDraftFaceListSelect: document.querySelector('#advancedDraftFaceListSelect'),
  advancedDraftOperationCustomFaceInput: document.querySelector('#advancedDraftOperationCustomFaceInput'),
  advancedDraftOperationCutInput: document.querySelector('#advancedDraftOperationCutInput'),
  advancedCutKeepNormalInput: document.querySelector('#advancedCutKeepNormalInput'),
  advancedCutKeepInverseInput: document.querySelector('#advancedCutKeepInverseInput'),
  commitAdvancedDraftFaceBtn: document.querySelector('#commitAdvancedDraftFaceBtn'),
  deleteAdvancedDraftFaceBtn: document.querySelector('#deleteAdvancedDraftFaceBtn'),
  advancedCustomFaceOperationListSelect: document.querySelector('#advancedCustomFaceOperationListSelect'),
  deleteAdvancedCustomFaceOperationBtn: document.querySelector('#deleteAdvancedCustomFaceOperationBtn'),
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
  editorGeometryContextMenu: document.querySelector('#editorGeometryContextMenu'),
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

function getCurrentEditorMode() {
  return normalizeEditorMode(state.editorMode);
}

function editorIsAdvancedMode() {
  return isEditorAdvancedMode(getCurrentEditorMode());
}

function getAdvancedPieceDisplayMode() {
  return state.advancedPieceDisplayMode === ADVANCED_PIECE_DISPLAY_MODES.POINTS
    ? ADVANCED_PIECE_DISPLAY_MODES.POINTS
    : ADVANCED_PIECE_DISPLAY_MODES.PIECE;
}

function advancedPieceDisplayIsPoints() {
  return editorIsAdvancedMode() && getAdvancedPieceDisplayMode() === ADVANCED_PIECE_DISPLAY_MODES.POINTS;
}

function setEditorMode(mode) {
  const previousMode = getCurrentEditorMode();
  Object.assign(state, switchEditorModeState(state, mode));
  if (previousMode !== getCurrentEditorMode() && previousMode === EDITOR_MODES.ADVANCED) {
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
  }
}

function resetAdvancedPointSelection() {
  state.selectedAdvancedPointIds = clearAdvancedPointSelection();
}

function applyAdvancedPointSelection(pointId, options = {}) {
  state.selectedAdvancedPointIds = selectAdvancedPoint(pointId, state.selectedAdvancedPointIds, options);
}

function resetAdvancedEdgeSelection() {
  state.selectedAdvancedEdgeIds = [];
}

function applyAdvancedEdgeSelection(edgeId, options = {}) {
  state.selectedAdvancedEdgeIds = selectAdvancedEdge(edgeId, state.selectedAdvancedEdgeIds, options);
}

function resetEditableEdgeSelection() {
  state.selectedEditableEdgeIds = [];
}

function applyEditableEdgeSelection(edgeId, options = {}) {
  state.selectedEditableEdgeIds = selectEditableEdge(edgeId, state.selectedEditableEdgeIds, options);
}

function getEditableEdgesForShape(shape = selectedShape()) {
  const size = getSize(shape?.size_id);
  return deriveEditableBBoxEdges(size);
}

function getActiveAdvancedDraftEdges() {
  return getAdvancedDraftEdgesForShape(state.advancedDraftEdgesByShapeId, state.selectedShapeId);
}

function setActiveAdvancedDraftEdges(edges) {
  if (!state.selectedShapeId) return;
  state.advancedDraftEdgesByShapeId[state.selectedShapeId] = edges;
}

function getActiveAdvancedDraftFaces() {
  return getAdvancedDraftFacesForShape(state.advancedDraftFacesByShapeId, state.selectedShapeId);
}

function setActiveAdvancedDraftFaces(faces) {
  if (!state.selectedShapeId) return;
  state.advancedDraftFacesByShapeId[state.selectedShapeId] = faces;
}

function getSelectedAdvancedDraftFace() {
  return getActiveAdvancedDraftFaces().find((face) => face.id === state.selectedAdvancedDraftFaceId) ?? null;
}

function getSelectedAdvancedCustomFaceOperation() {
  const shape = selectedShape();
  return getAdvancedPlanarOperations(shape?.generation?.operations ?? [])
    .find((operation) => operation.id === state.selectedAdvancedCustomFaceOperationId) ?? null;
}

function getAdvancedDraftOperationType() {
  return state.advancedDraftOperationType === 'cut' ? 'cut' : 'custom_face';
}

function getAdvancedCutKeepSide() {
  return state.advancedCutKeepSide === 'inverse' ? 'inverse' : 'normal';
}

function getAdvancedPlanarOperations(operations = []) {
  return [
    ...getCustomFaceOperations(operations),
    ...getCutOperations(operations),
  ];
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
  const protectedControls = document.querySelectorAll([
    '.catalog-tree-size-delete-btn',
    '.catalog-tree-variant-delete-btn',
    '.editor-variant-primary-edit-btn',
  ].join(','));
  for (const control of protectedControls) {
    control.hidden = !showDeleteButtons;
    control.style.display = showDeleteButtons ? '' : 'none';
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
let editorInteractionController = null;

const root = new THREE.Group();
scene.add(root);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cellPickTargets = [];
const advancedPointPickTargets = [];
const advancedEdgePickTargets = [];
const editableEdgePickTargets = [];
const shapeSnapshots = new Map();
let editorCatalogAutosave = null;

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

function rebuildRepo() {
  const lookup = createCatalogLookup(state.catalog);
  state.repo = {
    sizes: lookup.sizes,
    families: lookup.families,
    shapes: lookup.shapeVariants,
    specs: lookup.specProfiles,
    recipes: lookup.recipes,
    pieces: lookup.catalogPieces,
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

function normalizeVariantStatus(status) {
  return status === 'validated' ? 'validated' : 'draft';
}

function isProtectedStandardVariantShape(shape = selectedShape()) {
  const index = Number(shape?.variant_index);
  return index === 0 || index === 1;
}

function isPrimaryVariantShape(shape = selectedShape()) {
  return isProtectedStandardVariantShape(shape);
}

function isVariantEditingLocked(shape = selectedShape()) {
  if (!shape) return false;
  if (isProtectedStandardVariantShape(shape) && shape?.metadata?.editor_variant_locked === undefined) return true;
  return Boolean(shape?.metadata?.editor_variant_locked);
}

function setVariantEditingLocked(shape, locked) {
  if (!shape) return;
  shape.metadata ??= {};
  shape.metadata.editor_variant_locked = Boolean(locked);
  shape.metadata.updated_at = new Date().toISOString();
}

function ensureVariantEditable(actionLabel = 'Modification refusée') {
  const shape = selectedShape();
  if (!shape) return false;
  if (!isVariantEditingLocked(shape)) return true;
  setMessage(`${actionLabel} : variante verrouillée.`);
  return false;
}

function storeShapeSnapshot(shapeId = state.selectedShapeId) {
  const shape = getShape(shapeId);
  if (!shape) return;
  shapeSnapshots.set(shapeId, structuredClone(shape));
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
    familyDetails.className = 'tree-family catalog-tree-family';
    familyDetails.open = state.selectedBase?.family_id === group.family_id || group === groups[0];

    const familySummary = document.createElement('summary');
    familySummary.className = 'tree-family-summary catalog-tree-family-summary';
    const familyTitle = document.createElement('span');
    familyTitle.className = 'tree-family-title catalog-tree-family-title';
    familyTitle.textContent = group.label_fr;
    const addBaseBtn = document.createElement('button');
    addBaseBtn.type = 'button';
    addBaseBtn.className = 'tree-family-add-action catalog-tree-action catalog-tree-family-add-btn';
    addBaseBtn.textContent = '[+]';
    addBaseBtn.title = `Créer une référence dans ${group.label_fr}`;
    addBaseBtn.dataset.treeAction = 'create-size-reference';
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
      sizeDetails.className = 'tree-size catalog-tree-size';
      sizeDetails.open = isBaseActive;

      const sizeSummary = document.createElement('summary');
      sizeSummary.className = `catalog-tree-size-summary${isBaseActive ? ' active' : ''}`;

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'tree-node-button catalog-tree-size-select-btn';
      selectBtn.textContent = `${group.piece_label_fr} ${sizeId}`;
      selectBtn.dataset.treeAction = 'select-size';
      selectBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId);
      });

      const sizeActionGroup = document.createElement('div');
      sizeActionGroup.className = 'catalog-tree-size-actions';

      const specBtn = document.createElement('button');
      specBtn.type = 'button';
      specBtn.className = 'tree-mini-action tree-mini-icon-action catalog-tree-action catalog-tree-size-spec-btn';
      specBtn.title = 'Ouvrir les specs du modèle';
      specBtn.setAttribute('aria-label', 'Ouvrir les specs du modèle');
      specBtn.innerHTML = '<i class="ri-article-line" aria-hidden="true"></i>';
      specBtn.dataset.treeAction = 'open-size-specs';
      specBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId, { keepView: true });
        openSpecModal();
      });

      const recipeBtn = document.createElement('button');
      recipeBtn.type = 'button';
      recipeBtn.className = 'tree-mini-action tree-mini-icon-action catalog-tree-action catalog-tree-size-recipe-btn';
      recipeBtn.title = 'Ouvrir la recette du modèle';
      recipeBtn.setAttribute('aria-label', 'Ouvrir la recette du modèle');
      recipeBtn.innerHTML = '<i class="ri-survey-line" aria-hidden="true"></i>';
      recipeBtn.dataset.treeAction = 'open-size-recipes';
      recipeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectBaseModel(group, sizeId, { keepView: true });
        openRecipeModal();
      });

      const createVariantBtn = document.createElement('button');
      createVariantBtn.type = 'button';
      createVariantBtn.className = 'tree-mini-action tree-mini-icon-action catalog-tree-action catalog-tree-size-create-variant-btn';
      createVariantBtn.title = 'Créer une variante';
      createVariantBtn.setAttribute('aria-label', 'Créer une variante');
      createVariantBtn.innerHTML = '<i class="ri-timeline-view" aria-hidden="true"></i>';
      createVariantBtn.dataset.treeAction = 'create-variant';
      createVariantBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openVariantCreationModal(group.family_id, sizeId);
      });

      const deleteRootBtn = document.createElement('button');
      deleteRootBtn.type = 'button';
      deleteRootBtn.className = 'tree-mini-action tree-mini-icon-action danger editor-delete-button editor-root-delete-btn catalog-tree-action catalog-tree-size-delete-btn';
      deleteRootBtn.title = `Supprimer l'entrée catalogue ${group.piece_label_fr} ${sizeId}`;
      deleteRootBtn.setAttribute('aria-label', `Supprimer l'entrée catalogue ${group.piece_label_fr} ${sizeId}`);
      deleteRootBtn.innerHTML = '<i class="ri-delete-bin-line" aria-hidden="true"></i>';
      deleteRootBtn.dataset.editorDeleteAction = 'delete-root-piece';
      deleteRootBtn.dataset.treeAction = 'delete-size-reference';
      deleteRootBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteBaseReferenceByFamilyAndSize(group.family_id, sizeId);
      });

      sizeActionGroup.append(specBtn, recipeBtn, createVariantBtn, deleteRootBtn);
      sizeSummary.append(selectBtn, sizeActionGroup);
      sizeDetails.append(sizeSummary);

      const variants = document.createElement('div');
      variants.className = 'tree-variants catalog-tree-variants';
      for (const shape of findShapesForBase(group.family_id, sizeId)) {
        const variantRow = document.createElement('div');
        variantRow.className = 'tree-variant-row catalog-tree-variant-row';
        const variantLocked = isVariantEditingLocked(shape);
        const isProtectedStandardVariant = isProtectedStandardVariantShape(shape);

        const variantActionGroup = document.createElement('div');
        variantActionGroup.className = 'catalog-tree-variant-actions';

        const variantLockBtn = document.createElement('button');
        variantLockBtn.type = 'button';
        variantLockBtn.className = `tree-mini-action tree-mini-icon-action tree-variant-lock-btn catalog-tree-action catalog-tree-variant-lock-btn${variantLocked ? ' is-locked' : ''}${isProtectedStandardVariant ? ' editor-variant-primary-edit-btn' : ''}`;
        variantLockBtn.title = variantLocked
          ? (isProtectedStandardVariant
            ? 'Variante de base verrouillée par défaut : overlay masqué, édition désactivée'
            : 'Variante verrouillée : édition désactivée')
          : 'Variante modifiable : édition autorisée';
        variantLockBtn.setAttribute('aria-label', variantLocked ? 'Variante verrouillée' : 'Variante modifiable');
        variantLockBtn.innerHTML = variantLocked
          ? '<i class="ri-file-lock-line" aria-hidden="true"></i>'
          : '<i class="ri-file-line" aria-hidden="true"></i>';
        variantLockBtn.dataset.treeAction = 'toggle-variant-lock';
        variantLockBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setVariantEditingLocked(shape, !variantLocked);
          if (state.selectedShapeId !== shape.id) state.selectedShapeId = shape.id;
          afterEditorCatalogMutation('variant_lock_toggled', { redrawPreview: false });
        });

        const variant = document.createElement('button');
        variant.type = 'button';
        variant.className = 'tree-variant-button catalog-tree-variant-select-btn';
        if (isBaseActive && shape.id === state.selectedShapeId) variant.classList.add('active');
        const variantIconIndex = Number(shape?.metadata?.icon_index ?? shape?.variant_index);
        if (Number.isInteger(variantIconIndex) && variantIconIndex > 0) {
          const icon = document.createElement('img');
          icon.className = 'variant-icon tree-variant-icon';
          icon.alt = '';
          icon.setAttribute('aria-hidden', 'true');
          icon.src = resolveRuntimePath(`ui/shape-buttons/button_${pad2(variantIconIndex)}.png`);
          variant.append(icon);
        }
        const label = document.createElement('span');
        label.className = 'tree-variant-label';
        label.textContent = `↳ ${shape.label ?? shape.id}`;
        variant.append(label);
        variant.dataset.treeAction = 'select-variant';
        variant.addEventListener('click', () => {
          selectBaseModel(group, sizeId, { keepView: true });
          state.selectedShapeId = shape.id;
          const piece = findCatalogPiecesForBase().find((item) => item.shape_variant_id === shape.id);
          if (piece) state.selectedCatalogPieceId = piece.id;
          state.selectedFace = null;
          resetAdvancedPointSelection();
          resetAdvancedEdgeSelection();
          renderAll();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'tree-mini-action tree-mini-icon-action danger editor-delete-button editor-variant-delete-btn catalog-tree-action catalog-tree-variant-delete-btn';
        deleteBtn.title = `Supprimer la variante ${shape.label ?? shape.id}`;
        deleteBtn.setAttribute('aria-label', `Supprimer la variante ${shape.label ?? shape.id}`);
        deleteBtn.innerHTML = '<i class="ri-delete-bin-line" aria-hidden="true"></i>';
        deleteBtn.dataset.editorDeleteAction = 'delete-variant';
        deleteBtn.dataset.treeAction = 'delete-variant';
        deleteBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteVariantById(shape.id);
        });

        variantActionGroup.append(variantLockBtn, deleteBtn);
        variantRow.append(variant, variantActionGroup);
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
  resetAdvancedPointSelection();
  resetAdvancedEdgeSelection();
  if (shape?.id) storeShapeSnapshot(shape.id);

  renderAll();
  if (!options.keepView) fitPreview(false);
}

function findShapesForSize(sizeId = state.selectedBase?.size_id) {
  return (state.catalog.shape_variants ?? [])
    .filter((shape) => shape.size_id === sizeId)
    .sort((a, b) => (Number(a.variant_index) || 0) - (Number(b.variant_index) || 0) || a.id.localeCompare(b.id));
}

function shapeBelongsToBase(shape, familyId, sizeId) {
  return shapeBelongsToEditorBase(shape, familyId, sizeId);
}

function findCatalogPiecesForBase() {
  if (!state.selectedBase) return [];
  return (state.catalog.catalog_pieces ?? [])
    .filter((piece) => piece.family_id === state.selectedBase.family_id && piece.size_id === state.selectedBase.size_id)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
}

function findShapesForBase(familyId = state.selectedBase?.family_id, sizeId = state.selectedBase?.size_id) {
  return getEditorShapesForBase(state.catalog, familyId, sizeId);
}

function getCatalogPiecesForBase(familyId, sizeId) {
  return getEditorCatalogPiecesForBase(state.catalog, familyId, sizeId);
}

function getSpecsForBase(familyId, sizeId) {
  return getEditorSpecsForBase(state.catalog, familyId, sizeId);
}

function getRecipesForBase(familyId, sizeId) {
  return getEditorRecipesForBase(state.catalog, familyId, sizeId);
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
    `édition      : ${shape ? (isVariantEditingLocked(shape) ? 'verrouillée' : 'modifiable') : 'n/a'}`,
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

function normalizeShapeEdgeCorrections(shape = selectedShape()) {
  if (!shape?.generation) return false;
  const report = normalizeEdgeCorrectionOperations(shape.generation.operations ?? []);
  if (!report.changed) return false;
  shape.generation.operations = report.operations;
  markShapeDirty(shape, 'edge_correction_conflict_normalized');
  editorCatalogAutosave?.schedule('edge_correction_conflict_normalized');
  if (state.selectedOperationIndex !== null && state.selectedOperationIndex >= shape.generation.operations.length) {
    state.selectedOperationIndex = null;
  }
  return true;
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
  if (!ensureVariantEditable(enabled ? 'Ajout cellule refusé' : 'Suppression cellule refusée')) return;
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
  afterEditorCatalogMutation(enabled ? 'cell_added' : 'cell_removed');
}

function isCellInside(size, x, y, z) {
  const d = size?.dimensions;
  return d && x >= 0 && y >= 0 && z >= 0 && x < d.length && y < d.width && z < d.height;
}

function resetFullBox() {
  const shape = selectedShape();
  if (!shape) return;
  if (!ensureVariantEditable('Réinitialisation refusée')) return;
  ensureVoxelGeneration(shape);
  shape.generation.cells = fullCells(getSize(shape.size_id));
  markShapeDirty(shape, 'cells_reset_full_box');
  afterEditorCatalogMutation('cells_reset_full_box');
}

function clearCells() {
  const shape = selectedShape();
  if (!shape) return;
  if (!ensureVariantEditable('Vidage refusé')) return;
  ensureVoxelGeneration(shape);
  shape.generation.cells = [];
  markShapeDirty(shape, 'cells_cleared');
  afterEditorCatalogMutation('cells_cleared');
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
  state.selectedShapeId = id;
  storeShapeSnapshot(id);
  afterEditorCatalogMutation('shape_created', { message: `Variante créée : ${id} (${getVariantTypeLabel(variantType)}).` });
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
  state.selectedShapeId = id;
  storeShapeSnapshot(id);
  afterEditorCatalogMutation('shape_duplicated', { message: `Variante dupliquée : ${id}.` });
}

function deleteVariantById(shapeId = state.selectedShapeId) {
  const shape = getShape(shapeId);
  if (!shape) return;
  const linkedPieces = (state.catalog.catalog_pieces ?? []).filter((piece) => piece.shape_variant_id === shape.id);
  removeCatalogPiecesByIds(linkedPieces.map((piece) => piece.id));
  removeShapesByIds([shape.id]);
  if (state.selectedShapeId === shape.id) {
    state.selectedShapeId = findShapesForBase(state.selectedBase?.family_id, shape.size_id)[0]?.id ?? null;
  }
  if (state.selectedCatalogPieceId && !getPiece(state.selectedCatalogPieceId)) {
    state.selectedCatalogPieceId = findCatalogPiecesForBase()[0]?.id ?? null;
  }
  afterEditorCatalogMutation('shape_deleted', { message: `Variante supprimée : ${shape.id}.` });
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
  state.selectedCatalogPieceId = id;
  afterEditorCatalogMutation('catalog_piece_created', { message: `Entrée catalogue créée : ${id}.` });
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
  return piece;
}

function removeShapesByIds(shapeIds) {
  const ids = new Set(shapeIds);
  shapeIds.forEach((id) => shapeSnapshots.delete(id));
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

  if (state.selectedBase?.family_id === familyId && state.selectedBase?.size_id === sizeId) {
    state.selectedCatalogPieceId = null;
    state.selectedShapeId = null;
    state.selectedFace = null;
    const group = [getBaseGroupByFamilyId(familyId), ...getBaseGroups()].find((item) => item?.sizes?.length) ?? null;
    const fallbackSizeId = group?.sizes?.[0] ?? null;
    if (group && fallbackSizeId) {
      rebuildRepo();
      selectBaseModel(group, fallbackSizeId, { keepView: true });
      afterEditorCatalogMutation('base_reference_deleted', { message: `Référence supprimée : ${getFamilyLabel(familyId)} ${sizeId}.` });
      return true;
    }
    state.selectedBase = null;
  }

  afterEditorCatalogMutation('base_reference_deleted', { message: `Référence supprimée : ${getFamilyLabel(familyId)} ${sizeId}.` });
  return true;
}

function deleteCatalogPieceById(pieceId = state.selectedCatalogPieceId) {
  const piece = getPiece(pieceId);
  if (!piece) return;
  removeCatalogPiecesByIds([piece.id]);
  const remainingPieces = (state.catalog.catalog_pieces ?? [])
    .filter((item) => item.family_id === piece.family_id && item.size_id === piece.size_id)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
  state.selectedCatalogPieceId = remainingPieces[0]?.id ?? null;
  if (state.selectedCatalogPieceId) {
    state.selectedShapeId = getPiece(state.selectedCatalogPieceId)?.shape_variant_id ?? state.selectedShapeId;
  } else if (state.selectedShapeId === piece.shape_variant_id) {
    state.selectedShapeId = findShapesForBase(piece.family_id, piece.size_id)[0]?.id ?? null;
  }
  afterEditorCatalogMutation('catalog_piece_deleted', { message: `Entrée catalogue supprimée : ${piece.id}.` });
}

function deleteCatalogPiece() {
  deleteCatalogPieceById(state.selectedCatalogPieceId);
}

function renderShapeForm() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  const locked = isVariantEditingLocked(shape);
  if (dom.shapeIdInput) dom.shapeIdInput.value = shape?.id ?? '';
  if (dom.shapeLabelInput) dom.shapeLabelInput.value = shape?.label ?? '';
  if (dom.shapeFamilyInput) dom.shapeFamilyInput.value = shape?.shape_family ?? '';
  if (dom.shapeStatusSelect) dom.shapeStatusSelect.value = normalizeVariantStatus(shape?.status);
  if (dom.shapeLabelInput) dom.shapeLabelInput.disabled = locked;
  if (dom.shapeFamilyInput) dom.shapeFamilyInput.disabled = locked;
  if (dom.shapeStatusSelect) dom.shapeStatusSelect.disabled = locked;
  if (!dom.cellSummary) return;
  const cells = shape ? getShapeCells(shape, size) : [];
  setElementText(dom.cellSummary, shape ? [
    `taille       : ${shape.size_id}`,
    `dimensions   : ${size?.dimensions?.length ?? '?'}×${size?.dimensions?.width ?? '?'}×${size?.dimensions?.height ?? '?'}`,
    `cellules     : ${cells.length}`,
    `mode         : ${shape.generation?.mode ?? 'n/a'}`,
    `édition      : ${locked ? 'verrouillée' : 'modifiable'}`,
    isParametricShape(shape) ? `type global  : ${shape.generation?.base?.type ?? shape.shape_family}` : '',
    shape.generation?.mode !== 'voxel_grid' && !isParametricShape(shape) ? 'note         : converti en voxel_grid dès modification cellule' : '',
  ].filter(Boolean).join('\n') : 'Aucune variante sélectionnée.');
}

function renderEditorModeUi() {
  const shape = selectedShape();
  const locked = isVariantEditingLocked(shape);
  const hasShape = Boolean(shape);
  const size = getSize(shape?.size_id);
  const editableEdges = getEditableEdgesForShape(shape);
  const pointGridSummary = hasShape
    ? summarizeEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP)
    : null;
  const pointSelectionSummary = hasShape ? summarizeAdvancedPointSelection(state.selectedAdvancedPointIds) : null;
  if (state.selectedEditableEdgeShapeId !== (shape?.id ?? null)) {
    state.selectedEditableEdgeIds = [];
    state.selectedEditableEdgeShapeId = shape?.id ?? null;
  }
  const validEditableEdgeIds = new Set(editableEdges.map((edge) => edge.id));
  state.selectedEditableEdgeIds = state.selectedEditableEdgeIds.filter((edgeId) => validEditableEdgeIds.has(edgeId));
  if (dom.advancedPieceDisplayPieceInput) dom.advancedPieceDisplayPieceInput.checked = getAdvancedPieceDisplayMode() === ADVANCED_PIECE_DISPLAY_MODES.PIECE;
  if (dom.advancedPieceDisplayPointsInput) dom.advancedPieceDisplayPointsInput.checked = getAdvancedPieceDisplayMode() === ADVANCED_PIECE_DISPLAY_MODES.POINTS;
  if (dom.advancedPieceDisplayPieceInput) dom.advancedPieceDisplayPieceInput.disabled = !hasShape || locked;
  if (dom.advancedPieceDisplayPointsInput) dom.advancedPieceDisplayPointsInput.disabled = !hasShape || locked;
  if (dom.advancedDraftOperationCustomFaceInput) dom.advancedDraftOperationCustomFaceInput.checked = getAdvancedDraftOperationType() === 'custom_face';
  if (dom.advancedDraftOperationCutInput) dom.advancedDraftOperationCutInput.checked = getAdvancedDraftOperationType() === 'cut';
  if (dom.advancedCutKeepNormalInput) dom.advancedCutKeepNormalInput.checked = getAdvancedCutKeepSide() === 'normal';
  if (dom.advancedCutKeepInverseInput) dom.advancedCutKeepInverseInput.checked = getAdvancedCutKeepSide() === 'inverse';
  if (dom.advancedDraftOperationCustomFaceInput) dom.advancedDraftOperationCustomFaceInput.disabled = !hasShape || locked;
  if (dom.advancedDraftOperationCutInput) dom.advancedDraftOperationCutInput.disabled = !hasShape || locked;
  if (dom.advancedCutKeepNormalInput) dom.advancedCutKeepNormalInput.disabled = !hasShape || locked;
  if (dom.advancedCutKeepInverseInput) dom.advancedCutKeepInverseInput.disabled = !hasShape || locked;
  if (dom.editorAdvancedModePanel) dom.editorAdvancedModePanel.hidden = !hasShape || locked;
  if (dom.editorAdvancedControls) dom.editorAdvancedControls.hidden = false;
  if (dom.editorAdvancedModeSummary) {
    setElementText(dom.editorAdvancedModeSummary, deriveAdvancedModePreviewSummary({
      shape,
      size,
      selectedCatalogPieceId: state.selectedCatalogPieceId,
      selectedBase: state.selectedBase,
      subgridUnit: Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP,
      pointGridSummary,
      pointSelectionSummary,
      edgeCount: getActiveAdvancedDraftEdges().length,
      faceCount: getActiveAdvancedDraftFaces().length,
    }));
  }
  if (dom.editableEdgeSelectionSummary) {
    setElementText(
      dom.editableEdgeSelectionSummary,
      state.selectedEditableEdgeIds.length
        ? `${state.selectedEditableEdgeIds.length} arête(s) : ${state.selectedEditableEdgeIds.join(', ')}`
        : 'Aucune arête sélectionnée.',
    );
  }
  if (dom.chamferSelectedEdgesBtn) dom.chamferSelectedEdgesBtn.disabled = locked || !state.selectedEditableEdgeIds.length;
  if (dom.filletSelectedEdgesBtn) dom.filletSelectedEdgesBtn.disabled = locked || !state.selectedEditableEdgeIds.length;
  if (dom.clearEditableEdgeSelectionBtn) dom.clearEditableEdgeSelectionBtn.disabled = !state.selectedEditableEdgeIds.length;
  renderAdvancedFaceOperationControls();

  const lockSelectors = [
    '#shapeTab input',
    '#shapeTab select',
    '#shapeTab button',
    '#anchorsTab input',
    '#anchorsTab select',
    '#anchorsTab button',
  ];
  for (const selector of lockSelectors) {
    for (const element of document.querySelectorAll(selector)) {
      element.disabled = locked;
    }
  }
}

function renderAdvancedFaceOperationControls() {
  const shape = selectedShape();
  const locked = isVariantEditingLocked(shape);
  const draftFaces = getActiveAdvancedDraftFaces();
  if (!draftFaces.some((face) => face.id === state.selectedAdvancedDraftFaceId)) {
    state.selectedAdvancedDraftFaceId = draftFaces[0]?.id ?? null;
  }

  if (dom.advancedDraftFaceListSelect) {
    clearElement(dom.advancedDraftFaceListSelect);
    for (const face of draftFaces) {
      const option = document.createElement('option');
      option.value = face.id;
      option.textContent = `${face.id} · ${face.points.join(' → ')}`;
      option.selected = face.id === state.selectedAdvancedDraftFaceId;
      appendElement(dom.advancedDraftFaceListSelect, option);
    }
    dom.advancedDraftFaceListSelect.disabled = !shape || locked;
  }

  const advancedPlanarOperations = getAdvancedPlanarOperations(selectedShape()?.generation?.operations ?? []);
  if (!advancedPlanarOperations.some((operation) => operation.id === state.selectedAdvancedCustomFaceOperationId)) {
    state.selectedAdvancedCustomFaceOperationId = advancedPlanarOperations[0]?.id ?? null;
  }

  if (dom.advancedCustomFaceOperationListSelect) {
    clearElement(dom.advancedCustomFaceOperationListSelect);
    for (const operation of advancedPlanarOperations) {
      const option = document.createElement('option');
      option.value = operation.id;
      const label = operation.type === 'cut' ? 'coupe' : 'face';
      option.textContent = `${label} · ${operation.id} · ${operation.point_ids?.join(' → ') ?? ''}`;
      option.selected = operation.id === state.selectedAdvancedCustomFaceOperationId;
      appendElement(dom.advancedCustomFaceOperationListSelect, option);
    }
    dom.advancedCustomFaceOperationListSelect.disabled = !shape || locked;
  }

  if (dom.commitAdvancedDraftFaceBtn) dom.commitAdvancedDraftFaceBtn.disabled = locked || !draftFaces.length;
  if (dom.deleteAdvancedDraftFaceBtn) dom.deleteAdvancedDraftFaceBtn.disabled = locked || !draftFaces.length;
  if (dom.deleteAdvancedCustomFaceOperationBtn) dom.deleteAdvancedCustomFaceOperationBtn.disabled = locked || !advancedPlanarOperations.length;
}

function updateShapeIdentity() {
  const shape = selectedShape();
  if (!shape) return;
  if (!ensureVariantEditable('Modification identité refusée')) {
    renderAll(false);
    return;
  }
  if (dom.shapeLabelInput) shape.label = dom.shapeLabelInput.value.trim();
  if (dom.shapeFamilyInput) shape.shape_family = slugifyId(dom.shapeFamilyInput.value || shape.shape_family || 'block');
  if (dom.shapeStatusSelect) shape.status = normalizeVariantStatus(dom.shapeStatusSelect.value);
  shape.metadata ??= {};
  shape.metadata.updated_at = new Date().toISOString();
  afterEditorCatalogMutation('shape_identity_updated', { redrawPreview: false });
}

function renderOperations() {
  const shape = selectedShape();
  normalizeShapeEdgeCorrections(shape);
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
  if (op.type === 'edge_chamfer') {
    return `chanfrein arête · 0.5 · ${op.edge_ids?.join(', ') ?? 'arêtes inconnues'}`;
  }
  if (op.type === 'edge_fillet') {
    return `arrondi arête · R1 · ${op.edge_ids?.join(', ') ?? 'arêtes inconnues'}`;
  }
  if (op.type === 'custom_face') {
    return `face · ${op.point_ids?.length ?? 0} points · ${op.scope?.label_fr ?? 'face personnalisée'}`;
  }
  if (op.type === 'cut') {
    return `coupe · ${op.keep_side === 'inverse' ? 'côté B' : 'côté A'} · ${op.point_ids?.length ?? 0} points`;
  }
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
  if (!ensureVariantEditable('Ajout correction refusé')) {
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
  afterEditorCatalogMutation(`operation_${type}_added`, { message: `Correction ajoutée : ${describeShapeOperation(op)}.` });
}

function removeFaceOperation() {
  const shape = selectedShape();
  if (!shape) return;
  if (!ensureVariantEditable('Suppression correction refusée')) return;
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
  afterEditorCatalogMutation('operation_removed', { message: `Correction supprimée : ${describeShapeOperation(removed)}.` });
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
  if (!ensureVariantEditable('Ajout ancre refusé')) {
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
  afterEditorCatalogMutation('anchor_added', { message: `Ancre ajoutée : ${id}.` });
}

function deleteAnchor() {
  const shape = selectedShape();
  if (!shape) return;
  if (!ensureVariantEditable('Suppression ancre refusée')) return;
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
  afterEditorCatalogMutation('anchor_removed', { message: `Ancre supprimée : ${target.id}.` });
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
      editorCatalogAutosave?.schedule(`spec_${fieldId}_changed`);
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
      editorCatalogAutosave?.schedule(`recipe_${path.replaceAll('.', '_')}_changed`);
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
      editorCatalogAutosave?.schedule('recipe_ingredients_changed');
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
  storeShapeSnapshot(shape.id);
  const piece = createCatalogPieceForShape({
    familyId,
    sizeId,
    shapeId,
    pieceLabelFr: group.piece_label_fr,
    variantIndex: 1,
  });
  closeBaseReferenceModal();
  rebuildRepo();
  selectBaseModel(group, sizeId, { keepView: true });
  state.selectedShapeId = shape.id;
  state.selectedCatalogPieceId = piece.id;
  afterEditorCatalogMutation('base_reference_created', { message: `Référence créée : ${group.piece_label_fr} ${sizeId}.` });
}

function getAvailableVariantIndexes(familyId, sizeId, maxIndex = 14) {
  return getEditorAvailableVariantIndexes(state.catalog, familyId, sizeId, maxIndex);
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
  storeShapeSnapshot(shape.id);
  const piece = createCatalogPieceForShape({
    familyId,
    sizeId,
    shapeId,
    pieceLabelFr: group.piece_label_fr,
    variantIndex,
  });
  closeVariantCreationModal();
  rebuildRepo();
  selectBaseModel(group, sizeId, { keepView: true });
  state.selectedShapeId = shape.id;
  state.selectedCatalogPieceId = piece.id;
  afterEditorCatalogMutation('shape_created_modal', { message: `Variante créée : ${shape.id}.` });
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
  advancedPointPickTargets.length = 0;
  advancedEdgePickTargets.length = 0;
  editableEdgePickTargets.length = 0;

  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size) return;

  ensureVoxelGeneration(shape);
  const previewState = deriveEditorPreviewState({
    shape,
    size,
    fullCells,
    getShapeCells,
    getSuppressedCellKeysForOperations,
    cellKey,
  });
  if (previewState.shouldRenderMesh && !advancedPieceDisplayIsPoints()) {
    const previewGeometry = buildShapeGeometry({
      shape,
      size,
      scale: CELL_SCALE,
      symmetry: {},
      showVoxels: false,
    });
    const preview = meshWithEdges(
      previewGeometry,
      createOperationMaterial(),
      new THREE.LineBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.72 }),
    );
    root.add(preview);
  }

  if (isParametricShape(shape) && previewState.shouldRenderVoxelGuide) renderVoxelGuide(previewState.visibleCells, size);
  renderCellPickProxies(previewState.visibleCells, size);
  renderEditableGeometryEdges(size);
  renderAdvancedPointGrid(size);
  renderAdvancedCustomFaceOperations(size);
  renderAdvancedDraftFaces(size);
  renderAdvancedDraftEdges(size);

  const boundsBox = createCatalogReservationBox(size, CELL_SCALE, new THREE.Vector3());
  const bounds = new THREE.Box3Helper(boundsBox, SELECTED_COLOR);
  root.add(bounds);

  const anchorGeom = new THREE.SphereGeometry(CELL_SCALE * 0.1, 16, 10);
  const anchorMat = new THREE.MeshBasicMaterial({ color: ANCHOR_COLOR });
  for (const anchor of getRenderableEditorAnchors(shape)) {
    const dot = new THREE.Mesh(anchorGeom, anchorMat);
    dot.position.copy(anchorToWorld(anchor, size));
    root.add(dot);
  }

  renderSelectedFaceHint(size);
}

function renderEditableGeometryEdges(size) {
  for (const edge of getEditableEdgesForShape()) {
    const worldA = catalogPositionToWorld(edge.start, size);
    const worldB = catalogPositionToWorld(edge.end, size);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      worldA.x, worldA.y, worldA.z,
      worldB.x, worldB.y, worldB.z,
    ], 3));
    const selected = state.selectedEditableEdgeIds.includes(edge.id);
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: selected ? 0xf7f1ac : 0x8fb0ff,
      transparent: true,
      opacity: selected ? 1 : 0.72,
      depthTest: false,
    }));
    line.userData = { type: 'editable_edge', edgeId: edge.id };
    line.renderOrder = selected ? 46 : 34;
    editableEdgePickTargets.push(line);
    root.add(line);
  }
}

function renderAdvancedPointGrid(size) {
  const step = Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP;
  const points = generateEditorPointGrid(size, step);
  if (!points.length) return;

  const boundaryGeometry = new THREE.SphereGeometry(CELL_SCALE * 0.045, 10, 8);
  const interiorGeometry = new THREE.SphereGeometry(CELL_SCALE * 0.028, 8, 6);
  const boundaryMaterial = new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, transparent: true, opacity: 0.92, depthTest: false });
  const interiorMaterial = new THREE.MeshBasicMaterial({ color: 0x72c7ff, transparent: true, opacity: 0.24, depthTest: false });

  for (const point of points) {
    const isSelected = state.selectedAdvancedPointIds.includes(point.id);
    const marker = new THREE.Mesh(
      isSelected ? new THREE.SphereGeometry(CELL_SCALE * 0.065, 12, 10) : (point.isBoundary ? boundaryGeometry : interiorGeometry),
      isSelected
        ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98, depthTest: false })
        : (point.isBoundary ? boundaryMaterial : interiorMaterial),
    );
    marker.position.copy(catalogPositionToWorld(point, size));
    marker.userData = { type: 'advanced_point', pointId: point.id };
    marker.renderOrder = 40;
    advancedPointPickTargets.push(marker);
    root.add(marker);
  }
}

function renderAdvancedDraftEdges(size) {
  const points = generateEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP);
  const pointById = new Map(points.map((point) => [point.id, point]));
  const faceEdgeIds = new Set(getActiveAdvancedDraftFaces().flatMap((face) => face.edges ?? []));

  for (const edge of getActiveAdvancedDraftEdges()) {
    const pointA = pointById.get(edge.pointA);
    const pointB = pointById.get(edge.pointB);
    if (!pointA || !pointB) continue;
    const worldA = catalogPositionToWorld(pointA, size);
    const worldB = catalogPositionToWorld(pointB, size);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      worldA.x, worldA.y, worldA.z,
      worldB.x, worldB.y, worldB.z,
    ], 3));
    const selected = state.selectedAdvancedEdgeIds.includes(edge.id);
    const coveredByFace = faceEdgeIds.has(edge.id);
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: selected ? 0xa8d8ff : (coveredByFace ? 0x050505 : 0x3a8dff),
      transparent: true,
      opacity: selected ? 1 : 0.92,
      linewidth: 3,
      depthTest: false,
    }));
    line.userData = { type: 'advanced_edge', edgeId: edge.id };
    line.renderOrder = 35;
    advancedEdgePickTargets.push(line);
    root.add(line);
  }
}

function renderAdvancedDraftFaces(size) {
  const points = generateEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP);
  const pointById = new Map(points.map((point) => [point.id, point]));

  for (const face of getActiveAdvancedDraftFaces()) {
    if ((face.points ?? []).length < 3) continue;
    const positions = [];
    for (const pointId of face.points) {
      const point = pointById.get(pointId);
      if (!point) continue;
      const world = catalogPositionToWorld(point, size);
      positions.push(world.x, world.y, world.z);
    }
    if (positions.length < 9) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const indices = [];
    const vertexCount = positions.length / 3;
    for (let index = 1; index < vertexCount - 1; index += 1) {
      indices.push(0, index, index + 1);
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0x2f8fff,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }));
    mesh.renderOrder = 30;
    root.add(mesh);
  }
}

function renderAdvancedCustomFaceOperations(size) {
  const operations = getAdvancedPlanarOperations(selectedShape()?.generation?.operations ?? []);
  for (const operation of operations) {
    const points = Array.isArray(operation.points) ? operation.points : [];
    if (points.length < 3) continue;
    const positions = [];
    for (const point of points) {
      const world = catalogPositionToWorld(point, size);
      positions.push(world.x, world.y, world.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const indices = [];
    const vertexCount = positions.length / 3;
    for (let index = 1; index < vertexCount - 1; index += 1) {
      indices.push(0, index, index + 1);
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: operation.type === 'cut' ? 0xff7b5c : 0x5cd6ff,
      transparent: true,
      opacity: operation.type === 'cut' ? 0.42 : 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }));
    mesh.renderOrder = 24;
    root.add(mesh);
  }
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
  if (scope.kind === 'edge_selection' && Array.isArray(scope.edges) && scope.edges.length) {
    const seen = new Set();
    const cells = [];
    for (const edge of scope.edges) {
      for (const cell of getOperationAffectedCells({
        ...op,
        selection: { ...(op.selection ?? {}), face: edge.face },
        scope: {
          kind: 'edge_line',
          side: edge.side,
          axis: edge.axis,
        },
      }, size)) {
        const key = `${cell.x}:${cell.y}:${cell.z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push(cell);
      }
    }
    return cells;
  }
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
    color: op?.type === 'chamfer' || op?.type === 'edge_chamfer' ? OPERATION_CHAMFER_COLOR : OPERATION_ROUND_COLOR,
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
  return catalogAnchorToWorld(anchor.position, size.dimensions, CELL_SCALE);
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
  const plan = createEditorFitPreviewPlan(size, CELL_SCALE);
  editorViewController?.resetView(plan);
  syncEditorNavigationCubeActiveView();
  if (renderNow) renderer.render(scene, camera);
}

function resetPreview() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  const targetZ = size ? getEditorPreviewTargetZ(size, CELL_SCALE) : 0;
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
    `ui mode    : ${getCurrentEditorMode()}`,
    `schéma     : ${state.catalog?.schema_version ?? 'inconnu'}`,
    `modèle     : ${base ? `${base.piece_label_fr} ${base.size_id}` : 'aucun'}`,
    `famille    : ${base?.family_id ?? 'n/a'}`,
    `shape      : ${shape?.id ?? 'n/a'}`,
    `cellules   : ${cells.length}`,
    `ancres     : ${shape?.anchors?.length ?? 0}`,
    `ops forme  : ${shape?.generation?.operations?.length ?? 0}`,
    `catalog    : ${state.selectedCatalogPieceId ?? 'n/a'}`,
    `save       : ${state.editorSave.saving ? 'saving' : state.editorSave.dirty ? 'dirty' : 'clean'}`,
    state.editorSave.lastSavedAt ? `saved_at   : ${state.editorSave.lastSavedAt}` : '',
    state.editorSave.lastError ? `save_error : ${state.editorSave.lastError.message}` : '',
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
  lines.push('Enregistrer maintenant : écrit public/data/editor_catalog.json via le serveur dev; en fallback, garde un brouillon local temporaire.');
  lines.push('Publier vers Assembly : génère public/data/assembly_catalog.json avec variantes validated uniquement.');
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
    if (shape.generation?.mode === 'advanced_mesh') errors.push(`${shape.id}: advanced_mesh est obsolète.`);
    const cells = getShapeCells(shape, size);
    if (shape.generation?.mode === 'voxel_grid' && cells.length === 0) warnings.push(`${shape.id}: aucune cellule active.`);
    if (shape.generation?.mode === 'parametric_shape' && !['point_1', 'point_2', 'point_3'].includes(shape.generation?.base?.type)) errors.push(`${shape.id}: type paramétrique inconnu.`);
    const edgeCorrectionValidation = validateEdgeCorrectionExclusivity(shape.generation?.operations ?? []);
    for (const issue of edgeCorrectionValidation.errors) errors.push(`${shape.id}: ${issue}.`);
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
  if (shape.generation?.mode === 'advanced_mesh') {
    errors.push(`${shape.id}: advanced_mesh est obsolète.`);
  } else {
    ensureVoxelGeneration(shape);
    normalizeShapeEdgeCorrections(shape);
    const cells = getShapeCells(shape, size);
    if (!cells.length) errors.push(`${shape.id}: aucune cellule active.`);
    const edgeCorrectionValidation = validateEdgeCorrectionExclusivity(shape.generation.operations ?? []);
    for (const issue of edgeCorrectionValidation.errors) errors.push(`${shape.id}: ${issue}.`);
    for (const op of shape.generation.operations ?? []) {
      if (!['round', 'chamfer', 'slope', 'cut', 'custom_face', 'edge_chamfer', 'edge_fillet'].includes(op.type)) errors.push(`${shape.id}: opération inconnue ${op.type}.`);
      if (op.type === 'round' && Number(op.radius) !== 1) errors.push(`${shape.id}: arrondi avec rayon différent de 1.`);
      if (op.type === 'chamfer' && Number(op.size) !== 0.5) errors.push(`${shape.id}: chanfrein avec taille différente de 0.5.`);
      if (op.type === 'edge_chamfer') {
        const report = validateEdgeChamferOperation(op);
        for (const issue of report.errors) errors.push(`${shape.id}: edge_chamfer ${issue}.`);
        for (const issue of report.warnings) warnings.push(`${shape.id}: edge_chamfer ${issue}.`);
      }
      if (op.type === 'edge_fillet') {
        const report = validateEdgeFilletOperation(op);
        for (const issue of report.errors) errors.push(`${shape.id}: edge_fillet ${issue}.`);
        for (const issue of report.warnings) warnings.push(`${shape.id}: edge_fillet ${issue}.`);
      }
      if (op.type === 'custom_face') {
        const report = validateCustomFaceOperation(op, size);
        for (const issue of report.errors) errors.push(`${shape.id}: custom_face ${issue}.`);
        for (const issue of report.warnings) warnings.push(`${shape.id}: custom_face ${issue}.`);
      }
      if (op.type === 'cut') {
        const report = validateCutOperation(op, size);
        for (const issue of report.errors) errors.push(`${shape.id}: cut ${issue}.`);
        for (const issue of report.warnings) warnings.push(`${shape.id}: cut ${issue}.`);
      }
      if (!op.scope?.kind) warnings.push(`${shape.id}: opération ${op.type} sans scope détaillé.`);
    }
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
  const base = 'editor_catalog';
  return suffix ? `${base}.${suffix}.json` : `${base}.json`;
}

function getAssemblyCatalogFileName(suffix = '') {
  const base = 'assembly_catalog';
  return suffix ? `${base}.${suffix}.json` : `${base}.json`;
}

function getAdvancedDraftStateByShapeId() {
  const shapeIds = new Set([
    ...Object.keys(state.advancedDraftEdgesByShapeId ?? {}),
    ...Object.keys(state.advancedDraftFacesByShapeId ?? {}),
  ]);
  const result = {};
  for (const shapeId of shapeIds) {
    result[shapeId] = {
      edgeCount: getAdvancedDraftEdgesForShape(state.advancedDraftEdgesByShapeId, shapeId).length,
      faceCount: getAdvancedDraftFacesForShape(state.advancedDraftFacesByShapeId, shapeId).length,
    };
  }
  return result;
}

function buildCompiledCatalogOutput() {
  return compileEditorCatalog({
    catalog: state.catalog,
    sizes: state.catalog?.sizes ?? [],
    draftStateByShapeId: getAdvancedDraftStateByShapeId(),
  });
}

function downloadCatalogFile(filename = getCatalogFileName(), payload = state.catalog) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function writeCatalogToProjectFile(payload = state.catalog) {
  const response = await fetch(EDITOR_CATALOG_WRITE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return response.json();
}

async function writeAssemblyCatalogToProjectFile(payload) {
  const response = await fetch(ASSEMBLY_CATALOG_WRITE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return response.json();
}

function syncEditorSaveState(snapshot = {}) {
  state.editorSave = {
    ...state.editorSave,
    ...snapshot,
  };
}

function afterEditorCatalogMutation(reason, options = {}) {
  rebuildRepo();
  editorCatalogAutosave?.schedule(reason);
  const message = options.message ?? null;
  if (message) setMessage(message);
  renderAll(options.redrawPreview ?? true);
}

async function saveEditorCatalogNow(reason = 'manual_save') {
  if (!editorCatalogAutosave) return { ok: false, error: new Error('Autosave indisponible.') };
  const result = await editorCatalogAutosave.saveNow(reason);
  if (result.ok) {
    setMessage(`Catalogue éditeur enregistré : public/data/editor_catalog.json (${reason}).`);
  } else {
    setMessage(`Enregistrement éditeur local échoué : ${result.error.message}`);
  }
  renderAll(false);
  return result;
}

async function saveDraft() {
  await saveEditorCatalogNow('manual_save');
}

async function publishCatalogToAssembly() {
  await saveEditorCatalogNow('before_publish');
  const compiled = buildCompiledCatalogOutput();
  if (!compiled.ok) {
    setMessage(`Publication Assembly refusée : ${compiled.errors.join(' | ')}`);
    renderAll(false);
    return;
  }

  const publication = buildAssemblyCatalogFromEditorCatalog(compiled.catalog);
  if (!publication.report.publishable) {
    setMessage('Publication Assembly refusée : aucune variante validée publiable.');
    renderAll(false);
    return;
  }

  const validation = validateCatalogData(publication.catalog);
  if (!validation.valid) {
    setMessage(`Publication Assembly refusée : ${formatValidationIssues(validation.errors).join(' | ')}`);
    renderValidationReport();
    return;
  }

  try {
    const result = await writeAssemblyCatalogToProjectFile(publication.catalog);
    setMessage(`Assembly publié : ${publication.report.publishedPieces} pièce(s), ${publication.report.publishedShapes} variante(s). Ignoré : ${publication.report.skippedDraft} draft, ${publication.report.skippedChecked} checked, ${publication.report.skippedInvalid} invalid. Fichier : ${result.path ?? 'public/data/assembly_catalog.json'}.`);
  } catch (error) {
    downloadCatalogFile(getAssemblyCatalogFileName('publish'), publication.catalog);
    setMessage(`Écriture directe Assembly indisponible. Catalogue téléchargé : remplace public/data/assembly_catalog.json manuellement. Détail : ${error.message}`);
  }

  renderAll(false);
}

function controlSelectedShape() {
  const shape = selectedShape();
  if (!shape) return;
  const report = validateSelectedShape();
  if (report.errors.length) {
    shape.status = 'draft';
    afterEditorCatalogMutation('shape_checked_failed', { message: `Contrôle refusé : ${report.errors.length} erreur(s).`, redrawPreview: false });
  } else {
    shape.status = 'checked';
    shape.metadata ??= {};
    shape.metadata.checked_at = new Date().toISOString();
    afterEditorCatalogMutation('shape_checked', { message: `Contrôle OK : ${report.warnings.length} avertissement(s).`, redrawPreview: false });
  }
}

function validateSelectedShapeStatus() {
  const shape = selectedShape();
  if (!shape) return;
  const report = validateSelectedShape();
  if (report.errors.length) {
    shape.status = 'draft';
    afterEditorCatalogMutation('shape_validated_failed', { message: `Validation refusée : ${report.errors.length} erreur(s).`, redrawPreview: false });
  } else {
    shape.status = 'validated';
    shape.metadata ??= {};
    shape.metadata.validated_at = new Date().toISOString();
    afterEditorCatalogMutation('shape_validated', { message: 'Variante validée. Publie vers Assembly pour générer le catalogue runtime.', redrawPreview: false });
  }
}

function renderAll(redrawPreview = true) {
  renderBaseModels();
  renderShapeSelect();
  renderCatalogPieceSelect();
  renderSelectedBaseSummary();
  renderEditorModeUi();
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
  const compiled = buildCompiledCatalogOutput();
  if (!compiled.ok) {
    setMessage(`Export refusé : ${compiled.errors.join(' | ')}`);
    renderAll(false);
    return;
  }
  downloadJson('editor_catalog.export.json', compiled.catalog);
  setMessage('Catalogue éditeur exporté.');
  renderAll(false);
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

function setPointerFromEditorEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickAdvancedPointPrimitive(event) {
  if (!editorIsAdvancedMode() || !advancedPointPickTargets.length) return null;
  setPointerFromEditorEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const pointHits = raycaster.intersectObjects(advancedPointPickTargets, false);
  if (!pointHits.length) return null;
  const hit = pointHits[0];
  const pointId = hit.object.userData.pointId;
  return {
    type: 'point',
    id: pointId,
    position: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null,
    object: hit.object,
    intersection: hit,
  };
}

function pickEditableEdgePrimitive(event) {
  if (!editableEdgePickTargets.length) return null;
  setPointerFromEditorEvent(event);
  raycaster.params.Line.threshold = 12;
  raycaster.setFromCamera(pointer, camera);
  const edgeHits = raycaster.intersectObjects(editableEdgePickTargets, false);
  if (!edgeHits.length) return null;
  const hit = edgeHits[0];
  return {
    type: 'edge',
    id: hit.object.userData.edgeId,
    position: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null,
    object: hit.object,
    intersection: hit,
  };
}

function pickAdvancedEdgePrimitive(event) {
  if (!editorIsAdvancedMode() || !advancedEdgePickTargets.length) return null;
  setPointerFromEditorEvent(event);
  raycaster.params.Line.threshold = 12;
  raycaster.setFromCamera(pointer, camera);
  const edgeHits = raycaster.intersectObjects(advancedEdgePickTargets, false);
  if (!edgeHits.length) return null;
  const hit = edgeHits[0];
  return {
    type: 'line',
    id: hit.object.userData.edgeId,
    position: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null,
    object: hit.object,
    intersection: hit,
  };
}

function createAdvancedDraftEdgeFromSelection() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size || !editorIsAdvancedMode()) return false;
  if (!ensureVariantEditable('Création ligne refusée')) return false;

  const points = generateEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP);
  const pointMap = new Map(points.map((point) => [point.id, point]));
  const result = createAdvancedDraftEdgesFromSelection({
    shapeId: shape.id,
    selectedPointIds: state.selectedAdvancedPointIds,
    existingEdges: getActiveAdvancedDraftEdges(),
    pointMap,
  });

  if (!result.created) {
    const messageByReason = {
      insufficient_points: 'Ligne refusée : sélectionne 2 points.',
      too_many_points: 'Ligne refusée : sélectionne exactement 2 points.',
      unsupported_point_count: 'Ligne refusée : auto-création dispo pour triangle (3) et quadrilatère/parallélogramme (4) uniquement.',
      invalid_points: 'Ligne refusée : points invalides.',
      unknown_points: 'Ligne refusée : points hors grille active.',
      duplicate_edge: 'Ligne refusée : doublon.',
      non_coplanar: 'Ligne refusée : points non coplanaires.',
      missing_shape: 'Ligne refusée : aucune variante active.',
    };
    setMessage(messageByReason[result.reason] ?? 'Ligne refusée.');
    renderAll(false);
    return false;
  }

  const nextEdges = [...getActiveAdvancedDraftEdges(), ...result.edges];
  setActiveAdvancedDraftEdges(nextEdges);
  state.selectedAdvancedEdgeIds = result.loopEdgeIds ?? result.edges.map((edge) => edge.id);
  const createdCount = result.edges.length;
  const reusedCount = Number(result.reusedEdgeCount) || 0;
  let createdLabel = '';
  if (!createdCount && reusedCount) createdLabel = `Boucle réutilisée : ${reusedCount} ligne(s) déjà présente(s).`;
  else if (createdCount === 1) createdLabel = reusedCount ? '1 ligne créée, boucle complétée avec lignes existantes.' : '1 ligne créée.';
  else createdLabel = reusedCount ? `${createdCount} lignes créées, boucle complétée avec lignes existantes.` : `${createdCount} lignes créées.`;
  setMessage(createdLabel);
  renderAll();
  return true;
}

function deleteSelectedAdvancedDraftEdges() {
  if (!state.selectedAdvancedEdgeIds.length) return false;
  if (!ensureVariantEditable('Suppression ligne refusée')) return false;
  const nextEdges = removeAdvancedDraftEdgesById(getActiveAdvancedDraftEdges(), state.selectedAdvancedEdgeIds);
  setActiveAdvancedDraftEdges(nextEdges);
  const validEdgeIds = nextEdges.map((edge) => edge.id);
  setActiveAdvancedDraftFaces(removeInvalidDraftFaces(getActiveAdvancedDraftFaces(), validEdgeIds));
  resetAdvancedEdgeSelection();
  setMessage('Ligne(s) supprimée(s).');
  renderAll();
  return true;
}

function createAdvancedDraftFaceFromSelection() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size || !editorIsAdvancedMode()) return false;
  if (!ensureVariantEditable('Création face refusée')) return false;

  const points = generateEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP);
  const pointMap = new Map(points.map((point) => [point.id, point]));
  let activeEdges = getActiveAdvancedDraftEdges();
  let selectedEdgeIds = normalizeAdvancedEdgeSelection(state.selectedAdvancedEdgeIds);

  if (!selectedEdgeIds.length && state.selectedAdvancedPointIds.length > 4) {
    setMessage('Face refusée : auto-création dispo pour triangle (3) et quadrilatère/parallélogramme (4) uniquement.');
    renderAll(false);
    return false;
  }

  if (!selectedEdgeIds.length && state.selectedAdvancedPointIds.length >= 3) {
    const edgeResult = createAdvancedDraftEdgesFromSelection({
      shapeId: shape.id,
      selectedPointIds: state.selectedAdvancedPointIds,
      existingEdges: activeEdges,
      pointMap,
    });
    if (!edgeResult.created) {
      const messageByReason = {
        unsupported_point_count: 'Face refusée : auto-création dispo pour triangle (3) et quadrilatère/parallélogramme (4) uniquement.',
        invalid_points: 'Face refusée : points invalides.',
        unknown_points: 'Face refusée : points hors grille active.',
        non_coplanar: 'Face refusée : points non coplanaires.',
        missing_shape: 'Face refusée : aucune variante active.',
      };
      setMessage(messageByReason[edgeResult.reason] ?? 'Face refusée.');
      renderAll(false);
      return false;
    }
    if (edgeResult.edges.length) {
      activeEdges = [...activeEdges, ...edgeResult.edges];
      setActiveAdvancedDraftEdges(activeEdges);
    }
    selectedEdgeIds = edgeResult.loopEdgeIds ?? [];
    state.selectedAdvancedEdgeIds = selectedEdgeIds;
  }

  const result = createAdvancedDraftFace({
    shapeId: shape.id,
    selectedEdgeIds,
    selectedPointIds: state.selectedAdvancedPointIds,
    edges: activeEdges,
    pointMap,
  });

  if (!result.created) {
    const messageByReason = {
      insufficient_edges: 'Face refusée : sélectionne au moins 3 lignes.',
      unknown_edges: 'Face refusée : sélection incohérente.',
      open_loop: 'Face refusée : boucle non fermée.',
      unsupported_point_count: 'Face refusée : auto-création dispo pour triangle (3) et quadrilatère/parallélogramme (4) uniquement.',
      non_coplanar: 'Face refusée : points non coplanaires.',
      self_crossed: 'Face refusée : face auto-croisée.',
      degenerate_face: 'Face refusée : normal impossible à calculer.',
      missing_shape: 'Face refusée : aucune variante active.',
    };
    setMessage(messageByReason[result.reason] ?? 'Face refusée.');
    renderAll(false);
    return false;
  }

  const nextFaces = [...getActiveAdvancedDraftFaces()];
  if (!nextFaces.some((face) => face.id === result.face.id)) nextFaces.push(result.face);
  setActiveAdvancedDraftFaces(nextFaces);
  state.selectedAdvancedDraftFaceId = result.face.id;
  setMessage(`Face créée : ${result.face.id}.`);
  renderAll();
  return true;
}

function deleteSelectedAdvancedDraftFace() {
  const selectedFace = getSelectedAdvancedDraftFace();
  if (!selectedFace) return false;
  if (!ensureVariantEditable('Suppression face refusée')) return false;
  setActiveAdvancedDraftFaces(getActiveAdvancedDraftFaces().filter((face) => face.id !== selectedFace.id));
  state.selectedAdvancedDraftFaceId = null;
  setMessage(`Face draft supprimée : ${selectedFace.id}.`);
  renderAll();
  return true;
}

function commitSelectedAdvancedDraftFaceToOperation() {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  const selectedFace = getSelectedAdvancedDraftFace();
  if (!shape || !size || !selectedFace) return false;
  if (!ensureVariantEditable('Création opération refusée')) return false;

  const points = generateEditorPointGrid(size, Number(state.catalog?.units?.subgrid_unit) || EDITOR_SUBGRID_DEFAULT_STEP);
  const pointMap = new Map(points.map((point) => [point.id, point]));
  const result = getAdvancedDraftOperationType() === 'cut'
    ? createCutOperation({
      shapeId: shape.id,
      face: selectedFace,
      pointMap,
      keepSide: getAdvancedCutKeepSide(),
    })
    : createCustomFaceOperation({
      shapeId: shape.id,
      face: selectedFace,
      pointMap,
    });
  if (!result.created) {
    const messageByReason = {
      missing_shape: 'Opération refusée : aucune variante active.',
      invalid_face: 'Opération refusée : face draft invalide.',
      unknown_points: 'Opération refusée : points introuvables.',
      degenerate_face: 'Opération refusée : face dégénérée.',
    };
    setMessage(messageByReason[result.reason] ?? 'Opération refusée.');
    renderAll(false);
    return false;
  }

  const validation = result.operation.type === 'cut'
    ? validateCutOperation(result.operation, size)
    : validateCustomFaceOperation(result.operation, size);
  if (!validation.valid) {
    setMessage(`Opération refusée : ${validation.errors.join(', ')}.`);
    renderAll(false);
    return false;
  }

  shape.generation.operations ??= [];
  if (shape.generation.operations.some((operation) => operation.id === result.operation.id)) {
    setMessage(`Opération déjà présente : ${result.operation.id}.`);
    renderAll(false);
    return false;
  }

  shape.generation.operations.push(result.operation);
  markShapeDirty(shape, `${result.operation.type}_operation_added`);
  state.selectedOperationIndex = shape.generation.operations.length - 1;
  state.selectedAdvancedCustomFaceOperationId = result.operation.id;
  setActiveAdvancedDraftFaces(getActiveAdvancedDraftFaces().filter((face) => face.id !== selectedFace.id));
  state.selectedAdvancedDraftFaceId = null;
  setMessage(`Opération créée : ${result.operation.id}.`);
  renderAll();
  return true;
}

function createOperationFromSelectedEditableEdges(type) {
  const shape = selectedShape();
  const size = getSize(shape?.size_id);
  if (!shape || !size || !state.selectedEditableEdgeIds.length) return false;
  if (!ensureVariantEditable('Création opération arête refusée')) return false;

  ensureVoxelGeneration(shape);
  const editableEdges = getEditableEdgesForShape(shape);
  const result = type === 'edge_fillet'
    ? createEdgeFilletOperation({
      shapeId: shape.id,
      edgeIds: state.selectedEditableEdgeIds,
      editableEdges,
    })
    : createEdgeChamferOperation({
      shapeId: shape.id,
      edgeIds: state.selectedEditableEdgeIds,
      editableEdges,
    });

  if (!result.created) {
    const reasonLabel = result.reason === 'empty_selection'
      ? 'aucune arête sélectionnée'
      : result.reason === 'unknown_edge'
        ? 'sélection incohérente'
        : 'erreur inconnue';
    setMessage(`Opération arête refusée : ${reasonLabel}.`);
    renderAll(false);
    return false;
  }

  const validation = result.operation.type === 'edge_fillet'
    ? validateEdgeFilletOperation(result.operation)
    : validateEdgeChamferOperation(result.operation);
  if (!validation.valid) {
    setMessage(`Opération arête refusée : ${validation.errors.join(', ')}.`);
    renderAll(false);
    return false;
  }

  upsertEdgeCorrection(shape, state.selectedEditableEdgeIds[0], result.operation);
  markShapeDirty(shape, `${result.operation.type}_added`);
  state.selectedOperationIndex = (shape.generation.operations ?? []).length - 1;
  afterEditorCatalogMutation(result.operation.type, {
    message: `Opération ajoutée : ${describeShapeOperation(result.operation)}.`,
  });
  return true;
}

function deleteSelectedAdvancedCustomFaceOperation() {
  const shape = selectedShape();
  const selectedOperation = getSelectedAdvancedCustomFaceOperation();
  if (!shape || !selectedOperation) return false;
  if (!ensureVariantEditable('Suppression opération refusée')) return false;

  shape.generation.operations = removeCustomFaceOperationById(shape.generation.operations ?? [], selectedOperation.id);
  markShapeDirty(shape, `${selectedOperation.type}_operation_removed`);
  state.selectedAdvancedCustomFaceOperationId = null;
  setMessage(`Opération supprimée : ${selectedOperation.id}.`);
  renderAll();
  return true;
}

function pickVoxelFacePrimitive(event) {
  setPointerFromEditorEvent(event);
  raycaster.setFromCamera(pointer, camera);
  if (!cellPickTargets.length) return null;
  const hits = raycaster.intersectObjects(cellPickTargets, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const cell = structuredClone(hit.object.userData.cell);
  const face = faceFromIntersection(hit);
  return {
    type: 'face',
    id: `cell:${cell.x}:${cell.y}:${cell.z}:${face}`,
    cell,
    face,
    position: anchorPositionForCellFace(cell, face),
    object: hit.object,
    intersection: hit,
  };
}

function pickEditorPrimitive(event) {
  return pickAdvancedPointPrimitive(event)
    ?? pickEditableEdgePrimitive(event)
    ?? pickAdvancedEdgePrimitive(event)
    ?? pickVoxelFacePrimitive(event);
}

function applySelectedFace(faceSelection, { redraw = true } = {}) {
  if (!faceSelection) {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    if (redraw) {
      renderAnchors();
      renderPreview();
    }
    return;
  }

  state.selectedFace = {
    cell: structuredClone(faceSelection.cell),
    face: faceSelection.face,
    position: structuredClone(faceSelection.position),
  };
  const shape = selectedShape();
  const existing = (shape?.anchors ?? []).find((anchor) => anchorMatchesSelectedFace(anchor));
  state.selectedAnchorId = existing?.id ?? null;
  setCellInputValues(faceSelection.cell);
  if (redraw) {
    renderAnchors();
    renderPreview();
  }
}

function clearPrimitiveSelectionState({ redraw = true } = {}) {
  state.selectedFace = null;
  state.selectedAnchorId = null;
  resetAdvancedPointSelection();
  resetAdvancedEdgeSelection();
  resetEditableEdgeSelection();
  if (redraw) renderAll(false);
}

function selectEditorPrimitive(primitive, options = {}) {
  if (!primitive) return false;
  const { preserveMenu = false } = options;
  if (!preserveMenu) closeEditorGeometryContextMenu();

  if (primitive.type === 'point') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedEdgeSelection();
    resetEditableEdgeSelection();
    applyAdvancedPointSelection(primitive.id, { multi: false });
    renderAll();
    return true;
  }

  if (primitive.type === 'edge') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
    applyEditableEdgeSelection(primitive.id, { multi: false });
    renderAll(false);
    return true;
  }

  if (primitive.type === 'line') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedPointSelection();
    resetEditableEdgeSelection();
    applyAdvancedEdgeSelection(primitive.id, { multi: false });
    renderAll(false);
    return true;
  }

  if (primitive.type === 'face') {
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
    resetEditableEdgeSelection();
    applySelectedFace(primitive, { redraw: false });
    renderAll(false);
    return true;
  }

  return false;
}

function toggleEditorPrimitive(primitive) {
  if (!primitive) return false;
  closeEditorGeometryContextMenu();

  if (primitive.type === 'point') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedEdgeSelection();
    resetEditableEdgeSelection();
    applyAdvancedPointSelection(primitive.id, { multi: true });
    renderAll();
    return true;
  }

  if (primitive.type === 'edge') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
    applyEditableEdgeSelection(primitive.id, { multi: true });
    renderAll(false);
    return true;
  }

  if (primitive.type === 'line') {
    state.selectedFace = null;
    state.selectedAnchorId = null;
    resetAdvancedPointSelection();
    resetEditableEdgeSelection();
    applyAdvancedEdgeSelection(primitive.id, { multi: true });
    renderAll(false);
    return true;
  }

  if (primitive.type === 'face') {
    applySelectedFace(primitive, { redraw: false });
    renderAll(false);
    return true;
  }

  return false;
}

function getEditorSelectionState() {
  const selection = createEmptyEditorSelectionState();
  for (const pointId of state.selectedAdvancedPointIds) selection.points.add(getPrimitiveKey({ type: 'point', id: pointId }));
  for (const edgeId of state.selectedAdvancedEdgeIds) selection.lines.add(getPrimitiveKey({ type: 'line', id: edgeId }));
  for (const edgeId of state.selectedEditableEdgeIds) selection.edges.add(getPrimitiveKey({ type: 'edge', id: edgeId }));
  if (state.selectedFace) {
    const facePrimitive = {
      type: 'face',
      id: `cell:${state.selectedFace.cell.x}:${state.selectedFace.cell.y}:${state.selectedFace.cell.z}:${state.selectedFace.face}`,
      cell: structuredClone(state.selectedFace.cell),
      face: state.selectedFace.face,
      position: structuredClone(state.selectedFace.position),
    };
    selection.faces.add(getPrimitiveKey(facePrimitive));
    selection.active = facePrimitive;
  } else if (state.selectedEditableEdgeIds.length) {
    selection.active = { type: 'edge', id: state.selectedEditableEdgeIds.at(-1) };
  } else if (state.selectedAdvancedEdgeIds.length) {
    selection.active = { type: 'line', id: state.selectedAdvancedEdgeIds.at(-1) };
  } else if (state.selectedAdvancedPointIds.length) {
    selection.active = { type: 'point', id: state.selectedAdvancedPointIds.at(-1) };
  }
  return selection;
}

function selectedFaceHasOperation(face = state.selectedFace) {
  const shape = selectedShape();
  if (!shape || !face) return false;
  return (shape.generation?.operations ?? []).some((op) => operationMatchesSelectedFace(op, face));
}

function getEditorContextCapabilities() {
  const selection = getEditorSelectionState();
  return {
    locked: isVariantEditingLocked(),
    faceRound: selection.faces.size > 0,
    faceChamfer: selection.faces.size > 0,
    faceDelete: selection.faces.size > 0 && selectedFaceHasOperation(),
    edgeChamfer: selection.edges.size > 0,
    edgeFillet: selection.edges.size > 0,
  };
}

function getEditorGeometryContextActions(selection, hovered) {
  return getEditorContextActions(selection, hovered, getEditorContextCapabilities());
}

function closeEditorGeometryContextMenu() {
  if (!dom.editorGeometryContextMenu) return;
  dom.editorGeometryContextMenu.hidden = true;
  clearElement(dom.editorGeometryContextMenu);
}

function executeEditorContextAction(actionId) {
  if (actionId === 'face_round') createOperationFromSelectedFace('round');
  else if (actionId === 'face_chamfer') createOperationFromSelectedFace('chamfer');
  else if (actionId === 'face_delete') removeFaceOperation();
  else if (actionId === 'edge_chamfer') createOperationFromSelectedEditableEdges('edge_chamfer');
  else if (actionId === 'edge_fillet') createOperationFromSelectedEditableEdges('edge_fillet');
  closeEditorGeometryContextMenu();
}

function openEditorGeometryContextMenu({ clientX, clientY, viewportStage, actions }) {
  const menu = dom.editorGeometryContextMenu;
  if (!menu || !actions.length) {
    closeEditorGeometryContextMenu();
    return;
  }

  clearElement(menu);
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => executeEditorContextAction(action.id));
    appendElement(menu, button);
  }

  menu.hidden = false;
  const viewportRect = (viewportStage ?? dom.viewportWrap)?.getBoundingClientRect?.() ?? document.body.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const maxLeft = viewportRect.right - menuRect.width - 8;
  const maxTop = viewportRect.bottom - menuRect.height - 8;
  menu.style.left = `${Math.max(viewportRect.left + 8, Math.min(clientX, maxLeft))}px`;
  menu.style.top = `${Math.max(viewportRect.top + 8, Math.min(clientY, maxTop))}px`;
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

function panEditorCameraByPointerDelta(deltaX, deltaY, scaleMultiplier = 1) {
  const distance = camera.position.distanceTo(orbit.target);
  const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
  const viewportHeight = Math.max(dom.canvas.clientHeight, 1);
  const viewportWidth = Math.max(dom.canvas.clientWidth, 1);
  const worldPerPixelY = 2 * Math.tan(fovInRadians / 2) * distance / viewportHeight;
  const worldPerPixelX = worldPerPixelY * (viewportWidth / viewportHeight);
  const panScale = (Number.isFinite(EDITOR_CAMERA_SETTINGS.panSensitivity) ? EDITOR_CAMERA_SETTINGS.panSensitivity : 1) * scaleMultiplier;

  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
  const up = camera.up.clone().normalize();
  const offset = right.multiplyScalar(-deltaX * worldPerPixelX * panScale)
    .add(up.multiplyScalar(deltaY * worldPerPixelY * panScale));

  camera.position.add(offset);
  orbit.target.add(offset);
  orbit.update();
}

const editorCameraDragState = {
  lastPoint: null,
  mode: EDITOR_CAMERA_SETTINGS.rightMouseMode === 'orbitCamera' ? 'orbit' : 'pan',
  spherical: new THREE.Spherical(),
};

function beginEditorViewportPan(event, context = {}) {
  editorCameraDragState.lastPoint = context.startPoint ?? { x: event.clientX, y: event.clientY };
}

function updateEditorViewportPan(event, context = {}) {
  const point = context.currentPoint ?? { x: event.clientX, y: event.clientY };
  const lastPoint = editorCameraDragState.lastPoint ?? point;
  panEditorCameraByPointerDelta(point.x - lastPoint.x, point.y - lastPoint.y);
  editorCameraDragState.lastPoint = point;
}

function endEditorViewportPan() {
  editorCameraDragState.lastPoint = null;
}

function beginEditorCameraDrag(event, context = {}) {
  const settings = context.settings ?? EDITOR_CAMERA_SETTINGS;
  editorCameraDragState.lastPoint = context.startPoint ?? { x: event.clientX, y: event.clientY };
  editorCameraDragState.mode = settings.rightMouseMode === 'orbitCamera' ? 'orbit' : 'pan';
  const offset = camera.position.clone().sub(orbit.target);
  editorCameraDragState.spherical.setFromVector3(offset);
}

function updateEditorCameraDrag(event, context = {}) {
  const point = context.currentPoint ?? { x: event.clientX, y: event.clientY };
  const lastPoint = editorCameraDragState.lastPoint ?? point;
  const deltaX = point.x - lastPoint.x;
  const deltaY = point.y - lastPoint.y;
  const settings = context.settings ?? EDITOR_CAMERA_SETTINGS;

  if (editorCameraDragState.mode === 'pan') {
    panEditorCameraByPointerDelta(deltaX, deltaY);
  } else {
    const rotationSensitivity = Number.isFinite(settings.rotationSensitivity) ? settings.rotationSensitivity : 1;
    const invertY = settings.invertY ? -1 : 1;
    const azimuthDelta = (deltaX / Math.max(dom.canvas.clientWidth, 1)) * Math.PI * rotationSensitivity;
    const polarDelta = (deltaY / Math.max(dom.canvas.clientHeight, 1)) * Math.PI * rotationSensitivity * invertY;
    editorCameraDragState.spherical.theta -= azimuthDelta;
    editorCameraDragState.spherical.phi = THREE.MathUtils.clamp(
      editorCameraDragState.spherical.phi + polarDelta,
      0.05,
      Math.PI - 0.05,
    );
    const nextOffset = new THREE.Vector3().setFromSpherical(editorCameraDragState.spherical);
    camera.position.copy(orbit.target).add(nextOffset);
    camera.lookAt(orbit.target);
    orbit.update();
  }

  editorCameraDragState.lastPoint = point;
}

function endEditorCameraDrag() {
  editorCameraDragState.lastPoint = null;
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
    if (event.key === 'Escape') closeEditorGeometryContextMenu();
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
    if (event.key === 'f' || event.key === 'F') {
      if (createAdvancedDraftFaceFromSelection()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key === 'l' || event.key === 'L') {
      if (createAdvancedDraftEdgeFromSelection()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (state.selectedEditableEdgeIds.length) {
        resetEditableEdgeSelection();
        renderAll(false);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (state.selectedAdvancedPointIds.length || state.selectedAdvancedEdgeIds.length) {
        resetAdvancedPointSelection();
        resetAdvancedEdgeSelection();
        renderAll();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (deleteSelectedAdvancedDraftEdges()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (state.selectedAdvancedPointIds.length) {
        resetAdvancedPointSelection();
        setMessage('Sélection de points effacée.');
        renderAll(false);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
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
    closeEditorGeometryContextMenu();
    state.selectedShapeId = dom.shapeVariantSelect.value;
    state.selectedFace = null;
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
    resetEditableEdgeSelection();
    if (state.selectedShapeId) storeShapeSnapshot(state.selectedShapeId);
    const piece = findCatalogPiecesForBase().find((item) => item.shape_variant_id === state.selectedShapeId);
    if (piece) state.selectedCatalogPieceId = piece.id;
    renderAll();
  });
  bindElement(dom.catalogPieceSelect, 'change', () => {
    closeEditorGeometryContextMenu();
    state.selectedCatalogPieceId = dom.catalogPieceSelect.value;
    state.selectedFace = null;
    const piece = selectedPiece();
    if (piece) state.selectedShapeId = piece.shape_variant_id;
    resetAdvancedPointSelection();
    resetAdvancedEdgeSelection();
    resetEditableEdgeSelection();
    if (state.selectedShapeId) storeShapeSnapshot(state.selectedShapeId);
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
  const handleAdvancedPieceDisplayModeChange = () => {
    state.advancedPieceDisplayMode = dom.advancedPieceDisplayPointsInput?.checked
      ? ADVANCED_PIECE_DISPLAY_MODES.POINTS
      : ADVANCED_PIECE_DISPLAY_MODES.PIECE;
    renderPreview();
    renderEditorModeUi();
  };
  bindElement(dom.advancedPieceDisplayPieceInput, 'change', handleAdvancedPieceDisplayModeChange);
  bindElement(dom.advancedPieceDisplayPointsInput, 'change', handleAdvancedPieceDisplayModeChange);
  bindElement(dom.chamferSelectedEdgesBtn, 'click', () => createOperationFromSelectedEditableEdges('edge_chamfer'));
  bindElement(dom.filletSelectedEdgesBtn, 'click', () => createOperationFromSelectedEditableEdges('edge_fillet'));
  bindElement(dom.clearEditableEdgeSelectionBtn, 'click', () => {
    closeEditorGeometryContextMenu();
    resetEditableEdgeSelection();
    renderAll(false);
  });
  bindElement(dom.advancedDraftOperationCustomFaceInput, 'change', () => {
    state.advancedDraftOperationType = 'custom_face';
    renderEditorModeUi();
  });
  bindElement(dom.advancedDraftOperationCutInput, 'change', () => {
    state.advancedDraftOperationType = 'cut';
    renderEditorModeUi();
  });
  bindElement(dom.advancedCutKeepNormalInput, 'change', () => {
    state.advancedCutKeepSide = 'normal';
    renderEditorModeUi();
  });
  bindElement(dom.advancedCutKeepInverseInput, 'change', () => {
    state.advancedCutKeepSide = 'inverse';
    renderEditorModeUi();
  });
  bindElement(dom.advancedDraftFaceListSelect, 'change', () => {
    state.selectedAdvancedDraftFaceId = dom.advancedDraftFaceListSelect?.value ?? null;
    renderEditorModeUi();
  });
  bindElement(dom.commitAdvancedDraftFaceBtn, 'click', commitSelectedAdvancedDraftFaceToOperation);
  bindElement(dom.deleteAdvancedDraftFaceBtn, 'click', deleteSelectedAdvancedDraftFace);
  bindElement(dom.advancedCustomFaceOperationListSelect, 'change', () => {
    state.selectedAdvancedCustomFaceOperationId = dom.advancedCustomFaceOperationListSelect?.value ?? null;
    renderEditorModeUi();
  });
  bindElement(dom.deleteAdvancedCustomFaceOperationBtn, 'click', deleteSelectedAdvancedCustomFaceOperation);
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

  for (const button of document.querySelectorAll('.editor-overlay-tabs .tab-button')) {
    button.addEventListener('click', () => {
      document.querySelectorAll('.editor-overlay-tabs .tab-button').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#${button.dataset.tab}`)?.classList.add('active');
    });
  }

  editorInteractionController?.dispose?.();
  editorInteractionController = createEditorInteractionController({
    canvas: renderer.domElement,
    viewportStage: dom.viewportWrap,
    orbitControls: orbit,
    pickPrimitive: pickEditorPrimitive,
    selectPrimitive: selectEditorPrimitive,
    togglePrimitive: toggleEditorPrimitive,
    clearPrimitiveSelection: clearPrimitiveSelectionState,
    getSelectionState: getEditorSelectionState,
    beginViewportPan: beginEditorViewportPan,
    updateViewportPan: updateEditorViewportPan,
    endViewportPan: endEditorViewportPan,
    beginCameraDrag: beginEditorCameraDrag,
    updateCameraDrag: updateEditorCameraDrag,
    endCameraDrag: endEditorCameraDrag,
    openContextMenu: openEditorGeometryContextMenu,
    closeContextMenu: closeEditorGeometryContextMenu,
    getContextActions: getEditorGeometryContextActions,
    getUserSettings: () => EDITOR_CAMERA_SETTINGS,
  });
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

async function loadCatalogJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Impossible de charger ${url}`);
  return response.json();
}

function selectInitialEditorCatalog(fileCatalog, pendingBackup) {
  if (!pendingBackup?.catalog) return { catalog: fileCatalog, restoredPendingBackup: false };
  const fileTime = Date.parse(fileCatalog?.updated_at ?? fileCatalog?.metadata?.updated_at ?? '') || 0;
  const backupTime = Date.parse(pendingBackup.savedAt ?? '') || 0;
  if (backupTime <= fileTime) return { catalog: fileCatalog, restoredPendingBackup: false };
  return { catalog: pendingBackup.catalog, restoredPendingBackup: true };
}

async function loadEditorCatalog() {
  try {
    const fileCatalog = await loadCatalogJson(EDITOR_CATALOG_URL, { cache: 'no-store' });
    return { catalog: fileCatalog, bootstrappedFromAssembly: false };
  } catch (error) {
    const fallbackCatalog = await loadCatalogJson(ASSEMBLY_CATALOG_URL, { cache: 'no-store' });
    return { catalog: fallbackCatalog, bootstrappedFromAssembly: true, bootstrapError: error };
  }
}

async function init() {
  editorCatalogAutosave = createEditorCatalogAutosaveController({
    getCatalog: () => state.catalog,
    writeCatalog: (catalog) => writeCatalogToProjectFile(catalog),
    onStateChange: (snapshot) => {
      syncEditorSaveState(snapshot);
      renderStats();
    },
  });

  const loadResult = await loadEditorCatalog();
  const pendingBackup = loadPendingEditorCatalogBackup();
  const selectedCatalog = selectInitialEditorCatalog(loadResult.catalog, pendingBackup);
  state.catalog = selectedCatalog.catalog;
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
  if (loadResult.bootstrappedFromAssembly) {
    setMessage('Catalogue éditeur initialisé depuis Assembly.');
    await saveEditorCatalogNow('bootstrap_from_assembly');
  } else if (selectedCatalog.restoredPendingBackup) {
    setMessage('Brouillon local restauré après échec d’écriture précédent.');
    renderAll(false);
  }
  animate();
}

init().catch((error) => {
  console.error(error);
  setElementText(dom.stats, String(error.message || error));
});
