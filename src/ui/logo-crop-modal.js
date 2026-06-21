const HANDLE_HIT = 20; // hit-test radius in canvas px
const HANDLE_R   = 7;  // drawn radius in canvas px
const MIN_CROP   = 50; // minimum crop size in image px

const tpl = document.createElement('template');
tpl.innerHTML = `
<style>
  :host {
    position: absolute;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: #0B0E11;
  }
  :host([hidden]) { display: none !important; }

  .hdr {
    padding: max(env(safe-area-inset-top), 18px) 18px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    border-bottom: 1px solid #2A3037;
  }
  .hdr-title { font-size: 15px; font-weight: 600; color: #F5F3EF; }
  .dims {
    font-size: 12px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    color: #3DDC84;
    background: rgba(61,220,132,0.1);
    border: 1px solid rgba(61,220,132,0.2);
    border-radius: 6px;
    padding: 3px 8px;
  }

  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
  }

  canvas {
    display: block;
    border-radius: 8px;
    touch-action: none;
    cursor: crosshair;
  }

  .ftr {
    flex-shrink: 0;
    padding: 12px 18px max(env(safe-area-inset-bottom), 18px);
    display: flex;
    gap: 10px;
    border-top: 1px solid #2A3037;
  }
  .btn {
    flex: 1;
    height: 48px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid #2A3037;
  }
  .btn-cancel { background: #15191D; color: #8B919A; }
  .btn-apply  { background: #FF6A1A; color: #fff; border-color: #FF6A1A; }
</style>

<div class="hdr">
  <span class="hdr-title">Recortar logo</span>
  <span class="dims" id="dims">— × — px</span>
</div>
<div class="wrap" id="wrap">
  <canvas id="canvas"></canvas>
</div>
<div class="ftr">
  <button class="btn btn-cancel" id="btnCancel">Cancelar</button>
  <button class="btn btn-apply"  id="btnApply">Aplicar recorte</button>
</div>
`;

export class LogoCropModal extends HTMLElement {
  /** @type {((blob: Blob|null) => void)|null} */
  #resolve = null;
  /** @type {HTMLImageElement|null} */
  #img = null;
  /** @type {{x:number, y:number, size:number}|null} */
  #crop = null;
  /** @type {{w:number, h:number}|null} */
  #cSize = null;
  #drag = null;
  #raf  = null;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(tpl.content.cloneNode(true));
    this.setAttribute('hidden', '');
    this.#bind();
  }

  #bind() {
    const sr     = this.shadowRoot;
    const canvas = sr.getElementById('canvas');
    canvas.addEventListener('pointerdown',   e => this.#onDown(e), { passive: false });
    canvas.addEventListener('pointermove',   e => this.#onMove(e), { passive: false });
    canvas.addEventListener('pointerup',     () => { this.#drag = null; });
    canvas.addEventListener('pointercancel', () => { this.#drag = null; });
    sr.getElementById('btnCancel').addEventListener('click', () => this.#close(null));
    sr.getElementById('btnApply').addEventListener('click',  () => this.#apply());
  }

  /** @param {Blob} blob @returns {Promise<Blob|null>} */
  open(blob) {
    this.removeAttribute('hidden');
    return new Promise(resolve => {
      this.#resolve = resolve;
      this.#loadImage(blob);
    });
  }

  #close(result) {
    this.setAttribute('hidden', '');
    if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = null; }
    this.#img  = null;
    this.#crop = null;
    this.#cSize = null;
    this.#drag = null;
    this.#resolve?.(result);
    this.#resolve = null;
  }

  #loadImage(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); this.#img = img; requestAnimationFrame(() => this.#initCanvas()); };
    img.onerror = () => { URL.revokeObjectURL(url); this.#close(null); };
    img.src = url;
  }

  #initCanvas() {
    const sr   = this.shadowRoot;
    const wrap = sr.getElementById('wrap');
    const canvas = sr.getElementById('canvas');
    const img  = this.#img;

    const avW = wrap.clientWidth  - 32;
    const avH = wrap.clientHeight - 32;
    if (avW <= 0 || avH <= 0) return;

    const scale = Math.min(avW / img.naturalWidth, avH / img.naturalHeight, 1);
    const cw = Math.round(img.naturalWidth  * scale);
    const ch = Math.round(img.naturalHeight * scale);

    canvas.width  = cw;
    canvas.height = ch;
    this.#cSize = { w: cw, h: ch };

    const initSize = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * 0.8);
    this.#crop = {
      x:    Math.round((img.naturalWidth  - initSize) / 2),
      y:    Math.round((img.naturalHeight - initSize) / 2),
      size: initSize,
    };

    this.#render();
    this.#updateDims();
  }

  // ── Coordinate helpers ──────────────────────────────────────────────────

  #toImg(cx, cy) {
    const { w, h } = this.#cSize;
    const img = this.#img;
    return { x: (cx / w) * img.naturalWidth, y: (cy / h) * img.naturalHeight };
  }

  #toCanvas(ix, iy) {
    const { w, h } = this.#cSize;
    const img = this.#img;
    return { x: (ix / img.naturalWidth) * w, y: (iy / img.naturalHeight) * h };
  }

  #ptrToCanvas(e) {
    const canvas = this.shadowRoot.getElementById('canvas');
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  #corners() {
    const { x, y, size } = this.#crop;
    return {
      topLeft:     this.#toCanvas(x,        y),
      topRight:    this.#toCanvas(x + size, y),
      bottomLeft:  this.#toCanvas(x,        y + size),
      bottomRight: this.#toCanvas(x + size, y + size),
    };
  }

  // ── Pointer interaction ─────────────────────────────────────────────────

  #onDown(e) {
    e.preventDefault();
    if (!this.#crop || !this.#img) return;
    this.shadowRoot.getElementById('canvas').setPointerCapture(e.pointerId);

    const cp      = this.#ptrToCanvas(e);
    const corners = this.#corners();

    for (const [corner, hc] of Object.entries(corners)) {
      if (Math.hypot(cp.x - hc.x, cp.y - hc.y) <= HANDLE_HIT) {
        this.#drag = { type: 'resize', corner, origCrop: { ...this.#crop }, startImg: this.#toImg(cp.x, cp.y) };
        return;
      }
    }

    const tl = corners.topLeft;
    const br = corners.bottomRight;
    if (cp.x >= tl.x && cp.x <= br.x && cp.y >= tl.y && cp.y <= br.y) {
      this.#drag = { type: 'move', origCrop: { ...this.#crop }, startImg: this.#toImg(cp.x, cp.y) };
    }
  }

  #onMove(e) {
    if (!this.#drag) return;
    e.preventDefault();

    const img    = this.#img;
    const W      = img.naturalWidth;
    const H      = img.naturalHeight;
    const cp     = this.#ptrToCanvas(e);
    const imgPt  = this.#toImg(cp.x, cp.y);

    if (this.#drag.type === 'move') {
      const dx = imgPt.x - this.#drag.startImg.x;
      const dy = imgPt.y - this.#drag.startImg.y;
      const sz = this.#crop.size;
      this.#crop.x = Math.max(0, Math.min(this.#drag.origCrop.x + dx, W - sz));
      this.#crop.y = Math.max(0, Math.min(this.#drag.origCrop.y + dy, H - sz));
    } else {
      const { corner, origCrop } = this.#drag;

      // Anchor = opposite corner (stays fixed during resize)
      const anchorX = (corner === 'topRight'   || corner === 'bottomRight') ? origCrop.x              : origCrop.x + origCrop.size;
      const anchorY = (corner === 'bottomLeft' || corner === 'bottomRight') ? origCrop.y              : origCrop.y + origCrop.size;

      const dx = Math.abs(imgPt.x - anchorX);
      const dy = Math.abs(imgPt.y - anchorY);
      let size = Math.max(dx, dy, MIN_CROP);

      let nx = (corner === 'topRight'   || corner === 'bottomRight') ? anchorX : anchorX - size;
      let ny = (corner === 'bottomLeft' || corner === 'bottomRight') ? anchorY : anchorY - size;

      nx   = Math.max(0, nx);
      ny   = Math.max(0, ny);
      size = Math.min(size, W - nx, H - ny);
      if (size >= MIN_CROP) this.#crop = { x: nx, y: ny, size };
    }

    this.#scheduleRender();
    this.#updateDims();
  }

  #scheduleRender() {
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => { this.#raf = null; this.#render(); });
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  #render() {
    const canvas = this.shadowRoot.getElementById('canvas');
    const ctx    = canvas.getContext('2d');
    const img    = this.#img;
    const crop   = this.#crop;
    if (!img || !crop || !this.#cSize) return;

    const { w: cw, h: ch } = this.#cSize;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    // Dim non-selected area
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cw, ch);

    // Re-expose selected area
    const tl = this.#toCanvas(crop.x,             crop.y);
    const br = this.#toCanvas(crop.x + crop.size, crop.y + crop.size);
    const sw = br.x - tl.x;
    const sh = br.y - tl.y;

    ctx.save();
    ctx.beginPath();
    ctx.rect(tl.x, tl.y, sw, sh);
    ctx.clip();
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.restore();

    // Selection border
    ctx.strokeStyle = '#FF6A1A';
    ctx.lineWidth   = 2;
    ctx.strokeRect(tl.x, tl.y, sw, sh);

    // Rule-of-thirds guides
    ctx.strokeStyle = 'rgba(255,106,26,0.3)';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    for (const t of [1/3, 2/3]) {
      ctx.moveTo(tl.x + sw * t, tl.y); ctx.lineTo(tl.x + sw * t, br.y);
      ctx.moveTo(tl.x, tl.y + sh * t); ctx.lineTo(br.x, tl.y + sh * t);
    }
    ctx.stroke();

    // Corner handles
    for (const hc of Object.values(this.#corners())) {
      ctx.beginPath();
      ctx.arc(hc.x, hc.y, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle   = '#FF6A1A';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  #updateDims() {
    const size = Math.round(this.#crop?.size ?? 0);
    const el   = this.shadowRoot.getElementById('dims');
    if (el) el.textContent = `${size} × ${size} px`;
  }

  // ── Apply crop ──────────────────────────────────────────────────────────

  #apply() {
    const img  = this.#img;
    const crop = this.#crop;
    if (!img || !crop) { this.#close(null); return; }

    const out = document.createElement('canvas');
    out.width = out.height = 512;
    out.getContext('2d').drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, 512, 512);
    out.toBlob(blob => this.#close(blob ?? null), 'image/png', 0.95);
  }
}

customElements.define('geo-logo-crop-modal', LogoCropModal);
