export function normalizeAdvancedPointSelection(pointIds = []) {
  const seen = new Set();
  const result = [];
  for (const pointId of pointIds) {
    const value = String(pointId ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function selectAdvancedPoint(pointId, currentSelection = [], options = {}) {
  const normalizedCurrent = normalizeAdvancedPointSelection(currentSelection);
  const value = String(pointId ?? '').trim();
  if (!value) return normalizedCurrent;

  if (options.multi) {
    if (normalizedCurrent.includes(value)) return normalizedCurrent;
    return [...normalizedCurrent, value];
  }

  return [value];
}

export function clearAdvancedPointSelection() {
  return [];
}

export function summarizeAdvancedPointSelection(pointIds = []) {
  const normalized = normalizeAdvancedPointSelection(pointIds);
  return {
    ids: normalized,
    count: normalized.length,
  };
}
