import { cloneShipCreation, createLocalId, sanitizeShipName } from '../ship-creation.js';
import { idbDelete, idbGet, idbGetAll, idbPut } from './localDb.js';

const LAST_OPENED_SHIP_KEY = 'last_opened_ship_id';
const STORAGE_SCHEMA_VERSION_KEY = 'storage_schema_version';

function toShipListItem(ship) {
  return {
    local_id: ship.local_id,
    name: ship.name,
    updated_at: ship.updated_at,
    created_at: ship.created_at,
    piece_count: Array.isArray(ship.ship?.pieces) ? ship.ship.pieces.length : 0,
    computed_specs: ship.ship?.computed_specs ?? {},
    catalog_version: ship.catalog_version ?? 'unknown',
  };
}

export function createShipRepository() {
  return {
    async createShip(initialData) {
      const ship = cloneShipCreation(initialData);
      await idbPut('ships', ship);
      return ship;
    },

    async saveShip(shipCreation) {
      const ship = cloneShipCreation(shipCreation);
      await idbPut('ships', ship);
      return ship;
    },

    async loadShip(localId) {
      const ship = await idbGet('ships', localId);
      return ship ? cloneShipCreation(ship) : null;
    },

    async listShips() {
      const ships = await idbGetAll('ships', 'updated_at', 'prev');
      return ships.map(toShipListItem);
    },

    async deleteShip(localId) {
      await idbDelete('ships', localId);
    },

    async duplicateShip(localId) {
      const source = await this.loadShip(localId);
      if (!source) return null;
      const now = new Date().toISOString();
      const duplicate = {
        ...source,
        local_id: createLocalId(),
        name: `${sanitizeShipName(source.name)} copy`,
        created_at: now,
        updated_at: now,
        metadata: {
          ...(source.metadata ?? {}),
          duplicated_from_local_id: source.local_id,
        },
      };
      await this.saveShip(duplicate);
      return duplicate;
    },

    async renameShip(localId, newName) {
      const source = await this.loadShip(localId);
      if (!source) return null;
      source.name = sanitizeShipName(newName);
      source.updated_at = new Date().toISOString();
      await this.saveShip(source);
      return source;
    },

    async getLastOpenedShipId() {
      const record = await idbGet('app_meta', LAST_OPENED_SHIP_KEY);
      return record?.value ?? null;
    },

    async setLastOpenedShipId(localId) {
      await idbPut('app_meta', { key: LAST_OPENED_SHIP_KEY, value: localId });
    },

    async getStorageSchemaVersion() {
      const record = await idbGet('app_meta', STORAGE_SCHEMA_VERSION_KEY);
      return record?.value ?? null;
    },

    async setStorageSchemaVersion(version) {
      await idbPut('app_meta', { key: STORAGE_SCHEMA_VERSION_KEY, value: version });
    },
  };
}

export function createMemoryShipRepository() {
  const ships = new Map();
  const meta = new Map();

  return {
    async createShip(initialData) {
      const ship = cloneShipCreation(initialData);
      ships.set(ship.local_id, ship);
      return cloneShipCreation(ship);
    },

    async saveShip(shipCreation) {
      const ship = cloneShipCreation(shipCreation);
      ships.set(ship.local_id, ship);
      return cloneShipCreation(ship);
    },

    async loadShip(localId) {
      const ship = ships.get(localId);
      return ship ? cloneShipCreation(ship) : null;
    },

    async listShips() {
      return [...ships.values()]
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .map(toShipListItem);
    },

    async deleteShip(localId) {
      ships.delete(localId);
    },

    async duplicateShip(localId) {
      const source = ships.get(localId);
      if (!source) return null;
      const now = new Date().toISOString();
      const duplicate = {
        ...cloneShipCreation(source),
        local_id: createLocalId(),
        name: `${sanitizeShipName(source.name)} copy`,
        created_at: now,
        updated_at: now,
        metadata: {
          ...(source.metadata ?? {}),
          duplicated_from_local_id: source.local_id,
        },
      };
      ships.set(duplicate.local_id, duplicate);
      return cloneShipCreation(duplicate);
    },

    async renameShip(localId, newName) {
      const source = ships.get(localId);
      if (!source) return null;
      source.name = sanitizeShipName(newName);
      source.updated_at = new Date().toISOString();
      return cloneShipCreation(source);
    },

    async getLastOpenedShipId() {
      return meta.get(LAST_OPENED_SHIP_KEY) ?? null;
    },

    async setLastOpenedShipId(localId) {
      meta.set(LAST_OPENED_SHIP_KEY, localId);
    },

    async getStorageSchemaVersion() {
      return meta.get(STORAGE_SCHEMA_VERSION_KEY) ?? null;
    },

    async setStorageSchemaVersion(version) {
      meta.set(STORAGE_SCHEMA_VERSION_KEY, version);
    },
  };
}
