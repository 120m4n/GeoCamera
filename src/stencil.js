/** @import { GeoFix } from './geo.js' */

const TEXT_MONO = "'JetBrains Mono', 'SF Mono', 'Consolas', monospace";
const TEXT_SANS = "-apple-system, 'Inter', 'Segoe UI', sans-serif";

/**
 * Renders the GPS/date stencil + logo watermark onto a canvas in-place.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {GeoFix | null} fix
 * @param {Blob | null} logoBlob
 * @param {{
 *   showWatermark:   boolean,
 *   logoPosition:    'top-left'|'top-right'|'bottom-left'|'bottom-right',
 *   logoAlpha:       number,
 *   stencilPosition: 'top'|'bottom'|'left'|'right',
 *   stencilAlpha:    number,
 * }} config
 */
export async function applyStencil(canvas, fix, logoBlob, config) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Cap scale: without this a 1920px capture yields scale≈4.9 → 68px fonts
  const scale   = Math.min(w / 390, 2.5);
  const fCoords = Math.round(11 * scale);
  const fMeta   = Math.round(10 * scale);
  const padX    = Math.round(14 * scale);
  const padY    = Math.round(8  * scale);
  const gap     = Math.round(4  * scale);

  const sAlpha   = config.stencilAlpha    ?? 0.75;
  const position = config.stencilPosition ?? 'bottom';

  // Band height is content-driven, not a fixed image ratio
  const rowsH = fix
    ? fCoords + gap + fMeta + gap + fMeta
    : fMeta   + gap + fMeta;
  const bandH = padY + rowsH + padY;

  // For left/right the canvas axes swap after rotation:
  //   effectiveW = h (original height becomes the text line length)
  //   effectiveH = w (original width becomes the band thickness direction)
  const isVertical = position === 'left' || position === 'right';
  const effectiveW = isVertical ? h : w;
  const effectiveH = isVertical ? w : h;

  ctx.save();

  // Set up rotation transform for vertical bands.
  // translate(w,0)+rotate(+90°) maps y_bottom → x_orig≈0 (left edge).
  // translate(0,h)+rotate(-90°) maps y_bottom → x_orig≈w (right edge).
  if (position === 'left') {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
  } else if (position === 'right') {
    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);
  }

  // ── Gradient band ──────────────────────────────────────────────
  const feather = Math.round(bandH * 0.7);

  if (position === 'top') {
    const grad = ctx.createLinearGradient(0, 0, 0, bandH + feather);
    grad.addColorStop(0,    `rgba(0,0,0,${sAlpha.toFixed(2)})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${(sAlpha * 0.8).toFixed(2)})`);
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, effectiveW, bandH + feather);
  } else {
    // bottom, left (rotated), right (rotated) — all draw a "bottom" band
    const y0 = effectiveH - bandH;
    const grad = ctx.createLinearGradient(0, y0 - feather, 0, effectiveH);
    grad.addColorStop(0,    'rgba(0,0,0,0)');
    grad.addColorStop(0.45, `rgba(0,0,0,${(sAlpha * 0.78).toFixed(2)})`);
    grad.addColorStop(1,    `rgba(0,0,0,${sAlpha.toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0 - feather, effectiveW, bandH + feather);
  }

  // ── Text ───────────────────────────────────────────────────────
  ctx.globalAlpha = sAlpha;
  ctx.textBaseline = 'top';
  const textY = position === 'top'
    ? padY
    : (effectiveH - bandH + padY);

  if (fix) {
    // Row 1: coordinates (left) | ±accuracy (right)
    ctx.font = `${fCoords}px ${TEXT_MONO}`;
    ctx.fillStyle = '#F5F3EF';
    ctx.fillText(`${fix.lat.toFixed(6)}, ${fix.lon.toFixed(6)}`, padX, textY);

    const accText = `±${fix.accuracy}m`;
    ctx.fillStyle = '#3DDC84';
    ctx.fillText(accText, effectiveW - padX - ctx.measureText(accText).width, textY);

    // Row 2: Plus Code
    ctx.font = `${fMeta}px ${TEXT_MONO}`;
    ctx.fillStyle = '#8B919A';
    ctx.fillText(fix.plusCode, padX, textY + fCoords + gap);

    // Row 3: datetime
    ctx.font = `${fMeta}px ${TEXT_MONO}`;
    ctx.fillStyle = '#565C64';
    ctx.fillText(formatDateTime(new Date(fix.ts)), padX, textY + fCoords + gap + fMeta + gap);
  } else {
    ctx.font = `${fMeta}px ${TEXT_SANS}`;
    ctx.fillStyle = '#FFC247';
    ctx.fillText('Sin GPS', padX, textY);

    ctx.font = `${fMeta}px ${TEXT_MONO}`;
    ctx.fillStyle = '#565C64';
    ctx.fillText(formatDateTime(new Date()), padX, textY + fMeta + gap);
  }

  ctx.restore();

  // ── Logo watermark ─────────────────────────────────────────────
  if (config.showWatermark && logoBlob) {
    // Level 1: size proportional to image, not to text scale
    const logoSize = Math.max(Math.round(Math.min(w, h) * 0.07), 28);
    await drawLogo(
      ctx, logoBlob, w, h, padX, scale, logoSize,
      config.logoPosition ?? 'bottom-right',
      config.logoAlpha    ?? 1.0,
    );
  }
}

async function drawLogo(ctx, blob, canvasW, canvasH, pad, scale, logoSize, position, alpha) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    // Level 1 SVG fix: set explicit dimensions before assigning src so WebKit
    // can compute natural size for SVGs that lack width/height attributes
    img.width  = logoSize;
    img.height = logoSize;
    img.onload = () => {
      const [x, y] = logoCorner(position, canvasW, canvasH, pad, logoSize);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      roundRect(ctx, x, y, logoSize, logoSize, Math.round(6 * scale));
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

function logoCorner(position, w, h, pad, size) {
  switch (position) {
    case 'top-left':    return [pad, pad];
    case 'top-right':   return [w - pad - size, pad];
    case 'bottom-left': return [pad, h - pad - size];
    default:            return [w - pad - size, h - pad - size]; // bottom-right
  }
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
