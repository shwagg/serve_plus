import { useEffect } from 'react';

export const HEADER_MODAL_OPEN_EVENT = 'serve-plus:header-modal-open';

export function announceHeaderModalOpen(source) {
  window.dispatchEvent(
    new CustomEvent(HEADER_MODAL_OPEN_EVENT, {
      detail: { source },
    }),
  );
}

export function useCloseOnHeaderModalOpen(source, closeFn) {
  useEffect(() => {
    const handleModalOpen = (event) => {
      if (event.detail?.source === source) return;
      closeFn();
    };

    window.addEventListener(HEADER_MODAL_OPEN_EVENT, handleModalOpen);
    return () => window.removeEventListener(HEADER_MODAL_OPEN_EVENT, handleModalOpen);
  }, [source, closeFn]);
}
