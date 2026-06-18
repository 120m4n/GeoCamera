const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: block;
    position: absolute;
    inset: 0;
    background: #07090C;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }

  .splash {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /*
   * Portrait (mobile vertical): imagen llena el alto, recorte mínimo lateral.
   * object-position: center top ancla el logo/branding arriba — nunca se corta.
   */
  @media (orientation: portrait) {
    .splash {
      object-fit: cover;
      object-position: center top;
    }
    .scrim { height: 22%; }
  }

  /*
   * Landscape (mobile horizontal) y desktop: la imagen es retrato (9:16)
   * en un contenedor apaisado — usar contain para mostrarla completa centrada.
   * Las barras laterales oscuras (#07090C en :host) son intencionales.
   */
  @media (orientation: landscape) {
    .splash {
      object-fit: contain;
      object-position: center center;
    }
    .scrim { height: 38%; }
  }

  /* Desktop ancho (>= 1024px): limitar ancho máximo para que no se vea diminuta */
  @media (min-width: 1024px) and (orientation: landscape) {
    .splash {
      object-fit: contain;
      object-position: center center;
      /* El elemento ya ocupa inset:0; contain lo centra automáticamente */
    }
    .scrim { height: 28%; }
  }

  /* Scrim: gradiente en el tercio inferior, anima junto con el hint */
  .scrim {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%);
    animation: breathe 3.4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .hint {
    position: absolute;
    bottom: max(env(safe-area-inset-bottom, 0px), 32px);
    left: 0; right: 0;
    text-align: center;
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(245,243,239,0.75);
    letter-spacing: 0.2px;
    pointer-events: none;
    animation: breathe 3.4s ease-in-out infinite;
  }
</style>
<img class="splash" src="/splash_image.webp" alt="" loading="eager">
<div class="scrim"></div>
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

    // Fallback si WebP no carga (browser muy antiguo)
    this.shadowRoot.querySelector('.splash').addEventListener('error', () => {
      this.shadowRoot.querySelector('.splash').style.display = 'none';
      this.style.background = '#0B0E11';
    });
  }
}

customElements.define('geo-standby-screen', StandbyScreen);
