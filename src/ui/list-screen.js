import { listPhotos, deletePhoto, deletePhotos, getFifoMax } from '../db.js';
import { zipSync } from 'fflate';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import './image-picker.js';

const _svg = (d) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  back:   _svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  map:    _svg('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
  zip:    _svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  search: _svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'),
};

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    position: absolute;
    inset: 0;
    background: #0B0E11;
  }
  .header {
    padding: max(env(safe-area-inset-top), 18px) 18px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #2A3037;
    flex-shrink: 0;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header h1 {
    font-size: 17px;
    font-weight: 600;
    color: #F5F3EF;
    margin: 0;
  }
  .header .sub {
    font-size: 12px;
    color: #8B919A;
    font-family: 'JetBrains Mono', monospace;
    margin-top: 2px;
  }
  .back-btn {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #F5F3EF;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
  }
  .back-btn svg { width: 18px; height: 18px; display: block; }
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .map-btn {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #8B919A;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
    transition: color 0.15s, border-color 0.15s;
  }
  .map-btn:active { color: #FF6A1A; border-color: #FF6A1A; }
  .map-btn svg { width: 18px; height: 18px; display: block; }
  .icon-btn {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #8B919A; flex-shrink: 0;
    user-select: none; -webkit-user-select: none;
    transition: color 0.15s, border-color 0.15s;
  }
  .icon-btn:active { color: #FF6A1A; border-color: #FF6A1A; }
  .icon-btn.active { color: #FF6A1A; border-color: #FF6A1A; background: rgba(255,106,26,0.10); }
  .icon-btn svg { width: 18px; height: 18px; display: block; }
  .icon-btn[disabled] { opacity: 0.35; pointer-events: none; }

  /* Search bar */
  .search-bar {
    padding: 8px 18px;
    background: #0B0E11;
    border-bottom: 1px solid #2A3037;
    flex-shrink: 0;
    display: none;
  }
  .search-bar.visible { display: block; }
  .search-input {
    width: 100%;
    height: 36px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    color: #F5F3EF;
    font-size: 14px;
    font-family: inherit;
    padding: 0 12px;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input::placeholder { color: #565C64; }
  .search-input:focus { border-color: #FF6A1A; }
  .select-btn {
    height: 32px;
    padding: 0 14px;
    border-radius: 16px;
    background: transparent;
    border: 1px solid #2A3037;
    color: #8B919A;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .select-btn.active {
    background: rgba(255,106,26,0.12);
    border-color: #FF6A1A;
    color: #FF6A1A;
  }

  /* Dar al picker todo el espacio restante para que su scroll funcione */
  geo-image-picker {
    flex: 1;
    min-height: 0;
  }

  /* Action bar — visible only in selection mode */
  .action-bar {
    display: none;
    padding: 12px 18px;
    padding-bottom: max(env(safe-area-inset-bottom), 20px);
    background: #0B0E11;
    border-top: 1px solid #2A3037;
    flex-shrink: 0;
  }
  .action-bar.visible { display: block; }
  .trash-btn {
    width: 100%;
    height: 50px;
    border-radius: 14px;
    background: rgba(220,53,69,0.12);
    border: 1px solid rgba(220,53,69,0.35);
    color: #ff6b6b;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, opacity 0.15s;
    user-select: none;
    -webkit-user-select: none;
  }
  .trash-btn:active { background: rgba(220,53,69,0.25); }
  .trash-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
<div class="header">
  <div class="header-left">
    <div class="back-btn" id="backBtn">${ICON.back}</div>
    <div>
      <h1>Capturas recientes</h1>
      <div class="sub" id="subtitle">0 de 6 · FIFO local</div>
    </div>
  </div>
  <div class="header-right">
    <button class="icon-btn" id="zipBtn" title="Exportar ZIP" aria-label="Exportar miniaturas en ZIP">${ICON.zip}</button>
    <button class="icon-btn" id="searchBtn" title="Buscar" aria-label="Buscar capturas">${ICON.search}</button>
    <div class="map-btn" id="mapBtn" title="Visor geográfico">${ICON.map}</div>
    <button class="select-btn" id="selectBtn">Seleccionar</button>
  </div>
</div>
<div class="search-bar" id="searchBar">
  <input class="search-input" id="searchInput" type="search" placeholder="Plus Code, archivo o fecha…" autocomplete="off" autocorrect="off" spellcheck="false">
</div>
<geo-image-picker id="picker"></geo-image-picker>
<div class="action-bar" id="actionBar">
  <button class="trash-btn" id="trashBtn" disabled>🗑 Eliminar seleccionadas (0)</button>
</div>
`;

export class ListScreen extends HTMLElement {
  #selectionMode = false;
  #searchQuery = '';
  /** @type {import('../db.js').PhotoEntry[]} */
  #photos = [];

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById('backBtn').addEventListener('click', () => {
      if (this.#selectionMode) {
        this.#exitSelectionMode();
      } else {
        this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }));
      }
    });

    this.shadowRoot.getElementById('mapBtn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('nav', { detail: 'map', bubbles: true, composed: true }));
    });

    this.shadowRoot.getElementById('searchBtn').addEventListener('click', () => this.#toggleSearch());
    this.shadowRoot.getElementById('searchInput').addEventListener('input', (e) => {
      this.#searchQuery = e.target.value.trim().toLowerCase();
      this.#applyFilter();
    });
    this.shadowRoot.getElementById('zipBtn').addEventListener('click', () => this.#exportZip());

    this.shadowRoot.getElementById('selectBtn').addEventListener('click', () => {
      if (this.#selectionMode) {
        this.#exitSelectionMode();
      } else {
        this.#enterSelectionMode();
      }
    });

    this.shadowRoot.getElementById('picker').addEventListener('photo-select', (e) => {
      this.dispatchEvent(new CustomEvent('nav', {
        detail: { screen: 'detail', photoId: e.detail.photoId, photos: this.#photos },
        bubbles: true, composed: true,
      }));
    });

    this.shadowRoot.getElementById('picker').addEventListener('photo-delete', async (e) => {
      try {
        await deletePhoto(e.detail.photoId);
        await this.refresh();
      } catch (err) {
        console.error('[GeoCamera/list] delete error', err?.message);
      }
    });

    this.shadowRoot.getElementById('picker').addEventListener('selection-change', (e) => {
      this.#updateTrashBtn(e.detail.selectedIds.length);
    });

    this.shadowRoot.getElementById('trashBtn').addEventListener('click', () => this.#deleteSelected());
  }

  /** @param {import('../db.js').PhotoEntry[]} [photosOverride] */
  async refresh(photosOverride) {
    try {
      const [photos, fifoMax] = await Promise.all([
        photosOverride ?? listPhotos(),
        getFifoMax(),
      ]);
      this.#photos = Array.isArray(photosOverride) ? photosOverride : photos;
      this.shadowRoot.getElementById('subtitle').textContent = `${this.#photos.length} de ${fifoMax} · FIFO local`;
      this.#applyFilter();
      if (this.#selectionMode) {
        this.#updateTrashBtn(this.shadowRoot.getElementById('picker').selectedIds.length);
      }
    } catch (err) {
      console.error('[GeoCamera/list] refresh error', err?.message);
    }
  }

  #applyFilter() {
    const q = this.#searchQuery;
    const visible = q
      ? this.#photos.filter(p =>
          p.plusCode?.toLowerCase().includes(q) ||
          p.filename?.toLowerCase().includes(q) ||
          new Date(p.capturedAt).toLocaleDateString('es').toLowerCase().includes(q)
        )
      : this.#photos;
    this.shadowRoot.getElementById('picker').photos = visible;
  }

  #toggleSearch() {
    const bar = this.shadowRoot.getElementById('searchBar');
    const btn = this.shadowRoot.getElementById('searchBtn');
    const visible = bar.classList.toggle('visible');
    btn.classList.toggle('active', visible);
    if (visible) {
      this.shadowRoot.getElementById('searchInput').focus();
    } else {
      this.shadowRoot.getElementById('searchInput').value = '';
      this.#searchQuery = '';
      this.#applyFilter();
    }
  }

  async #exportZip() {
    const photos = this.#photos;
    if (photos.length === 0) return;

    const btn = this.shadowRoot.getElementById('zipBtn');
    btn.disabled = true;
    try {
      const files = {};
      for (const photo of photos) {
        const ab = await photo.thumbnailBlob.arrayBuffer();
        files[photo.filename] = new Uint8Array(ab);
      }
      // level 0 = store-only — JPEGs are already compressed
      const zipped = zipSync(files, { level: 0 });
      const filename = `geocamera_${new Date().toISOString().slice(0, 10)}.zip`;

      if (Capacitor.isNativePlatform()) {
        // iOS/Android: blob URLs are not openable by the OS — write to Cache then share
        const base64 = uint8ToBase64(zipped);
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache, recursive: true });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ files: [uri], title: filename });
        Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => {});
      } else {
        const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[GeoCamera/list] exportZip error', err?.message);
      }
    } finally {
      btn.disabled = false;
    }
  }

  // ── Selection mode ───────────────────────────────────────────

  #enterSelectionMode() {
    this.#selectionMode = true;
    this.shadowRoot.getElementById('picker').selectionMode = true;
    this.shadowRoot.getElementById('selectBtn').textContent = 'Cancelar';
    this.shadowRoot.getElementById('selectBtn').classList.add('active');
    this.shadowRoot.getElementById('actionBar').classList.add('visible');
    this.#updateTrashBtn(0);
  }

  #exitSelectionMode() {
    this.#selectionMode = false;
    this.shadowRoot.getElementById('picker').selectionMode = false;
    this.shadowRoot.getElementById('selectBtn').textContent = 'Seleccionar';
    this.shadowRoot.getElementById('selectBtn').classList.remove('active');
    this.shadowRoot.getElementById('actionBar').classList.remove('visible');
  }

  async #deleteSelected() {
    try {
      const picker = this.shadowRoot.getElementById('picker');
      const ids = picker.selectedIds;
      if (ids.length === 0) return;
      await deletePhotos(ids);
      this.#exitSelectionMode();
      await this.refresh();
    } catch (err) {
      console.error('[GeoCamera/list] deleteSelected error', err?.message);
    }
  }

  #updateTrashBtn(count) {
    const btn = this.shadowRoot.getElementById('trashBtn');
    btn.textContent = `🗑 Eliminar seleccionadas (${count})`;
    btn.disabled = count === 0;
  }
}

customElements.define('geo-list-screen', ListScreen);

// Chunked to avoid stack overflow on large arrays with spread operator
function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
