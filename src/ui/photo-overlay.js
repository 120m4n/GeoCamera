const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    position: absolute;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 5px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%);
    z-index: 2;
    pointer-events: none;
  }

  .btn {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(11,14,17,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: all;
    font-size: 13px;
    line-height: 1;
    transition: background 0.15s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
    flex-shrink: 0;
  }
  .btn:active { transform: scale(0.88); }

  /* Favorite button */
  .btn-fav        { color: #565C64; }
  .btn-fav.active { color: #FFC247; background: rgba(255,194,71,0.18); }

  /* Checkbox (selection mode) */
  .btn-check {
    color: #565C64;
    font-size: 15px;
  }
  .btn-check.active {
    color: #FF6A1A;
    background: rgba(255,106,26,0.22);
  }

  /* Delete button */
  .btn-del { color: #8B919A; }
  .btn-del:active { background: rgba(220,53,69,0.3); color: #ff6b6b; }
</style>
<button class="btn btn-fav"   id="favBtn"   aria-label="Favorito">☆</button>
<button class="btn btn-del"   id="delBtn"   aria-label="Eliminar">✕</button>
`;

export class PhotoOverlay extends HTMLElement {
  #selectionMode = false;
  #favorite = false;
  #selected = false;

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById('favBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.#selectionMode) {
        this.#dispatchSelect();
      } else {
        this.dispatchEvent(new CustomEvent('overlay-favorite', { bubbles: true, composed: true }));
      }
    });

    this.shadowRoot.getElementById('delBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('overlay-delete', { bubbles: true, composed: true }));
    });
  }

  get selectionMode() { return this.#selectionMode; }
  set selectionMode(v) {
    this.#selectionMode = !!v;
    this.#syncFavBtn();
  }

  get favorite() { return this.#favorite; }
  set favorite(v) {
    this.#favorite = !!v;
    this.#syncFavBtn();
  }

  get selected() { return this.#selected; }
  set selected(v) {
    this.#selected = !!v;
    this.#syncFavBtn();
  }

  #dispatchSelect() {
    this.dispatchEvent(new CustomEvent('overlay-select', { bubbles: true, composed: true }));
  }

  #syncFavBtn() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.getElementById('favBtn');
    if (this.#selectionMode) {
      btn.className = 'btn btn-check' + (this.#selected ? ' active' : '');
      btn.setAttribute('aria-label', this.#selected ? 'Deseleccionar' : 'Seleccionar');
      btn.textContent = this.#selected ? '●' : '○';
    } else {
      btn.className = 'btn btn-fav' + (this.#favorite ? ' active' : '');
      btn.setAttribute('aria-label', this.#favorite ? 'Quitar favorito' : 'Favorito');
      btn.textContent = this.#favorite ? '★' : '☆';
    }
  }
}

customElements.define('geo-photo-overlay', PhotoOverlay);
