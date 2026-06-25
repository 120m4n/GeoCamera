import { camera, fromFile } from '../camera.js';
import { HIGH_ACCURACY_THRESHOLD } from '../geo.js';

const _svg = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  power:    _svg('<line x1="12" y1="2" x2="12" y2="12"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>'),
  settings: _svg('<path d="M20 7H9"/><path d="M14 17H3"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'),
  grid:     _svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  rotateCw: _svg('<path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>'),
  image:    _svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
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
  .viewfinder {
    position: relative;
    flex: 1;
    background: #0a0c0e;
    overflow: hidden;
  }
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* ── Standby overlay — visible while camera initialises ── */
  .standby {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: #06070A;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .standby.hidden { display: none; }
  .standby-spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: #FF6A1A;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Permission error state ── */
  .perm-error {
    position: absolute;
    inset: 0;
    z-index: 9;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px;
    text-align: center;
  }
  .perm-error.visible { display: flex; }
  .perm-error p { color: #8B919A; font-size: 14px; line-height: 1.5; }
  .perm-error button {
    padding: 12px 24px;
    border-radius: 12px;
    background: #FF6A1A;
    color: #0B0E11;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  /* ── Top bar ── */
  .top-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    padding: env(safe-area-inset-top, 18px) 16px 0;
    padding-top: max(env(safe-area-inset-top), 18px);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    z-index: 5;
  }
  .top-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .gps-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(11,14,17,0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid #2A3037;
    border-radius: 20px;
    padding: 7px 12px;
    font-size: 13px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    color: #F5F3EF;
  }
  .gps-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #FFC247;
    animation: pulse 1.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  .gps-dot.locked { background: #3DDC84; animation: none; }
  .gps-dot.denied { background: #FF6A1A; animation: none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

  .top-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
  .icon-btn {
    width: 40px; height: 40px;
    border-radius: 12px;
    background: rgba(11,14,17,0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #F5F3EF;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .icon-btn svg { width: 20px; height: 20px; display: block; flex-shrink: 0; }
  .counter-badge {
    background: rgba(11,14,17,0.72);
    border: 1px solid #2A3037;
    border-radius: 20px;
    padding: 5px 10px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: #8B919A;
  }

  /* ── GPS warning ── */
  .gps-warning {
    position: absolute;
    bottom: 148px;
    left: 16px; right: 16px;
    background: rgba(255,194,71,0.12);
    border: 1px solid rgba(255,194,71,0.4);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12.5px;
    color: #FFC247;
    text-align: center;
    z-index: 4;
    display: none;
  }
  .gps-warning.visible { display: block; }

  /* ── Bottom controls ── */
  .bottom-controls {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 0 24px;
    padding-bottom: max(env(safe-area-inset-bottom), 36px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }
  .controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 340px;
  }
  .side-btn {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: rgba(21,25,29,0.8);
    border: 1px solid #2A3037;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8B919A;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .side-btn svg { width: 22px; height: 22px; display: block; flex-shrink: 0; }
  .side-btn.hidden { visibility: hidden; }
  .shutter-btn {
    width: 84px; height: 84px;
    border-radius: 50%;
    background: transparent;
    border: 3px solid rgba(245,243,239,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
  }
  .shutter-inner {
    width: 68px; height: 68px;
    border-radius: 50%;
    background: #FF6A1A;
    transition: transform 0.15s ease, background 0.15s ease;
    pointer-events: none;
  }
  .shutter-btn:active .shutter-inner,
  .shutter-btn.pressed .shutter-inner {
    transform: scale(0.88);
    background: #B84E13;
  }
  .shutter-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
<div class="viewfinder">
  <video playsinline autoplay muted></video>

  <div class="standby" id="standby">
    <div class="standby-spinner"></div>
  </div>

  <div class="perm-error" id="permError">
    <p id="permMsg">Se requiere acceso a la cámara para usar GeoCamera.</p>
    <button id="retryBtn">Reintentar</button>
  </div>

  <div class="top-bar">
    <div class="top-left">
      <div class="icon-btn" id="standbyBtn" title="Standby">${ICON.power}</div>
    </div>
    <div class="gps-badge">
      <div class="gps-dot" id="gpsDot"></div>
      <span id="gpsText">Buscando GPS…</span>
    </div>
    <div class="top-right">
      <div class="icon-btn" id="settingsBtn" title="Configuración">${ICON.settings}</div>
      <div class="icon-btn" id="listBtn" title="Capturas">${ICON.grid}</div>
      <div class="counter-badge" id="counterBadge">0/23</div>
    </div>
  </div>

  <div class="gps-warning" id="gpsWarning">Precisión GPS baja — puedes capturar igual</div>

  <div class="bottom-controls">
    <div class="controls-row">
      <div class="side-btn" id="attachBtn" title="Adjuntar imagen">${ICON.image}</div>
      <input type="file" accept="image/*" id="fileInput" style="display:none">
      <div class="shutter-btn disabled" id="shutterBtn">
        <div class="shutter-inner"></div>
      </div>
      <div class="side-btn" id="flipBtn" title="Cambiar cámara">${ICON.rotateCw}</div>
    </div>
  </div>
</div>
`;

export class CameraScreen extends HTMLElement {
  #initialized = false;
  #startSeq = 0;
  #pressedTimer = null;

  connectedCallback() {
    if (this.#initialized) return;
    this.#initialized = true;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.#bindEvents();
  }

  disconnectedCallback() {
    clearTimeout(this.#pressedTimer);
    this.#pressedTimer = null;
  }

  #bindEvents() {
    const sr = this.shadowRoot;
    sr.getElementById('shutterBtn').addEventListener('click', () => this.#onShutter());
    sr.getElementById('flipBtn').addEventListener('click', () => this.#onFlip());
    sr.getElementById('standbyBtn').addEventListener('click', () => this.dispatchEvent(new CustomEvent('nav', { detail: 'standby', bubbles: true, composed: true })));
    sr.getElementById('listBtn').addEventListener('click', () => this.dispatchEvent(new CustomEvent('nav', { detail: 'list', bubbles: true, composed: true })));
    sr.getElementById('attachBtn').addEventListener('click', () => this.#onAttach());
    sr.getElementById('fileInput').addEventListener('change', e => this.#onFileSelected(e));
    sr.getElementById('settingsBtn').addEventListener('click', () => this.dispatchEvent(new CustomEvent('nav', { detail: 'settings', bubbles: true, composed: true })));
    sr.getElementById('retryBtn').addEventListener('click', () => this.startCamera());
  }

  async startCamera() {
    const seq = ++this.#startSeq;
    const sr = this.shadowRoot;
    const video = sr.querySelector('video');
    const permError = sr.getElementById('permError');
    const permMsg = sr.getElementById('permMsg');
    const standby = sr.getElementById('standby');
    const shutterBtn = sr.getElementById('shutterBtn');

    permError.classList.remove('visible');
    standby.classList.remove('hidden');
    shutterBtn.classList.add('disabled');

    // Defer past the first paint so the WKWebView layout and security context
    // are fully settled before any camera API is touched. Prevents signal 9
    // watchdog kills on iOS during app launch.
    await new Promise(r => requestAnimationFrame(r));

    // stopCamera() was called while waiting — abort to avoid starting camera
    // after navigation away.
    if (this.#startSeq !== seq) return;

    try {
      await camera.start(video);

      // stopCamera() may have been called while camera.start() was in-flight
      // (e.g. appStateChange, standbyTimer, or navigation). Calling stop() here
      // prevents the native plugin from remaining in a started state with no
      // corresponding JS owner — which corrupts subsequent captures.
      if (this.#startSeq !== seq) {
        camera.stop();
        return;
      }

      if (camera.isNative) {
        video.style.display = 'none';
        this.style.background = 'transparent';
        sr.querySelector('.viewfinder').style.background = 'transparent';
      }

      this.#updateFlipBtn();
      shutterBtn.classList.remove('disabled');
    } catch (err) {
      const isPermissionError =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        // CameraPreview plugin rejects with this string when AVFoundation denies access
        err.message?.toLowerCase().includes('permission') ||
        err.message?.toLowerCase().includes('denied');

      let msg = isPermissionError
        ? camera.isNative
          ? 'Permiso de cámara denegado. Ve a Configuración → GeoCamera → Cámara y actívalo.'
          : /iPad|iPhone|iPod/.test(navigator.userAgent)
            ? 'Permiso de cámara denegado. Ve a Configuración → Safari → Cámara y permite el acceso.'
            : 'Permiso de cámara denegado. Toca el ícono de cámara en la barra de dirección y permite el acceso.'
        : 'No se pudo acceder a la cámara. Asegúrate de que ninguna otra app la esté usando y vuelve a intentarlo.';

      permMsg.textContent = msg;
      permError.classList.add('visible');
    } finally {
      standby.classList.add('hidden');
    }
  }

  stopCamera() {
    this.#startSeq++;
    camera.stop();
  }

  updateGPS(fix, error) {
    const dot = this.shadowRoot.getElementById('gpsDot');
    const text = this.shadowRoot.getElementById('gpsText');
    const warning = this.shadowRoot.getElementById('gpsWarning');

    if (error === 'denied') {
      dot.className = 'gps-dot denied';
      text.textContent = 'GPS denegado';
      warning.classList.add('visible');
      warning.textContent = 'GPS denegado — la foto se capturará sin coordenadas';
      return;
    }
    if (!fix) {
      dot.className = 'gps-dot';
      text.textContent = 'Buscando GPS…';
      warning.classList.remove('visible');
      return;
    }
    const good = fix.accuracy <= HIGH_ACCURACY_THRESHOLD;
    dot.className = 'gps-dot' + (good ? ' locked' : '');
    text.textContent = `±${fix.accuracy} m`;
    warning.classList.toggle('visible', !good);
    if (!good) warning.textContent = `Precisión GPS baja (±${fix.accuracy} m) — puedes capturar igual`;
  }

  updateCounter(count, max) {
    this.shadowRoot.getElementById('counterBadge').textContent = `${count}/${max}`;
    this.shadowRoot.getElementById('listBtn').style.opacity = count > 0 ? '1' : '0.5';
  }

  async #onShutter() {
    const btn = this.shadowRoot.getElementById('shutterBtn');
    if (btn.classList.contains('disabled')) return;
    btn.classList.add('pressed', 'disabled');
    clearTimeout(this.#pressedTimer);
    this.#pressedTimer = setTimeout(() => btn.classList.remove('pressed'), 200);
    try {
      const video = this.shadowRoot.querySelector('video');
      const captureCanvas = await camera.capture(video);
      this.dispatchEvent(new CustomEvent('capture', {
        detail: { canvas: captureCanvas },
        bubbles: true,
        composed: true,
      }));
    } finally {
      btn.classList.remove('disabled');
    }
  }

  #onAttach() {
    this.shadowRoot.getElementById('fileInput').click();
  }

  async #onFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected
    if (!file) return;
    try {
      const { canvas, exifGps } = await fromFile(file);
      this.dispatchEvent(new CustomEvent('file-import', {
        detail: { canvas, exifGps },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      console.error('[GeoCamera/attach]', err?.message);
    }
  }

  async #onFlip() {
    try {
      const video = this.shadowRoot.querySelector('video');
      await camera.toggleFacing(video);
    } catch (err) {
      console.error('[GeoCamera/flip]', err?.message);
    }
  }

  #updateFlipBtn() {
    const btn = this.shadowRoot.getElementById('flipBtn');
    btn.classList.toggle('hidden', !camera.hasMultipleCameras);
  }
}

customElements.define('geo-camera-screen', CameraScreen);
