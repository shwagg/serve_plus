import React, { useEffect, useState } from "react";
import BadgeIcon from "./BadgeIcon";
import { BADGE_BY_ID } from "../../constants/badgeDefinitions";

/**
 * BadgeEarnedModal — celebration pop-up when a badge is earned.
 *
 * Props:
 *   badgeQueue  – array of badgeId strings to show (one at a time)
 *   onDismiss   – function(badgeId) called when user closes a badge popup
 */
export default function BadgeEarnedModal({ badgeQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);

  const currentId = badgeQueue[0] ?? null;
  const definition = currentId ? BADGE_BY_ID[currentId] : null;

  useEffect(() => {
    if (currentId) {
      // Small delay so animation feels intentional
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [currentId]);

  if (!currentId || !definition) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onDismiss && onDismiss(currentId);
    }, 220);
  };

  const categoryColorMap = {
    default:       "#9CA3AF",
    milestone:     "#0D9488",
    performance:   "#D97706",
    leadership:    "#7C3AED",
    institutional: "#DC2626",
  };
  const accentColor = categoryColorMap[definition.category] ?? "#0D9488";

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-label="Badge earned"
    >
      <div className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}>
        {/* X close button */}
        <button
          className="badge-earned-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Sparkle / confetti decoration */}
        <div className="badge-earned-sparkles" aria-hidden="true">
          <span>✦</span><span>✦</span><span>✦</span>
        </div>

        <p className="badge-earned-subtitle">Achievement Unlocked!</p>

        {/* Badge visual */}
        <div className="badge-earned-icon-wrap">
          <BadgeIcon badgeId={definition.id} earned size="lg" />
        </div>

        <h2 className="badge-earned-name" style={{ color: accentColor }}>
          {definition.name}
        </h2>
        <p className="badge-earned-desc">{definition.description}</p>

        {badgeQueue.length > 1 && (
          <p className="badge-earned-more">
            +{badgeQueue.length - 1} more badge{badgeQueue.length - 1 > 1 ? "s" : ""} earned!
          </p>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: accentColor }}
          onClick={handleClose}
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}
