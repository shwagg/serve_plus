import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../../components/Header";
import ReviewModal from "./ReviewModal";
import "../../../styles/ReviewProposal.css";

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

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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

  // Derived filtered data (better than storing duplicate state)
  const filteredProposals = useMemo(() => {
    let data = [...proposals];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(p =>
        (p.title || "").toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "overall") {
      data = data.filter(
        p => (p.status || "").toLowerCase() === statusFilter
      );
    }

    return data;
  }, [proposals, searchTerm, statusFilter]);

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
