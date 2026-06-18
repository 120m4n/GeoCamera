import './ui/standby-screen.js';
import './ui/camera-screen.js';
import './ui/review-screen.js';
import './ui/list-screen.js';
import './ui/detail-screen.js';
import './ui/settings-screen.js';
import './ui/toast.js';
import { App } from '@capacitor/app';
import { geo } from './geo.js';
import { saveCapture } from './downloader.js';
import { listPhotos, getConfig } from './db.js';
import { processQueue } from './sync.js';

// ── App config state ──────────────────────────────────────────
const appConfig = {
  logoBlob: null,
  showWatermark: true,
  showLogoHeader: true,
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
  switch (screen) {
    case 'standby':
      screenEls.get('camera').stopCamera();
      show('standby');
      break;

    case 'camera':
      show('camera');
      screenEls.get('camera').startCamera();
      await refreshCounter();
      break;

    case 'list':
      screenEls.get('camera').stopCamera();
      show('list');
      await screenEls.get('list').refresh();
      break;

    case 'detail':
      show('detail');
      await screenEls.get('detail').load(params.photoId);
      break;

    case 'settings': {
      screenEls.get('camera').stopCamera();
      show('settings');
      const photos = await listPhotos();
      await screenEls.get('settings').refresh(photos.length);
      break;
    }

    default:
      navigateTo('camera');
  }
}

// ── Capture → review ──────────────────────────────────────────
async function handleCapture(e) {
  const { canvas } = e.detail;
  const fix = geo.lastFix;

  show('review');
  screenEls.get('camera').stopCamera();

  await screenEls.get('review').setCapture(canvas, fix, {
    logoBlob: appConfig.logoBlob,
    showWatermark: appConfig.showWatermark,
  });
}

// ── Save confirmed ────────────────────────────────────────────
async function handleSave(e) {
  const { canvas, fix } = e.detail;
  try {
    await saveCapture(canvas, fix);
    const photos = await listPhotos();
    show('camera');
    screenEls.get('toast').show(`Guardada — ${photos.length}/23`);
    screenEls.get('camera').startCamera();
    await refreshCounter();
  } catch (err) {
    console.error('Error al guardar:', err);
    screenEls.get('toast').show('Error al guardar', 2000);
    show('camera');
    screenEls.get('camera').startCamera();
  }
}

// ── Discard ───────────────────────────────────────────────────
function handleDiscard() {
  show('camera');
  screenEls.get('camera').startCamera();
}

// ── Config changes ────────────────────────────────────────────
async function handleLogoChanged() {
  appConfig.logoBlob = await getConfig('logoBlob');
}

async function handleConfigChanged(e) {
  if ('showWatermark' in e.detail) appConfig.showWatermark = e.detail.showWatermark;
  if ('showLogoHeader' in e.detail) appConfig.showLogoHeader = e.detail.showLogoHeader;
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
  const photos = await listPhotos();
  screenEls.get('camera').updateCounter(photos.length);
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
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  buildApp();

  // Load persisted config
  appConfig.logoBlob = await getConfig('logoBlob');
  appConfig.showWatermark = await getConfig('showWatermark') ?? true;
  appConfig.showLogoHeader = await getConfig('showLogoHeader') ?? true;

  // Wire global event delegation
  document.addEventListener('nav', handleNav);
  document.addEventListener('capture', handleCapture);
  document.addEventListener('save', handleSave);
  document.addEventListener('discard', handleDiscard);
  document.addEventListener('logo-changed', handleLogoChanged);
  document.addEventListener('config-changed', handleConfigChanged);

  // Start GPS immediately
  geo.start();

  // Land on standby — camera starts only when user taps
  await navigateTo('standby');
}

boot();
