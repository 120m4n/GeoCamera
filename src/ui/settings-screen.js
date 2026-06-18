import { getConfig, setConfig } from '../db.js';

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
  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: #8B919A;
    margin: 22px 0 10px;
  }
  .logo-preview {
    height: 96px;
    border-radius: 12px;
    background: #15191D;
    border: 1px dashed #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .logo-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .logo-preview .placeholder {
    color: #565C64;
    font-size: 13px;
  }
  .upload-btn, .clear-btn {
    height: 48px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    border: 1px solid #2A3037;
  }
  .upload-btn {
    background: #1D2227;
    color: #F5F3EF;
    margin-bottom: 8px;
  }
  .clear-btn {
    background: transparent;
    color: #8B919A;
  }
  input[type="file"] { display: none; }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid #2A3037;
    gap: 12px;
  }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: 14px; color: #F5F3EF; }
  .toggle-desc { font-size: 11.5px; color: #8B919A; margin-top: 2px; }
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

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid #2A3037;
  }
  .info-label { font-size: 14px; color: #F5F3EF; }
  .info-desc { font-size: 11.5px; color: #8B919A; margin-top: 2px; }
  .info-value { font-size: 12px; color: #565C64; font-family: 'JetBrains Mono', monospace; }
  .version { padding: 24px 0 8px; font-size: 11px; color: #565C64; text-align: center; }
</style>
<div class="header">
  <h1>Configuración</h1>
  <div class="back-btn" id="backBtn">←</div>
</div>
<div class="content">
  <div class="section-label">Logo / Marca</div>
  <div class="logo-preview" id="logoPreview">
    <span class="placeholder">Sin logo configurado</span>
  </div>
  <input type="file" id="fileInput" accept="image/png,image/svg+xml,image/jpeg,image/webp">
  <button class="upload-btn" id="uploadBtn">Subir logo (PNG / SVG)</button>
  <button class="clear-btn" id="clearBtn" style="display:none">Eliminar logo</button>

  <div class="section-label">Uso del logo</div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Encabezado de la app</div>
      <div class="toggle-desc">Muestra el logo en la barra superior</div>
    </div>
    <div class="switch on" id="switchHeader"></div>
  </div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Marca de agua en fotos</div>
      <div class="toggle-desc">Incluye el logo al capturar</div>
    </div>
    <div class="switch on" id="switchWatermark"></div>
  </div>

  <div class="section-label">Almacenamiento</div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Sincronización con backend</div>
      <div class="toggle-desc">No disponible — fase futura del proyecto</div>
    </div>
    <div class="switch disabled" title="No disponible"></div>
  </div>

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
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.#bind();
  }

  #bind() {
    const sr = this.shadowRoot;
    sr.getElementById('backBtn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }))
    );
    sr.getElementById('uploadBtn').addEventListener('click', () => sr.getElementById('fileInput').click());
    sr.getElementById('fileInput').addEventListener('change', e => this.#handleFile(e));
    sr.getElementById('clearBtn').addEventListener('click', () => this.#clearLogo());
    sr.getElementById('switchHeader').addEventListener('click', (e) => this.#toggleSwitch(e.currentTarget, 'showLogoHeader'));
    sr.getElementById('switchWatermark').addEventListener('click', (e) => this.#toggleSwitch(e.currentTarget, 'showWatermark'));
  }

  async refresh(photoCount) {
    const sr = this.shadowRoot;

    // Logo
    const logoBlob = await getConfig('logoBlob');
    this.#renderLogo(logoBlob);

    // Toggles
    const showHeader = await getConfig('showLogoHeader') ?? true;
    const showWatermark = await getConfig('showWatermark') ?? true;
    sr.getElementById('switchHeader').classList.toggle('on', showHeader);
    sr.getElementById('switchWatermark').classList.toggle('on', showWatermark);

    // Photo count
    if (photoCount !== undefined) sr.getElementById('photoCount').textContent = `${photoCount} / 23`;
  }

  async #handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    await setConfig('logoBlob', blob);
    this.#renderLogo(blob);
    this.dispatchEvent(new CustomEvent('logo-changed', { bubbles: true, composed: true }));
  }

  async #clearLogo() {
    await setConfig('logoBlob', null);
    this.#renderLogo(null);
    this.dispatchEvent(new CustomEvent('logo-changed', { bubbles: true, composed: true }));
  }

  #renderLogo(blob) {
    const preview = this.shadowRoot.getElementById('logoPreview');
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    preview.innerHTML = '';
    if (blob) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.alt = 'Logo';
      preview.appendChild(img);
      clearBtn.style.display = '';
    } else {
      const span = document.createElement('span');
      span.className = 'placeholder';
      span.textContent = 'Sin logo configurado';
      preview.appendChild(span);
      clearBtn.style.display = 'none';
    }
  }

  async #toggleSwitch(el, configKey) {
    const next = !el.classList.contains('on');
    el.classList.toggle('on', next);
    await setConfig(configKey, next);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { [configKey]: next }, bubbles: true, composed: true }));
  }
}

customElements.define('geo-settings-screen', SettingsScreen);
