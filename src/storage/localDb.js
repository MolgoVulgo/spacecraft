const DB_NAME = 'spacecraft_editor';
const DB_VERSION = 1;

let openPromise = null;

function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export function getLocalDbConfig() {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    stores: {
      ships: 'local_id',
      app_meta: 'key',
    },
  };
}

export function openLocalDb() {
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('ships')) {
        const shipsStore = db.createObjectStore('ships', { keyPath: 'local_id' });
        shipsStore.createIndex('updated_at', 'updated_at', { unique: false });
        shipsStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('app_meta')) {
        db.createObjectStore('app_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      openPromise = null;
      reject(request.error ?? new Error('IndexedDB open failed.'));
    };
    request.onblocked = () => {
      reject(new Error('IndexedDB open blocked by another tab.'));
    };
  });

  return openPromise;
}

export async function withStore(storeName, mode, handler) {
  const db = await openLocalDb();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    let handlerResult;
    try {
      handlerResult = handler(store, transaction);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = async () => {
      try {
        resolve(await handlerResult);
      } catch (error) {
        reject(error);
      }
    };
    transaction.onerror = () => reject(transaction.error ?? new Error(`Transaction failed for ${storeName}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`Transaction aborted for ${storeName}.`));
  });
}

export async function idbGet(storeName, key) {
  return withStore(storeName, 'readonly', (store) => wrapRequest(store.get(key)));
}

export async function idbPut(storeName, value) {
  return withStore(storeName, 'readwrite', (store) => wrapRequest(store.put(value)));
}

export async function idbDelete(storeName, key) {
  return withStore(storeName, 'readwrite', (store) => wrapRequest(store.delete(key)));
}

export async function idbGetAll(storeName, indexName = null, direction = 'prev') {
  return withStore(storeName, 'readonly', (store) => new Promise((resolve, reject) => {
    const source = indexName ? store.index(indexName) : store;
    const request = source.openCursor(null, direction);
    const results = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      results.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error(`Cursor failed for ${storeName}.`));
  }));
}
