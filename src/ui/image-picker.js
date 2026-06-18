import './photo-overlay.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: block;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
  }

  /*
   * Clave anti-deformación: la celda determina su altura solo por aspect-ratio.
   * El <img> usa position:absolute para salir del flujo y no empujar la altura.
   */
  .cell {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: #15191D;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
    -webkit-tap-highlight-color: transparent;
  }
  .cell:active { opacity: 0.8; }

  /* Selection highlight ring */
  .cell.selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2.5px solid #FF6A1A;
    border-radius: 2px;
    z-index: 3;
    pointer-events: none;
  }

  .thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Scrim + metadata overlay */
  .meta-overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 18px 6px 5px;
    background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
    z-index: 1;
  }
  .time {
    font-size: 9.5px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    color: rgba(245,243,239,0.9);
    line-height: 1;
  }
  .acc {
    font-size: 9px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    line-height: 1;
  }
  .acc.good { color: #3DDC84; }
  .acc.warn { color: #FFC247; }
  .acc.none { color: #565C64; }

  /* Estado vacío */
  .empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 56px 24px;
    text-align: center;
  }
  .empty-icon { font-size: 38px; opacity: 0.35; }
  .empty-text { font-size: 14px; color: #565C64; line-height: 1.5; }
  .empty-btn {
    padding: 10px 22px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    color: #F5F3EF;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    margin-top: 4px;
  }
</style>
<div class="grid" id="grid"></div>
`;

export class ImagePicker extends HTMLElement {
  /** @type {Map<string, string>} photoId → blob URL */
  #urlMap = new Map();
  /** @type {Set<string>} photoId */
  #selectedIds = new Set();
  #selectionMode = false;
  #initialized = false;
  /** @type {import('../db.js').PhotoEntry[]} */
  #photos = [];

  connectedCallback() {
    if (this.#initialized) return;
    this.#initialized = true;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  disconnectedCallback() {
    this.#revokeAll();
  }

  // ── Public API ───────────────────────────────────────────────

  /** @param {import('../db.js').PhotoEntry[]} arr */
  set photos(arr) {
    if (!this.shadowRoot) return;
    this.#photos = arr;
    const newIds = new Set(arr.map(p => p.id));

    for (const [id, url] of this.#urlMap) {
      if (!newIds.has(id)) { URL.revokeObjectURL(url); this.#urlMap.delete(id); }
    }
    for (const photo of arr) {
      if (!this.#urlMap.has(photo.id) && photo.thumbnailBlob) {
        this.#urlMap.set(photo.id, URL.createObjectURL(photo.thumbnailBlob));
      }
    }

    // Drop selections for removed photos
    for (const id of this.#selectedIds) {
      if (!newIds.has(id)) this.#selectedIds.delete(id);
    }

    this.#render(arr);
  }

  get selectionMode() { return this.#selectionMode; }

  set selectionMode(v) {
    this.#selectionMode = !!v;
    if (!this.#selectionMode) this.#selectedIds.clear();
    this.#render(this.#photos);
  }

  /** @returns {string[]} */
  get selectedIds() { return [...this.#selectedIds]; }

  // ── Private ──────────────────────────────────────────────────

  #render(photos) {
    const grid = this.shadowRoot.getElementById('grid');
    grid.innerHTML = '';

    if (photos.length === 0) {
      grid.appendChild(this.#emptyState());
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const photo of photos) {
      fragment.appendChild(this.#buildCell(photo));
    }
    grid.appendChild(fragment);
  }

  #buildCell(photo) {
    const url = this.#urlMap.get(photo.id);
    const isSelected = this.#selectedIds.has(photo.id);

    const cell = document.createElement('button');
    cell.className = 'cell' + (isSelected ? ' selected' : '');
    cell.setAttribute('aria-label', `Captura ${formatTime(photo.capturedAt)}`);
    cell.dataset.id = photo.id;

    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = url ?? '';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';

    // Action overlay (top)
    const overlay = document.createElement('geo-photo-overlay');
    overlay.favorite = !!(photo.isFavorite);
    overlay.selected = isSelected;
    overlay.selectionMode = this.#selectionMode;

    overlay.addEventListener('overlay-favorite', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('photo-favorite', {
        detail: { photoId: photo.id, isFavorite: !photo.isFavorite },
        bubbles: true, composed: true,
      }));
    });

    overlay.addEventListener('overlay-delete', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('photo-delete', {
        detail: { photoId: photo.id },
        bubbles: true, composed: true,
      }));
    });

    overlay.addEventListener('overlay-select', (e) => {
      e.stopPropagation();
      this.#toggleSelection(photo.id);
    });

    // Meta overlay (bottom)
    const metaOverlay = document.createElement('div');
    metaOverlay.className = 'meta-overlay';

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(photo.capturedAt);

    const acc = document.createElement('span');
    if (photo.accuracyMeters > 0) {
      acc.className = `acc ${photo.accuracyMeters <= 20 ? 'good' : 'warn'}`;
      acc.textContent = `±${photo.accuracyMeters}m`;
    } else {
      acc.className = 'acc none';
      acc.textContent = '—';
    }

    metaOverlay.appendChild(time);
    metaOverlay.appendChild(acc);
    cell.appendChild(img);
    cell.appendChild(overlay);
    cell.appendChild(metaOverlay);

    cell.addEventListener('click', () => {
      if (this.#selectionMode) {
        this.#toggleSelection(photo.id);
      } else {
        this.dispatchEvent(new CustomEvent('photo-select', {
          detail: { photoId: photo.id },
          bubbles: true, composed: true,
        }));
      }
    });

    return cell;
  }

  #toggleSelection(photoId) {
    if (this.#selectedIds.has(photoId)) {
      this.#selectedIds.delete(photoId);
    } else {
      this.#selectedIds.add(photoId);
    }
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { selectedIds: [...this.#selectedIds] },
      bubbles: true, composed: true,
    }));
    // Update only the affected cell's visual state
    this.#patchCell(photoId);
  }

  /** Re-syncs a single cell's selected state without a full re-render. */
  #patchCell(photoId) {
    const cell = this.shadowRoot.querySelector(`.cell[data-id="${photoId}"]`);
    if (!cell) return;
    const isSelected = this.#selectedIds.has(photoId);
    cell.classList.toggle('selected', isSelected);
    const overlay = cell.querySelector('geo-photo-overlay');
    if (overlay) { overlay.selected = isSelected; }
  }

  #emptyState() {
    const div = document.createElement('div');
    div.className = 'empty';
    div.innerHTML = `
      <div class="empty-icon">📷</div>
      <p class="empty-text">Aún no hay capturas.<br>Vuelve a la cámara y registra la primera.</p>
      <button class="empty-btn">Ir a la cámara</button>
    `;
    div.querySelector('.empty-btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }));
    });
    return div;
  }

  #revokeAll() {
    for (const url of this.#urlMap.values()) URL.revokeObjectURL(url);
    this.#urlMap.clear();
  }
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

customElements.define('geo-image-picker', ImagePicker);
