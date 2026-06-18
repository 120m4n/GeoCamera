const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    background: rgba(21,25,29,0.95);
    border: 1px solid #3DDC84;
    border-radius: 16px;
    padding: 22px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 100;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  :host(.show) {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  .check {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: #3DDC84;
    color: #0B0E11;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  .label {
    font-size: 14px;
    color: #F5F3EF;
    font-weight: 600;
    text-align: center;
    max-width: 180px;
  }
</style>
<div class="check">✓</div>
<div class="label" id="label">Guardada</div>
`;

export class GeoToast extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  /** @param {string} message @param {number} [duration=1300] */
  show(message, duration = 1300) {
    this.shadowRoot.getElementById('label').textContent = message;
    this.classList.add('show');
    setTimeout(() => this.classList.remove('show'), duration);
  }
}

customElements.define('geo-toast', GeoToast);
