import React, { useEffect, useState } from "react";
import BadgeIcon from "./BadgeIcon";
import { BADGE_BY_ID } from "../../constants/badgeDefinitions";
import { playBadgeEarnedSound } from "../../utils/soundUtils";

const CONFETTI = [
  { color: '#FFD700', x: 12,  y: 18, w: 8,  h: 8,  r: '50%',  delay: 0,    dur: 1.8 },
  { color: '#FF6B6B', x: 82,  y: 12, w: 7,  h: 5,  r: '2px',  delay: 0.1,  dur: 2.1 },
  { color: '#4ECDC4', x: 88,  y: 42, w: 9,  h: 9,  r: '50%',  delay: 0.2,  dur: 1.6 },
  { color: '#45B7D1', x: 8,   y: 58, w: 6,  h: 4,  r: '2px',  delay: 0.05, dur: 2.3 },
  { color: '#96CEB4', x: 72,  y: 72, w: 10, h: 10, r: '50%',  delay: 0.15, dur: 1.9 },
  { color: '#FFEAA7', x: 22,  y: 78, w: 7,  h: 7,  r: '50%',  delay: 0.25, dur: 2.0 },
  { color: '#DDA0DD', x: 58,  y: 88, w: 8,  h: 5,  r: '2px',  delay: 0.1,  dur: 1.7 },
  { color: '#98D8C8', x: 4,   y: 32, w: 6,  h: 6,  r: '50%',  delay: 0.3,  dur: 2.2 },
  { color: '#F7DC6F', x: 84,  y: 22, w: 9,  h: 6,  r: '2px',  delay: 0.05, dur: 1.5 },
  { color: '#BB8FCE', x: 38,  y: 8,  w: 7,  h: 7,  r: '50%',  delay: 0.2,  dur: 2.4 },
  { color: '#5DADE2', x: 68,  y: 52, w: 6,  h: 4,  r: '2px',  delay: 0.15, dur: 1.8 },
  { color: '#58D68D', x: 18,  y: 44, w: 8,  h: 8,  r: '50%',  delay: 0.25, dur: 2.0 },
  { color: '#FF9F43', x: 50,  y: 5,  w: 6,  h: 6,  r: '50%',  delay: 0.1,  dur: 1.9 },
  { color: '#EE5A24', x: 92,  y: 65, w: 7,  h: 5,  r: '2px',  delay: 0.35, dur: 2.1 },
  { color: '#A29BFE', x: 30,  y: 92, w: 8,  h: 8,  r: '50%',  delay: 0.05, dur: 1.6 },
];

const CATEGORY_COLORS = {
  default:       "#9CA3AF",
  milestone:     "#0D9488",
  performance:   "#D97706",
  leadership:    "#7C3AED",
  institutional: "#DC2626",
};

export default function BadgeEarnedModal({ badgeQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);

  const currentId = badgeQueue[0] ?? null;
  const definition = currentId ? BADGE_BY_ID[currentId] : null;

  useEffect(() => {
    if (currentId) {
      const t = setTimeout(() => {
        setVisible(true);
        playBadgeEarnedSound();
      }, 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [currentId]);

  if (!currentId || !definition) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(currentId), 300);
  };

  const accentColor = CATEGORY_COLORS[definition.category] ?? "#0D9488";

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-label="Badge earned"
      onClick={handleClose}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti layer */}
        <div className="badge-earned-confetti" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.w,
                height: p.h,
                borderRadius: p.r,
                background: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Badge */}
        <div className="badge-earned-icon-wrap">
          <BadgeIcon badgeId={definition.id} earned size="lg" />
        </div>

        {/* Text */}
        <p className="badge-earned-subtitle">Badge Unlocked!</p>
        <h2 className="badge-earned-name" style={{ color: accentColor }}>
          {definition.name}
        </h2>
        <p className="badge-earned-desc">{definition.description}</p>

        {badgeQueue.length > 1 && (
          <p className="badge-earned-more">
            +{badgeQueue.length - 1} more badge{badgeQueue.length - 1 > 1 ? "s" : ""} to claim!
          </p>
        )}

        {/* Button */}
        <button
          className="badge-earned-btn"
          style={{ background: accentColor }}
          onClick={handleClose}
        >
          {badgeQueue.length > 1 ? "Close" : "Awesome!"}
        </button>
      </div>
    </div>
  );
}
