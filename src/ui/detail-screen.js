import { getPhoto } from '../db.js';

const _svg = (d) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  back:   _svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  prev:   _svg('<path d="m15 18-6-6 6-6"/>'),
  next:   _svg('<path d="m9 18 6-6-6-6"/>'),
  mapPin: _svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  copy:   _svg('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
  check:  _svg('<polyline points="20 6 9 17 4 12"/>'),
};

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    position: absolute;
    inset: 0;
    background: #06070A;
  }
  .header {
    padding: max(env(safe-area-inset-top), 18px) 18px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #2A3037;
    flex-shrink: 0;
    background: #0B0E11;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .back-btn {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #F5F3EF;
    user-select: none; -webkit-user-select: none; flex-shrink: 0;
  }
  .back-btn svg { width: 18px; height: 18px; display: block; }
  .header-title h1 { font-size: 17px; font-weight: 600; color: #F5F3EF; margin: 0; }
  .header-title .sub { font-size: 12px; color: #8B919A; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
  .pos-badge {
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: #8B919A;
    background: #15191D;
    border: 1px solid #2A3037;
    border-radius: 20px;
    padding: 4px 10px;
    white-space: nowrap;
  }
  .pos-badge[hidden] { display: none; }

  .photo-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #06070A;
    touch-action: pan-y;
  }
  .photo-area img {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
    transition: opacity 0.12s ease;
  }
  .photo-area img.fade { opacity: 0; }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px; height: 64px;
    background: rgba(11,14,17,0.60);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(245,243,239,0.85);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; user-select: none; -webkit-user-select: none;
    z-index: 4;
    transition: background 0.12s;
  }
  .nav-btn:active { background: rgba(255,106,26,0.30); }
  .nav-btn.prev { left: 0; border-left: none; border-radius: 0 8px 8px 0; }
  .nav-btn.next { right: 0; border-right: none; border-radius: 8px 0 0 8px; }
  .nav-btn[hidden] { display: none; }
  .nav-btn svg { width: 20px; height: 20px; display: block; }

  .meta {
    background: #15191D;
    border-top: 1px solid #2A3037;
    overflow-y: auto;
    flex-shrink: 0;
    max-height: 42%;
    /* padding-bottom keeps last row clear of the Android/iOS home indicator */
    padding-bottom: max(env(safe-area-inset-bottom), 12px);
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 16px;
    border-bottom: 1px solid #2A3037;
    gap: 10px;
  }
  .meta-row:last-child { border-bottom: none; }
  .k { color: #8B919A; font-size: 12px; flex-shrink: 0; }
  .v { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #F5F3EF; text-align: right; word-break: break-all; }
  /* value + icon combos */
  .v-row {
    display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0;
  }
  .copy-btn {
    width: 28px; height: 28px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; cursor: pointer;
    color: #565C64; border-radius: 6px;
    padding: 0; transition: color 0.15s;
  }
  .copy-btn svg { width: 14px; height: 14px; display: block; }
  .copy-btn:active, .copy-btn:hover { color: #F5F3EF; }
  .copy-btn.copied { color: #3DDC84; }
  .map-pin-link {
    flex-shrink: 0; display: flex; align-items: center;
    color: #FF6A1A; text-decoration: none;
  }
  .map-pin-link svg { width: 16px; height: 16px; display: block; }
  .map-pin-link:active { opacity: 0.65; }
</style>
<div class="header">
  <div class="header-left">
    <div class="back-btn" id="backBtn">${ICON.back}</div>
    <div class="header-title">
      <h1>Detalle</h1>
      <div class="sub" id="subtitle"></div>
    </div>
  </div>
  <div class="pos-badge" id="posBadge" hidden></div>
</div>
<div class="photo-area" id="photoArea">
  <img id="thumb" alt="Captura" />
  <div class="nav-btn prev" id="prevBtn" hidden>${ICON.prev}</div>
  <div class="nav-btn next" id="nextBtn" hidden>${ICON.next}</div>
</div>
<div class="meta" id="meta"></div>
`;

export class DetailScreen extends HTMLElement {
  #thumbUrl = null;
  /** @type {import('../db.js').PhotoEntry[]} */
  #photos = [];
  #currentIndex = 0;
  #touchStartX = 0;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    const sr = this.shadowRoot;
    sr.getElementById('backBtn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('nav', { detail: 'list', bubbles: true, composed: true }))
    );
    sr.getElementById('prevBtn').addEventListener('click', () => this.#step(-1));
    sr.getElementById('nextBtn').addEventListener('click', () => this.#step(1));

    const area = sr.getElementById('photoArea');
    area.addEventListener('touchstart', (e) => {
      this.#touchStartX = e.touches[0].clientX;
    }, { passive: true });
    area.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.#touchStartX;
      if (Math.abs(dx) > 50) this.#step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  disconnectedCallback() {
    if (this.#thumbUrl) { URL.revokeObjectURL(this.#thumbUrl); this.#thumbUrl = null; }
  }

  /**
   * @param {string} photoId
   * @param {import('../db.js').PhotoEntry[]} [photos] — full list enables slider navigation
   */
  async load(photoId, photos = []) {
    try {
      this.#photos = photos;
      this.#currentIndex = photos.findIndex(p => p.id === photoId);

      if (this.#currentIndex < 0) {
        const single = await getPhoto(photoId);
        if (!single) return;
        this.#photos = [single];
        this.#currentIndex = 0;
      }

      this.#renderCurrent();
    } catch (err) {
      console.error('[GeoCamera/detail] load error', err?.message);
    }
  }

  // ── Private ──────────────────────────────────────────────────

  async #step(delta) {
    const next = this.#currentIndex + delta;
    if (next < 0 || next >= this.#photos.length) return;

    const img = this.shadowRoot.getElementById('thumb');
    img.classList.add('fade');
    await new Promise(r => setTimeout(r, 120));
    this.#currentIndex = next;
    this.#renderCurrent();
    img.classList.remove('fade');
  }

  #renderCurrent() {
    const photo = this.#photos[this.#currentIndex];
    if (!photo) return;
    const sr = this.shadowRoot;

    if (this.#thumbUrl) URL.revokeObjectURL(this.#thumbUrl);
    this.#thumbUrl = URL.createObjectURL(photo.thumbnailBlob);
    sr.getElementById('thumb').src = this.#thumbUrl;

    sr.getElementById('subtitle').textContent = formatDate(photo.capturedAt);

    const badge = sr.getElementById('posBadge');
    if (this.#photos.length > 1) {
      badge.textContent = `${this.#currentIndex + 1} / ${this.#photos.length}`;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }

    sr.getElementById('prevBtn').hidden = this.#currentIndex === 0;
    sr.getElementById('nextBtn').hidden = this.#currentIndex === this.#photos.length - 1;

    this.#renderMeta(photo);
  }

  #renderMeta(photo) {
    const hasCoords = photo.latitude !== 0 || photo.longitude !== 0;
    const mapsUrl = hasCoords
      ? `https://maps.google.com/?q=${photo.latitude.toFixed(6)},${photo.longitude.toFixed(6)}`
      : null;
    const coordStr = hasCoords
      ? `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`
      : 'N/D';

    const meta = this.shadowRoot.getElementById('meta');
    meta.innerHTML = '';

    const addRow = (k, v) => {
      const row = document.createElement('div');
      row.className = 'meta-row';
      row.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
      meta.appendChild(row);
    };

    // ── Coordenadas (lat, lon) + copy button ──────────────────
    {
      const row = document.createElement('div');
      row.className = 'meta-row';
      const kEl = document.createElement('span');
      kEl.className = 'k';
      kEl.textContent = 'Coordenadas';
      const vRow = document.createElement('div');
      vRow.className = 'v-row';
      const vEl = document.createElement('span');
      vEl.className = 'v';
      vEl.textContent = coordStr;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.setAttribute('aria-label', 'Copiar coordenadas');
      copyBtn.innerHTML = ICON.copy;
      copyBtn.disabled = !hasCoords;
      if (hasCoords) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(coordStr);
            copyBtn.innerHTML = ICON.check;
            copyBtn.classList.add('copied');
            setTimeout(() => { copyBtn.innerHTML = ICON.copy; copyBtn.classList.remove('copied'); }, 1500);
          } catch { /* clipboard unavailable */ }
        });
      }
      vRow.appendChild(vEl);
      vRow.appendChild(copyBtn);
      row.appendChild(kEl);
      row.appendChild(vRow);
      meta.appendChild(row);
    }

    addRow('Precisión', photo.accuracyMeters >= 0 ? `±${photo.accuracyMeters} m` : 'N/D');

    // ── Plus Code + map pin link ──────────────────────────────
    {
      const row = document.createElement('div');
      row.className = 'meta-row';
      const kEl = document.createElement('span');
      kEl.className = 'k';
      kEl.textContent = 'Plus Code';
      const vRow = document.createElement('div');
      vRow.className = 'v-row';
      const vEl = document.createElement('span');
      vEl.className = 'v';
      vEl.textContent = photo.plusCode || 'N/D';
      vRow.appendChild(vEl);
      if (mapsUrl) {
        const a = document.createElement('a');
        a.className = 'map-pin-link';
        a.href = mapsUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', 'Abrir en Google Maps');
        a.innerHTML = ICON.mapPin;
        vRow.appendChild(a);
      }
      row.appendChild(kEl);
      row.appendChild(vRow);
      meta.appendChild(row);
    }

    addRow('Capturada', formatDateTime(photo.capturedAt));
    addRow('Archivo',   photo.filename);
  }
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function syncLabel(status) {
  return { local: 'Local', pending: 'Pendiente', synced: 'Sincronizado', error: 'Error' }[status] ?? status;
}

customElements.define('geo-detail-screen', DetailScreen);
