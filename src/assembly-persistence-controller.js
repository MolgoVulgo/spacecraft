import {
  buildReadOnlyShipSnapshot,
  buildShipCreation,
  buildShipExportFilename,
  cloneShipCreation,
  createEmptyComputedSpecs,
  getCatalogVersion,
  prepareImportedShipCreation,
  sanitizeShipName,
  validateShipCreation,
} from './ship-creation.js';
import { getLocalDbConfig } from './storage/localDb.js';
import { createMemoryShipRepository, createShipRepository } from './storage/shipRepository.js';
import { detectStorageAvailability } from './storage/storageAvailability.js';

const AUTOSAVE_DELAY_MS = 700;

function noop() {}

async function readFileAsText(file) {
  if (typeof file?.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
}

export function createAssemblyPersistenceController(options) {
  const {
    catalog,
    serializeCurrentShip,
    loadShipCreation,
    onStateChange = noop,
    downloadJson = noop,
    confirm = (message) => globalThis.confirm(message),
  } = options;

  const persistentRepository = createShipRepository();
  const memoryRepository = createMemoryShipRepository();
  const storageSchemaVersion = getLocalDbConfig().version;

  const state = {
    currentShipId: null,
    currentShipName: 'Unnamed',
    currentCreatedAt: null,
    currentCatalogVersion: getCatalogVersion(catalog),
    lastSavedAt: null,
    storageMode: 'temporary',
    saveInProgress: false,
    isDirty: false,
    lastSaveError: '',
    lastWarning: '',
    ships: [],
  };

  let activeRepository = memoryRepository;
  let autosaveTimer = null;

  function emit() {
    onStateChange(getState());
  }

  function getState() {
    return {
      ...state,
      ships: state.ships.map((ship) => ({ ...ship })),
    };
  }

  function clearAutosaveTimer() {
    if (!autosaveTimer) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  async function refreshShips() {
    state.ships = await activeRepository.listShips();
    emit();
  }

  async function openShipCreation(shipCreation, options = {}) {
    const { suppressWarning = false } = options;
    const validation = validateShipCreation(shipCreation, {
      currentCatalogVersion: state.currentCatalogVersion,
      catalogVersion: state.currentCatalogVersion,
      catalogPieceIds: (catalog?.catalog_pieces ?? []).map((piece) => piece.id),
    });
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }
    clearAutosaveTimer();
    state.currentShipId = shipCreation.local_id;
    state.currentShipName = sanitizeShipName(shipCreation.name);
    state.currentCreatedAt = shipCreation.created_at;
    state.lastSavedAt = shipCreation.updated_at;
    state.isDirty = false;
    state.lastSaveError = '';
    if (!suppressWarning) state.lastWarning = validation.warnings.join(' ');
    await loadShipCreation(cloneShipCreation(shipCreation));
    await activeRepository.setLastOpenedShipId(shipCreation.local_id);
    await refreshShips();
  }

  async function createAndOpenBlankShip(name = 'Unnamed') {
    const blankShip = buildShipCreation({
      catalog,
      name,
      pieces: [],
      computedSpecs: createEmptyComputedSpecs(catalog),
    });
    await activeRepository.createShip(blankShip);
    await openShipCreation(blankShip);
    return blankShip;
  }

  async function flushAutosave() {
    clearAutosaveTimer();
    if (!state.currentShipId || !state.isDirty || state.saveInProgress) return null;

    state.saveInProgress = true;
    state.lastSaveError = '';
    emit();

    try {
      const shipCreation = serializeCurrentShip({
        localId: state.currentShipId,
        name: state.currentShipName,
        createdAt: state.currentCreatedAt,
      });
      const saved = await activeRepository.saveShip(shipCreation);
      state.lastSavedAt = saved.updated_at;
      state.currentCreatedAt = saved.created_at;
      state.isDirty = false;
      await activeRepository.setLastOpenedShipId(saved.local_id);
      await refreshShips();
      return saved;
    } catch (error) {
      state.lastSaveError = error?.message ?? 'Autosave impossible.';
      state.isDirty = true;
      emit();
      return null;
    } finally {
      state.saveInProgress = false;
      emit();
    }
  }

  function scheduleAutosave() {
    clearAutosaveTimer();
    autosaveTimer = setTimeout(() => {
      flushAutosave().catch((error) => {
        state.lastSaveError = error?.message ?? 'Autosave impossible.';
        emit();
      });
    }, AUTOSAVE_DELAY_MS);
    emit();
  }

  function markDirty() {
    state.isDirty = true;
    state.lastSaveError = '';
    emit();
    scheduleAutosave();
  }

  return {
    getState,

    async init() {
      const availability = await detectStorageAvailability(catalog);
      state.storageMode = availability.mode;
      state.lastWarning = availability.reason || '';
      activeRepository = availability.mode === 'persistent' ? persistentRepository : memoryRepository;

      await activeRepository.setStorageSchemaVersion(storageSchemaVersion);
      await refreshShips();

      const lastOpenedId = await activeRepository.getLastOpenedShipId();
      const lastOpened = lastOpenedId ? await activeRepository.loadShip(lastOpenedId) : null;
      if (lastOpened) {
        await openShipCreation(lastOpened, { suppressWarning: true });
        return;
      }

      if (state.ships.length > 0) {
        const first = await activeRepository.loadShip(state.ships[0].local_id);
        if (first) {
          await openShipCreation(first, { suppressWarning: true });
          return;
        }
      }

      await createAndOpenBlankShip();
    },

    async createShip(name) {
      await flushAutosave();
      return createAndOpenBlankShip(name);
    },

    async openShip(localId) {
      await flushAutosave();
      const ship = await activeRepository.loadShip(localId);
      if (!ship) return false;
      await openShipCreation(ship);
      return true;
    },

    async renameCurrentShip(name) {
      const nextName = sanitizeShipName(name);
      if (!state.currentShipId) return false;
      state.currentShipName = nextName;
      markDirty();
      await flushAutosave();
      return true;
    },

    async duplicateShip(localId = state.currentShipId) {
      await flushAutosave();
      const duplicate = await activeRepository.duplicateShip(localId);
      if (!duplicate) return false;
      await openShipCreation(duplicate);
      return true;
    },

    async deleteShip(localId = state.currentShipId) {
      const item = state.ships.find((ship) => ship.local_id === localId);
      if (!item) return false;
      if (!confirm(`Supprimer localement "${item.name}" ?`)) return false;

      await activeRepository.deleteShip(localId);
      await refreshShips();

      if (state.ships.length === 0) {
        await createAndOpenBlankShip();
        return true;
      }

      const nextId = state.currentShipId === localId ? state.ships[0].local_id : state.currentShipId;
      const nextShip = await activeRepository.loadShip(nextId);
      if (nextShip) await openShipCreation(nextShip);
      return true;
    },

    async markSceneDirty() {
      if (!state.currentShipId) return;
      markDirty();
    },

    async saveNow() {
      await flushAutosave();
    },

    async exportCurrentShip() {
      const saved = await flushAutosave() || await activeRepository.loadShip(state.currentShipId);
      if (!saved) return false;
      downloadJson(buildShipExportFilename(saved.name), saved);
      return true;
    },

    async exportCurrentSnapshot() {
      const saved = await flushAutosave() || await activeRepository.loadShip(state.currentShipId);
      if (!saved) return false;
      downloadJson(`${buildShipExportFilename(saved.name).replace('.spacecraft.json', '')}.snapshot.json`, buildReadOnlyShipSnapshot(saved));
      return true;
    },

    async importShip(file) {
      const content = await readFileAsText(file);
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('Import refuse: JSON invalide.');
      }

      const prepared = prepareImportedShipCreation(parsed, {
        catalog,
        currentCatalogVersion: state.currentCatalogVersion,
      });

      if (!prepared.valid || !prepared.shipCreation) {
        throw new Error(prepared.errors.join(' '));
      }

      await activeRepository.createShip(prepared.shipCreation);
      state.lastWarning = prepared.warnings.join(' ');
      await openShipCreation(prepared.shipCreation, { suppressWarning: true });
      emit();
      return prepared.shipCreation;
    },
  };
}
