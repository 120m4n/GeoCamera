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
  return new Promise((resolve) => {
    const img = new Image();
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
