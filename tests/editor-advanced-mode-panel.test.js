import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} not found`);

  let depth = 0;
  let seenBody = false;
  let end = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
      seenBody = true;
    } else if (char === '}') {
      depth -= 1;
      if (seenBody && depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  assert.notEqual(end, -1, `function ${name} end not found`);
  return source.slice(start, end);
}

async function loadEditorPanelHarness() {
  const source = await readFile(new URL('../src/editor.js', import.meta.url), 'utf8');
  const script = [
    'const EDITOR_SUBGRID_DEFAULT_STEP = 0.5;',
    "const ADVANCED_PIECE_DISPLAY_MODES = { PIECE: 'piece', POINTS: 'points' };",
    extractFunction(source, 'isProtectedStandardVariantShape'),
    extractFunction(source, 'isPrimaryVariantShape'),
    extractFunction(source, 'isVariantEditingLocked'),
    extractFunction(source, 'applyEditorUserPreferences'),
    extractFunction(source, 'renderEditorModeUi'),
    'module.exports = { isVariantEditingLocked, applyEditorUserPreferences, renderEditorModeUi };',
  ].join('\n\n');

  const protectedControls = [
    { hidden: false, style: {}, attributes: {}, tabIndex: 0, setAttribute(name, value) { this.attributes[name] = value; } },
    { hidden: false, style: {}, attributes: {}, tabIndex: 0, setAttribute(name, value) { this.attributes[name] = value; } },
    { hidden: false, style: {}, attributes: {}, tabIndex: 0, setAttribute(name, value) { this.attributes[name] = value; } },
  ];
  const formControlsBySelector = new Map([
    ['#shapeTab input', [{ disabled: false }]],
    ['#shapeTab select', [{ disabled: false }]],
    ['#shapeTab button', [{ disabled: false }]],
    ['#anchorsTab input', [{ disabled: false }]],
    ['#anchorsTab select', [{ disabled: false }]],
    ['#anchorsTab button', [{ disabled: false }]],
  ]);
  const panel = { hidden: false };
  const summary = { textContent: '' };
  const noopInput = { checked: false, disabled: false };
  const selectionSummary = { textContent: '' };

  const context = {
    module: { exports: {} },
    exports: {},
    document: {
      body: { dataset: {} },
      querySelectorAll(selector) {
        if (selector === '.catalog-tree-size-delete-btn,.catalog-tree-variant-delete-btn,.editor-variant-primary-edit-btn') {
          return protectedControls;
        }
        return formControlsBySelector.get(selector) ?? [];
      },
    },
    state: {
      editorMode: 'advanced',
      selectedAdvancedPointIds: [],
      selectedEditableEdgeIds: [],
      selectedEditableEdgeShapeId: null,
      selectedCatalogPieceId: null,
      selectedBase: null,
      catalog: null,
    },
    dom: {
      advancedPieceDisplayPieceInput: { ...noopInput },
      advancedPieceDisplayPointsInput: { ...noopInput },
      advancedDraftOperationCustomFaceInput: { ...noopInput },
      advancedDraftOperationCutInput: { ...noopInput },
      advancedCutKeepNormalInput: { ...noopInput },
      advancedCutKeepInverseInput: { ...noopInput },
      editorAdvancedModePanel: panel,
      editorAdvancedControls: { hidden: false },
      editorAdvancedModeSummary: summary,
      editableEdgeSelectionSummary: selectionSummary,
      chamferSelectedEdgesBtn: { disabled: false },
      filletSelectedEdgesBtn: { disabled: false },
      clearEditableEdgeSelectionBtn: { disabled: false },
      advancedDraftFaceListSelect: { disabled: false },
      advancedCustomFaceOperationListSelect: { disabled: false },
      commitAdvancedDraftFaceBtn: { disabled: false },
      deleteAdvancedDraftFaceBtn: { disabled: false },
      deleteAdvancedCustomFaceOperationBtn: { disabled: false },
    },
    selectedShape: () => context.currentShape,
    editorIsAdvancedMode: () => true,
    getSize: () => ({ dimensions: { length: 4, width: 3, height: 1 } }),
    summarizeEditorPointGrid: () => ({ total: 0 }),
    summarizeAdvancedPointSelection: () => ({ count: 0 }),
    getAdvancedPieceDisplayMode: () => 'piece',
    getAdvancedDraftOperationType: () => 'custom_face',
    getAdvancedCutKeepSide: () => 'normal',
    deriveAdvancedModePreviewSummary: () => 'summary',
    getActiveAdvancedDraftEdges: () => [],
    getActiveAdvancedDraftFaces: () => [],
    getEditableEdgesForShape: () => [{ id: 'top-front' }, { id: 'top-left' }],
    isVariantEditingLocked: (shape) => shape?.variant_index === 1,
    renderAdvancedFaceOperationControls: () => {},
    setElementText(element, text) {
      element.textContent = text;
    },
    currentShape: null,
  };

  vm.runInNewContext(script, context);
  return { ...context.module.exports, context, panel, protectedControls, selectionSummary };
}

test('editor advanced mode panel visibility depends only on selected variant editability', async () => {
  const { applyEditorUserPreferences, renderEditorModeUi, context, panel, protectedControls, selectionSummary } = await loadEditorPanelHarness();

  context.currentShape = { id: 'shape_v01', variant_index: 1, metadata: {} };
  renderEditorModeUi();
  assert.equal(panel.hidden, true);

  context.currentShape = { id: 'shape_v02', variant_index: 2, metadata: { editor_variant_locked: false } };
  renderEditorModeUi();
  assert.equal(panel.hidden, false);
  assert.equal(context.dom.editorAdvancedControls.hidden, false);
  assert.equal(selectionSummary.textContent, 'Aucune arête sélectionnée.');

  applyEditorUserPreferences({ showDeleteButtons: false });
  assert.equal(panel.hidden, false);
  for (const control of protectedControls) {
    assert.equal(control.hidden, true);
    assert.equal(control.style.display, 'none');
  }

  applyEditorUserPreferences({ showDeleteButtons: true });
  assert.equal(panel.hidden, false);
  for (const control of protectedControls) {
    assert.equal(control.hidden, false);
    assert.equal(control.style.display, '');
  }
});

test('hidden editor advanced mode panel has an explicit CSS display rule', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /#editorAdvancedModePanel\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});
