import React, { useEffect, useState } from "react";

const CONFETTI = [
  { color: '#FFD700', x: 12,  y: 18, w: 8,  h: 8,  r: '50%',  delay: 0,    dur: 1.8 },
  { color: '#30bdb7', x: 82,  y: 12, w: 7,  h: 5,  r: '2px',  delay: 0.1,  dur: 2.1 },
  { color: '#4ECDC4', x: 88,  y: 42, w: 9,  h: 9,  r: '50%',  delay: 0.2,  dur: 1.6 },
  { color: '#234e7b', x: 8,   y: 58, w: 6,  h: 4,  r: '2px',  delay: 0.05, dur: 2.3 },
  { color: '#96CEB4', x: 72,  y: 72, w: 10, h: 10, r: '50%',  delay: 0.15, dur: 1.9 },
  { color: '#FFEAA7', x: 22,  y: 78, w: 7,  h: 7,  r: '50%',  delay: 0.25, dur: 2.0 },
  { color: '#30bdb7', x: 58,  y: 88, w: 8,  h: 5,  r: '2px',  delay: 0.1,  dur: 1.7 },
  { color: '#234e7b', x: 4,   y: 32, w: 6,  h: 6,  r: '50%',  delay: 0.3,  dur: 2.2 },
  { color: '#F7DC6F', x: 84,  y: 22, w: 9,  h: 6,  r: '2px',  delay: 0.05, dur: 1.5 },
  { color: '#BB8FCE', x: 38,  y: 8,  w: 7,  h: 7,  r: '50%',  delay: 0.2,  dur: 2.4 },
  { color: '#5DADE2', x: 68,  y: 52, w: 6,  h: 4,  r: '2px',  delay: 0.15, dur: 1.8 },
  { color: '#58D68D', x: 18,  y: 44, w: 8,  h: 8,  r: '50%',  delay: 0.25, dur: 2.0 },
  { color: '#FF9F43', x: 50,  y: 5,  w: 6,  h: 6,  r: '50%',  delay: 0.1,  dur: 1.9 },
  { color: '#234e7b', x: 92,  y: 65, w: 7,  h: 5,  r: '2px',  delay: 0.35, dur: 2.1 },
  { color: '#A29BFE', x: 30,  y: 92, w: 8,  h: 8,  r: '50%',  delay: 0.05, dur: 1.6 },
];

export default function CertEarnedModal({ certQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);
  const current = certQueue[0] ?? null;

  useEffect(() => {
    if (current) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [current?.notifId]);

  if (!current) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(current.notifId), 300);
  };

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-label="Certificate received"
      onClick={handleClose}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="badge-earned-confetti" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                width: p.w, height: p.h,
                borderRadius: p.r, background: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="badge-earned-icon-wrap">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #eef5ff 0%, #dbeafe 100%)',
            border: '2.5px solid #30bdb7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#234e7b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="9 15 11 17 15 13"/>
            </svg>
          </div>
        </div>

        <p className="badge-earned-subtitle">Certificate Received!</p>
        <h2 className="badge-earned-name" style={{ color: "#234e7b" }}>{current.course}</h2>
        <p className="badge-earned-desc">
          Your SerVe+ certificate has been issued and added to your portfolio.
        </p>

        {certQueue.length > 1 && (
          <p className="badge-earned-more">
            +{certQueue.length - 1} more certificate{certQueue.length - 1 > 1 ? "s" : ""} to view!
          </p>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: "#234e7b" }}
          onClick={handleClose}
        >
          {certQueue.length > 1 ? "Close" : "View in Portfolio!"}
        </button>
      </div>
    </div>
  );
}
