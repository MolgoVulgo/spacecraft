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

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
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

function validateBooleanAxesObject(value, path, reporter, code = 'invalid_symmetry') {
  if (!hasOwnObject(value)) {
    reporter.error(path, 'objet axes absent ou invalide.', code);
    return;
  }
  for (const axis of ['length', 'width', 'height']) {
    if (typeof value[axis] !== 'boolean') {
      reporter.error(`${path}.${axis}`, `${axis} doit être booléen.`, code);
    }
  }
}

function validateVector(value, path, reporter, code = 'invalid_vector') {
  if (!hasOwnObject(value)) {
    reporter.error(path, 'vecteur absent ou invalide.', code);
    return;
  }
  for (const axis of ['x', 'y', 'z']) {
    if (!isFiniteNumber(value[axis])) {
      reporter.error(`${path}.${axis}`, `${axis} doit être un nombre fini.`, code);
    }
  }
}

function validateDimensions(value, path, reporter, code = 'invalid_dimensions') {
  if (!hasOwnObject(value)) {
    reporter.error(path, 'dimensions absentes ou invalides.', code);
    return;
  }
  for (const axis of ['length', 'width', 'height']) {
    if (!isFiniteNumber(value[axis]) || Number(value[axis]) <= 0) {
      reporter.error(`${path}.${axis}`, `${axis} doit être un nombre positif.`, code);
    }
  }
}

function validatePlacementRules(placementRules, path, reporter) {
  if (!hasOwnObject(placementRules)) {
    reporter.error(path, 'placement_rules absent ou invalide.', 'invalid_placement_rules');
    return;
  }

  if (placementRules.allowed_symmetry != null) {
    validateBooleanAxesObject(placementRules.allowed_symmetry, `${path}.allowed_symmetry`, reporter);
  }

  if (placementRules.allowed_orientations != null) {
    if (!Array.isArray(placementRules.allowed_orientations) || placementRules.allowed_orientations.length === 0) {
      reporter.error(`${path}.allowed_orientations`, 'allowed_orientations doit être un tableau non vide.', 'invalid_orientation');
    } else {
      for (const [index, orientation] of placementRules.allowed_orientations.entries()) {
        const orientationPath = `${path}.allowed_orientations[${index}]`;
        if (!orientation?.id) reporter.error(`${orientationPath}.id`, 'id absent.', 'missing_id');
        validateDimensions(orientation?.dimensions, `${orientationPath}.dimensions`, reporter, 'invalid_orientation');
        validateVector(orientation?.rotation, `${orientationPath}.rotation`, reporter, 'invalid_orientation');
      }
    }
  }

  if (placementRules.mount_points != null) {
    if (!Array.isArray(placementRules.mount_points)) {
      reporter.error(`${path}.mount_points`, 'mount_points doit être un tableau.', 'invalid_mount_point');
    } else {
      for (const [index, mountPoint] of placementRules.mount_points.entries()) {
        const mountPath = `${path}.mount_points[${index}]`;
        if (!mountPoint?.id) reporter.error(`${mountPath}.id`, 'id absent.', 'missing_id');
        if (!mountPoint?.face) reporter.error(`${mountPath}.face`, 'face absente.', 'invalid_mount_point');
        validateVector(mountPoint?.position, `${mountPath}.position`, reporter, 'invalid_mount_point');
        validateVector(mountPoint?.normal, `${mountPath}.normal`, reporter, 'invalid_mount_point');
        if (mountPoint?.required != null && typeof mountPoint.required !== 'boolean') {
          reporter.error(`${mountPath}.required`, 'required doit être booléen.', 'invalid_mount_point');
        }
      }
    }
  }

  if (placementRules.functional_zones != null) {
    if (!Array.isArray(placementRules.functional_zones)) {
      reporter.error(`${path}.functional_zones`, 'functional_zones doit être un tableau.', 'invalid_functional_zone');
    } else {
      for (const [index, zone] of placementRules.functional_zones.entries()) {
        const zonePath = `${path}.functional_zones[${index}]`;
        if (!zone?.id) reporter.error(`${zonePath}.id`, 'id absent.', 'missing_id');
        if (!zone?.face) reporter.error(`${zonePath}.face`, 'face absente.', 'invalid_functional_zone');
        if (!zone?.direction) reporter.error(`${zonePath}.direction`, 'direction absente.', 'invalid_functional_zone');
        if (zone?.must_be_clear != null && typeof zone.must_be_clear !== 'boolean') {
          reporter.error(`${zonePath}.must_be_clear`, 'must_be_clear doit être booléen.', 'invalid_functional_zone');
        }
        if (zone?.clearance != null && (!isFiniteNumber(zone.clearance) || Number(zone.clearance) < 0)) {
          reporter.error(`${zonePath}.clearance`, 'clearance doit être un nombre positif ou nul.', 'invalid_functional_zone');
        }
      }
    }
  }
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
    'part_types',
    'materials',
    'shape_variants',
    'spec_profiles',
    'recipes',
    'catalog_pieces',
  ];

  const idSets = {};
  for (const name of collectionNames) {
    const items = catalog[name];
    if ((name === 'part_types' || name === 'materials') && items == null) {
      idSets[name] = new Set();
      continue;
    }
    if (!Array.isArray(items)) {
      reporter.error(name, `${name} doit être un tableau.`, 'invalid_collection');
      idSets[name] = new Set();
      continue;
    }
    idSets[name] = collectIds(items, name, reporter);
  }

  for (const [index, shape] of (catalog.shape_variants ?? []).entries()) {
    const path = `shape_variants[${index}]`;
    const size = (catalog.sizes ?? []).find((item) => item.id === shape?.size_id) ?? null;
    if (!idSets.sizes?.has(shape?.size_id)) {
      reporter.error(`${path}.size_id`, `size_id introuvable (${shape?.size_id ?? 'absent'}).`, 'missing_reference');
    }
    if (!shape?.generation?.mode) {
      reporter.error(`${path}.generation.mode`, 'generation.mode absent.', 'missing_field');
    } else if (shape.generation.mode === 'legacy_mesh') {
      reporter.warn(`${path}.generation.mode`, 'legacy_mesh encore présent.', 'legacy_generation');
    } else if (shape.generation.mode === 'advanced_mesh') {
      reporter.error(`${path}.generation.mode`, 'advanced_mesh est obsolète; utiliser voxel_grid / parametric_shape avec generation.operations[].', 'obsolete_generation');
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

  for (const [index, partType] of (catalog.part_types ?? []).entries()) {
    const path = `part_types[${index}]`;
    if (!idSets.families?.has(partType?.family_id)) {
      reporter.error(`${path}.family_id`, `family_id introuvable (${partType?.family_id ?? 'absent'}).`, 'missing_reference');
    }
    if (partType?.requires_placement_rules != null && typeof partType.requires_placement_rules !== 'boolean') {
      reporter.error(`${path}.requires_placement_rules`, 'requires_placement_rules doit être booléen.', 'invalid_field');
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
    if (piece?.type_id && !idSets.part_types?.has(piece.type_id)) {
      reporter.error(`${path}.type_id`, `type_id introuvable (${piece.type_id}).`, 'missing_reference');
    }
    if (piece?.material_id && !idSets.materials?.has(piece.material_id)) {
      reporter.error(`${path}.material_id`, `material_id introuvable (${piece.material_id}).`, 'missing_reference');
    }
    if (piece?.spec_profile_id && !idSets.spec_profiles?.has(piece.spec_profile_id)) {
      reporter.error(`${path}.spec_profile_id`, `spec_profile_id introuvable (${piece.spec_profile_id}).`, 'missing_reference');
    }
    if (piece?.recipe_id && !idSets.recipes?.has(piece.recipe_id)) {
      reporter.error(`${path}.recipe_id`, `recipe_id introuvable (${piece.recipe_id}).`, 'missing_reference');
    }

    const shape = (catalog.shape_variants ?? []).find((item) => item.id === piece?.shape_variant_id);
    const spec = (catalog.spec_profiles ?? []).find((item) => item.id === piece?.spec_profile_id);
    const partType = (catalog.part_types ?? []).find((item) => item.id === piece?.type_id);
    if (shape?.size_id && piece?.size_id && shape.size_id !== piece.size_id) {
      reporter.error(`${path}.shape_variant_id`, `shape.size_id (${shape.size_id}) != piece.size_id (${piece.size_id}).`, 'size_mismatch');
    }
    if (spec?.size_id && piece?.size_id && spec.size_id !== piece.size_id) {
      reporter.error(`${path}.spec_profile_id`, `spec.size_id (${spec.size_id}) != piece.size_id (${piece.size_id}).`, 'size_mismatch');
    }
    if (partType?.family_id && piece?.family_id && partType.family_id !== piece.family_id) {
      reporter.error(`${path}.type_id`, `type.family_id (${partType.family_id}) != piece.family_id (${piece.family_id}).`, 'family_type_mismatch');
    }
    if (piece?.placement_rules != null) {
      validatePlacementRules(piece.placement_rules, `${path}.placement_rules`, reporter);
    }
    if (partType?.requires_placement_rules && !hasOwnObject(piece?.placement_rules)) {
      reporter.error(`${path}.placement_rules`, 'placement_rules requis pour ce type de pièce.', 'missing_placement_rules');
    }
    if (piece?.fixed_catalog_entry === false) {
      reporter.warn(`${path}.fixed_catalog_entry`, 'fixed_catalog_entry devrait rester true pour le catalogue fermé.', 'catalog_mutability');
    }
  }

  return reporter.build();
}
