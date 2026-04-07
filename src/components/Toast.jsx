import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

let toastId = 0;

const sharedStyle = {
  background: '#ffffff',
  borderRadius: 10,
  fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
  fontWeight: 400,
  fontSize: 14,
  letterSpacing: '0.01em',
  boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
  pointerEvents: 'auto',
  minWidth: 'fit-content',
  maxWidth: 360,
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null); // { message, resolve }

  useEffect(() => {
    const toastHandler = (e) => {
      const { message, type } = e.detail;
      const id = ++toastId;
      setToasts(prev => [...prev, { id, message, type, visible: true }]);
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

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleConfirm = (result) => {
    confirm?.resolve(result);
    setConfirm(null);
  };

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>

      {/* Confirm dialog — shown above toasts */}
      {confirm && (
        <div style={{
          ...sharedStyle,
          padding: '10px 14px',
          color: '#1a1a1a',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ flex: 1, lineHeight: 1.5, wordBreak: 'break-word', fontSize: 14 }}>
            {confirm.message}
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => handleConfirm(false)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                color: '#4a5568',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirm(true)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#28a8a3'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#30bdb7'}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#30bdb7',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
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
            color: '#1a1a1a',
            padding: '14px 18px',
            transform: t.visible ? 'translateY(0)' : 'translateY(20px)',
            opacity: t.visible ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(.2,.8,.4,1), opacity 0.25s',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              onMouseEnter={(e) => e.currentTarget.style.color = '#30bdb7'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                fontSize: 14,
                fontWeight: 400,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                transition: 'color 0.2s',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
