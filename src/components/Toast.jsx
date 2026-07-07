import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

let toastId = 0;

const TOAST_BG = '#f0f0f0';

const sharedStyle = {
  background: TOAST_BG,
  borderRadius: '16px',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: 14,
  letterSpacing: '0.01em',
  boxShadow: 'none',
  pointerEvents: 'auto',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const toastHandler = (e) => {
      const { message, type, subtitle } = e.detail;
      const id = ++toastId;
      setToasts(prev => [...prev, { id, message, type, subtitle, visible: true }]);
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 400);
      }, 5000);
    };

    const confirmHandler = (e) => {
      const { message, resolve } = e.detail;
      setConfirm({ message, resolve });
    };

    window.addEventListener('app-toast', toastHandler);
    window.addEventListener('app-confirm', confirmHandler);
    return () => {
      window.removeEventListener('app-toast', toastHandler);
      window.removeEventListener('app-confirm', confirmHandler);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleConfirm = (result) => {
    confirm?.resolve(result);
    setConfirm(null);
  };

  const itemSizing = { width: '100%', boxSizing: 'border-box' };

  const containerStyle = isMobile
    ? { position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10, pointerEvents: 'none', maxWidth: 'calc(100vw - 32px)' }
    : { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10, pointerEvents: 'none', width: 440 };

  return ReactDOM.createPortal(
    <div style={containerStyle}>

      {/* Confirm dialog — shown above toasts */}
      {confirm && (
        <div style={{
          ...sharedStyle,
          ...itemSizing,
          padding: '12px 16px',
          color: '#1a1a1a',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 12,
        }}>
          <span style={{ flex: 1, lineHeight: 1.5, wordBreak: 'break-word', fontSize: 14 }}>
            {confirm.message}
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => handleConfirm(false)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e2e2'}
              onMouseLeave={(e) => e.currentTarget.style.background = TOAST_BG}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1.5px solid #000',
                background: TOAST_BG,
                color: '#1a1a1a',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirm(true)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#C81724'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#EB1F29'}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#EB1F29',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Regular toasts */}
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            ...sharedStyle,
            ...itemSizing,
            color: '#1a1a1a',
            padding: isMobile ? '14px 16px' : '12px 16px',
            position: 'relative',
            transform: t.visible ? 'translateY(0)' : 'translateY(20px)',
            opacity: t.visible ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(.2,.8,.4,1), opacity 0.25s',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'block', flex: '1 1 auto', minWidth: 0, overflowWrap: 'break-word', wordBreak: 'normal' }}>
              <span style={{ display: 'block', lineHeight: 1.4, fontWeight: t.subtitle ? 600 : 400 }}>{t.message}</span>
              {t.subtitle && <span style={{ display: 'block', lineHeight: 1.4, fontSize: 13, color: '#555', marginTop: 1 }}>{t.subtitle}</span>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              onMouseEnter={(e) => e.currentTarget.style.color = '#EB1F29'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: isMobile ? 18 : 20,
                fontWeight: 400,
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
                transition: 'color 0.2s',
                flexShrink: 0,
                marginLeft: 'auto',
              }}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
