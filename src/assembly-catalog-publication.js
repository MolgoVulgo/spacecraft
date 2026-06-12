function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createShapeValidationReport(shape, size) {
  const errors = [];
  const generationMode = shape?.generation?.mode;

  if (!size) errors.push('size_id introuvable');
  if (!generationMode) errors.push('generation.mode absent');
  if (generationMode === 'advanced_mesh') errors.push('advanced_mesh obsolète');
  if (generationMode === 'voxel_grid') {
    const cells = (shape?.generation?.cells ?? []).filter((cell) => cell?.enabled !== false);
    if (!cells.length) errors.push('aucune cellule active');
  }
  if (generationMode === 'parametric_shape' && !['point_1', 'point_2', 'point_3'].includes(shape?.generation?.base?.type)) {
    errors.push('type paramétrique inconnu');
  }

  for (const anchor of shape?.anchors ?? []) {
    if (!anchor?.position) errors.push(`ancre ${anchor?.id ?? '?'} sans position`);
    if (!anchor?.normal && !anchor?.face) errors.push(`ancre ${anchor?.id ?? '?'} sans normal/face`);
  }

  for (const operation of shape?.generation?.operations ?? []) {
    if (!['round', 'chamfer', 'slope', 'cut', 'custom_face'].includes(operation?.type)) {
      errors.push(`opération inconnue ${operation?.type ?? '?'}`);
    }
    if (operation?.type === 'round' && Number(operation?.radius) !== 1) errors.push('arrondi avec rayon différent de 1');
    if (operation?.type === 'chamfer' && Number(operation?.size) !== 0.5) errors.push('chanfrein avec taille différente de 0.5');
  }

  return { errors };
}

export function buildAssemblyCatalogFromEditorCatalog(editorCatalog, options = {}) {
  const catalog = cloneJson(editorCatalog ?? {});
  const shapeVariants = Array.isArray(catalog.shape_variants) ? catalog.shape_variants : [];
  const sizes = Array.isArray(catalog.sizes) ? catalog.sizes : [];
  const sizeById = new Map(sizes.map((size) => [size.id, size]));

  const report = {
    publishable: false,
    publishedPieces: 0,
    publishedShapes: 0,
    skippedDraft: 0,
    skippedChecked: 0,
    skippedInvalid: 0,
    skippedWithErrors: [],
  };

  const publishedShapes = [];
  for (const shape of shapeVariants) {
    if (shape?.status !== 'validated') {
      if (shape?.status === 'draft' || !shape?.status) report.skippedDraft += 1;
      else if (shape?.status === 'checked') report.skippedChecked += 1;
      else report.skippedInvalid += 1;
      continue;
    }

    const validation = createShapeValidationReport(shape, sizeById.get(shape?.size_id) ?? null);
    if (validation.errors.length) {
      report.skippedInvalid += 1;
      report.skippedWithErrors.push({ shapeId: shape?.id ?? null, errors: validation.errors });
      continue;
    }

    publishedShapes.push(shape);
  }

  const publishedShapeIds = new Set(publishedShapes.map((shape) => shape.id));
  const publishedPieces = (catalog.catalog_pieces ?? []).filter((piece) => publishedShapeIds.has(piece?.shape_variant_id));
  const publishedSpecIds = new Set(publishedPieces.map((piece) => piece.spec_profile_id).filter(Boolean));
  const publishedRecipeIds = new Set(publishedPieces.map((piece) => piece.recipe_id).filter(Boolean));
  const publishedFamilyIds = new Set(publishedPieces.map((piece) => piece.family_id).filter(Boolean));
  const publishedSizeIds = new Set([
    ...publishedPieces.map((piece) => piece.size_id).filter(Boolean),
    ...publishedShapes.map((shape) => shape.size_id).filter(Boolean),
  ]);

  const assemblyCatalog = {
    schema_version: catalog.schema_version,
    game: catalog.game,
    units: catalog.units,
    definitions: catalog.definitions,
    ship_blueprint_schema: catalog.ship_blueprint_schema,
    sizes: (catalog.sizes ?? []).filter((size) => publishedSizeIds.has(size?.id)),
    families: (catalog.families ?? []).filter((family) => publishedFamilyIds.has(family?.id)),
    shape_variants: publishedShapes,
    spec_profiles: (catalog.spec_profiles ?? []).filter((spec) => publishedSpecIds.has(spec?.id)),
    recipes: (catalog.recipes ?? []).filter((recipe) => publishedRecipeIds.has(recipe?.id)),
    catalog_pieces: publishedPieces,
    base_piece_models: (catalog.base_piece_models ?? [])
      .filter((model) => publishedFamilyIds.has(model?.family_id))
      .map((model) => ({
        ...model,
        sizes: (model?.sizes ?? []).filter((sizeId) => publishedSizeIds.has(sizeId)),
      })),
  };

  report.publishedPieces = assemblyCatalog.catalog_pieces.length;
  report.publishedShapes = assemblyCatalog.shape_variants.length;
  report.publishable = report.publishedPieces > 0;

  if (options.includeSourceCatalog) {
    return { catalog: assemblyCatalog, report, sourceCatalog: catalog };
  }
  return { catalog: assemblyCatalog, report };
}
