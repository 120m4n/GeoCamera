// Sync stub — active only when SYNC_ENABLED = true and a backend URL is configured.
// All entries default to syncStatus: 'local' in MVP and never change.

export const SYNC_ENABLED = false;
const BACKEND_URL = ''; // e.g. 'https://api.geocamera.example.com'

/**
 * Enqueues a photo for sync. No-op in MVP.
 * @param {string} photoId
 */
export async function enqueue(photoId) {
  if (!SYNC_ENABLED) return;
  // TODO: mark syncStatus: 'pending' in IndexedDB
}

/**
 * Attempts to sync all pending photos. Called on visibilitychange or app resume.
 * No-op in MVP.
 */
export async function processQueue() {
  if (!SYNC_ENABLED || !BACKEND_URL) return;
  // TODO: iterate photos with syncStatus: 'pending', POST thumbnail+metadata,
  // update syncStatus to 'synced' or 'error'. iOS has no Background Sync API —
  // this must be called explicitly on app resume / visibilitychange.
}
