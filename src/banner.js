// ── iOS install banner ────────────────────────────────────────
// Show hint only in Safari mobile, not in standalone mode.

export function initIOSBanner() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const dismissed = sessionStorage.getItem('ios-banner-dismissed');

  const bannerEl = document.getElementById('ios-banner');
  const closeBtn = bannerEl?.querySelector('button');

  if (isIOS && !isStandalone && !dismissed) {
    bannerEl.style.display = 'block';
  }

  closeBtn?.addEventListener('click', () => {
    bannerEl.style.display = 'none';
    sessionStorage.setItem('ios-banner-dismissed', '1');
  });
}

// ── Android / Chromium install banner ────────────────────────
// Capture the deferred prompt and surface it as a native-feeling banner.

let deferredPrompt = null;

export function initAndroidBanner() {
  const bannerEl   = document.getElementById('android-banner');
  const installBtn = document.getElementById('android-install-btn');
  const dismissBtn = document.getElementById('android-dismiss-btn');

  if (!bannerEl || !installBtn || !dismissBtn) return;

  const dismissed = sessionStorage.getItem('android-banner-dismissed');
  if (dismissed) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    bannerEl.style.display = 'flex';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    bannerEl.style.display = 'none';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'dismissed') {
      sessionStorage.setItem('android-banner-dismissed', '1');
    }
  });

  dismissBtn.addEventListener('click', () => {
    bannerEl.style.display = 'none';
    deferredPrompt = null;
    sessionStorage.setItem('android-banner-dismissed', '1');
  });

  // Hide banner once the user installs from the browser menu directly
  window.addEventListener('appinstalled', () => {
    bannerEl.style.display = 'none';
    deferredPrompt = null;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initIOSBanner();
    initAndroidBanner();
  });
} else {
  initIOSBanner();
  initAndroidBanner();
}
