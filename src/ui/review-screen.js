import { applyStencil } from '../stencil.js';

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
  .photo-wrap {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    z-index: 3;
    transition: opacity 0.06s ease-out;
  }
  .flash.active { opacity: 0.65; }
  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(6,7,10,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  .loading-overlay.hidden { display: none; }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #FF6A1A;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .actions {
    display: flex;
    gap: 12px;
    padding: 18px 20px;
    padding-bottom: max(env(safe-area-inset-bottom), 32px);
    background: #0B0E11;
    border-top: 1px solid #2A3037;
  }
  button {
    flex: 1;
    height: 56px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  button:active { opacity: 0.8; }
  .btn-discard {
    background: #1D2227;
    color: #F5F3EF;
    border: 1px solid #2A3037;
  }
  .btn-save {
    background: #FF6A1A;
    color: #0B0E11;
  }
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
<div class="photo-wrap">
  <canvas id="canvas"></canvas>
  <div class="flash" id="flash"></div>
  <div class="loading-overlay" id="loading">
    <div class="spinner"></div>
  </div>
</div>
<div class="actions">
  <button class="btn-discard" id="discardBtn">✕ Descartar</button>
  <button class="btn-save" id="saveBtn">✓ Guardar</button>
</div>
`;

export class ReviewScreen extends HTMLElement {
  #canvas = null;
  #fix = null;
  #config = null;
  #saving = false;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById('discardBtn').addEventListener('click', () => this.#discard());
    this.shadowRoot.getElementById('saveBtn').addEventListener('click', () => this.#save());
  }

  /**
   * @param {HTMLCanvasElement} srcCanvas - raw capture from camera
   * @param {import('../geo.js').GeoFix | null} fix
   * @param {{ logoBlob: Blob|null, showWatermark: boolean }} config
   */
  async setCapture(srcCanvas, fix, config) {
    this.#fix = fix;
    this.#config = config;
    this.#saving = false;

    const saveBtn = this.shadowRoot.getElementById('saveBtn');
    saveBtn.textContent = '✓ Guardar';
    saveBtn.disabled = true;

    const loading = this.shadowRoot.getElementById('loading');
    loading.classList.remove('hidden');

    const displayCanvas = this.shadowRoot.getElementById('canvas');
    // Draw at native resolution to a temp canvas for stencil, then render to display
    const workCanvas = document.createElement('canvas');
    workCanvas.width = srcCanvas.width;
    workCanvas.height = srcCanvas.height;
    workCanvas.getContext('2d').drawImage(srcCanvas, 0, 0);

    await applyStencil(workCanvas, fix, config.logoBlob, config);

    // Store for save
    this.#canvas = workCanvas;

    // Render to display canvas (will scale via CSS)
    displayCanvas.width = workCanvas.width;
    displayCanvas.height = workCanvas.height;
    displayCanvas.getContext('2d').drawImage(workCanvas, 0, 0);

    loading.classList.add('hidden');
    this.shadowRoot.getElementById('saveBtn').disabled = false;
  }

  #discard() {
    this.#canvas = null;
    this.dispatchEvent(new CustomEvent('discard', { bubbles: true, composed: true }));
  }

  async #save() {
    if (this.#saving || !this.#canvas) return;
    this.#saving = true;
    const saveBtn = this.shadowRoot.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '…';

    // Shutter flash — immediate tactile feedback before the async save
    const flash = this.shadowRoot.getElementById('flash');
    flash.classList.add('active');
    await new Promise(r => setTimeout(r, 90));
    flash.classList.remove('active');

    this.dispatchEvent(new CustomEvent('save', {
      detail: { canvas: this.#canvas, fix: this.#fix, config: this.#config },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('geo-review-screen', ReviewScreen);
