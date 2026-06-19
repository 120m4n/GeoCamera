// Service Worker — App Shell cache-first strategy
// Sync logic lives in src/sync.js and is intentionally inactive in MVP.

const CACHE_NAME = 'geocamera-v7';

// Only precache URL-stable assets. Vite-bundled JS/CSS (hashed filenames)
// get cached on demand via the fetch handler below.
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install: cache app shell ─────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches only ─────────────────────
// IndexedDB is user data — never wipe it here. Use RESET_APP message for factory reset.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Message handling: allow app to trigger reset ─────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'RESET_APP') {
    // Unregister SW and clear all storage
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      indexedDB.databases?.()
        ? indexedDB.databases().then(dbs =>
            Promise.all(dbs.map(db => new Promise((resolve, reject) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })))
          )
        : Promise.resolve()
    ]).then(() => {
      self.registration.unregister();
      e.ports[0]?.postMessage({ status: 'reset_complete' });
    });
  }
});

// ── Fetch: cache-first strategy ──────────────────────────

// ── Fetch: cache-first strategy ──────────────────────────
self.addEventListener('fetch', (e) => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
