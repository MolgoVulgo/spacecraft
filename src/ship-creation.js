import { validateSceneSnapshot } from './scene-validator.js';

export const SHIP_CREATION_SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function cloneJson(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const seed = Math.random().toString(16).slice(2, 10);
  return `ship_${Date.now().toString(36)}_${seed}`;
}

export function sanitizeShipName(name) {
  const value = String(name ?? '').trim();
  return value || 'Unnamed';
}

export function getCatalogVersion(catalog) {
  return String(
    catalog?.catalog_version
      ?? catalog?.game?.catalog_version
      ?? catalog?.schema_version
      ?? 'unknown',
  );
}

export function createEmptyComputedSpecs(catalog) {
  const definitions = catalog?.definitions?.spec_fields ?? {};
  return Object.fromEntries(
    Object.entries(definitions).map(([fieldId, definition]) => {
      const isWeightedAverage = definition?.aggregation === 'weighted_average';
      return [
        fieldId,
        {
          value: isWeightedAverage ? null : 0,
          unit: definition?.unit ?? null,
          status: 'confirmed',
        },
      ];
    }),
  );
}

export function buildShipCreation({
  catalog,
  localId = createLocalId(),
  name = 'Unnamed',
  createdAt = nowIso(),
  updatedAt = createdAt,
  pieces = [],
  groups = [],
  computedSpecs = createEmptyComputedSpecs(catalog),
  metadata = {},
} = {}) {
  return {
    schema_version: SHIP_CREATION_SCHEMA_VERSION,
    catalog_version: getCatalogVersion(catalog),
    local_id: String(localId),
    name: sanitizeShipName(name),
    created_at: createdAt,
    updated_at: updatedAt,
    ship: {
      pieces: cloneJson(Array.isArray(pieces) ? pieces : []),
      groups: cloneJson(Array.isArray(groups) ? groups : []),
      computed_specs: cloneJson(computedSpecs ?? {}),
    },
    metadata: cloneJson(metadata ?? {}),
  };
}

export function cloneShipCreation(creation) {
  return cloneJson(creation);
}

export function validateShipCreation(payload, options = {}) {
  const errors = [];
  const warnings = [];
  const currentCatalogVersion = options.catalogVersion ? String(options.catalogVersion) : null;

  if (!payload || typeof payload !== 'object') {
    errors.push('ShipCreation absent ou invalide.');
    return { valid: false, errors, warnings };
  }

  if (payload.schema_version !== SHIP_CREATION_SCHEMA_VERSION) {
    errors.push(`schema_version invalide: ${payload.schema_version ?? 'absent'}.`);
  }

  if (!payload.local_id) errors.push('local_id absent.');
  if (!payload.name) errors.push('name absent.');
  if (!payload.created_at) errors.push('created_at absent.');
  if (!payload.updated_at) errors.push('updated_at absent.');
  if (!payload.ship || typeof payload.ship !== 'object') errors.push('ship absent.');
  if (!Array.isArray(payload.ship?.pieces)) errors.push('ship.pieces doit etre un tableau.');
  if (payload.ship?.groups !== undefined && !Array.isArray(payload.ship?.groups)) {
    errors.push('ship.groups doit etre un tableau.');
  }
  if (!payload.ship?.computed_specs || typeof payload.ship.computed_specs !== 'object') {
    warnings.push('ship.computed_specs absent ou invalide; recalcul local requis.');
  }

  const sceneValidation = validateSceneSnapshot(payload.ship, {
    catalogPieceIds: options.catalogPieceIds,
  });
  errors.push(...sceneValidation.errors.map((issue) => `${issue.path}: ${issue.message}`));
  warnings.push(...sceneValidation.warnings.map((issue) => `${issue.path}: ${issue.message}`));

  if (currentCatalogVersion && payload.catalog_version && String(payload.catalog_version) !== currentCatalogVersion) {
    warnings.push(`catalog_version differente: ${payload.catalog_version} (courant: ${currentCatalogVersion}).`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function prepareImportedShipCreation(payload, { catalog, currentCatalogVersion } = {}) {
  const validation = validateShipCreation(payload, {
    catalogVersion: currentCatalogVersion ?? getCatalogVersion(catalog),
    catalogPieceIds: (catalog?.catalog_pieces ?? []).map((piece) => piece.id),
  });
  if (!validation.valid) return { ...validation, shipCreation: null };

  const importedAt = nowIso();
  const shipCreation = buildShipCreation({
    catalog,
    localId: createLocalId(),
    name: payload.name,
    createdAt: importedAt,
    updatedAt: importedAt,
    pieces: payload.ship?.pieces ?? [],
    groups: payload.ship?.groups ?? [],
    computedSpecs: payload.ship?.computed_specs ?? createEmptyComputedSpecs(catalog),
    metadata: {
      ...(payload.metadata ?? {}),
      imported_at: importedAt,
      imported_from_local_id: payload.local_id ?? null,
      imported_from_catalog_version: payload.catalog_version ?? null,
    },
  });

  return { ...validation, shipCreation };
}

export function buildReadOnlyShipSnapshot(shipCreation) {
  return {
    schema_version: shipCreation.schema_version,
    catalog_version: shipCreation.catalog_version,
    source_local_id: shipCreation.local_id,
    name: shipCreation.name,
    published_at: nowIso(),
    ship: cloneJson(shipCreation.ship),
  };
}

export function buildShipExportFilename(name, date = new Date()) {
  const safeName = sanitizeShipName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${safeName || 'ship'}_${yyyy}-${mm}-${dd}.spacecraft.json`;
}
