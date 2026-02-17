import React, { useEffect, useMemo, useState, useContext } from "react";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../../components/Header";
import ReviewModal from "./ReviewModal";
import "../../../styles/ReviewProposal.css";
import { SessionContext } from "../../../context/SessionContext";

export default function ReviewProposal() {
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

  const filteredProposals = useMemo(() => {
    let data = [...proposals];
    if (userApprovalField) {
      data = data.filter(p => {
        if (userApprovalField === "reviewedBy") {
          // Show proposals that are not yet reviewed (for approval), and also those already reviewed (pending)
          // Pending: reviewedBy is filled, recommendedBy, endorsedBy, approvedBy are empty, status is not published/completed
          const isForApproval = !p.reviewedBy && !p.recommendedBy && !p.endorsedBy && !p.approvedBy && (!p.status || (p.status !== "published" && p.status !== "completed"));
          const isPending = typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && (!p.recommendedBy || p.recommendedBy.trim() === "") && (!p.endorsedBy || p.endorsedBy.trim() === "") && (!p.approvedBy || p.approvedBy.trim() === "") && (!p.status || (p.status !== "published" && p.status !== "completed"));
          return isForApproval || isPending;
        }
        if (userApprovalField === "recommendedBy") {
          return typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && (!p.recommendedBy || p.recommendedBy.trim() === "") && (!p.endorsedBy || p.endorsedBy.trim() === "") && (!p.approvedBy || p.approvedBy.trim() === "") && (!p.status || (p.status !== "published" && p.status !== "completed"));
        }
        if (userApprovalField === "endorsedBy") {
          return typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && typeof p.recommendedBy === "string" && p.recommendedBy.trim() !== "" && (!p.endorsedBy || p.endorsedBy.trim() === "") && (!p.approvedBy || p.approvedBy.trim() === "") && (!p.status || (p.status !== "published" && p.status !== "completed"));
        }
        if (userApprovalField === "approvedBy") {
          return typeof p.reviewedBy === "string" && p.reviewedBy.trim() !== "" && typeof p.recommendedBy === "string" && p.recommendedBy.trim() !== "" && typeof p.endorsedBy === "string" && p.endorsedBy.trim() !== "" && (!p.approvedBy || p.approvedBy.trim() === "") && (!p.status || (p.status !== "published" && p.status !== "completed"));
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
  }, [proposals, searchTerm, statusFilter, userApprovalField]);

  // Debug logs for troubleshooting
  console.log("[DEBUG] userData:", userData);
  console.log("[DEBUG] userData keys:", Object.keys(userData));
  console.log("[DEBUG] positionField:", userData.position, userData.positions, userData.Position, userData.Positions);
  console.log("[DEBUG] normalizedPositions:", normalizedPositions);
  console.log("[DEBUG] userApprovalField:", userApprovalField);
  console.log("[DEBUG] proposals:", proposals);
  console.log("[DEBUG] filteredProposals:", filteredProposals);

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
    if (s === "pending") return "For Approval";
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

  return (
    <>
      <Header />
      <div className="review-proposal-container">
        <div className="review-proposal-wrapper">
          <div className="review-proposal-header">
            <h1 className="review-proposal-title">Review Proposals</h1>
            <div className="status-filters">
              {["overall","for-approval","pending","draft","published","completed"].map(filter => (
                <label key={filter} className="filter-label">
                  <input
                    type="radio"
                    name="status"
                    checked={statusFilter === filter}
                    onChange={() => setStatusFilter(filter)}
                    className={`filter-${filter.replace('_', '-')}`}
                  />
                  <span>{filter === "for-approval" ? "For Approval" : filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="search-filter-row">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search proposals by title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          <hr className="review-proposal-divider" />
          <div className="table-container">
            {loading && <div className="loading-message">Loading proposals...</div>}
            {error && <div className="error-message">{error}</div>}
            {!loading && !error && (
              <table className="review-proposal-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Title</th>
                    <th className="text-left description-header">Description</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="no-proposals-message">
                        No proposals found
                      </td>
                    </tr>
                  ) : (
                    filteredProposals.map((proposal, index) => (
                      <tr key={proposal.id}>
                        <td className="row-number">{index + 1}</td>
                        <td className="proposal-title">
                          <button 
                            className="title-link"
                            onClick={() => handleOpenModal(proposal)}
                          >
                            {proposal.title || "N/A"}
                          </button>
                        </td>
                        <td className="proposal-description">
                          {proposal.description 
                            ? (proposal.description.length > 150 
                                ? proposal.description.substring(0, 150) + "..." 
                                : proposal.description)
                            : "No description"}
                        </td>
                        <td className="text-center">
                          <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                            {formatStatus(proposal.status) || "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {/* Proposal Summary Modal */}
      {showModal && <ReviewModal proposal={selectedProposal} onClose={handleCloseModal} onApprovalChange={handleApprovalChange} />}
    </>
  );
}
