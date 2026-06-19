import { useEffect, useState } from "react";
import BadgeIcon from "./BadgeIcon";
import { BADGE_BY_ID } from "../../constants/badgeDefinitions";
import { playBadgeEarnedSound } from "../../utils/soundUtils";

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
      const t = setTimeout(() => { setVisible(true); playBadgeEarnedSound(); }, 80);
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
      aria-modal="true" role="dialog" aria-label="Badge earned"
      style={{ zIndex: 10000 }}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
        style={{ position: "relative" }}
      >
        {/* X close button */}
        <div className="badge-earned-close-wrap">
          <button
            className="badge-earned-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >✕</button>
        </div>

        <div className="badge-earned-icon-wrap">
          <BadgeIcon badgeId={definition.id} earned size="lg" />
        </div>

        <p className="badge-earned-subtitle">Badge Unlocked!</p>
        <h2 className="badge-earned-name" style={{ color: accentColor }}>{definition.name}</h2>
        <p className="badge-earned-desc">{definition.description}</p>

        {badgeQueue.length > 1 && (
          <p className="badge-earned-more">
            +{badgeQueue.length - 1} more badge{badgeQueue.length - 1 > 1 ? "s" : ""} to claim!
          </p>
        )}

        <button className="badge-earned-btn" style={{ background: accentColor }} onClick={handleClose}>
          {badgeQueue.length > 1 ? "Next" : "Awesome!"}
        </button>
      </div>
    </div>
  );
}
