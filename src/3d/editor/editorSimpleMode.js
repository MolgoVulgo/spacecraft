export function deriveEditorPreviewState({
  shape,
  size,
  advanced,
  fullCells,
  getShapeCells,
  getSuppressedCellKeysForOperations,
  cellKey,
  getAdvancedMeshValidation,
}) {
  const operations = shape?.generation?.operations ?? [];
  const suppressed = getSuppressedCellKeysForOperations(operations, size);
  const allCells = getShapeCells(shape, size).filter((cell) => cell.enabled !== false);
  const visibleCells = advanced
    ? fullCells(size)
    : allCells.filter((cell) => !suppressed.has(cellKey(cell.x, cell.y, cell.z)));
  const advancedValidation = getAdvancedMeshValidation(shape, size);
  const faceCount = shape?.generation?.visual_mesh?.faces?.length ?? 0;

  return {
    advanced,
    allCells,
    visibleCells,
    advancedValidation,
    shouldRenderMesh: !advanced || (advancedValidation.valid && faceCount > 0),
    shouldRenderVoxelGuide: !advanced,
    shouldRenderAdvancedHandles: advanced,
  };
}
