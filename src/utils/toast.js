export function showToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

// Make accessible from non-React files (e.g. exportProposalPDF.js)
if (typeof window !== 'undefined') {
  window.showToast = showToast;
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