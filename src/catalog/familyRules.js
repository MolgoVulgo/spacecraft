const DEFAULT_ALLOWED_SYMMETRY = Object.freeze({
  length: true,
  width: true,
  height: true,
});

const DEFAULT_FUNCTIONAL_FAMILY = Object.freeze({
  id: 'structure',
  label_fr: 'Structure',
  allowed_types: ['structure_block'],
  legacy: true,
});

const DEFAULT_PART_TYPE = Object.freeze({
  id: 'structure_block',
  family_id: 'structure',
  label_fr: 'Bloc structurel',
  requires_placement_rules: false,
  legacy: true,
});

function findById(items = [], id) {
  if (!id) return null;
  return items.find((item) => item?.id === id) ?? null;
}

function normalizeAllowedSymmetry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalized = {};
  let found = false;
  for (const axis of ['length', 'width', 'height']) {
    if (typeof value[axis] === 'boolean') {
      normalized[axis] = value[axis];
      found = true;
    }
  }
  return found ? { ...DEFAULT_ALLOWED_SYMMETRY, ...normalized } : null;
}

function createDefaultOrientation(size = null) {
  const dimensions = size?.dimensions ?? null;
  return {
    id: 'default',
    dimensions,
    rotation: { x: 0, y: 0, z: 0 },
  };
}

export function getCatalogFamily(catalog = {}, familyId) {
  return findById(catalog.families, familyId);
}

export function getFunctionalFamily(catalog = {}, familyId) {
  return getCatalogFamily(catalog, familyId);
}

export function getEffectiveFunctionalFamily(catalog = {}, catalogPiece = {}) {
  const family = getCatalogFamily(catalog, catalogPiece?.family_id);
  if (catalogPiece?.type_id || family?.allowed_types?.length) return family ?? DEFAULT_FUNCTIONAL_FAMILY;
  return DEFAULT_FUNCTIONAL_FAMILY;
}

export function getPartType(catalog = {}, typeId) {
  return findById(catalog.part_types, typeId);
}

export function getEffectivePartType(catalog = {}, catalogPiece = {}) {
  if (!catalogPiece?.type_id) return DEFAULT_PART_TYPE;
  return getPartType(catalog, catalogPiece.type_id);
}

export function getMaterial(catalog = {}, materialId) {
  return findById(catalog.materials, materialId);
}

export function requiresPlacementRules(catalog = {}, catalogPiece = {}) {
  return Boolean(getEffectivePartType(catalog, catalogPiece)?.requires_placement_rules);
}

export function getEffectiveAllowedSymmetry(catalogPiece = {}, shape = null) {
  return normalizeAllowedSymmetry(catalogPiece?.placement_rules?.allowed_symmetry)
    ?? normalizeAllowedSymmetry(shape?.allowed_symmetry)
    ?? { ...DEFAULT_ALLOWED_SYMMETRY };
}

export function getAllowedOrientations(catalogPiece = {}, size = null) {
  const orientations = catalogPiece?.placement_rules?.allowed_orientations;
  if (Array.isArray(orientations) && orientations.length > 0) return orientations;
  return [createDefaultOrientation(size)];
}

export function getEffectivePlacementRules(catalogPiece = {}, shape = null, size = null) {
  const placementRules = catalogPiece?.placement_rules ?? {};
  return {
    ...placementRules,
    allowed_symmetry: getEffectiveAllowedSymmetry(catalogPiece, shape),
    allowed_orientations: getAllowedOrientations(catalogPiece, size),
    mount_points: Array.isArray(placementRules.mount_points) ? placementRules.mount_points : [],
    functional_zones: Array.isArray(placementRules.functional_zones) ? placementRules.functional_zones : [],
  };
}

export function isFunctionalPart(catalogPiece = {}) {
  return Boolean(catalogPiece?.type_id || catalogPiece?.material_id || catalogPiece?.placement_rules);
}

export function isPropulsionPart(catalog = {}, catalogPiece = {}) {
  if (catalogPiece?.family_id === 'propulsion') return true;
  return getEffectivePartType(catalog, catalogPiece)?.family_id === 'propulsion';
}
