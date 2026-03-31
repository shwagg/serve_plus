export function showToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

// Make accessible from non-React files (e.g. exportProposalPDF.js)
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
