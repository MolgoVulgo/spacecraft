const DEFAULT_POINT_GRID_STEP = 0.5;

function toDimensionValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundGridCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

export function getEditorPointGridStep(step = DEFAULT_POINT_GRID_STEP) {
  const value = Number(step);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_POINT_GRID_STEP;
}

export function isEditorPointWithinBounds(point, size) {
  const dimensions = size?.dimensions ?? size ?? {};
  const length = toDimensionValue(dimensions.length);
  const width = toDimensionValue(dimensions.width);
  const height = toDimensionValue(dimensions.height);

  return point.x >= 0 && point.x <= length
    && point.y >= 0 && point.y <= width
    && point.z >= 0 && point.z <= height;
}

export function generateEditorPointGrid(size, step = DEFAULT_POINT_GRID_STEP) {
  const dimensions = size?.dimensions ?? size ?? {};
  const length = toDimensionValue(dimensions.length);
  const width = toDimensionValue(dimensions.width);
  const height = toDimensionValue(dimensions.height);
  const gridStep = getEditorPointGridStep(step);
  const points = [];

  if (!length || !width || !height) return points;

  for (let x = 0; x <= length + 1e-9; x += gridStep) {
    for (let y = 0; y <= width + 1e-9; y += gridStep) {
      for (let z = 0; z <= height + 1e-9; z += gridStep) {
        const px = roundGridCoordinate(Math.min(x, length));
        const py = roundGridCoordinate(Math.min(y, width));
        const pz = roundGridCoordinate(Math.min(z, height));
        const isBoundary = px === 0 || px === length || py === 0 || py === width || pz === 0 || pz === height;
        points.push({
          id: `pt_${String(px).replace('.', '_')}_${String(py).replace('.', '_')}_${String(pz).replace('.', '_')}`,
          x: px,
          y: py,
          z: pz,
          isBoundary,
        });
      }
    }
  }

  return points;
}

export function summarizeEditorPointGrid(size, step = DEFAULT_POINT_GRID_STEP) {
  const points = generateEditorPointGrid(size, step);
  const boundaryCount = points.filter((point) => point.isBoundary).length;
  return {
    step: getEditorPointGridStep(step),
    total: points.length,
    boundaryCount,
    interiorCount: points.length - boundaryCount,
  };
}
