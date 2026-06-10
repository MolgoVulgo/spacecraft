function createIssue(level, path, message, code) {
  return { level, path, message, code };
}

function createReporter() {
  const errors = [];
  const warnings = [];
  return {
    error(path, message, code = 'invalid') {
      errors.push(createIssue('error', path, message, code));
    },
    warn(path, message, code = 'warning') {
      warnings.push(createIssue('warning', path, message, code));
    },
    build() {
      return { valid: errors.length === 0, errors, warnings };
    },
  };
}

function hasOwnObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectIds(items, path, reporter) {
  const ids = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const itemPath = `${path}[${index}]`;
    const id = item?.id;
    if (!id) {
      reporter.error(`${itemPath}.id`, 'id absent.', 'missing_id');
      continue;
    }
    if (ids.has(id)) {
      reporter.error(`${itemPath}.id`, `id dupliqué: ${id}.`, 'duplicate_id');
      continue;
    }
    ids.add(id);
  }
  return ids;
}

export function formatValidationIssues(issues = []) {
  return issues.map((issue) => `${issue.path}: ${issue.message}`);
}

export function validateCatalogData(catalog) {
  const reporter = createReporter();

  if (!hasOwnObject(catalog)) {
    reporter.error('catalog', 'catalog absent ou invalide.', 'invalid_catalog');
    return reporter.build();
  }

  const requiredTopLevelFields = [
    'schema_version',
    'game',
    'units',
    'definitions',
    'sizes',
    'families',
    'shape_variants',
    'spec_profiles',
    'recipes',
    'catalog_pieces',
    'ship_blueprint_schema',
  ];

  for (const field of requiredTopLevelFields) {
    if (catalog[field] == null) {
      reporter.error(field, `${field} absent.`, 'missing_field');
    }
  }

  const collectionNames = [
    'sizes',
    'families',
    'shape_variants',
    'spec_profiles',
    'recipes',
    'catalog_pieces',
  ];

  const idSets = {};
  for (const name of collectionNames) {
    const items = catalog[name];
    if (!Array.isArray(items)) {
      reporter.error(name, `${name} doit être un tableau.`, 'invalid_collection');
      idSets[name] = new Set();
      continue;
    }
    idSets[name] = collectIds(items, name, reporter);
  }

  for (const [index, shape] of (catalog.shape_variants ?? []).entries()) {
    const path = `shape_variants[${index}]`;
    if (!idSets.sizes?.has(shape?.size_id)) {
      reporter.error(`${path}.size_id`, `size_id introuvable (${shape?.size_id ?? 'absent'}).`, 'missing_reference');
    }
    if (!shape?.generation?.mode) {
      reporter.error(`${path}.generation.mode`, 'generation.mode absent.', 'missing_field');
    } else if (shape.generation.mode === 'legacy_mesh') {
      reporter.warn(`${path}.generation.mode`, 'legacy_mesh encore présent.', 'legacy_generation');
    }
    for (const [anchorIndex, anchor] of (shape?.anchors ?? []).entries()) {
      if (!hasOwnObject(anchor?.position) || !hasOwnObject(anchor?.normal)) {
        reporter.error(`${path}.anchors[${anchorIndex}]`, 'anchor position/normal absent.', 'invalid_anchor');
      }
    }
  }

  for (const [index, spec] of (catalog.spec_profiles ?? []).entries()) {
    const path = `spec_profiles[${index}]`;
    if (spec?.size_id && !idSets.sizes?.has(spec.size_id)) {
      reporter.error(`${path}.size_id`, `size_id introuvable (${spec.size_id}).`, 'missing_reference');
    }
  }

  for (const [index, recipe] of (catalog.recipes ?? []).entries()) {
    const path = `recipes[${index}]`;
    if (!idSets.spec_profiles?.has(recipe?.output_spec_profile_id)) {
      reporter.error(`${path}.output_spec_profile_id`, `output_spec_profile_id introuvable (${recipe?.output_spec_profile_id ?? 'absent'}).`, 'missing_reference');
    }
  }

  for (const [index, piece] of (catalog.catalog_pieces ?? []).entries()) {
    const path = `catalog_pieces[${index}]`;
    if (!idSets.families?.has(piece?.family_id)) {
      reporter.error(`${path}.family_id`, `family_id introuvable (${piece?.family_id ?? 'absent'}).`, 'missing_reference');
    }
    if (!idSets.sizes?.has(piece?.size_id)) {
      reporter.error(`${path}.size_id`, `size_id introuvable (${piece?.size_id ?? 'absent'}).`, 'missing_reference');
    }
    if (!idSets.shape_variants?.has(piece?.shape_variant_id)) {
      reporter.error(`${path}.shape_variant_id`, `shape_variant_id introuvable (${piece?.shape_variant_id ?? 'absent'}).`, 'missing_reference');
    }
    if (piece?.spec_profile_id && !idSets.spec_profiles?.has(piece.spec_profile_id)) {
      reporter.error(`${path}.spec_profile_id`, `spec_profile_id introuvable (${piece.spec_profile_id}).`, 'missing_reference');
    }
    if (piece?.recipe_id && !idSets.recipes?.has(piece.recipe_id)) {
      reporter.error(`${path}.recipe_id`, `recipe_id introuvable (${piece.recipe_id}).`, 'missing_reference');
    }

    const shape = (catalog.shape_variants ?? []).find((item) => item.id === piece?.shape_variant_id);
    const spec = (catalog.spec_profiles ?? []).find((item) => item.id === piece?.spec_profile_id);
    if (shape?.size_id && piece?.size_id && shape.size_id !== piece.size_id) {
      reporter.error(`${path}.shape_variant_id`, `shape.size_id (${shape.size_id}) != piece.size_id (${piece.size_id}).`, 'size_mismatch');
    }
    if (spec?.size_id && piece?.size_id && spec.size_id !== piece.size_id) {
      reporter.error(`${path}.spec_profile_id`, `spec.size_id (${spec.size_id}) != piece.size_id (${piece.size_id}).`, 'size_mismatch');
    }
    if (piece?.fixed_catalog_entry === false) {
      reporter.warn(`${path}.fixed_catalog_entry`, 'fixed_catalog_entry devrait rester true pour le catalogue fermé.', 'catalog_mutability');
    }
  }

  return reporter.build();
}
