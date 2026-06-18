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
      // Let the WKWebView finish layout before touching native camera APIs.
      await new Promise(r => setTimeout(r, 200));

      // Pre-request camera permission via AVFoundation before CameraPreview.start().
      // iOS has a race condition where DiscoverySession returns empty if called
      // immediately inside requestAccess's callback (the authorization status hasn't
      // fully propagated yet). By calling Camera.requestPermissions() first — which
      // uses AVFoundation directly without creating any AVCaptureSession — the status
      // is already .authorized when the plugin's own requestAccess fires, so
      // DiscoverySession finds cameras reliably.
      let camPerm;
      try {
        const result = await Camera.requestPermissions({ permissions: ['camera'] });
        camPerm = result.camera;
        console.log('[GeoCamera] Camera.requestPermissions resolved:', camPerm);
      } catch (permErr) {
        console.warn('[GeoCamera] Camera.requestPermissions threw:', permErr);
        // Plugin not available (e.g. web); let CameraPreview handle its own permission
        camPerm = 'granted';
      }

      if (camPerm === 'denied') {
        const err = new Error('Camera permission denied');
        err.name = 'NotAllowedError';
        throw err;
      }

      console.log('[GeoCamera] calling CameraPreview.start');
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      await CameraPreview.start({
        position: this.#facing === 'environment' ? 'rear' : 'front',
        toBack: true,
        disableAudio: true,
      });
    } else {
      await this.#checkAvailableCameras();
      await this.#openStream(videoEl);
    }
  }

  async stop() {
    if (this.#native) {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      await CameraPreview.stop().catch(() => {});
    } else {
      if (this.#stream) {
        this.#stream.getTracks().forEach(t => t.stop());
        this.#stream = null;
      }
    }
  }

  async toggleFacing(videoEl) {
    this.#facing = this.#facing === 'environment' ? 'user' : 'environment';
    if (this.#native) {
      await CameraPreview.flip();
    } else {
      await this.stop();
      await this.#openStream(videoEl);
    }
  }

  /**
   * Captures the current frame and returns a canvas.
   * Native: CameraPreview.capture() → base64 → canvas.
   * Web: snapshot from <video> element.
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<HTMLCanvasElement>}
   */
  async capture(videoEl) {
    if (this.#native) {
      const { value } = await CameraPreview.capture({ quality: 92 });
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
    } catch (err) {
      this.#stream = null;
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
