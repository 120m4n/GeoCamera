import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { CameraPreview } from '@capacitor-community/camera-preview';

export class CameraService {
  #facing = 'environment';
  #native = Capacitor.isNativePlatform();
  // Web only
  #stream = null;
  #availableCameras = [];

  get isNative() { return this.#native; }
  get hasMultipleCameras() {
    // On native, assume multiple cameras exist (CameraPreview.flip() handles it).
    return this.#native ? true : this.#availableCameras.length > 1;
  }

  async start(videoEl) {
    if (this.#native) {
      await new Promise(r => setTimeout(r, 200));

      let camPerm;
      try {
        const result = await Camera.requestPermissions({ permissions: ['camera'] });
        camPerm = result.camera;
        console.log('[GeoCamera/camera] requestPermissions:', camPerm);
      } catch (permErr) {
        console.warn('[GeoCamera/camera] requestPermissions threw:', permErr?.message);
        camPerm = 'granted';
      }

      if (camPerm === 'denied') {
        const err = new Error('Camera permission denied');
        err.name = 'NotAllowedError';
        throw err;
      }

      console.log('[GeoCamera/camera] CameraPreview.start() →', this.#facing);
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      try {
        await CameraPreview.start({
          position: this.#facing === 'environment' ? 'rear' : 'front',
          toBack: true,
          disableAudio: true,
        });
        console.log('[GeoCamera/camera] CameraPreview.start() OK');
      } catch (startErr) {
        console.error('[GeoCamera/camera] CameraPreview.start() FAILURE', startErr?.message, startErr?.stack);
        throw startErr;
      }
    } else {
      await this.#checkAvailableCameras();
      await this.#openStream(videoEl);
    }
  }

  async stop() {
    if (this.#native) {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      await CameraPreview.stop().catch(err => console.warn('[GeoCamera/camera] stop() error (ignored):', err?.message));
    } else {
      if (this.#stream) {
        this.#stream.getTracks().forEach(t => t.stop());
        this.#stream = null;
      }
    }
  }

  async toggleFacing(videoEl) {
    this.#facing = this.#facing === 'environment' ? 'user' : 'environment';
    console.log('[GeoCamera/camera] toggleFacing ->', this.#facing);
    if (this.#native) {
      await CameraPreview.flip();
    } else {
      await this.stop();
      await this.#openStream(videoEl);
    }
  }

  async capture(videoEl) {
    if (this.#native) {
      console.log('[GeoCamera/camera] CameraPreview.capture() start');
      let value;
      try {
        ({ value } = await CameraPreview.capture({ quality: 92 }));
        console.log('[GeoCamera/camera] CameraPreview.capture() OK — base64 length:', value?.length);
      } catch (capErr) {
        console.error('[GeoCamera/camera] CameraPreview.capture() FAILURE', capErr?.message, capErr?.stack);
        throw capErr;
      }
      return base64ToCanvas(`data:image/jpeg;base64,${value}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (this.#facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async #checkAvailableCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.#availableCameras = devices.filter(d => d.kind === 'videoinput');
  }

  async #openStream(videoEl) {
    console.log('[GeoCamera/camera] getUserMedia ->', this.#facing);
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.#facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      videoEl.srcObject = this.#stream;
      await videoEl.play();
      console.log('[GeoCamera/camera] getUserMedia OK');
    } catch (err) {
      this.#stream = null;
      console.error('[GeoCamera/camera] getUserMedia FAILURE', err?.name, err?.message);
      throw err;
    }
  }
}

// Parse EXIF orientation tag from a JPEG data URL.
// Returns 1–8 per the EXIF spec (1 = no rotation needed).
function readExifOrientation(dataUrl) {
  try {
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const bin = atob(b64);
    if (bin.charCodeAt(0) !== 0xFF || bin.charCodeAt(1) !== 0xD8) return 1;

    let pos = 2;
    while (pos + 4 < bin.length) {
      const marker = (bin.charCodeAt(pos) << 8) | bin.charCodeAt(pos + 1);
      const segLen  = (bin.charCodeAt(pos + 2) << 8) | bin.charCodeAt(pos + 3);

      if (marker === 0xFFE1 && bin.slice(pos + 4, pos + 10) === 'Exif\x00\x00') {
        const base = pos + 10;
        const le   = bin.charCodeAt(base) === 0x49; // 'I' = little-endian
        const r16  = o => le
          ? (bin.charCodeAt(base+o) | bin.charCodeAt(base+o+1) << 8)
          : (bin.charCodeAt(base+o) << 8 | bin.charCodeAt(base+o+1));
        const r32  = o => le
          ? (bin.charCodeAt(base+o) | bin.charCodeAt(base+o+1)<<8 | bin.charCodeAt(base+o+2)<<16 | bin.charCodeAt(base+o+3)<<24) >>> 0
          : (bin.charCodeAt(base+o)<<24 | bin.charCodeAt(base+o+1)<<16 | bin.charCodeAt(base+o+2)<<8 | bin.charCodeAt(base+o+3)) >>> 0;

        const ifd0 = r32(4);
        const n    = r16(ifd0);
        for (let i = 0; i < n; i++) {
          const e = ifd0 + 2 + i * 12;
          if (r16(e) === 0x0112) return r16(e + 8); // Orientation tag
        }
      }

      if (marker === 0xFFDA) break; // start of scan — stop looking
      pos += 2 + segLen;
    }
  } catch (_) {}
  return 1;
}

function base64ToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    // Disable browser auto-rotation so we apply EXIF correction ourselves,
    // avoiding double-rotation on Chrome 81+ which also auto-applies EXIF.
    img.style.imageOrientation = 'none';
    img.onload = () => {
      let ori = readExifOrientation(dataUrl);
      // Android Camera1 doesn't embed EXIF orientation. Sensor at -90° from natural
      // requires 90° CW correction (EXIF 6) to restore portrait orientation.
      if (ori === 1 && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        ori = 6;
      }
      const W    = img.naturalWidth;
      const H    = img.naturalHeight;
      // WKWebKit can fire onload with naturalWidth=0 on cold start under memory
      // pressure (deferred image decoding). A 0×0 canvas produces a blank
      // preview and toBlob() returns null on iOS, silently breaking the save.
      if (!W || !H) { reject(new Error('Image decoded with zero dimensions')); return; }
      const swap = ori >= 5; // 90° or 270° rotations swap width/height

      const canvas = document.createElement('canvas');
      canvas.width  = swap ? H : W;
      canvas.height = swap ? W : H;
      const ctx = canvas.getContext('2d');

      // Apply a 2D transform that maps raw sensor pixels to the correct orientation.
      // Each case encodes the standard EXIF rotation/flip as a canvas matrix.
      switch (ori) {
        case 2: ctx.transform(-1,  0,  0,  1, W, 0); break; // flip H
        case 3: ctx.transform(-1,  0,  0, -1, W, H); break; // 180°
        case 4: ctx.transform( 1,  0,  0, -1, 0, H); break; // flip V
        case 5: ctx.transform( 0,  1,  1,  0, 0, 0); break; // transpose
        case 6: ctx.transform( 0,  1, -1,  0, H, 0); break; // 90° CW
        case 7: ctx.transform( 0, -1, -1,  0, H, W); break; // transverse
        case 8: ctx.transform( 0, -1,  1,  0, 0, W); break; // 90° CCW
      }

      ctx.drawImage(img, 0, 0);
      console.log('[GeoCamera/camera] EXIF ori:', ori, '| canvas:', canvas.width, 'x', canvas.height);
      resolve(canvas);
    };
    img.src = dataUrl;
  });
}

export const camera = new CameraService();

// ── File import ───────────────────────────────────────────────
// Reads EXIF orientation (1–8) AND GPS IFD from the first 64 KB of a JPEG.
// Reading only a slice avoids loading a 10+ MB image into memory twice.
async function readExifFromBuffer(file) {
  try {
    const buf  = await file.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return { ori: 1, gps: null };

    let pos = 2;
    let ori = 1;
    let gps = null;

    while (pos + 4 <= buf.byteLength) {
      const marker = view.getUint16(pos);
      const segLen = view.getUint16(pos + 2);

      if (marker === 0xFFE1 &&
          buf.byteLength >= pos + 10 &&
          view.getUint32(pos + 4) === 0x45786966 && // 'Exif'
          view.getUint16(pos + 8) === 0x0000) {

        const base = pos + 10;
        const le   = view.getUint16(base) === 0x4949; // 'II' = little-endian
        const r16  = o => view.getUint16(base + o, le);
        const r32  = o => view.getUint32(base + o, le);

        const ifd0 = r32(4);
        const n0   = r16(ifd0);
        let gpsOff = null;

        for (let i = 0; i < n0; i++) {
          const e   = ifd0 + 2 + i * 12;
          const tag = r16(e);
          if (tag === 0x0112) ori    = r16(e + 8);   // Orientation
          if (tag === 0x8825) gpsOff = r32(e + 8);   // GPS IFD offset
        }

        if (gpsOff !== null) {
          const ng   = r16(gpsOff);
          const tags = {};
          for (let i = 0; i < ng; i++) {
            const e     = gpsOff + 2 + i * 12;
            if (base + e + 12 > buf.byteLength) break;
            const tag   = r16(e);
            const type  = r16(e + 2);
            const count = r32(e + 4);

            if (type === 2) { // ASCII
              const off = count <= 4 ? base + e + 8 : base + r32(e + 8);
              let s = '';
              for (let j = 0; j < count - 1; j++) s += String.fromCharCode(view.getUint8(off + j));
              tags[tag] = s;
            } else if (type === 5) { // RATIONAL (unsigned)
              const off = base + r32(e + 8);
              if (off + count * 8 > buf.byteLength) continue;
              const vals = [];
              for (let j = 0; j < count; j++) {
                const num = view.getUint32(off + j * 8,     le);
                const den = view.getUint32(off + j * 8 + 4, le);
                vals.push(den === 0 ? 0 : num / den);
              }
              tags[tag] = vals;
            }
          }

          if (tags[0x0002] && tags[0x0004]) {
            const dms = ([d, m, s]) => d + m / 60 + s / 3600;
            let lat = dms(tags[0x0002]);
            let lon = dms(tags[0x0004]);
            if (tags[0x0001] === 'S') lat = -lat;
            if (tags[0x0003] === 'W') lon = -lon;
            if (isFinite(lat) && isFinite(lon)) {
              gps = { lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7 };
            }
          }
        }
        break; // APP1/EXIF segment found — stop scanning
      }

      if (marker === 0xFFDA) break; // start of scan
      pos += 2 + segLen;
    }
    return { ori, gps };
  } catch (_) {
    return { ori: 1, gps: null };
  }
}

/**
 * Load a user-selected File into a canvas, correcting EXIF orientation.
 * Does NOT apply the Android Camera1 orientation hack used for native captures.
 *
 * @param {File} file
 * @returns {Promise<{ canvas: HTMLCanvasElement, exifGps: {lat:number,lon:number}|null }>}
 */
export async function fromFile(file) {
  const { ori, gps: exifGps } = await readExifFromBuffer(file);

  const url    = URL.createObjectURL(file);
  const canvas = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.style.imageOrientation = 'none'; // prevent double-rotation on Chrome 81+
    img.onload = () => {
      const W    = img.naturalWidth;
      const H    = img.naturalHeight;
      const swap = ori >= 5;
      const c    = document.createElement('canvas');
      c.width    = swap ? H : W;
      c.height   = swap ? W : H;
      const ctx  = c.getContext('2d');
      switch (ori) {
        case 2: ctx.transform(-1,  0,  0,  1, W, 0); break;
        case 3: ctx.transform(-1,  0,  0, -1, W, H); break;
        case 4: ctx.transform( 1,  0,  0, -1, 0, H); break;
        case 5: ctx.transform( 0,  1,  1,  0, 0, 0); break;
        case 6: ctx.transform( 0,  1, -1,  0, H, 0); break;
        case 7: ctx.transform( 0, -1, -1,  0, H, W); break;
        case 8: ctx.transform( 0, -1,  1,  0, 0, W); break;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.src = url;
  });

  return { canvas, exifGps };
}
