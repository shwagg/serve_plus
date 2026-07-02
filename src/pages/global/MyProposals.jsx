import { useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import ProposalTimeline from "../../components/ProposalTimeline";
import { SessionContext } from "../../context/sessionContextCore";
import { hasSignatoryApproval, PROPOSAL_LOCKED_NOTICE } from "../../utils/proposalApproval";
import { canCurrentUserPublishProposal, publishApprovedProposal } from "../../utils/publishProposal";
import { showConfirm, showToast } from "../../utils/toast";
import ProjectProposal from "./proposal/ProjectProposal";
import "../../styles/ReviewProposal.css";
import "../../styles/student.css";

function formatDate(value) {
  if (!value) return "Date TBA";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function getProposalStatusLine(proposal) {
  const { reviewedBy, recommendedBy, endorsedBy, approvedBy, status, rejectedBy, rejectedByUser } = proposal;
  if (rejectedBy && status === "rejected" && !reviewedBy) {
    return `Returned for revision${rejectedByUser ? ` by ${rejectedByUser}` : ""}`;
  }
  if (approvedBy && recommendedBy && endorsedBy && reviewedBy) {
    return "Approved - Ready for you to publish";
  }
  if (endorsedBy) return "Endorsed by Admin - Awaiting Director approval";
  if (recommendedBy) return `Recommended by ${recommendedBy} - Awaiting Admin (CSCE) endorsement`;
  if (reviewedBy) return `Reviewed by ${reviewedBy} - Awaiting College Dean recommendation`;
  return "Submitted - Awaiting Program Chair review";
}

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) return <p>N/A</p>;
  return (
    <ul className="student-proposal-detail-list">
      {items.map((item, index) => <li key={index}>{item}</li>)}
    </ul>
  );
}

function getStatusInfo(status = "") {
  const labels = {
    for_approval: { label: "For Approval", color: "#d97706" },
    pending: { label: "Pending", color: "#9a3412" },
    draft: { label: "Ready to Publish", color: "#166534" },
    rejected: { label: "Returned for Revision", color: "#dc2626" },
  };
  return labels[status] || { label: status || "Draft", color: "#64748b" };
}

export default function MyProposals() {
  const { userData } = useContext(SessionContext);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [publishingProposalId, setPublishingProposalId] = useState("");

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    if (!currentUser) {
      setProposals([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const proposalsQuery = query(
      collection(db, "missions"),
      where("createdBy", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      proposalsQuery,
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((proposal) => proposal.status !== "published");
        setProposals(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading my proposals:", error);
        showToast("Failed to load proposals.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const closeModal = () => {
    setSelectedProposal(null);
    setEditMode(false);
  };

  const handlePublish = async (proposal) => {
    if (!proposal || publishingProposalId) return;
    const confirmed = await showConfirm(`Publish "${proposal.title || "this event"}"? Volunteers will be able to join the event.`);
    if (!confirmed) return;

    setPublishingProposalId(proposal.id);
    try {
      await publishApprovedProposal(proposal, userData || {});
      showToast("Event published.");
      closeModal();
    } catch (error) {
      console.error("Error publishing proposal:", error);
      showToast(error?.message || "Failed to publish. Try again.");
    } finally {
      setPublishingProposalId("");
    }
  };

  return (
    <div className="review-proposal-container rp-admin">
      <div className="review-proposal-wrapper">
        <nav className="rp-breadcrumb" aria-label="breadcrumb">
          <span className="rp-breadcrumb-item">Faculty</span>
          <span className="rp-breadcrumb-sep">›</span>
          <span className="rp-breadcrumb-item rp-breadcrumb-current">My Proposals</span>
        </nav>

        <div className="rp-page-header">
          <div>
            <h1 className="review-proposal-title">My Proposals</h1>
            <p className="rp-action-hint">Publish approved events after final sign-off.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-message">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="rp-empty">
            <div className="rp-empty-icon">📋</div>
            <p>No proposals found</p>
          </div>
        ) : (
          <div className="rp-card-grid">
            {proposals.map((proposal) => {
              const statusInfo = getStatusInfo(proposal.status);
              const canPublish = canCurrentUserPublishProposal(proposal, currentUser);
              const typeLabel = proposal.projectType === "sl"
                ? "Service Learning"
                : proposal.projectType === "ce"
                  ? "Community Engagement"
                  : proposal.projectType || "Proposal";

              return (
                <div
                  key={proposal.id}
                  className={`rp-card${canPublish ? " rp-card--action" : ""}`}
                  onClick={() => setSelectedProposal(proposal)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedProposal(proposal);
                  }}
                >
                  <div className="rp-card-top">
                    <div className="rp-card-tags">
                      <span className="rp-type-tag">{typeLabel}</span>
                      {canPublish && <span className="rp-action-tag">Ready to Publish</span>}
                    </div>
                    <span className="status-badge draft" style={{ background: statusInfo.color, color: "#fff" }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <h3 className="rp-card-title">{proposal.title || "Untitled Proposal"}</h3>
                  <p className="rp-card-desc">{getProposalStatusLine(proposal)}</p>
                  <div className="rp-card-meta">
                    {proposal.targetDate && <span>Target: {formatDate(proposal.targetDate)}</span>}
                    {proposal.location && <span>{proposal.location}</span>}
                  </div>
                  <div className="rp-card-footer">
                    <button
                      className={`rp-review-btn${canPublish ? " rp-review-btn--primary" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProposal(proposal);
                      }}
                    >
                      {canPublish ? "Publish Event" : "View Details"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProposal && (
        <div
          className="student-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="student-modal student-proposal-modal">
            {(() => {
              const proposalLocked = hasSignatoryApproval(selectedProposal);
              const normalizedStatus = String(selectedProposal.status || "").toLowerCase();
              const isEditableStatus = normalizedStatus === "rejected" || normalizedStatus === "for_approval" || normalizedStatus === "for-approval";
              const canEditProposal = isEditableStatus && !proposalLocked;
              const canPublishProposal = canCurrentUserPublishProposal(selectedProposal, currentUser);
              const editUnavailableReason = proposalLocked
                ? PROPOSAL_LOCKED_NOTICE
                : "Editing is available only before the first signatory approval or when the proposal has been returned for revision.";

              if (editMode && canEditProposal) {
                return (
                  <>
                    <div className="student-proposal-modal-header">
                      <h3>{selectedProposal.projectType === "sl" ? "Service Learning Proposal" : "Community Engagement Proposal"}</h3>
                      <button onClick={closeModal} aria-label="Close proposal">x</button>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      <ProjectProposal
                        projectType={selectedProposal.projectType === "sl" ? "service-learning" : "community-engagement"}
                        editProposal={selectedProposal}
                        onClose={closeModal}
                        timelineNode={<ProposalTimeline proposal={selectedProposal} compact />}
                      />
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="student-proposal-modal-header">
                    <div>
                      <h3>{selectedProposal.projectType === "sl" ? "Service Learning Proposal" : "Community Engagement Proposal"}</h3>
                      <p>{selectedProposal.title || "Untitled Proposal"}</p>
                    </div>
                    <button onClick={closeModal} aria-label="Close proposal">x</button>
                  </div>

                  <div className="student-proposal-details">
                    {proposalLocked && (
                      <div className="student-proposal-lock-notice" role="status">
                        <strong>Proposal locked after first approval</strong>
                        <span>{PROPOSAL_LOCKED_NOTICE}</span>
                      </div>
                    )}

                    {normalizedStatus === "rejected" && selectedProposal.rejectionReason && (
                      <div className="student-proposal-rejection-notice">
                        <strong>Returned for revision{selectedProposal.rejectedByUser ? ` by ${selectedProposal.rejectedByUser}` : ""}</strong>
                        <span>{selectedProposal.rejectionReason}</span>
                      </div>
                    )}

                    <div className="student-proposal-actions">
                      <button
                        type="button"
                        className="student-proposal-edit-btn"
                        disabled={!canEditProposal}
                        title={!canEditProposal ? editUnavailableReason : "Edit proposal"}
                        onClick={() => setEditMode(true)}
                      >
                        Edit Proposal
                      </button>
                      {canPublishProposal && (
                        <button
                          type="button"
                          className="student-proposal-publish-btn"
                          disabled={publishingProposalId === selectedProposal.id}
                          onClick={() => handlePublish(selectedProposal)}
                        >
                          {publishingProposalId === selectedProposal.id ? "Publishing..." : "Publish Event"}
                        </button>
                      )}
                      {!canEditProposal && (
                        <p className="student-proposal-edit-helper">{editUnavailableReason}</p>
                      )}
                    </div>

                    <div className="student-proposal-detail-grid">
                      <section><h4>Status</h4><p>{getProposalStatusLine(selectedProposal)}</p></section>
                      <section><h4>Target Date</h4><p>{formatDate(selectedProposal.targetDate)}</p></section>
                      <section><h4>Location</h4><p>{selectedProposal.location || "N/A"}</p></section>
                      <section><h4>Volunteer Hours</h4><p>{selectedProposal.volunteerHours || "N/A"}</p></section>
                    </div>
                    <section className="student-proposal-detail-section"><h4>Description</h4><p>{selectedProposal.description || "N/A"}</p></section>
                    <section className="student-proposal-detail-section"><h4>Objectives</h4><p>{selectedProposal.objectives || "N/A"}</p></section>
                    <section className="student-proposal-detail-section"><h4>Stakeholders</h4>{renderList(selectedProposal.stakeholders)}</section>
                    <section className="student-proposal-detail-section"><h4>Specific Activities</h4>{renderList(selectedProposal.specificActivities)}</section>
                    <section className="student-proposal-detail-section"><h4>Approval Progress</h4><ProposalTimeline proposal={selectedProposal} compact /></section>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
