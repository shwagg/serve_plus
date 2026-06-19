import { useEffect } from 'react';

export const HEADER_MODAL_OPEN_EVENT = 'serve-plus:header-modal-open';

export function announceHeaderModalOpen(source) {
  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent(HEADER_MODAL_OPEN_EVENT, {
        detail: { source },
      }),
    );
  };

  if (typeof window.queueMicrotask === 'function') {
    window.queueMicrotask(dispatch);
  } else {
    window.setTimeout(dispatch, 0);
  }
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
