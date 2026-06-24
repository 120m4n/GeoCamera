const DB_NAME = 'geocamera';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos_index';
const STORE_CONFIG = 'config';
export const FIFO_MAX = 6; // compile-time default; runtime uses getFifoMax()

/** @typedef {{ id: string, filename: string, thumbnailBlob: Blob, latitude: number, longitude: number, accuracyMeters: number, plusCode: string, capturedAt: string, syncStatus: 'local'|'pending'|'synced'|'error' }} PhotoEntry */

let _db = null;

async function openDB() {
  if (_db) return _db;
  console.log('[GeoCamera/db] openDB()');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      console.log('[GeoCamera/db] onupgradeneeded v', e.oldVersion, '->', e.newVersion);
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      console.log('[GeoCamera/db] open OK');
      resolve(_db);
    };
    req.onerror = () => {
      console.error('[GeoCamera/db] open FAILURE', req.error?.message);
      reject(req.error);
    };
  });
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFifoMax() {
  await openDB();
  const row = await promisify(tx(STORE_CONFIG, 'readonly').get('fifoMax'));
  const val = row?.value;
  return (typeof val === 'number' && val >= 6) ? val : FIFO_MAX;
}

export async function setFifoMax(n) {
  const clamped = Math.max(6, Math.min(50, Math.round(n)));
  return setConfig('fifoMax', clamped);
}

/**
 * Adds a photo to the index, enforcing the configured FIFO limit.
 * @param {Omit<PhotoEntry, 'syncStatus'>} entry
 */
export async function addPhoto(entry) {
  await openDB();
  const store = tx(STORE_PHOTOS, 'readwrite');
  await promisify(store.put({ ...entry, syncStatus: 'local' }));

  const max = await getFifoMax();
  const all = await listPhotos();
  if (all.length > max) {
    const toDelete = all.slice(max);
    const delStore = tx(STORE_PHOTOS, 'readwrite');
    for (const old of toDelete) {
      await promisify(delStore.delete(old.id));
    }
  }
}

/**
 * Returns all photos sorted by capturedAt descending (newest first).
 * @returns {Promise<PhotoEntry[]>}
 */
export async function listPhotos() {
  await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(STORE_PHOTOS, 'readonly');
    const req = store.index('capturedAt').openCursor(null, 'prev');
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * @param {string} id
 * @returns {Promise<PhotoEntry | undefined>}
 */
export async function getPhoto(id) {
  await openDB();
  return promisify(tx(STORE_PHOTOS, 'readonly').get(id));
}

/**
 * @param {string} id
 */
export async function deletePhoto(id) {
  await openDB();
  return promisify(tx(STORE_PHOTOS, 'readwrite').delete(id));
}

/**
/**
 * Deletes multiple photos by id. Errors on individual deletes are ignored.
 * @param {string[]} ids
 */
export async function deletePhotos(ids) {
  await openDB();
  for (const id of ids) {
    await promisify(tx(STORE_PHOTOS, 'readwrite').delete(id)).catch(() => {});
  }
}

// ── Config store ──────────────────────────────────────────────

/**
 * @param {string} key
 * @param {any} value
 */
export async function setConfig(key, value) {
  await openDB();
  return promisify(tx(STORE_CONFIG, 'readwrite').put({ key, value }));
}

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getConfig(key) {
  await openDB();
  const row = await promisify(tx(STORE_CONFIG, 'readonly').get(key));
  return row?.value ?? null;
}
