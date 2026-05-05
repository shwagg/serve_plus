import { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { showToast, showConfirm } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";
import ProjectDetailSidebar from "./ProjectDetailSidebar";
import ProjectProposal from "../global/proposal/ProjectProposal";
import "../../styles/ReviewProposal.css";
import { SessionContext } from "../../context/SessionContext";

const FILTER_OPTIONS = [
  { key: "all",         label: "All Projects" },
  { key: "for_approval", label: "For Approval" },
  { key: "draft",       label: "Draft" },
  { key: "published",   label: "Published" },
  { key: "completed",   label: "Completed" },
  { key: "archived",    label: "Archived" },
];

function isForApproval(status = "") {
  const s = status.toLowerCase();
  return s === "for_approval" || s === "for-approval" || s === "pending";
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function sortByDate(list) {
  return [...list].sort((a, b) => {
    const da = parseDate(a.targetDate);
    const db = parseDate(b.targetDate);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

export default function AdminProjects() {
  const navigate = useNavigate();
  const { userData } = useContext(SessionContext);
  const role = (userData?.role || "").toLowerCase();
  const positionField = userData?.position || userData?.positions || "";
  const userPositions = Array.isArray(positionField)
    ? positionField
    : positionField ? [positionField] : [];
  const normalizedPositions = userPositions.map(p =>
    String(p).toLowerCase().trim().replace(/\s+/g, " ")
  );

  function getUserApprovalField() {
    if (role === "admin") {
      if (normalizedPositions.includes("regular")) return "endorsedBy";
      if (normalizedPositions.includes("director")) return "approvedBy";
    }
    return null;
  }
  const userApprovalField = getUserApprovalField();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const dropdownRef = useRef(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "missions"));
      setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function needsMyAction(p) {
    if (!userApprovalField) return false;
    if (userApprovalField === "endorsedBy") {
      return !!(p.reviewedBy && p.recommendedBy && !p.endorsedBy && !p.approvedBy);
    }
    if (userApprovalField === "approvedBy") {
      return !!(p.reviewedBy && p.recommendedBy && p.endorsedBy && !p.approvedBy);
    }
    return false;
  }

  const filtered = useMemo(() => {
    let data = [...projects];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(p => (p.title || "").toLowerCase().includes(term));
    }
    if (statusFilter !== "all") {
      data = data.filter(p => {
        const s = (p.status || "").toLowerCase();
        if (statusFilter === "for_approval") return isForApproval(s);
        return s === statusFilter;
      });
    } else {
      data = data.filter(p => (p.status || "").toLowerCase() !== "archived");
    }
    return data;
  }, [projects, searchTerm, statusFilter]);

  const forApprovalList = useMemo(
    () => (statusFilter === "all" ? filtered.filter(p => isForApproval(p.status)) : []),
    [filtered, statusFilter]
  );

  const otherList = useMemo(
    () => sortByDate(
      statusFilter === "all"
        ? filtered.filter(p => !isForApproval(p.status))
        : filtered
    ),
    [filtered, statusFilter]
  );

  function getStatusBadgeClass(status = "") {
    const s = status.toLowerCase();
    if (isForApproval(s)) return "pending";
    if (s === "draft") return "draft";
    if (s === "published") return "published";
    if (s === "completed") return "completed";
    if (s === "archived") return "archived";
    return "draft";
  }

  function formatStatus(status = "") {
    if (!status) return "Draft";
    if (isForApproval(status)) return "For Approval";
    if (status === "archived") return "Archived";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function typeLabel(p) {
    if (p.projectType === "sl") return "Service Learning";
    if (p.projectType === "ce") return "Community Engagement";
    return p.projectType || "Proposal";
  }

  function openSidebar(project) {
    setSelectedProject(project);
    setShowSidebar(true);
  }

  const handlePublish = async (e, project) => {
    e.stopPropagation();
    if (!await showConfirm(`Publish "${project.title}"? Volunteers will be able to join the event.`)) return;
    try {
      await updateDoc(doc(db, "missions", project.id), {
        status: "published",
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      logAudit({
        action: "PROPOSAL_PUBLISHED",
        category: "proposal",
        actorName: userData?.name || "",
        details: { proposalId: project.id, proposalTitle: project.title || "" },
      });
      showToast("Event published.");
      fetchProjects();
    } catch {
      showToast("Failed to publish. Try again.");
    }
  };

  const handleDelete = async (e, project) => {
    e.stopPropagation();
    if (!await showConfirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "missions", project.id));
      logAudit({
        action: "PROPOSAL_DELETED",
        category: "proposal",
        actorName: userData?.name || "",
        details: { proposalTitle: project.title || "" },
      });
      showToast("Proposal deleted.");
      fetchProjects();
    } catch {
      showToast("Failed to delete. Try again.");
    }
  };

  const handleArchive = async (e, project) => {
    e.stopPropagation();
    if (!await showConfirm(`Archive "${project.title}"? It will be moved to the Archived list.`)) return;
    try {
      await updateDoc(doc(db, "missions", project.id), {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      logAudit({
        action: "PROPOSAL_ARCHIVED",
        category: "proposal",
        actorName: userData?.name || "",
        details: { proposalId: project.id, proposalTitle: project.title || "" },
      });
      showToast("Proposal archived.");
      fetchProjects();
    } catch {
      showToast("Failed to archive. Try again.");
    }
  };

  function renderCard(project) {
    const needsAction = needsMyAction(project);
    return (
      <div
        key={project.id}
        className={`rp-card${needsAction ? " rp-card--action" : ""}`}
        onClick={() => openSidebar(project)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && openSidebar(project)}
      >
        <div className="rp-card-top">
          <div className="rp-card-tags">
            <span className="rp-type-tag">{typeLabel(project)}</span>
            {needsAction && <span className="rp-action-tag">Needs Approval</span>}
          </div>
          <span className={`status-badge ${getStatusBadgeClass(project.status)}`}>
            {formatStatus(project.status)}
          </span>
        </div>
        <h3 className="rp-card-title">{project.title || "Untitled Project"}</h3>
        {project.description && (
          <p className="rp-card-desc">
            {project.description.length > 110
              ? project.description.slice(0, 110) + "…"
              : project.description}
          </p>
        )}
        <div className="rp-card-meta">
          {project.preparedBy && <span>By {project.preparedBy}</span>}
          {project.targetDate && <span>Target: {project.targetDate}</span>}
        </div>
        <div className="rp-card-footer" style={{ flexWrap: "wrap", gap: 6 }}>
          <button
            className={`rp-review-btn${needsAction ? " rp-review-btn--primary" : ""}`}
            onClick={e => { e.stopPropagation(); openSidebar(project); }}
          >
            {needsAction ? "Review & Approve →" : "View Details →"}
          </button>
          {project.status === "draft" && role === "admin" && (
            <button
              className="rp-review-btn rp-review-btn--edit"
              onClick={e => { e.stopPropagation(); setEditProject(project); setShowEditModal(true); }}
            >
              Edit →
            </button>
          )}
          {project.status === "draft" && role === "admin" && (
            <button
              className="rp-review-btn"
              onClick={e => handlePublish(e, project)}
              style={{ background: "#15803d", color: "#fff", borderColor: "transparent" }}
            >
              ✓ Publish
            </button>
          )}
          {project.status === "draft" && role === "admin" && (
            <button
              className="rp-review-btn"
              onClick={e => handleDelete(e, project)}
              style={{ background: "#dc2626", color: "#fff", borderColor: "transparent" }}
            >
              🗑 Delete
            </button>
          )}
          {project.status === "completed" && role === "admin" && (
            <button
              className="rp-review-btn"
              onClick={e => handleArchive(e, project)}
              style={{ background: "#6b7280", color: "#fff", borderColor: "transparent" }}
            >
              📦 Archive
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentLabel = FILTER_OPTIONS.find(f => f.key === statusFilter)?.label ?? "All Projects";
  const isEmpty = forApprovalList.length === 0 && otherList.length === 0;

  return (
    <div className="admin-projects-page">
      {/* ── Header ── */}
      <div className="ap-header">
        <h1 className="page-title">Project Proposals</h1>
        <div className="ap-controls">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search here..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Split-style filter button */}
          <div className="ap-filter-wrap" ref={dropdownRef}>
            <div className="ap-split-btn">
              <span className="ap-split-label">{currentLabel}</span>
              <button
                className="ap-split-arrow"
                onClick={() => setDropdownOpen(prev => !prev)}
                aria-label="Filter options"
              >
                ▾
              </button>
            </div>
            {dropdownOpen && (
              <div className="ap-dropdown">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    className={`ap-dropdown-item${statusFilter === opt.key ? " active" : ""}`}
                    onClick={() => { setStatusFilter(opt.key); setDropdownOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <hr className="ap-divider" />

      {/* ── Content ── */}
      {loading && <div className="loading-message">Loading projects…</div>}
      {error   && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <>
          {isEmpty ? (
            <div className="rp-empty">
              <div className="rp-empty-icon">📋</div>
              <p>No projects found</p>
            </div>
          ) : (
            <>
              {/* For Approval section (only in "All Projects" view) */}
              {statusFilter === "all" && forApprovalList.length > 0 && (
                <div className="ap-section">
                  <span className="ap-section-heading">For Approval</span>
                  <div className="rp-card-grid">
                    {forApprovalList.map(renderCard)}
                  </div>
                </div>
              )}

              {/* Remaining / filtered projects */}
              {otherList.length > 0 && (
                <div className="ap-section">
                  {statusFilter === "all" && (
                    <span className="ap-section-heading">Other Projects</span>
                  )}
                  <div className="rp-card-grid">
                    {otherList.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showSidebar && selectedProject && (
        <ProjectDetailSidebar
          project={selectedProject}
          onClose={() => { setShowSidebar(false); setSelectedProject(null); }}
          onApprovalChange={fetchProjects}
        />
      )}

      {showEditModal && editProject && (() => {
        const allSigned = !!(editProject.reviewedBy && editProject.recommendedBy && editProject.endorsedBy && editProject.approvedBy);
        const canEditForm = role === "admin";
        return (
          <div
            onClick={() => { setShowEditModal(false); setEditProject(null); }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
              zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 18, width: "min(700px, 95vw)",
                maxHeight: "90vh", display: "flex", flexDirection: "column",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
              }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {editProject.projectType === "sl" ? "📝 Service Learning Proposal" : "📝 Community Engagement Proposal"}
                </h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditProject(null); }}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}
                >✕</button>
              </div>
              {allSigned && !canEditForm ? (
                <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 8 }}>
                    Editing Locked
                  </div>
                  <p style={{ margin: 0, fontSize: "0.88rem" }}>
                    All signatories have approved this proposal. Only an admin can make changes at this stage.
                  </p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {allSigned && (
                    <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "10px 20px", fontSize: "0.82rem", color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⚠️</span>
                      <span>All signatories have approved — changes here are admin-only edits before publishing.</span>
                    </div>
                  )}
                  <ProjectProposal
                    projectType={editProject.projectType === "sl" ? "service-learning" : "community-engagement"}
                    editProposal={editProject}
                    onClose={() => { setShowEditModal(false); setEditProject(null); fetchProjects(); }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
