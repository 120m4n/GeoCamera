import { getPhoto } from '../db.js';

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
  .header h1 { font-size: 17px; font-weight: 600; color: #F5F3EF; margin: 0; }
  .header .sub { font-size: 12px; color: #8B919A; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
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
  .photo-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #06070A;
  }
  .photo-area img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .meta {
    background: #15191D;
    border-top: 1px solid #2A3037;
    overflow-y: auto;
    flex-shrink: 0;
    max-height: 45%;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 18px;
    border-bottom: 1px solid #2A3037;
    gap: 12px;
  }
  .meta-row:last-child { border-bottom: none; }
  .k { color: #8B919A; font-size: 13px; flex-shrink: 0; }
  .v { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #F5F3EF; text-align: right; word-break: break-all; }
</style>
<div class="header">
  <div>
    <h1>Detalle</h1>
    <div class="sub" id="subtitle"></div>
  </div>
  <div class="back-btn" id="backBtn">←</div>
</div>
<div class="photo-area">
  <img id="thumb" alt="Captura" />
</div>
<div class="meta" id="meta"></div>
`;

export class DetailScreen extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.shadowRoot.getElementById('backBtn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('nav', { detail: 'list', bubbles: true, composed: true }))
    );
  }

  async load(photoId) {
    const photo = await getPhoto(photoId);
    if (!photo) return;

    const img = this.shadowRoot.getElementById('thumb');
    const meta = this.shadowRoot.getElementById('meta');

    img.src = URL.createObjectURL(photo.thumbnailBlob);
    this.shadowRoot.getElementById('subtitle').textContent = formatDate(photo.capturedAt);

    const rows = [
      ['Latitud', photo.latitude !== 0 ? photo.latitude.toFixed(6) : 'N/D'],
      ['Longitud', photo.longitude !== 0 ? photo.longitude.toFixed(6) : 'N/D'],
      ['Precisión', photo.accuracyMeters >= 0 ? `±${photo.accuracyMeters} m` : 'N/D'],
      ['Plus Code', photo.plusCode || 'N/D'],
      ['Capturada', formatDateTime(photo.capturedAt)],
      ['Archivo', photo.filename],
      ['Estado', syncLabel(photo.syncStatus)],
    ];

    meta.innerHTML = rows.map(([k, v]) => `
      <div class="meta-row">
        <span class="k">${k}</span>
        <span class="v">${v}</span>
      </div>
    `).join('');
  }
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function syncLabel(status) {
  return { local: 'Local', pending: 'Pendiente', synced: 'Sincronizado', error: 'Error' }[status] ?? status;
}

customElements.define('geo-detail-screen', DetailScreen);
