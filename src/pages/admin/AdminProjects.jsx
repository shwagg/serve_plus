import { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { showToast, showConfirm } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";
import ProjectDetailSidebar from "./ProjectDetailSidebar";
import "../../styles/ReviewProposal.css";
import "../../styles/AdminProjects.css";
import { SessionContext } from "../../context/sessionContextCore";

const FILTER_OPTIONS = [
  { key: "all",         label: "All Projects" },
  { key: "for_approval", label: "For Approval" },
  { key: "draft",       label: "Approved" },
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

  const approvedList = useMemo(
    () => (statusFilter === "all" ? filtered.filter(p => (p.status || "").toLowerCase() === "draft") : []),
    [filtered, statusFilter]
  );

  const otherList = useMemo(
    () => sortByDate(
      statusFilter === "all"
        ? filtered.filter(p =>
            !isForApproval(p.status) &&
            (p.status || "").toLowerCase() !== "draft" &&
            (p.status || "").toLowerCase() !== "published"
          )
        : filtered
    ),
    [filtered, statusFilter]
  );

  const archivedFromAll = useMemo(() => {
    if (statusFilter !== "all") return [];
    return projects.filter(p => {
      if ((p.status || "").toLowerCase() !== "archived") return false;
      if (searchTerm.trim()) return (p.title || "").toLowerCase().includes(searchTerm.toLowerCase());
      return true;
    });
  }, [projects, statusFilter, searchTerm]);

  const publishedSectionList = useMemo(
    () => statusFilter === "all"
      ? sortByDate([
          ...filtered.filter(p => (p.status || "").toLowerCase() === "published"),
          ...archivedFromAll,
        ])
      : [],
    [filtered, archivedFromAll, statusFilter]
  );

  function getStatusBadgeClass(status = "") {
    const s = status.toLowerCase();
    if (isForApproval(s)) return "pending";
    if (s === "draft") return "draft";
    if (s === "rejected") return "rejected";
    if (s === "published") return "published";
    if (s === "completed") return "completed";
    if (s === "archived") return "archived";
    return "draft";
  }

  function formatStatus(status = "") {
    if (!status) return "Ready for Publishing";
    if (status.toLowerCase() === "draft") return "Approved";
    if (status.toLowerCase() === "rejected") return "Returned for Revision";
    if (isForApproval(status)) return "Pending";
    if (status.toLowerCase() === "published") return "Active · Open";
    if (status.toLowerCase() === "archived") return "Archived";
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
        <div className="rp-card-footer">
          <button
            className={`rp-review-btn${needsAction ? " rp-review-btn--primary" : ""}`}
            onClick={e => { e.stopPropagation(); openSidebar(project); }}
          >
            {needsAction ? "Review & Approve →" : "View Details →"}
          </button>
          {project.status === "completed" && role === "admin" && (
            <button
              className="rp-review-btn rp-btn-archive"
              onClick={e => handleArchive(e, project)}
            >
              📦 Archive
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentLabel = FILTER_OPTIONS.find(f => f.key === statusFilter)?.label ?? "All Projects";
  const isEmpty = forApprovalList.length === 0 && approvedList.length === 0 && publishedSectionList.length === 0 && otherList.length === 0;

  return (
    <div className="admin-projects-page">
      {/* ── Header ── */}
      <div className="ap-header">
        <h1 className="page-title">Project Proposals</h1>
        <div className="ap-controls">
          <div className="search-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5"/>
              <path d="M10.5 10.5L13.5 13.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search proposals..."
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
                <button
                  className="ap-dropdown-item ap-dropdown-item--create"
                  onClick={() => { setDropdownOpen(false); navigate("/admin/projects/new"); }}
                >
                  + Add Project
                </button>
                <div className="ap-dropdown-divider" />
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
                  <span className="ap-section-heading">Pending Approvals</span>
                  <div className="rp-card-grid">
                    {forApprovalList.map(renderCard)}
                  </div>
                </div>
              )}

              {/* Approved section (only in "All Projects" view) */}
              {statusFilter === "all" && approvedList.length > 0 && (
                <div className="ap-section">
                  <span className="ap-section-heading">Approved</span>
                  <div className="rp-card-grid">
                    {approvedList.map(renderCard)}
                  </div>
                </div>
              )}

              {/* Published Proposals — active (published) + archived */}
              {statusFilter === "all" && publishedSectionList.length > 0 && (
                <div className="ap-section">
                  <span className="ap-section-heading">Published Proposals</span>
                  <div className="rp-card-grid">
                    {publishedSectionList.map(renderCard)}
                  </div>
                </div>
              )}

              {/* Completed / other projects */}
              {otherList.length > 0 && (
                <div className="ap-section">
                  {statusFilter === "all" && (
                    <span className="ap-section-heading">Completed Projects</span>
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

    </div>
  );
}
