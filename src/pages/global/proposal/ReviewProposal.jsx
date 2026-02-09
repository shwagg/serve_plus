import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../../components/Header";
import "../../../styles/ReviewProposal.css";

export default function ReviewProposal() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("overall");

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "proposals"));

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

  const formatDate = (value) => {
    if (!value) return "N/A";
    try {
      if (value?.toDate) return value.toDate().toLocaleDateString();
      return new Date(value).toLocaleDateString();
    } catch {
      return "N/A";
    }
  };

  const getStatusBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";
    return "pending";
  };

  return (
    <>
      <Header />

      <div className="review-proposal-container">
        <div className="review-proposal-wrapper">

          <div className="review-proposal-header">
            <h1 className="review-proposal-title">Review Proposals</h1>

            <div className="status-filters">
              {["overall","pending","approved","rejected"].map(filter => (
                <label key={filter} className="filter-label">
                  <input
                    type="radio"
                    name="status"
                    checked={statusFilter === filter}
                    onChange={() => setStatusFilter(filter)}
                  />
                  <span>{filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
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
                    <th className="text-center">Target Date</th>
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
                        <td className="proposal-title">{proposal.title || "N/A"}</td>
                        <td className="text-center">
                          {formatDate(proposal.targetDate)}
                        </td>
                        <td className="text-center">
                          <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                            {proposal.status || "Pending"}
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
    </>
  );
}
