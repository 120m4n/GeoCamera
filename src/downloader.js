import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { addPhoto } from './db.js';

const THUMBNAIL_MAX_PX = 300;
const THUMBNAIL_QUALITY = 0.72;
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

  const thumbBlob = await canvasToBlob(
    scaledCanvas(canvas, THUMBNAIL_MAX_PX),
    'image/jpeg',
    THUMBNAIL_QUALITY
  );

  const fullBlob = await canvasToBlob(canvas, 'image/jpeg', FULL_QUALITY);
  await saveFile(fullBlob, filename);

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

  return id;
}

/**
 * Saves the file natively (Android: DCIM/GeoCamera, iOS: Documents/GeoCamera)
 * or falls back to <a download> on web.
 */
async function saveFile(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    // Android writes to external storage so the photo appears in the gallery.
    // iOS writes to Documents (accessible via Files app); no direct gallery API in Capacitor.
    const directory = Capacitor.getPlatform() === 'android'
      ? Directory.External
      : Directory.Documents;
    await Filesystem.writeFile({
      path: `GeoCamera/${filename}`,
      data: base64,
      directory,
      recursive: true,
    });
  } else {
    triggerWebDownload(blob, filename);
  }
}

function buildFilename(ts, fix) {
  const pad = n => String(n).padStart(2, '0');
  const datePart = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}`;
  const timePart = `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const code = fix?.plusCode?.replace('+', '') ?? 'NOGPS';
  return `geocamera_${datePart}_${timePart}_${code}.jpg`;
}

function triggerWebDownload(blob, filename) {
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
