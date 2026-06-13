function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

export function createCatalogLookup(catalog = {}) {
  return {
    sizes: mapById(catalog.sizes),
    families: mapById(catalog.families),
    partTypes: mapById(catalog.part_types),
    materials: mapById(catalog.materials),
    shapeVariants: mapById(catalog.shape_variants),
    specProfiles: mapById(catalog.spec_profiles),
    recipes: mapById(catalog.recipes),
    catalogPieces: mapById(catalog.catalog_pieces),
  };
}

export function findCatalogPieceByFamilySizeVariant(catalog = {}, familyId, sizeId, variantIndex) {
  const shapeById = new Map((catalog.shape_variants ?? []).map((shape) => [shape.id, shape]));
  return (catalog.catalog_pieces ?? []).find((piece) => {
    if (piece?.family_id !== familyId || piece?.size_id !== sizeId) return false;
    const shape = shapeById.get(piece.shape_variant_id);
    return Number(shape?.variant_index) === Number(variantIndex);
  }) ?? null;
}
