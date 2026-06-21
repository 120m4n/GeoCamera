import './ui/standby-screen.js';
import './ui/camera-screen.js';
import './ui/review-screen.js';
import './ui/list-screen.js';
import './ui/detail-screen.js';
import './ui/settings-screen.js';
import './ui/toast.js';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { geo } from './geo.js';
import { saveCapture } from './downloader.js';
import { listPhotos, getConfig, FIFO_MAX } from './db.js';
import { processQueue } from './sync.js';

// ── App config state ──────────────────────────────────────────
const appConfig = {
  logoBlob:        null,
  showWatermark:   true,
  logoPosition:    'bottom-right',
  logoAlpha:       1.0,
  stencilPosition: 'bottom',
  stencilAlpha:    0.75,
};

// ── Router ───────────────────────────────────────────────────
const SCREENS = ['standby', 'camera', 'review', 'list', 'detail', 'settings'];

/** @type {Map<string, HTMLElement>} */
const screenEls = new Map();

function buildApp() {
  const app = document.getElementById('app');

  // Screens
  for (const name of SCREENS) {
    const tag = `geo-${name}-screen`;
    const el = document.createElement(tag);
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    app.appendChild(el);
    screenEls.set(name, el);
  }

  // Toast (global overlay)
  const toast = document.createElement('geo-toast');
  app.appendChild(toast);
  screenEls.set('toast', toast);

  return { app, toast };
}

let currentScreen = '';
let _standbyTimer = null;

function startStandbyTimer() {
  clearTimeout(_standbyTimer);
  _standbyTimer = setTimeout(() => navigateTo('standby'), 37_000);
}

function clearStandbyTimer() {
  clearTimeout(_standbyTimer);
  _standbyTimer = null;
}

function show(name) {
  for (const [key, el] of screenEls) {
    if (key === 'toast') continue;
    const visible = key === name;
    el.style.display = visible ? '' : 'none';
    el.setAttribute('aria-hidden', String(!visible));
  }
  currentScreen = name;
}

// ── Navigation handler ────────────────────────────────────────
function handleNav(e) {
  const detail = e.detail;
  if (typeof detail === 'string') {
    navigateTo(detail);
  } else if (detail?.screen) {
    navigateTo(detail.screen, detail);
  }
}

async function navigateTo(screen, params = {}) {
  console.log('[GeoCamera/nav] ->', screen, params.photoId ?? '');
  try {
    switch (screen) {
      case 'standby':
        clearStandbyTimer();
        screenEls.get('camera').stopCamera();
        show('standby');
        break;

      case 'camera':
        show('camera');
        screenEls.get('camera').startCamera();
        await refreshCounter();
        startStandbyTimer();
        break;

      case 'list':
        clearStandbyTimer();
        screenEls.get('camera').stopCamera();
        show('list');
        await screenEls.get('list').refresh();
        break;

      case 'detail':
        show('detail');
        await screenEls.get('detail').load(params.photoId, params.photos ?? []);
        break;

      case 'settings': {
        clearStandbyTimer();
        screenEls.get('camera').stopCamera();
        show('settings');
        const photos = await listPhotos();
        await screenEls.get('settings').refresh(photos.length, appConfig.logoBlob);
        break;
      }

      default:
        navigateTo('camera');
    }
  } catch (err) {
    console.error('[GeoCamera/nav]', screen, err?.message);
    screenEls.get('toast')?.show('Error de navegación', 2000, 'error');
  }
}

// ── Capture → review ──────────────────────────────────────────
async function handleCapture(e) {
  try {
    const { canvas } = e.detail;
    const fix = geo.lastFix;
    console.log('[GeoCamera/capture] canvas', canvas?.width, 'x', canvas?.height, '| fix', fix ? `±${fix.accuracy}m` : 'null');

    clearStandbyTimer();
    show('review');
    screenEls.get('camera').stopCamera();

    await screenEls.get('review').setCapture(canvas, fix, {
      logoBlob:        appConfig.logoBlob,
      showWatermark:   appConfig.showWatermark,
      logoPosition:    appConfig.logoPosition,
      logoAlpha:       appConfig.logoAlpha,
      stencilPosition: appConfig.stencilPosition,
      stencilAlpha:    appConfig.stencilAlpha,
    });
  } catch (err) {
    console.error('[GeoCamera/capture]', err?.message);
    screenEls.get('toast')?.show('Error al procesar captura', 2000, 'error');
    show('camera');
    screenEls.get('camera').startCamera();
  }
}

// ── Save confirmed ────────────────────────────────────────────
async function handleSave(e) {
  const { canvas, fix } = e.detail;
  console.log('[GeoCamera/save] start | canvas', canvas?.width, 'x', canvas?.height);
  try {
    await saveCapture(canvas, fix);
    const photos = await listPhotos();
    console.log('[GeoCamera/save] OK — total in DB:', photos.length);
    await screenEls.get('list').refresh(photos);
    show('camera');
    screenEls.get('toast').show(`Guardada — ${photos.length}/${FIFO_MAX}`);
    screenEls.get('camera').startCamera();
    screenEls.get('camera').updateCounter(photos.length, FIFO_MAX);
  } catch (err) {
    console.error('[GeoCamera/save] FAILURE', err?.message, err?.stack);
    screenEls.get('toast').show('Error al guardar', 2000, 'error');
    show('camera');
    screenEls.get('camera').startCamera();
  }
}

// ── Discard ───────────────────────────────────────────────────
function handleDiscard() {
  show('camera');
  screenEls.get('camera').startCamera();
}

// ── Default logo fallback ─────────────────────────────────────
async function fetchDefaultLogo() {
  try {
    const res = await fetch('/icons/icon-192.png');
    if (res.ok) return res.blob();
  } catch { /* offline without SW cache */ }
  return null;
}

// ── Config changes ────────────────────────────────────────────
async function handleLogoChanged() {
  try {
    appConfig.logoBlob = await getConfig('logoBlob') ?? await fetchDefaultLogo();
  } catch (err) {
    console.error('[GeoCamera/logo]', err?.message);
  }
}

function handleConfigChanged(e) {
  if ('showWatermark'   in e.detail) appConfig.showWatermark   = e.detail.showWatermark;
  if ('logoPosition'    in e.detail) appConfig.logoPosition    = e.detail.logoPosition;
  if ('logoAlpha'       in e.detail) appConfig.logoAlpha       = e.detail.logoAlpha;
  if ('stencilPosition' in e.detail) appConfig.stencilPosition = e.detail.stencilPosition;
  if ('stencilAlpha'    in e.detail) appConfig.stencilAlpha    = e.detail.stencilAlpha;
}

// ── GPS updates → camera screen ───────────────────────────────
geo.addEventListener('fix', (e) => {
  if (currentScreen === 'camera') {
    screenEls.get('camera').updateGPS(e.detail, null);
  }
});
geo.addEventListener('error', (e) => {
  if (currentScreen === 'camera') {
    screenEls.get('camera').updateGPS(null, e.detail);
  }
});

async function refreshCounter() {
  try {
    const photos = await listPhotos();
    screenEls.get('camera').updateCounter(photos.length, FIFO_MAX);
  } catch (err) {
    console.error('[GeoCamera/counter]', err?.message);
  }
}

// ── iOS / sync on resume ──────────────────────────────────────
// appStateChange fires reliably on native (iOS/Android) and falls back to
// document visibilitychange on web via the Capacitor web implementation.
App.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) return;
  processQueue();
  if (currentScreen === 'camera') navigateTo('standby');
});

// ── Service Worker registration ───────────────────────────────
// SW is only useful in the browser PWA. In native (Capacitor) the APK already
// bundles all assets, so the SW only causes stale-cache errors across builds.
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    // Unregister any SW left over from a previous install to clear stale caches.
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) reg.unregister();
    });
  } else if (import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  console.log('[GeoCamera/boot] starting');
  try {
    buildApp();
    console.log('[GeoCamera/boot] DOM built');

    appConfig.logoBlob        = await getConfig('logoBlob') ?? await fetchDefaultLogo();
    appConfig.showWatermark   = await getConfig('showWatermark')   ?? true;
    appConfig.logoPosition    = await getConfig('logoPosition')    ?? 'bottom-right';
    appConfig.logoAlpha       = await getConfig('logoAlpha')       ?? 1.0;
    appConfig.stencilPosition = await getConfig('stencilPosition') ?? 'bottom';
    appConfig.stencilAlpha    = await getConfig('stencilAlpha')    ?? 0.75;
    console.log('[GeoCamera/boot] config loaded');

    document.addEventListener('nav', handleNav);
    document.addEventListener('capture', handleCapture);
    document.addEventListener('save', handleSave);
    document.addEventListener('discard', handleDiscard);
    document.addEventListener('logo-changed', handleLogoChanged);
    document.addEventListener('config-changed', handleConfigChanged);

    geo.start();
    console.log('[GeoCamera/boot] geo.start() called');

    await navigateTo('standby');
    console.log('[GeoCamera/boot] ready — standby screen shown');
  } catch (err) {
    console.error('[GeoCamera/boot] FAILURE', err?.message, err?.stack);
  }
}

boot();
