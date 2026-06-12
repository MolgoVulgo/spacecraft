export function deriveEditorPreviewState({
  shape,
  size,
  fullCells,
  getShapeCells,
  getSuppressedCellKeysForOperations,
  cellKey,
}) {
  const operations = shape?.generation?.operations ?? [];
  const suppressed = getSuppressedCellKeysForOperations(operations, size);
  const allCells = getShapeCells(shape, size).filter((cell) => cell.enabled !== false);
  const visibleCells = allCells.filter((cell) => !suppressed.has(cellKey(cell.x, cell.y, cell.z)));

  return {
    allCells,
    visibleCells,
    shouldRenderMesh: true,
    shouldRenderVoxelGuide: true,
  };
}
