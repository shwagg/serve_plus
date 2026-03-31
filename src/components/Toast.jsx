import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

let toastId = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type } = e.detail;
      const id = ++toastId;
      setToasts(prev => [...prev, { id, message, type, visible: true }]);
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 400);
      }, 3000);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: '#faf3d3',
            color: '#345360',
            border: '2px solid #345360',
            borderRadius: 12,
            padding: '14px 32px',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            boxShadow: '0 4px 24px rgba(52,83,96,0.13)',
            transform: t.visible ? 'translateY(0)' : 'translateY(40px)',
            opacity: t.visible ? 1 : 0,
            transition: 'transform 0.35s cubic-bezier(.4,1.4,.6,1), opacity 0.3s',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
