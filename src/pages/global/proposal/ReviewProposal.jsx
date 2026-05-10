import React, { useEffect, useMemo, useState, useContext } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../../components/Header";
import ReviewModal from "./ReviewModal";
import "../../../styles/ReviewProposal.css";
import { SessionContext } from "../../../context/SessionContext";

export default function ReviewProposal() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin/") || location.pathname.startsWith("/faculty/");
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("overall");
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "missions"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProposals(data);
    } catch (err) {
      console.error("Firestore error:", err);
      setError("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  // Get current user info from context
  const { userData: contextUserData } = useContext(SessionContext);
  const userData = contextUserData || {};
  const role = userData?.role || userData?.userRole || userData?.Role || "";
  const positionField = userData?.position || userData?.positions || userData?.Position || userData?.Positions || "";
  const userPositions = Array.isArray(positionField) ? positionField : positionField ? [positionField] : [];
  const normalizedPositions = userPositions.map(p => String(p).toLowerCase().trim().replace(/\s+/g, " ")).filter(p => p.length > 0);
  const isPartner = role.toLowerCase() === "partner";

  function getUserApprovalField() {
    if (role.toLowerCase() === "faculty") {
      if (normalizedPositions.includes("program chair") || normalizedPositions.includes("cluster head")) return "reviewedBy";
      if (normalizedPositions.includes("college dean")) return "recommendedBy";
    }
    if (role.toLowerCase() === "admin") {
      if (normalizedPositions.includes("regular")) return "endorsedBy";
      if (normalizedPositions.includes("director")) return "approvedBy";
    }
    return null;
  }
  const userApprovalField = getUserApprovalField();

  // Helper: context-aware status label for each row
  function getContextStatusLabel(proposal) {
    // Determine which step this user is on
    if (userApprovalField === "reviewedBy") {
      if (!proposal.reviewedBy) return "For Approval";
      if (proposal.reviewedBy && !proposal.recommendedBy && !proposal.endorsedBy && !proposal.approvedBy) return "Pending";
    }
    if (userApprovalField === "recommendedBy") {
      if (proposal.reviewedBy && !proposal.recommendedBy) return "For Approval";
      if (proposal.reviewedBy && proposal.recommendedBy && !proposal.endorsedBy && !proposal.approvedBy) return "Pending";
    }
    if (userApprovalField === "endorsedBy") {
      if (proposal.reviewedBy && proposal.recommendedBy && !proposal.endorsedBy) return "For Approval";
      if (proposal.reviewedBy && proposal.recommendedBy && proposal.endorsedBy && !proposal.approvedBy) return "Pending";
    }
    if (userApprovalField === "approvedBy") {
      if (proposal.reviewedBy && proposal.recommendedBy && proposal.endorsedBy && !proposal.approvedBy) return "For Approval";
    }
    // Fallback to default
    return formatStatus(proposal.status);
  }

  const filteredProposals = useMemo(() => {
    let data = [...proposals];
    if (isPartner) {
      // Only show proposals where partnerSchool matches this partner's name
      const partnerName = userData?.name || userData?.displayName || "";
      data = data.filter(p => (p.partnerSchool || "").toLowerCase() === partnerName.toLowerCase());
    } else if (userApprovalField) {
      data = data.filter(p => {
        const status = (p.status || "").toLowerCase();
        // Always show drafts and published in overall/draft/published filters for all roles
        if (statusFilter === "overall" || statusFilter === "draft" || statusFilter === "published") {
          if (status === "draft" || status === "published") return true;
        }
        if (userApprovalField === "reviewedBy") {
          // Only show proposals designated for this specific Program Chair
          const userName = userData?.name || "";
          const isDesignated = !p.selectedReviewedBy || p.selectedReviewedBy === userName;
          const isForApproval = isDesignated && !p.reviewedBy && !p.recommendedBy && !p.endorsedBy && !p.approvedBy && (!status || (status !== "published" && status !== "completed"));
          const isPending = isDesignated && typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && (!status || (status !== "published" && status !== "completed"));
          return isForApproval || isPending;
        }
        if (userApprovalField === "recommendedBy") {
          // Only show proposals designated for this specific College Dean
          const userName = userData?.name || "";
          const isDesignated = !p.selectedRecommendedBy || p.selectedRecommendedBy === userName;
          const isForApproval = isDesignated && typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && (!p.recommendedBy || p.recommendedBy.trim() === "") && (!p.endorsedBy || p.endorsedBy.trim() === "") && (!p.approvedBy || p.approvedBy.trim() === "") && (!status || (status !== "published" && status !== "completed"));
          const isPending = isDesignated && typeof p.recommendedBy === "string" && p.recommendedBy.trim() !== "" && (!status || (status !== "published" && status !== "completed"));
          return isForApproval || isPending;
        }
        if (userApprovalField === "endorsedBy") {
          // Show if not published/completed and this user is/was the endorser
          const isForApproval = typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && typeof p.recommendedBy === "string" && p.recommendedBy.trim() !== "" && (!p.endorsedBy || p.endorsedBy.trim() === "") && (!p.approvedBy || p.approvedBy.trim() === "") && (!status || (status !== "published" && status !== "completed"));
          const isPending = typeof p.endorsedBy === "string" && p.endorsedBy.trim() !== "" && (!status || (status !== "published" && status !== "completed"));
          return isForApproval || isPending;
        }
        if (userApprovalField === "approvedBy") {
          return typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && typeof p.recommendedBy === "string" && p.recommendedBy.trim() !== "" && typeof p.endorsedBy === "string" && p.endorsedBy.trim() !== "" && (!p.approvedBy || p.approvedBy.trim() === "") && (!status || (status !== "published" && status !== "completed"));
        }
        return false;
      });
    } else {
      data = [];
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(p => (p.title || "").toLowerCase().includes(term));
    }
    if (statusFilter !== "overall") {
      data = data.filter(p => (p.status || "").toLowerCase() === statusFilter);
    }
    return data;
  }, [proposals, searchTerm, statusFilter, userApprovalField, isPartner, userData]);

  const getStatusBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "for_approval" || s === "for-approval") return "pending";
    if (s === "draft") return "draft";
    if (s === "pending") return "pending";
    if (s === "published") return "published";
    if (s === "completed") return "completed";
    return "draft";
  };

  const formatStatus = (status = "") => {
    if (!status) return "Draft";
    const s = status.toLowerCase();
    if (s === "for_approval" || s === "for-approval") return "For Approval";
    if (s === "pending") return "Pending";
    if (s === "draft") return "Ready for Publishing";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleOpenModal = (proposal) => {
    setSelectedProposal(proposal);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProposal(null);
  };

  const handleApprovalChange = () => {
    fetchProposals();
  };

  const actionableCount = filteredProposals.filter(p => getContextStatusLabel(p) === "For Approval").length;

  const filterLabels = {
    "overall": "All",
    "for-approval": "For Approval",
    "pending": "Pending",
    "draft": "Ready for Publishing",
    "published": "Published",
    "completed": "Completed",
  };

  const filterColors = {
    "overall":      { active: "#1f3b73", bg: "#e8edf7" },
    "for-approval": { active: "#92400e", bg: "#fef3c7" },
    "pending":      { active: "#9a3412", bg: "#ffedd5" },
    "draft":        { active: "#475569", bg: "#f1f5f9" },
    "published":    { active: "#166534", bg: "#dcfce7" },
    "completed":    { active: "#1e40af", bg: "#dbeafe" },
  };

  return (
    <>
      {!isAdminRoute && <Header />}
      <div className={`review-proposal-container${isAdminRoute ? " rp-admin" : ""}`}>
        <div className="review-proposal-wrapper">

          {/* Breadcrumb */}
          <nav className="rp-breadcrumb" aria-label="breadcrumb">
            <span className="rp-breadcrumb-item">Admin</span>
            <span className="rp-breadcrumb-sep">›</span>
            <span className="rp-breadcrumb-item rp-breadcrumb-current">Review Proposals</span>
          </nav>

          {/* Page header */}
          <div className="rp-page-header">
            <div>
              <h1 className="review-proposal-title">Review Proposals</h1>
              {actionableCount > 0 && (
                <p className="rp-action-hint">
                  {actionableCount} proposal{actionableCount !== 1 ? "s" : ""} awaiting your approval
                </p>
              )}
            </div>
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search by title…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Pill filter tabs */}
          <div className="rp-filter-tabs">
            {Object.keys(filterLabels).map(f => {
              const isActive = statusFilter === f;
              const col = filterColors[f];
              return (
                <button
                  key={f}
                  className={`rp-filter-tab${isActive ? " active" : ""}`}
                  style={isActive ? { background: col.bg, color: col.active, borderColor: col.active } : {}}
                  onClick={() => setStatusFilter(f)}
                >
                  {filterLabels[f]}
                </button>
              );
            })}
          </div>

          {/* Cards */}
          {loading && <div className="loading-message">Loading proposals…</div>}
          {error && <div className="error-message">{error}</div>}
          {!loading && !error && (
            filteredProposals.length === 0 ? (
              <div className="rp-empty">
                <div className="rp-empty-icon">📋</div>
                <p>No proposals found</p>
              </div>
            ) : (
              <div className="rp-card-grid">
                {filteredProposals.map(proposal => {
                  const contextStatus = getContextStatusLabel(proposal);
                  const needsAction = contextStatus === "For Approval";
                  const typeLabel = proposal.projectType === "sl"
                    ? "Service Learning"
                    : proposal.projectType === "ce"
                    ? "Community Engagement"
                    : proposal.projectType || "Proposal";

                  return (
                    <div
                      key={proposal.id}
                      className={`rp-card${needsAction ? " rp-card--action" : ""}`}
                      onClick={() => handleOpenModal(proposal)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => (e.key === "Enter" || e.key === " ") && handleOpenModal(proposal)}
                    >
                      <div className="rp-card-top">
                        <div className="rp-card-tags">
                          <span className="rp-type-tag">{typeLabel}</span>
                          {needsAction && <span className="rp-action-tag">Needs Approval</span>}
                        </div>
                        <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                          {contextStatus}
                        </span>
                      </div>

                      <h3 className="rp-card-title">{proposal.title || "Untitled Proposal"}</h3>

                      {proposal.description && (
                        <p className="rp-card-desc">
                          {proposal.description.length > 110
                            ? proposal.description.slice(0, 110) + "…"
                            : proposal.description}
                        </p>
                      )}

                      <div className="rp-card-meta">
                        {proposal.preparedBy && <span>By {proposal.preparedBy}</span>}
                        {proposal.targetDate && <span>Target: {proposal.targetDate}</span>}
                      </div>

                      <div className="rp-card-footer">
                        <button
                          className={`rp-review-btn${needsAction ? " rp-review-btn--primary" : ""}`}
                          onClick={e => { e.stopPropagation(); handleOpenModal(proposal); }}
                        >
                          {needsAction ? "Review & Approve →" : "View Details →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
      {showModal && (
        <ReviewModal
          proposal={selectedProposal}
          onClose={handleCloseModal}
          onApprovalChange={handleApprovalChange}
          isPartner={isPartner}
        />
      )}
    </>
  );
}
