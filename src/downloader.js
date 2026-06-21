import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { addPhoto } from './db.js';

// 1024 px max dimension: ~120–180 KB JPEG per thumbnail.
// 6 thumbnails × ~150 KB = ~900 KB peak in-memory blob budget — safely below
// Safari's threshold before it starts evicting blobs under memory pressure.
const THUMBNAIL_MAX_PX = 1024;
const THUMBNAIL_QUALITY = 0.82;
const FULL_QUALITY = 0.92;

/**
 * Full capture pipeline after the user taps "Guardar".
 * canvas arrives pre-stenciled from review-screen — do NOT stencil again.
 *
 * @param {HTMLCanvasElement} canvas - already-stenciled canvas from review-screen
 * @param {import('./geo.js').GeoFix | null} fix
 * @returns {Promise<string>} the new photo id
 */
export async function saveCapture(canvas, fix) {
  const ts = fix ? new Date(fix.ts) : new Date();
  const filename = buildFilename(ts, fix);
  console.log('[GeoCamera/downloader] saveCapture start:', filename);

  const thumbBlob = await canvasToBlob(
    scaledCanvas(canvas, THUMBNAIL_MAX_PX),
    'image/jpeg',
    THUMBNAIL_QUALITY
  );
  console.log('[GeoCamera/downloader] thumbnail encoded:', thumbBlob.size, 'bytes');

  const fullBlob = await canvasToBlob(canvas, 'image/jpeg', FULL_QUALITY);
  console.log('[GeoCamera/downloader] full-res encoded:', fullBlob.size, 'bytes');

  await saveFile(fullBlob, filename);
  console.log('[GeoCamera/downloader] file saved:', filename);

  const id = crypto.randomUUID();
  await addPhoto({
    id,
    filename,
    thumbnailBlob: thumbBlob,
    latitude: fix?.lat ?? 0,
    longitude: fix?.lon ?? 0,
    accuracyMeters: fix?.accuracy ?? -1,
    plusCode: fix?.plusCode ?? '',
    capturedAt: ts.toISOString(),
  });
  console.log('[GeoCamera/downloader] DB entry written, id:', id);

  return id;
}

/**
 * Saves the file natively (Android: DCIM/GeoCamera, iOS: Documents/GeoCamera)
 * or falls back to <a download> on web.
 */
async function saveFile(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    const directory = platform === 'android' ? Directory.External : Directory.Documents;
    console.log('[GeoCamera/downloader] Filesystem.writeFile platform:', platform, 'dir:', directory);
    const base64 = await blobToBase64(blob);
    try {
      await Filesystem.writeFile({
        path: `GeoCamera/${filename}`,
        data: base64,
        directory,
        recursive: true,
      });
    } catch (fsErr) {
      console.error('[GeoCamera/downloader] Filesystem.writeFile FAILURE', fsErr?.message, fsErr?.stack);
      throw fsErr;
    }
  } else {
    await triggerWebSave(blob, filename);
  }
}

function buildFilename(ts, fix) {
  const pad = n => String(n).padStart(2, '0');
  const datePart = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}`;
  const timePart = `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const code = fix?.plusCode?.replace('+', '') ?? 'NOGPS';
  return `geocamera_${datePart}_${timePart}_${code}.jpg`;
}

async function triggerWebSave(blob, filename) {
  // iOS Safari: <a download> opens the file in-browser instead of saving.
  // Web Share API (Level 2) triggers the native share sheet → "Guardar en Archivos" / "Guardar imagen".
  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // user dismissed the sheet intentionally
      // Other errors (e.g. share not allowed in this context) fall through to <a download>
    }
  }
  // Desktop / Android Chrome fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function scaledCanvas(src, maxPx) {
  const scale = Math.min(1, maxPx / Math.max(src.width, src.height));
  const dst = document.createElement('canvas');
  dst.width = Math.round(src.width * scale);
  dst.height = Math.round(src.height * scale);
  dst.getContext('2d').drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('toBlob failed')),
      type,
      quality
    );
  });
}
