import { useEffect, useState } from "react";

function formatWholePoints(value) {
  return Math.round(Number(value) || 0);
}

export default function BonusModal({ bonusQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);
  const current = bonusQueue[0] ?? null;

  useEffect(() => {
    if (current) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [current?.id]);

  if (!current) return null;

  const { missionTitle, totalPoints, basePoints, requirementPoints = 0, bonuses = {} } = current;
  const displayTotalPoints = formatWholePoints(totalPoints);
  const displayBasePoints = formatWholePoints(basePoints);
  const displayRequirementPoints = formatWholePoints(requirementPoints);

  const bonusLines = [
    bonuses.returning && {
      label: "Returning participant",
      amount: formatWholePoints(bonuses.returning.amount),
    },
    bonuses.termStreak && {
      label: "Term streak",
      amount: formatWholePoints(bonuses.termStreak.amount),
    },
    bonuses.roleDiversity && {
      label: "Role diversity",
      amount: formatWholePoints(bonuses.roleDiversity.amount),
    },
    bonuses.sdg && {
      label: `New SDGs (${bonuses.sdg.count})`,
      amount: formatWholePoints(bonuses.sdg.amount),
    },
  ].filter(Boolean);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-label="Points released"
      onClick={handleClose}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <p className="badge-earned-subtitle">Mission Complete!</p>
        <h2 className="badge-earned-name" style={{ color: "#f59e0b", fontSize: "1.15rem", marginBottom: 4 }}>
          {missionTitle}
        </h2>

        <div style={{ width: "100%", margin: "16px 0", textAlign: "left" }}>
          {displayRequirementPoints > 0 && (
            <div style={rowStyle}>
              <span style={labelStyle}>Requirements</span>
              <span style={valueStyle}>+{displayRequirementPoints} pts</span>
            </div>
          )}
          {displayBasePoints > 0 && (
            <div style={rowStyle}>
              <span style={labelStyle}>Mission points</span>
              <span style={valueStyle}>+{displayBasePoints} pts</span>
            </div>
          )}

          {bonusLines.length > 0 && (
            <>
              <p style={bonusHeadingStyle}>Bonuses</p>
              {bonusLines.map((b) => (
                <div key={b.label} style={rowStyle}>
                  <span style={{ ...labelStyle, color: "#374151" }}>{b.label}</span>
                  <span style={{ ...valueStyle, color: "#16a34a" }}>+{b.amount} pts</span>
                </div>
              ))}
            </>
          )}

          <div style={{ ...rowStyle, borderTop: "1px solid #e5e7eb", marginTop: 8, paddingTop: 8 }}>
            <span style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>Total</span>
            <span style={{ fontWeight: 700, color: "#f59e0b", fontSize: 15 }}>{displayTotalPoints} pts</span>
          </div>
        </div>

        <button
          className="badge-earned-btn"
          style={{ background: "#f59e0b" }}
          onClick={handleClose}
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 0",
  borderBottom: "1px solid #f3f4f6",
};

const labelStyle = {
  color: "#6b7280",
  fontSize: 14,
};

const valueStyle = {
  fontWeight: 600,
  color: "#111",
  fontSize: 14,
};

const bonusHeadingStyle = {
  fontSize: 11,
  color: "#9ca3af",
  margin: "10px 0 4px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
