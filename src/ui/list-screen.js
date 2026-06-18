import { listPhotos } from '../db.js';

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
    font-size: 16px;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
  }
  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    align-content: start;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    overflow: hidden;
    cursor: pointer;
    position: relative;
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cell-time {
    position: absolute;
    bottom: 5px; left: 6px; right: 6px;
    font-size: 9.5px;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(245,243,239,0.85);
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    pointer-events: none;
  }
  .empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
    color: #565C64;
  }
  .empty p { font-size: 14px; line-height: 1.5; }
  .empty .icon { font-size: 36px; opacity: 0.4; }
  .empty button {
    padding: 10px 20px;
    border-radius: 10px;
    background: #15191D;
    border: 1px solid #2A3037;
    color: #F5F3EF;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
</style>
<div class="header">
  <div>
    <h1>Capturas recientes</h1>
    <div class="sub" id="subtitle">0 de 23 · FIFO local</div>
  </div>
  <div class="back-btn" id="backBtn">←</div>
</div>
<div class="grid" id="grid"></div>
`;

export class ListScreen extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.shadowRoot.getElementById('backBtn').addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }))
    );
  }

  async refresh() {
    const photos = await listPhotos();
    const grid = this.shadowRoot.getElementById('grid');
    const subtitle = this.shadowRoot.getElementById('subtitle');
    subtitle.textContent = `${photos.length} de 23 · FIFO local`;
    grid.innerHTML = '';

    if (photos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = `
        <div class="icon">📷</div>
        <p>Aún no hay capturas.<br>Vuelve a la cámara y registra la primera.</p>
        <button id="goCamera">Ir a la cámara</button>
      `;
      empty.querySelector('#goCamera').addEventListener('click', () =>
        this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }))
      );
      grid.appendChild(empty);
      return;
    }

    for (const photo of photos) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const url = URL.createObjectURL(photo.thumbnailBlob);
      const img = document.createElement('img');
      img.src = url;
      img.alt = photo.capturedAt;
      img.onload = () => {}; // URL stays alive as long as img is in DOM

      const timeLabel = document.createElement('div');
      timeLabel.className = 'cell-time';
      timeLabel.textContent = formatTime(photo.capturedAt);

      cell.appendChild(img);
      cell.appendChild(timeLabel);
      cell.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('nav', {
          detail: { screen: 'detail', photoId: photo.id },
          bubbles: true,
          composed: true,
        }));
      });

      grid.appendChild(cell);
    }
  }
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

customElements.define('geo-list-screen', ListScreen);
