export const EDITOR_MODES = Object.freeze({
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
});

export function normalizeEditorMode(mode) {
  return mode === EDITOR_MODES.ADVANCED ? EDITOR_MODES.ADVANCED : EDITOR_MODES.SIMPLE;
}

export function isEditorAdvancedMode(mode) {
  return normalizeEditorMode(mode) === EDITOR_MODES.ADVANCED;
}

export function switchEditorModeState(editorState, nextMode) {
  if (!editorState) return { editorMode: normalizeEditorMode(nextMode) };
  return {
    ...editorState,
    editorMode: normalizeEditorMode(nextMode),
  };
}

export function deriveAdvancedModePreviewSummary({
  shape,
  size,
  selectedCatalogPieceId,
  selectedBase,
  subgridUnit = 0.5,
  pointGridSummary = null,
  pointSelectionSummary = null,
  edgeCount = 0,
  faceCount = 0,
}) {
  if (!shape || !size?.dimensions) return 'Aucune variante sélectionnée.';
  const dimensions = size.dimensions;
  return [
    `mode       : édition géométrique`,
    `variante   : ${shape.id}`,
    `catalog    : ${selectedCatalogPieceId ?? 'aucune pièce liée'}`,
    `base       : ${selectedBase ? `${selectedBase.family_id} ${selectedBase.size_id}` : 'aucune'}`,
    `bbox       : ${dimensions.length}×${dimensions.width}×${dimensions.height}`,
    `grid       : ${subgridUnit}`,
    pointGridSummary ? `points     : ${pointGridSummary.total} (${pointGridSummary.boundaryCount} surface, ${pointGridSummary.interiorCount} internes)` : '',
    pointSelectionSummary ? `sélection : ${pointSelectionSummary.count} point(s)` : '',
    `lignes     : ${edgeCount}`,
    `faces      : ${faceCount}`,
    `géométrie  : ${shape.generation?.mode ?? 'n/a'}`,
  ].join('\n');
}
