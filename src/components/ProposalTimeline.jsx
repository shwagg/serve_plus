import React from "react";

/**
 * ProposalTimeline
 * Shows the signatory approval chain as a vertical timeline.
 *
 * Props:
 *   proposal – the mission/proposal document from Firestore
 *   compact  – boolean, if true renders a smaller version (for card modal header)
 */
export default function ProposalTimeline({ proposal, compact = false }) {
  if (!proposal) return null;

  const {
    reviewedBy, recommendedBy, endorsedBy, approvedBy,
    preparedBy, status, rejectedBy, rejectedByUser, rejectionReason,
    approvals = {},
    selectedReviewedBy, selectedRecommendedBy,
  } = proposal;

  const fmt = (ts) => {
    if (!ts) return null;
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
        " · " + d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  const isRejected = rejectedBy && status === "for_approval" && !reviewedBy;
  const isAllDone = reviewedBy && recommendedBy && endorsedBy && approvedBy;

  const badgeLabel = isRejected ? "Returned" : isAllDone ? "Completed" : "In Progress";
  const badgeStyle = isRejected
    ? { background: "#fee2e2", color: "#991b1b" }
    : isAllDone
    ? { background: "#dcfce7", color: "#166534" }
    : { background: "#e0f2fe", color: "#0369a1" };

  const steps = [
    {
      key: "submitted",
      label: "Submitted",
      sublabel: preparedBy ? `by ${preparedBy}` : "Proposal sent for approval",
      done: true,
      decidedAt: fmt(approvals?.submitted?.decidedAt || proposal.dateProposed || proposal.createdAt),
    },
    {
      key: "reviewedBy",
      label: "Reviewed By",
      sublabel: "Program Chair",
      designated: selectedReviewedBy || null,
      done: !!reviewedBy,
      name: reviewedBy,
      decidedAt: fmt(approvals?.reviewedBy?.decidedAt),
      approved: approvals?.reviewedBy?.approved,
      rejected: isRejected && rejectedBy === "reviewedBy",
    },
    {
      key: "recommendedBy",
      label: "Recommended By",
      sublabel: "College Dean / Cluster Head",
      designated: selectedRecommendedBy || null,
      done: !!recommendedBy,
      name: recommendedBy,
      decidedAt: fmt(approvals?.recommendedBy?.decidedAt),
      approved: approvals?.recommendedBy?.approved,
      rejected: isRejected && rejectedBy === "recommendedBy",
    },
    {
      key: "endorsedBy",
      label: "Endorsed By",
      sublabel: "CSCE Admin",
      designated: null,
      done: !!endorsedBy,
      name: endorsedBy,
      decidedAt: fmt(approvals?.endorsedBy?.decidedAt),
      approved: approvals?.endorsedBy?.approved,
      rejected: isRejected && rejectedBy === "endorsedBy",
    },
    {
      key: "approvedBy",
      label: "Approved By",
      sublabel: "CSCE Director",
      designated: null,
      done: !!approvedBy,
      name: approvedBy,
      decidedAt: fmt(approvals?.approvedBy?.decidedAt),
      approved: approvals?.approvedBy?.approved,
      rejected: isRejected && rejectedBy === "approvedBy",
    },
    {
      key: "ready",
      label: "Ready to Publish",
      sublabel: "All approvals complete — admin or director can now publish the event",
      done: !!isAllDone,
      decidedAt: null,
    },
  ];

  const activeIdx = steps.findIndex((s) => !s.done);

  const iconStyle = (step, i) => {
    const base = {
      width: compact ? 24 : 28,
      height: compact ? 24 : 28,
      borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontWeight: 700,
      fontSize: compact ? 10 : 12,
      marginTop: 2, zIndex: 1, position: "relative",
    };
    if (step.rejected) return { ...base, background: "#dc2626", color: "#fff" };
    if (step.done) return { ...base, background: "#0D9488", color: "#fff" };
    if (i === activeIdx) return { ...base, background: "#fff", border: "2.5px solid #0D9488", color: "#0D9488" };
    return { ...base, background: "#f1f5f9", border: "2px solid #e2e8f0", color: "#cbd5e1" };
  };

  const iconChar = (step, i) => {
    if (step.rejected) return "✕";
    if (step.done) return "✓";
    if (i === activeIdx) return "●";
    return String(i + 1);
  };

  return (
    <div style={{
      background: "#f8fafc",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: compact ? "14px 16px" : "18px 20px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: compact ? 14 : 20 }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Signatories Progress
        </span>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99, ...badgeStyle }}>
          {badgeLabel}
        </span>
      </div>

      {/* Rejection notice */}
      {isRejected && rejectionReason && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.8rem", color: "#991b1b" }}>
          <strong>Returned:</strong> {rejectionReason}
        </div>
      )}

      {/* Steps */}
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isActive = i === activeIdx && !isRejected;
        return (
          <div key={step.key} style={{ display: "flex", gap: compact ? 10 : 14, position: "relative" }}>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                position: "absolute",
                left: compact ? 11 : 13,
                top: compact ? 26 : 30,
                bottom: -6,
                width: 2,
                background: step.done ? "#0D9488" : "#e5e7eb",
              }} />
            )}

            {/* Circle */}
            <div style={iconStyle(step, i)}>{iconChar(step, i)}</div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : compact ? 14 : 20 }}>
              <div style={{
                fontSize: compact ? "0.82rem" : "0.88rem",
                fontWeight: step.done || isActive ? 700 : 500,
                color: step.done || isActive ? "#1e293b" : "#94a3b8",
                marginBottom: 2,
              }}>
                {step.label}
              </div>
              <div style={{ fontSize: compact ? "0.72rem" : "0.76rem", color: "#94a3b8", lineHeight: 1.4 }}>
                {step.sublabel}
              </div>
              {step.designated && (
                <div style={{ fontSize: compact ? "0.74rem" : "0.78rem", fontWeight: 600, color: "#475569", marginTop: 2 }}>
                  {step.designated}
                </div>
              )}
              {step.name && (
                <div style={{ fontSize: compact ? "0.76rem" : "0.8rem", fontWeight: 600, color: "#0D9488", marginTop: 3 }}>
                  {step.name}
                </div>
              )}
              {step.decidedAt && (
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
                  {step.decidedAt}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
