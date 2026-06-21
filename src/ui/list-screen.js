import { listPhotos, deletePhoto, deletePhotos, FIFO_MAX } from '../db.js';
import './image-picker.js';

const _svg = (d) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  back: _svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
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
  <button class="select-btn" id="selectBtn">Seleccionar</button>
</div>
<geo-image-picker id="picker"></geo-image-picker>
<div class="action-bar" id="actionBar">
  <button class="trash-btn" id="trashBtn" disabled>🗑 Eliminar seleccionadas (0)</button>
</div>
`;

export class ListScreen extends HTMLElement {
  #selectionMode = false;
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
      const photos = photosOverride ?? await listPhotos();
      this.#photos = photos;
      this.shadowRoot.getElementById('subtitle').textContent = `${photos.length} de ${FIFO_MAX} · FIFO local`;
      this.shadowRoot.getElementById('picker').photos = photos;
      if (this.#selectionMode) {
        this.#updateTrashBtn(this.shadowRoot.getElementById('picker').selectedIds.length);
      }
    } catch (err) {
      console.error('[GeoCamera/list] refresh error', err?.message);
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
