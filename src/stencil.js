/** @import { GeoFix } from './geo.js' */

const TEXT_MONO = "'JetBrains Mono', 'SF Mono', 'Consolas', monospace";
const TEXT_SANS = "-apple-system, 'Inter', 'Segoe UI', sans-serif";

/**
 * Renders the GPS/date stencil overlay onto a canvas in-place.
 * @param {HTMLCanvasElement} canvas - already has the photo drawn on it
 * @param {GeoFix | null} fix
 * @param {Blob | null} logoBlob
 * @param {{ showWatermark: boolean }} config
 */
export async function applyStencil(canvas, fix, logoBlob, config) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Cap scale so the stencil stays compact at high-res captures.
  // Without the cap, a 1920px-wide photo would yield scale≈4.9, making
  // fonts 68px tall and the overlay spill past 25% of the image height.
  const scale = Math.min(w / 390, 2.5);

  const fCoords = Math.round(11 * scale);
  const fMeta   = Math.round(10 * scale);
  const padX    = Math.round(14 * scale);
  const padY    = Math.round(8  * scale);
  const gap     = Math.round(4  * scale);  // between rows

  // Band height is driven by actual content, not by image height ratio.
  const rowsH = fix
    ? fCoords + gap + fMeta + gap + fMeta
    : fMeta   + gap + fMeta;
  const bandH = padY + rowsH + padY;
  const y0 = h - bandH;

  // Gradient: feather upward 0.7× the band height
  const feather = Math.round(bandH * 0.7);
  const grad = ctx.createLinearGradient(0, y0 - feather, 0, h);
  grad.addColorStop(0,    'rgba(0,0,0,0)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.78)');
  grad.addColorStop(1,    'rgba(0,0,0,0.90)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0 - feather, w, bandH + feather);

  ctx.textBaseline = 'top';
  let textY = y0 + padY;

  if (fix) {
    // Row 1: lat, lon (left) | ±Xm (right)
    ctx.font = `${fCoords}px ${TEXT_MONO}`;
    ctx.fillStyle = '#F5F3EF';
    ctx.fillText(`${fix.lat.toFixed(6)}, ${fix.lon.toFixed(6)}`, padX, textY);

    const accText = `±${fix.accuracy}m`;
    ctx.fillStyle = '#3DDC84';
    ctx.fillText(accText, w - padX - ctx.measureText(accText).width, textY);
    textY += fCoords + gap;

    // Row 2: Plus Code
    ctx.font = `${fMeta}px ${TEXT_MONO}`;
    ctx.fillStyle = '#8B919A';
    ctx.fillText(fix.plusCode, padX, textY);
    textY += fMeta + gap;
  } else {
    ctx.font = `${fMeta}px ${TEXT_SANS}`;
    ctx.fillStyle = '#FFC247';
    ctx.fillText('Sin GPS', padX, textY);
    textY += fMeta + gap;
  }

  // Last row: datetime
  const ts = fix ? new Date(fix.ts) : new Date();
  ctx.font = `${fMeta}px ${TEXT_MONO}`;
  ctx.fillStyle = '#565C64';
  ctx.fillText(formatDateTime(ts), padX, textY);

  // Logo watermark
  if (config.showWatermark && logoBlob) {
    await drawLogo(ctx, logoBlob, w, h, padX, scale);
  }
}

async function drawLogo(ctx, blob, canvasW, canvasH, pad, scale) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const logoSize = Math.round(24 * scale);
      const x = canvasW - pad - logoSize;
      const y = canvasH - pad - logoSize;
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x, y, logoSize, logoSize, 6 * scale);
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOff = Math.abs(offset);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    `${sign}${offH}:${offM}`;
}
