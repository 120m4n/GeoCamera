import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { encode as encodePlusCode } from './pluscode.js';

/** @typedef {{ lat: number, lon: number, accuracy: number, plusCode: string, ts: string }} GeoFix */

const HIGH_ACCURACY_THRESHOLD = 20; // meters — below this is "good"

export class GeoService extends EventTarget {
  /** @type {GeoFix | null} */
  #lastFix = null;
  /** @type {string | null} watchId returned by Geolocation.watchPosition */
  #watchId = null;
  #started = false;

  get lastFix() { return this.#lastFix; }
  get hasGoodFix() { return this.#lastFix !== null && this.#lastFix.accuracy <= HIGH_ACCURACY_THRESHOLD; }

  async start() {
    if (this.#started) return;
    this.#started = true;

    // Request permissions on native; web falls back to browser prompt automatically.
    if (Capacitor.isNativePlatform()) {
      const { location } = await Geolocation.requestPermissions();
      if (location === 'denied') {
        this.dispatchEvent(new CustomEvent('error', { detail: 'denied' }));
        return;
      }
    }

    // Single immediate fix, then watch for updates.
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      this.#handlePosition(pos);
    } catch (err) {
      this.#handleError(err);
    }

    this.#watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, maximumAge: 5000 },
      (pos, err) => {
        if (err) { this.#handleError(err); return; }
        if (pos)  this.#handlePosition(pos);
      }
    );
  }

  async stop() {
    if (this.#watchId !== null) {
      await Geolocation.clearWatch({ id: this.#watchId });
      this.#watchId = null;
    }
    this.#started = false;
  }

  /** Returns a snapshot of the current fix (or waits up to timeoutMs for one). */
  async snapshot(timeoutMs = 12000) {
    if (this.#lastFix) return this.#lastFix;
    return new Promise((resolve) => {
      const onFix = (e) => { cleanup(); resolve(e.detail); };
      const onErr = () => { cleanup(); resolve(null); };
      const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.removeEventListener('fix', onFix);
        this.removeEventListener('error', onErr);
      };
      this.addEventListener('fix', onFix, { once: true });
      this.addEventListener('error', onErr, { once: true });
    });
  }

  #handlePosition(pos) {
    const fix = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      plusCode: encodePlusCode(pos.coords.latitude, pos.coords.longitude, 10),
      ts: new Date().toISOString(),
    };
    this.#lastFix = fix;
    this.dispatchEvent(new CustomEvent('fix', { detail: fix }));
  }

  #handleError(err) {
    const code = err?.code ?? err;
    const detail = code === 1 ? 'denied'
      : code === 2 ? 'unavailable'
      : 'timeout';
    this.dispatchEvent(new CustomEvent('error', { detail }));
  }
}

export const geo = new GeoService();
