import L from 'leaflet';
import leafletCss from 'leaflet/dist/leaflet.css?inline';
import { listPhotos } from '../db.js';
import { decode as decodePlusCode } from '../pluscode.js';

const _svg = (d) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICON = {
  back: _svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  export: _svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
};

const CSS = `
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
  background: #0B0E11;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header h1 {
  font-size: 17px;
  font-weight: 600;
  color: #F5F3EF;
  margin: 0;
}
.sub {
  font-size: 12px;
  color: #8B919A;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
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
  flex-shrink: 0;
  user-select: none;
  -webkit-user-select: none;
}
.back-btn svg { width: 18px; height: 18px; display: block; }
.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  background: rgba(255,106,26,0.12);
  border: 1px solid rgba(255,106,26,0.4);
  color: #FF6A1A;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.15s;
}
.export-btn:active { background: rgba(255,106,26,0.25); }
.export-btn svg { width: 16px; height: 16px; display: block; }
#mapEl {
  flex: 1;
  min-height: 0;
}

/* ── Leaflet dark overrides ─────────────────────── */
.leaflet-container {
  background: #1D2227;
  font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
}
.leaflet-popup-content-wrapper {
  background: #15191D;
  color: #F5F3EF;
  border: 1px solid #2A3037;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.leaflet-popup-tip { background: #15191D; }
.leaflet-popup-close-button { color: #8B919A !important; font-size: 18px !important; }
.leaflet-popup-content { margin: 12px 14px; }
.leaflet-bar a {
  background-color: #15191D;
  border-color: #2A3037;
  color: #F5F3EF;
}
.leaflet-bar a:hover { background-color: #1D2227; }
.leaflet-control-attribution {
  background: rgba(11,14,17,0.82) !important;
  color: #565C64 !important;
  font-size: 10px !important;
}
.leaflet-control-attribution a { color: #565C64 !important; }

/* ── Popup content ──────────────────────────────── */
.popup-thumb {
  width: 170px;
  height: 127px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  margin-bottom: 10px;
}
.popup-meta { font-size: 12px; line-height: 1.8; }
.popup-meta .lbl { color: #8B919A; }
.popup-meta .val { color: #F5F3EF; font-family: 'JetBrains Mono', 'SF Mono', monospace; }
.popup-meta .good { color: #3DDC84; }
.popup-meta .warn { color: #FFC247; }

/* ── Empty state ────────────────────────────────── */
.empty {
  position: absolute;
  inset: 60px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: #565C64;
  font-size: 14px;
  gap: 6px;
  z-index: 1000;
}
`;

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>${CSS}${leafletCss}</style>
<div class="header">
  <div class="header-left">
    <div class="back-btn" id="backBtn">${ICON.back}</div>
    <div>
      <h1>Visor geográfico</h1>
      <div class="sub" id="subtitle">Sin capturas</div>
    </div>
  </div>
  <button class="export-btn" id="exportBtn" title="Exportar GeoJSON">
    ${ICON.export}
    <span>Exportar</span>
  </button>
</div>
<div id="mapEl"></div>
`;

export class MapScreen extends HTMLElement {
  #map = null;
  #markersGroup = null;
  #cellsGroup = null;
  #photos = [];
  #geojson = { type: 'FeatureCollection', features: [] };
  #thumbUrls = new Map();

  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

    this.shadowRoot.getElementById('backBtn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('nav', { detail: 'list', bubbles: true, composed: true }));
    });

    this.shadowRoot.getElementById('exportBtn').addEventListener('click', () => this.#exportGeoJSON());
  }

  /** Called from navigateTo('map') in app.js — re-reads DB and refreshes map. */
  async refresh() {
    this.#photos = await listPhotos();
    this.#buildGeoJSON();
    if (!this.#map) {
      await this.#initMap();
    } else {
      this.#renderMarkers();
    }
    this.#updateSubtitle();
  }

  /**
   * Called from handleSave in app.js with the already-fetched photos list,
   * so the map's in-memory GeoJSON stays current without an extra DB read.
   * @param {import('../db.js').PhotoEntry[]} photos
   */
  syncPhotos(photos) {
    this.#photos = photos;
    this.#buildGeoJSON();
    if (this.#map) this.#renderMarkers();
    this.#updateSubtitle();
  }

  async #initMap() {
    const mapEl = this.shadowRoot.getElementById('mapEl');
    // Wait one animation frame so the container has non-zero dimensions
    // (the host transitions from display:none to visible just before refresh() is called).
    await new Promise(r => requestAnimationFrame(r));

    this.#map = L.map(mapEl, { zoomControl: true, attributionControl: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.#map);

    this.#cellsGroup = L.featureGroup().addTo(this.#map);
    this.#markersGroup = L.featureGroup().addTo(this.#map);

    this.#renderMarkers();
  }

  #renderMarkers() {
    this.#markersGroup.clearLayers();
    this.#cellsGroup.clearLayers();

    this.#thumbUrls.forEach(url => URL.revokeObjectURL(url));
    this.#thumbUrls.clear();

    const withCoords = this.#photos.filter(p => p.latitude !== 0 || p.longitude !== 0);

    for (const p of withCoords) {
      // Plus Code bounding-box rectangle
      if (p.plusCode) {
        const area = decodePlusCode(p.plusCode);
        if (area) {
          L.rectangle(
            [[area.latLo, area.lonLo], [area.latHi, area.lonHi]],
            { color: '#FF6A1A', weight: 1.5, fillColor: '#FF6A1A', fillOpacity: 0.15, interactive: false }
          ).addTo(this.#cellsGroup);
        }
      }

      // Popup HTML
      const thumbUrl = URL.createObjectURL(p.thumbnailBlob);
      this.#thumbUrls.set(p.id, thumbUrl);

      const accClass = p.accuracyMeters >= 0 && p.accuracyMeters <= 20 ? 'good' : 'warn';
      const accText  = p.accuracyMeters >= 0 ? `±${p.accuracyMeters}m` : '—';
      const dateStr  = new Date(p.capturedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });

      const popupHtml = `
        <img class="popup-thumb" src="${thumbUrl}" alt="Captura">
        <div class="popup-meta">
          <div><span class="lbl">Fecha  </span><span class="val">${dateStr}</span></div>
          <div><span class="lbl">GPS    </span><span class="val">${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</span></div>
          <div><span class="lbl">Prec.  </span><span class="val ${accClass}">${accText}</span></div>
          <div><span class="lbl">Código </span><span class="val">${p.plusCode || '—'}</span></div>
        </div>`;

      L.circleMarker([p.latitude, p.longitude], {
        radius: 9,
        fillColor: '#FF6A1A',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 1,
      })
        .bindPopup(popupHtml, { maxWidth: 210 })
        .addTo(this.#markersGroup);
    }

    // Fit bounds or show world view
    if (withCoords.length > 0) {
      this.#map.fitBounds(this.#markersGroup.getBounds(), { padding: [50, 50], maxZoom: 18 });
    } else {
      this.#map.setView([4.6, -74.1], 5);
    }

    this.#map.invalidateSize();
  }

  #buildGeoJSON() {
    const features = [];

    for (const p of this.#photos) {
      if (p.latitude === 0 && p.longitude === 0) continue;

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: {
          id: p.id,
          filename: p.filename,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracyMeters: p.accuracyMeters,
          plusCode: p.plusCode,
          capturedAt: p.capturedAt,
          syncStatus: p.syncStatus,
        },
      });

      if (p.plusCode) {
        const area = decodePlusCode(p.plusCode);
        if (area) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [area.lonLo, area.latLo],
                [area.lonHi, area.latLo],
                [area.lonHi, area.latHi],
                [area.lonLo, area.latHi],
                [area.lonLo, area.latLo],
              ]],
            },
            properties: {
              id: p.id,
              featureType: 'plusCodeCell',
              plusCode: p.plusCode,
            },
          });
        }
      }
    }

    this.#geojson = { type: 'FeatureCollection', features };
  }

  #exportGeoJSON() {
    const json = JSON.stringify(this.#geojson, null, 2);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url  = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `geocamera_${date}.geojson`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  #updateSubtitle() {
    const count = this.#photos.filter(p => p.latitude !== 0 || p.longitude !== 0).length;
    const total = this.#photos.length;
    const sub   = this.shadowRoot?.getElementById('subtitle');
    if (!sub) return;
    if (total === 0) {
      sub.textContent = 'Sin capturas';
    } else {
      sub.textContent = `${count} punto${count !== 1 ? 's' : ''} · ${total} captura${total !== 1 ? 's' : ''}`;
    }
  }

  disconnectedCallback() {
    this.#thumbUrls.forEach(url => URL.revokeObjectURL(url));
    this.#thumbUrls.clear();
    if (this.#map) {
      this.#map.remove();
      this.#map = null;
    }
  }
}

customElements.define('geo-map-screen', MapScreen);
