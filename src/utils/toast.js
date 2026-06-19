let _lastToastMessage = null;
let _lastToastTimer = null;

export function showToast(message, type = 'success', subtitle = null) {
  // Deduplicate: ignore if the exact same message is already visible
  if (_lastToastMessage === message) return;
  _lastToastMessage = message;
  if (_lastToastTimer) clearTimeout(_lastToastTimer);
  _lastToastTimer = setTimeout(() => {
    _lastToastMessage = null;
    _lastToastTimer = null;
  }, 5500); // slightly longer than toast display duration (5000ms)
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, subtitle } }));
}

export function showConfirm(message) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('app-confirm', { detail: { message, resolve } }));
  });
}

// Make accessible from non-React files
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.showConfirm = showConfirm;
}

// Override native alert globally
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;

  window.alert = function (message) {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message, type: 'error' } // default alert = error style
      })
    );

    // Note: remove comment if you DON'T want browser popup alert (annoying but sometimes useful for critical errors)
    // originalAlert(message);
  };
}