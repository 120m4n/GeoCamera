const DB_NAME = 'geocamera';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos_index';
const STORE_CONFIG = 'config';
const FIFO_MAX = 23;

/** @typedef {{ id: string, filename: string, thumbnailBlob: Blob, latitude: number, longitude: number, accuracyMeters: number, plusCode: string, capturedAt: string, syncStatus: 'local'|'pending'|'synced'|'error' }} PhotoEntry */

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
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

/**
 * Adds a photo to the index, enforcing FIFO-23.
 * @param {Omit<PhotoEntry, 'syncStatus'>} entry
 */
export async function addPhoto(entry) {
  await openDB();
  const store = tx(STORE_PHOTOS, 'readwrite');
  await promisify(store.put({ ...entry, syncStatus: 'local' }));

  // Enforce FIFO — remove oldest if over limit
  const all = await listPhotos();
  if (all.length > FIFO_MAX) {
    const toDelete = all.slice(FIFO_MAX);
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
