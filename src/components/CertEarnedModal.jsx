import { useEffect, useState } from "react";

export default function CertEarnedModal({ certQueue = [], onDismiss, hasBadgeFollowing }) {
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

  const isLastCert = certQueue.length === 1;
  let btnLabel;
  if (!isLastCert) {
    btnLabel = "Next";
  } else if (hasBadgeFollowing) {
    btnLabel = "Continue";
  } else {
    btnLabel = "View in Portfolio";
  }

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true" role="dialog" aria-label="Certificate received"
      style={{ zIndex: 10000 }}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
        style={{ position: "relative" }}
      >
        {/* X close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 16,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: "#94a3b8", lineHeight: 1, padding: 4,
            zIndex: 2,
          }}
        >✕</button>

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

        <p className="badge-earned-subtitle">Congratulations!</p>
        <h2 className="badge-earned-name" style={{ color: "#234e7b" }}>{current.course}</h2>
        <p className="badge-earned-desc">
          Mission Complete.
          <br />Your SERVE+ certificate has been added to your portfolio.
        </p>

        {current.missionPoints != null && current.missionPoints > 0 && (
          <div style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "1.5px solid #86efac",
            borderRadius: 12, padding: "10px 18px", margin: "8px 0",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            zIndex: 1, position: "relative",
          }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#166534" }}>
              +{current.missionPoints} pts
            </span>
            <span style={{ fontSize: "0.8rem", color: "#15803d" }}>earned this mission</span>
          </div>
        )}

        {certQueue.length > 1 && (
          <p className="badge-earned-more">
            +{certQueue.length - 1} more certificate{certQueue.length - 1 > 1 ? "s" : ""} to view!
          </p>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: "#234e7b" }}
          onClick={() => {
            handleClose();
            if (isLastCert && !hasBadgeFollowing) {
              sessionStorage.setItem("profileScrollTo", "certificates");
              window.location.href = "/profile";
            }
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
