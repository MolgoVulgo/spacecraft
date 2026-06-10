import { createEmptyComputedSpecs, createLocalId } from '../ship-creation.js';
import { idbDelete, idbGet, idbPut, openLocalDb } from './localDb.js';

export async function detectStorageAvailability(catalog) {
  if (!globalThis.indexedDB) {
    return {
      mode: 'temporary',
      available: false,
      reason: 'IndexedDB indisponible dans ce navigateur.',
    };
  }

  const probeId = `probe_${createLocalId()}`;
  const probeRecord = {
    schema_version: 1,
    catalog_version: 'probe',
    local_id: probeId,
    name: 'Storage probe',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ship: {
      pieces: [],
      computed_specs: createEmptyComputedSpecs(catalog),
    },
    metadata: { probe: true },
  };

  try {
    await openLocalDb();
    await idbPut('ships', probeRecord);
    const saved = await idbGet('ships', probeId);
    await idbDelete('ships', probeId);

    if (!saved || saved.local_id !== probeId) {
      throw new Error('Cycle write/read/delete incomplet.');
    }

    return {
      mode: 'persistent',
      available: true,
      reason: '',
    };
  } catch (error) {
    try {
      await idbDelete('ships', probeId);
    } catch {}
    return {
      mode: 'temporary',
      available: false,
      reason: error?.message ?? 'IndexedDB indisponible.',
    };
  }
}
