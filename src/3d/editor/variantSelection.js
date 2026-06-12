export function shapeBelongsToEditorBase(shape, familyId, sizeId) {
  if (!shape || !familyId || !sizeId || shape.size_id !== sizeId) return false;
  const basedOn = shape.metadata?.based_on;
  if (basedOn === `${familyId}:${sizeId}`) return true;
  return String(shape.id ?? '').startsWith(`shape_${familyId}_${sizeId}_`);
}

export function getEditorCatalogPiecesForBase(catalog, familyId, sizeId) {
  return (catalog?.catalog_pieces ?? [])
    .filter((piece) => piece.family_id === familyId && piece.size_id === sizeId)
    .sort((a, b) => a.label_fr.localeCompare(b.label_fr, 'fr'));
}

export function getEditorShapesForBase(catalog, familyId, sizeId) {
  if (!familyId || !sizeId) return [];
  const linkedIds = new Set(
    (catalog?.catalog_pieces ?? [])
      .filter((piece) => piece.family_id === familyId && piece.size_id === sizeId)
      .map((piece) => piece.shape_variant_id),
  );

  return (catalog?.shape_variants ?? [])
    .filter((shape) => linkedIds.has(shape.id) || shapeBelongsToEditorBase(shape, familyId, sizeId))
    .sort((a, b) => (Number(a.variant_index) || 0) - (Number(b.variant_index) || 0) || a.id.localeCompare(b.id));
}

export function getEditorSpecsForBase(catalog, familyId, sizeId) {
  return (catalog?.spec_profiles ?? [])
    .filter((spec) => spec.family_id === familyId && spec.size_id === sizeId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getEditorRecipesForBase(catalog, familyId, sizeId) {
  const specIds = new Set(getEditorSpecsForBase(catalog, familyId, sizeId).map((spec) => spec.id));
  return (catalog?.recipes ?? [])
    .filter((recipe) => specIds.has(recipe.output_spec_profile_id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getEditorAvailableVariantIndexes(catalog, familyId, sizeId, maxIndex = 14) {
  const used = new Set(getEditorShapesForBase(catalog, familyId, sizeId).map((shape) => Number(shape.variant_index) || 0));
  const available = [];
  for (let index = 2; index <= maxIndex; index += 1) {
    if (!used.has(index)) available.push(index);
  }
  return available;
}
