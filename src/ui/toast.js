const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%) translateY(-140%);
    background: rgba(21,25,29,0.96);
    border: 1px solid rgba(61,220,132,0.38);
    border-radius: 100px;
    padding: 10px 18px 10px 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    pointer-events: none;
    transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
    z-index: 200;
    white-space: nowrap;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.45);
  }
  :host(.show) {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  :host(.error) {
    border-color: rgba(255,106,26,0.45);
  }
  .dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #3DDC84;
    flex-shrink: 0;
  }
  :host(.error) .dot { background: #FF6A1A; }
  .label {
    font-size: 13px;
    font-weight: 600;
    color: #F5F3EF;
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    letter-spacing: 0.1px;
  }
</style>
<div class="dot"></div>
<span class="label" id="label">Guardada</span>
`;

export class GeoToast extends HTMLElement {
  #timer = null;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  /** @param {string} message @param {number} [duration=1300] @param {'success'|'error'} [type='success'] */
  show(message, duration = 1300, type = 'success') {
    this.shadowRoot.getElementById('label').textContent = message;
    this.classList.toggle('error', type === 'error');
    this.classList.add('show');
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.classList.remove('show'), duration);
  }
}

customElements.define('geo-toast', GeoToast);
