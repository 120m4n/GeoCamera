/**
 * iOS install banner: show hint only in Safari mobile, not in standalone mode.
 */

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

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIOSBanner);
} else {
  initIOSBanner();
}
