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

function base64ToCanvas(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.src = dataUrl;
  });
}

export const camera = new CameraService();
