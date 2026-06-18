const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: absolute;
    inset: 0;
    background: #0B0E11;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    gap: 20px;
  }
  .logo {
    width: 96px;
    height: 96px;
    border-radius: 22px;
    animation: breathe 3.2s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { opacity: 1;    transform: scale(1); }
    50%       { opacity: 0.72; transform: scale(0.95); }
  }
  .app-name {
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #F5F3EF;
    letter-spacing: 0.4px;
  }
  .hint {
    position: absolute;
    bottom: max(env(safe-area-inset-bottom), 48px);
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #565C64;
    animation: hint-fade 3.2s ease-in-out infinite;
  }
  @keyframes hint-fade {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }
</style>
<img class="logo" src="/icons/icon-192.svg" alt="">
<span class="app-name">GeoCamera</span>
<span class="hint">Toca para activar la cámara</span>
`;

export class StandbyScreen extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('nav', { detail: 'camera', bubbles: true, composed: true }));
    });

    this.shadowRoot.querySelector('.logo').addEventListener('error', (e) => {
      e.target.replaceWith(this.#fallbackLogo());
    });
  }

  #fallbackLogo() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 192 192');
    svg.classList.add('logo');
    svg.innerHTML = `
      <rect width="192" height="192" rx="40" fill="#15191D"/>
      <circle cx="96" cy="90" r="46" fill="none" stroke="#2A3037" stroke-width="4"/>
      <circle cx="96" cy="90" r="36" fill="none" stroke="#FF6A1A" stroke-width="3"/>
      <circle cx="96" cy="90" r="22" fill="#FF6A1A" opacity="0.92"/>
      <circle cx="96" cy="90" r="6" fill="#15191D"/>
      <circle cx="148" cy="52" r="10" fill="#3DDC84"/>
    `;
    return svg;
  }
}

customElements.define('geo-standby-screen', StandbyScreen);
