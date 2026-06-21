import { getConfig, setConfig, FIFO_MAX } from '../db.js';
import './logo-crop-modal.js';

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
  .header h1 { font-size: 17px; font-weight: 600; color: #F5F3EF; margin: 0; }
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
    font-size: 16px;
    user-select: none;
    -webkit-user-select: none;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 0 18px;
  }

  /* ── Section labels ── */
  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: #8B919A;
    margin: 20px 0 10px;
  }

  /* ── Logo preview ── */
  .logo-preview {
    height: 80px;
    border-radius: 12px;
    background: #15191D;
    border: 1px dashed #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-bottom: 10px;
    position: relative;
  }
  .logo-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .logo-preview .placeholder { color: #565C64; font-size: 13px; }
  .logo-preview .default-label {
    position: absolute; bottom: 0; left: 0; right: 0;
    font-size: 10px; color: #8B919A;
    background: rgba(11,14,17,0.78);
    text-align: center; padding: 3px 0;
    pointer-events: none;
  }
  .logo-preview .info-label {
    position: absolute; bottom: 0; left: 0; right: 0;
    font-size: 10px; color: #FFC247;
    background: rgba(11,14,17,0.78);
    text-align: center; padding: 3px 0;
    pointer-events: none;
  }
  .upload-btn, .clear-btn {
    height: 44px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    border: 1px solid #2A3037;
  }
  .upload-btn { background: #1D2227; color: #F5F3EF; margin-bottom: 8px; }
  .clear-btn  { background: transparent; color: #8B919A; }
  input[type="file"] { display: none; }

  /* ── Toggle rows ── */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #2A3037;
    gap: 12px;
  }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: 14px; color: #F5F3EF; }
  .toggle-desc  { font-size: 11.5px; color: #8B919A; margin-top: 2px; }
  .switch {
    width: 46px; height: 28px;
    border-radius: 14px;
    background: #1D2227;
    border: 1px solid #2A3037;
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #8B919A;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .switch.on { background: rgba(255,106,26,0.25); border-color: #FF6A1A; }
  .switch.on::after { transform: translateX(18px); background: #FF6A1A; }
  .switch.disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Corner picker (logo position) ── */
  .corner-picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 4px;
  }
  .corner-btn {
    height: 48px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    color: #565C64;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    user-select: none;
    -webkit-user-select: none;
  }
  .corner-btn.active {
    background: rgba(255,106,26,0.15);
    border-color: #FF6A1A;
    color: #FF6A1A;
  }

  /* ── Segmented alpha control ── */
  .seg-control {
    display: flex;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #2A3037;
    margin-bottom: 4px;
  }
  .seg-btn {
    flex: 1;
    height: 40px;
    background: #15191D;
    border: none;
    border-right: 1px solid #2A3037;
    color: #565C64;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    user-select: none;
    -webkit-user-select: none;
  }
  .seg-btn:last-child { border-right: none; }
  .seg-btn.active {
    background: rgba(255,106,26,0.18);
    color: #FF6A1A;
    font-weight: 700;
  }

  /* ── Stencil position picker ── */
  .pos-picker {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }
  .pos-btn {
    flex: 1;
    height: 56px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    color: #565C64;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    user-select: none;
    -webkit-user-select: none;
  }
  .pos-icon { font-size: 18px; line-height: 1; }
  .pos-btn.active {
    background: rgba(255,106,26,0.15);
    border-color: #FF6A1A;
    color: #FF6A1A;
  }

  /* ── Info rows ── */
  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #2A3037;
  }
  .info-label { font-size: 14px; color: #F5F3EF; }
  .info-desc  { font-size: 11.5px; color: #8B919A; margin-top: 2px; }
  .info-value { font-size: 12px; color: #565C64; font-family: 'JetBrains Mono', monospace; }
  .version { padding: 24px 0 max(env(safe-area-inset-bottom), 24px); font-size: 11px; color: #565C64; text-align: center; }
</style>

<div class="header">
  <h1>Configuración</h1>
  <div class="back-btn" id="backBtn">←</div>
</div>

<div class="content">

  <!-- ── Logo / Marca ── -->
  <div class="section-label">Logo / Marca</div>
  <div class="logo-preview" id="logoPreview">
    <span class="placeholder">Sin logo configurado</span>
  </div>
  <input type="file" id="fileInput" accept="image/png,image/svg+xml,image/jpeg,image/webp">
  <button class="upload-btn" id="uploadBtn">Subir logo (PNG / SVG)</button>
  <button class="clear-btn" id="clearBtn" style="display:none">Eliminar logo</button>

  <!-- ── Uso del logo ── -->
  <div class="section-label">Uso del logo</div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Marca de agua en fotos</div>
      <div class="toggle-desc">Incluye el logo al capturar</div>
    </div>
    <div class="switch on" id="switchWatermark"></div>
  </div>

  <!-- ── Posición del logo ── -->
  <div class="section-label">Posición del logo</div>
  <div class="corner-picker">
    <button class="corner-btn" data-corner="top-left"     title="Superior izquierda">↖</button>
    <button class="corner-btn" data-corner="top-right"    title="Superior derecha">↗</button>
    <button class="corner-btn" data-corner="bottom-left"  title="Inferior izquierda">↙</button>
    <button class="corner-btn" data-corner="bottom-right" title="Inferior derecha">↘</button>
  </div>

  <!-- ── Opacidad del logo ── -->
  <div class="section-label">Opacidad del logo</div>
  <div class="seg-control" id="logoAlphaSeg">
    <button class="seg-btn" data-val="1">100%</button>
    <button class="seg-btn" data-val="0.75">75%</button>
    <button class="seg-btn" data-val="0.5">50%</button>
    <button class="seg-btn" data-val="0.25">25%</button>
  </div>

  <!-- ── Estencil GPS ── -->
  <div class="section-label">Posición del estencil GPS</div>
  <div class="pos-picker">
    <button class="pos-btn" data-pos="top"><span class="pos-icon">↑</span>Arriba</button>
    <button class="pos-btn" data-pos="bottom"><span class="pos-icon">↓</span>Abajo</button>
    <button class="pos-btn" data-pos="left"><span class="pos-icon">←</span>Izq.</button>
    <button class="pos-btn" data-pos="right"><span class="pos-icon">→</span>Der.</button>
  </div>

  <!-- ── Opacidad del estencil ── -->
  <div class="section-label">Opacidad del estencil GPS</div>
  <div class="seg-control" id="stencilAlphaSeg">
    <button class="seg-btn" data-val="1">100%</button>
    <button class="seg-btn" data-val="0.75">75%</button>
    <button class="seg-btn" data-val="0.5">50%</button>
    <button class="seg-btn" data-val="0.25">25%</button>
  </div>

  <!-- ── Almacenamiento ── -->
  <div class="section-label">Almacenamiento</div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Sincronización con backend</div>
      <div class="toggle-desc">No disponible — fase futura</div>
    </div>
    <div class="switch disabled"></div>
  </div>

  <!-- ── Información ── -->
  <div class="section-label">Información</div>
  <div class="info-row">
    <div>
      <div class="info-label">Índice local</div>
      <div class="info-desc">Fotos almacenadas en este dispositivo</div>
    </div>
    <div class="info-value" id="photoCount">—</div>
  </div>

  <div class="version">GeoCamera MVP v1.0 · Local-first PWA</div>
</div>
`;

export class SettingsScreen extends HTMLElement {
  #logoUrl   = null;
  #cropModal = null;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.#bind();
  }

  disconnectedCallback() {
    if (this.#logoUrl) { URL.revokeObjectURL(this.#logoUrl); this.#logoUrl = null; }
  }

  #bind() {
    const sr = this.shadowRoot;

    // Crop modal lives inside this shadow root, covering it when open
    this.#cropModal = document.createElement('geo-logo-crop-modal');
    sr.appendChild(this.#cropModal);

    sr.getElementById('backBtn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }))
    );
    sr.getElementById('uploadBtn').addEventListener('click', () => sr.getElementById('fileInput').click());
    sr.getElementById('fileInput').addEventListener('change', e => this.#handleFile(e));
    sr.getElementById('clearBtn').addEventListener('click', () => this.#clearLogo());
    sr.getElementById('switchWatermark').addEventListener('click', e => this.#toggleSwitch(e.currentTarget, 'showWatermark'));

    // Corner picker
    sr.querySelectorAll('.corner-btn').forEach(btn =>
      btn.addEventListener('click', () => this.#pickCorner(btn))
    );

    // Alpha segs
    sr.querySelectorAll('#logoAlphaSeg .seg-btn').forEach(btn =>
      btn.addEventListener('click', () => this.#pickAlpha(btn, '#logoAlphaSeg', 'logoAlpha'))
    );
    sr.querySelectorAll('#stencilAlphaSeg .seg-btn').forEach(btn =>
      btn.addEventListener('click', () => this.#pickAlpha(btn, '#stencilAlphaSeg', 'stencilAlpha'))
    );

    // Stencil position
    sr.querySelectorAll('.pos-btn').forEach(btn =>
      btn.addEventListener('click', () => this.#pickPosition(btn))
    );
  }

  async refresh(photoCount, activeLogo) {
    try {
      const sr = this.shadowRoot;

      // Logo — distinguish custom (persisted) from default (memory fallback)
      const customLogo = await getConfig('logoBlob');
      this.#renderLogo(activeLogo ?? customLogo, !customLogo);

      // Toggles
      const showWatermark = await getConfig('showWatermark') ?? true;
      sr.getElementById('switchWatermark').classList.toggle('on', showWatermark);

      // Logo position
      const logoPos = await getConfig('logoPosition') ?? 'bottom-right';
      sr.querySelectorAll('.corner-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.corner === logoPos)
      );

      // Logo alpha
      const logoAlpha = await getConfig('logoAlpha') ?? 1.0;
      this.#syncSeg('#logoAlphaSeg', logoAlpha);

      // Stencil position
      const stencilPos = await getConfig('stencilPosition') ?? 'bottom';
      sr.querySelectorAll('.pos-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.pos === stencilPos)
      );

      // Stencil alpha
      const stencilAlpha = await getConfig('stencilAlpha') ?? 0.75;
      this.#syncSeg('#stencilAlphaSeg', stencilAlpha);

      // Photo count
      if (photoCount !== undefined) sr.getElementById('photoCount').textContent = `${photoCount} / ${FIFO_MAX}`;
    } catch (err) {
      console.error('[GeoCamera/settings] refresh error', err?.message);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────

  #syncSeg(selector, value) {
    const round = v => Math.round(v * 100);
    this.shadowRoot.querySelectorAll(`${selector} .seg-btn`).forEach(b =>
      b.classList.toggle('active', round(parseFloat(b.dataset.val)) === round(value))
    );
  }

  async #handleFile(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = ''; // allow re-selection of same file

      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      let finalBlob  = blob;
      let smallLabel = null;

      if (file.type !== 'image/svg+xml') {
        const { w, h } = await this.#getImageDimensions(blob);
        if (w >= 200 && h >= 200) {
          const cropped = await this.#cropModal.open(blob);
          if (!cropped) return; // user cancelled
          finalBlob = cropped;
        } else {
          smallLabel = 'Imagen pequeña — sin recorte';
        }
      }

      await setConfig('logoBlob', finalBlob);
      this.#renderLogo(finalBlob, false, smallLabel);
      this.dispatchEvent(new CustomEvent('logo-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] handleFile error', err?.message);
    }
  }

  #getImageDimensions(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('cannot decode image')); };
      img.src = url;
    });
  }

  async #clearLogo() {
    try {
      await setConfig('logoBlob', null);
      this.#renderLogo(null);
      this.dispatchEvent(new CustomEvent('logo-changed', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] clearLogo error', err?.message);
    }
  }

  #renderLogo(blob, isDefault = false, infoLabel = null) {
    const preview  = this.shadowRoot.getElementById('logoPreview');
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    if (this.#logoUrl) { URL.revokeObjectURL(this.#logoUrl); this.#logoUrl = null; }
    preview.innerHTML = '';
    if (blob) {
      const img = document.createElement('img');
      this.#logoUrl = URL.createObjectURL(blob);
      img.src = this.#logoUrl;
      img.alt = 'Logo';
      preview.appendChild(img);
      if (isDefault) {
        const lbl = document.createElement('span');
        lbl.className = 'default-label';
        lbl.textContent = 'GeoCamera (defecto)';
        preview.appendChild(lbl);
      } else if (infoLabel) {
        const lbl = document.createElement('span');
        lbl.className = 'info-label';
        lbl.textContent = infoLabel;
        preview.appendChild(lbl);
      }
      clearBtn.style.display = isDefault ? 'none' : '';
    } else {
      const span = document.createElement('span');
      span.className = 'placeholder';
      span.textContent = 'Sin logo configurado';
      preview.appendChild(span);
      clearBtn.style.display = 'none';
    }
  }

  async #toggleSwitch(el, configKey) {
    try {
      const next = !el.classList.contains('on');
      el.classList.toggle('on', next);
      await setConfig(configKey, next);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { [configKey]: next }, bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] toggleSwitch error', err?.message);
    }
  }

  async #pickCorner(btn) {
    try {
      const val = btn.dataset.corner;
      this.shadowRoot.querySelectorAll('.corner-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await setConfig('logoPosition', val);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { logoPosition: val }, bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] pickCorner error', err?.message);
    }
  }

  async #pickAlpha(btn, segSelector, configKey) {
    try {
      const val = parseFloat(btn.dataset.val);
      this.#syncSeg(segSelector, val);
      await setConfig(configKey, val);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { [configKey]: val }, bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] pickAlpha error', err?.message);
    }
  }

  async #pickPosition(btn) {
    try {
      const val = btn.dataset.pos;
      this.shadowRoot.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await setConfig('stencilPosition', val);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { stencilPosition: val }, bubbles: true, composed: true }));
    } catch (err) {
      console.error('[GeoCamera/settings] pickPosition error', err?.message);
    }
  }
}

customElements.define('geo-settings-screen', SettingsScreen);
