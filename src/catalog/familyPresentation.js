const FALLBACK_FAMILY_COLOR = '#888888';

const FAMILY_PRESENTATION_REGISTRY = Object.freeze({
  steel: { label: 'Acier', groupLabel: 'ACIER', defaultColor: '#8a8f98', editable: true },
  titanium_superior: { label: 'Titane supérieur', groupLabel: 'TITANE SUPÉRIEUR', defaultColor: '#6e8398', editable: true },
  solid_chassis: { label: 'Châssis solide', groupLabel: 'CHÂSSIS AVANCÉS', defaultColor: '#5d6673', editable: true },
  levinium: { label: 'Lévinium', groupLabel: 'ALLIAGES ULTRA LÉGERS', defaultColor: '#79b89f', editable: true },
  propulsion: { label: 'Propulsion', groupLabel: 'SYSTÈMES DE PROPULSION', defaultColor: '#d9822b', editable: true },
  structure: { label: 'Structure', groupLabel: 'STRUCTURE', defaultColor: '#8a8f98', editable: true },
  energy: { label: 'Énergie', groupLabel: 'ÉNERGIE', defaultColor: '#e6c84f', editable: true },
  thermal: { label: 'Thermique', groupLabel: 'THERMIQUE', defaultColor: '#c94f4f', editable: true },
  control: { label: 'Contrôle', groupLabel: 'CONTRÔLE', defaultColor: '#4fa3c9', editable: true },
});

function sanitizeDisplayText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function sanitizeHexColor(value, fallback = null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function makeDefaultGroupLabel(label, familyId) {
  const source = sanitizeDisplayText(label) || sanitizeDisplayText(familyId) || 'Famille';
  return source.toUpperCase();
}

export function getFamilyPresentationRegistry() {
  return FAMILY_PRESENTATION_REGISTRY;
}

export function getCatalogFamilyPresentation(catalog = {}, familyId) {
  if (!familyId) return null;
  const family = (catalog.families ?? []).find((item) => item?.id === familyId) ?? null;
  const preset = FAMILY_PRESENTATION_REGISTRY[familyId] ?? {};
  const label = sanitizeDisplayText(family?.label_fr) || preset.label || familyId;
  return {
    ...family,
    id: familyId,
    label_fr: label,
    group_label_fr: sanitizeDisplayText(family?.group_label_fr) || preset.groupLabel || makeDefaultGroupLabel(label, familyId),
    default_color: sanitizeHexColor(family?.default_color, preset.defaultColor ?? FALLBACK_FAMILY_COLOR),
    editable: family?.editable !== false && preset.editable !== false,
  };
}

export function getCatalogFamiliesForPresentation(catalog = {}) {
  return (catalog.families ?? [])
    .map((family) => getCatalogFamilyPresentation(catalog, family?.id))
    .filter(Boolean);
}

function getLabelOverride(settings = {}, scope, id) {
  if (!scope || !id) return '';
  return sanitizeDisplayText(settings?.editor?.labels?.[scope]?.[id]);
}

export function resolveDisplayLabel(scope, id, settings = {}, catalogDefault = '') {
  return getLabelOverride(settings, scope, id)
    || sanitizeDisplayText(catalogDefault)
    || String(id ?? '');
}

export function resolveFamilyColor(familyId, settings = {}, catalog = {}) {
  const override = sanitizeHexColor(settings?.editor?.familyColors?.[familyId], null);
  if (override) return override;
  return sanitizeHexColor(getCatalogFamilyPresentation(catalog, familyId)?.default_color, FALLBACK_FAMILY_COLOR);
}

export function resolveFamilyLabel(familyId, settings = {}, catalog = {}) {
  const family = getCatalogFamilyPresentation(catalog, familyId);
  return resolveDisplayLabel('families', familyId, settings, family?.label_fr ?? familyId);
}

export function resolveFamilyGroupLabel(familyId, settings = {}, catalog = {}) {
  const family = getCatalogFamilyPresentation(catalog, familyId);
  return resolveDisplayLabel('families', familyId, settings, family?.group_label_fr ?? family?.label_fr ?? familyId).toUpperCase();
}

export function resolvePartTypeLabel(typeId, settings = {}, catalog = {}) {
  const partType = (catalog.part_types ?? []).find((item) => item?.id === typeId) ?? null;
  return resolveDisplayLabel('types', typeId, settings, partType?.label_fr ?? typeId);
}

export function resolvePartLabel(pieceId, settings = {}, catalog = {}) {
  const piece = (catalog.catalog_pieces ?? []).find((item) => item?.id === pieceId) ?? null;
  return resolveDisplayLabel('parts', pieceId, settings, piece?.label_fr ?? pieceId);
}

export function resolveVariantLabel(variantId, settings = {}, catalog = {}) {
  const variant = (catalog.shape_variants ?? []).find((item) => item?.id === variantId) ?? null;
  return resolveDisplayLabel('variants', variantId, settings, variant?.label ?? variantId);
}

