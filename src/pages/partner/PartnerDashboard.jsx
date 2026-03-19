import "../../styles/partnerDashboard.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db, auth } from "../../firebaseConfig";
import {
  collection, getDocs, doc, getDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle, FaHourglassHalf,
  FaListAlt, FaClock, FaLeaf, FaChartBar,
  FaSearch, FaChevronDown, FaFileAlt,
} from "react-icons/fa";

const SDG_SEGMENT_COLORS = ['#14b8a6', '#3b82f6', '#22c55e', '#f97316', '#a855f7'];
const SDG_OTHERS_COLOR = '#cbd5e1';

const SDG_LABELS = {
  1: "No Poverty", 2: "Zero Hunger", 3: "Good Health", 4: "Quality Education",
  5: "Gender Equality", 6: "Clean Water", 7: "Clean Energy", 8: "Decent Work",
  9: "Industry & Innovation", 10: "Reduced Inequalities", 11: "Sustainable Cities",
  12: "Responsible Consumption", 13: "Climate Action", 14: "Life Below Water",
  15: "Life on Land", 16: "Peace & Justice", 17: "Partnerships",
};


export default function PartnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;

  const [partnerName, setPartnerName] = useState("");
  const [partnerSchool, setPartnerSchool] = useState("");
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  // reviewState: { [missionId]: { action: 'approve'|'reject', comment: '' } }
  const [reviewState, setReviewState] = useState({});
  // Project list filter
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sdgExpanded, setSdgExpanded] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(false);

  const sectionRefs = useRef({});

  // Fetch partner info
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPartnerName(data.organizationName || data.name || data.username || "Partner");
        setPartnerSchool(data.organizationName || data.name || "");
        setUserName(data.name || data.username || "");
        setUserAvatar(data.photoURL || data.avatar || data.profilePic || "");
      }
    });
  }, []);

  // Fetch missions
  useEffect(() => {
    setLoading(true);
    getDocs(collection(db, "missions")).then((snap) => {
      setMissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // ── Derived data ────────────────────────────────────────
  const myMissions = missions.filter((m) => {
    if (partnerSchool && m.partnerSchool === partnerSchool) return true;
    if (user?.uid && m.approvals?.partner?.decidedBy === user.uid) return true;
    return false;
  });

  const pendingApproval = myMissions.filter(
    (m) => m.status === "for_approval" && !m.approvals?.partner?.approved
  );
  const activeMissions = myMissions.filter((m) => m.status === "published");
  const completedMissions = myMissions.filter((m) => m.status === "completed");

  const sdgCounts = {};
  myMissions.forEach((m) => {
    (m.sdg || m.sdgs || []).forEach((s) => { sdgCounts[s] = (sdgCounts[s] || 0) + 1; });
  });
  const allSdgs = Object.entries(sdgCounts).sort((a, b) => b[1] - a[1]);
  const topSdgs = allSdgs.slice(0, 5);
  const slCount = myMissions.filter((m) => m.projectType === "sl").length;
  const ceCount = myMissions.filter((m) => m.projectType === "ce").length;

  const baseProjects =
    projectFilter === "active" ? activeMissions
    : projectFilter === "completed" ? completedMissions
    : [...activeMissions, ...completedMissions, ...myMissions.filter(
        (m) => !["published", "completed"].includes(m.status)
      )];

  const searchTerm = search.trim().toLowerCase();

  const filteredProjects = searchTerm
    ? baseProjects.filter((m) =>
        (m.title || "").toLowerCase().includes(searchTerm) ||
        (m.location || "").toLowerCase().includes(searchTerm)
      )
    : baseProjects;

  const filteredReviews = searchTerm
    ? pendingApproval.filter((m) =>
        (m.title || "").toLowerCase().includes(searchTerm)
      )
    : pendingApproval;

  // Expand review section when there are pending items; collapse when empty
  useEffect(() => {
    setReviewExpanded(pendingApproval.length > 0);
  }, [pendingApproval.length]);

  // Handle menu navigation state: expand+scroll to review, or scroll to top for dashboard
  useEffect(() => {
    if (location.state?.expandSection === "review") {
      setReviewExpanded(true);
      setTimeout(() => {
        sectionRefs.current["section-review"]?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else if (location.state?.scrollTop) {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    }
  }, [location.state]);

  // Collapse review section when it scrolls out of view
  useEffect(() => {
    const el = sectionRefs.current["section-review"];
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setReviewExpanded(false); },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to first section with results — debounced so it only fires after typing stops
  useEffect(() => {
    if (!searchTerm) return;
    const timer = setTimeout(() => {
      const hasReviewMatch = pendingApproval.some((m) =>
        (m.title || "").toLowerCase().includes(searchTerm)
      );
      const hasProjectMatch = baseProjects.some((m) =>
        (m.title || "").toLowerCase().includes(searchTerm) ||
        (m.location || "").toLowerCase().includes(searchTerm)
      );
      const targetId = hasReviewMatch ? "section-review" : hasProjectMatch ? "section-projects" : null;
      if (targetId) {
        const el = sectionRefs.current[targetId];
        if (el) {
          const headerHeight = 64; // fixed header + a bit of breathing room
          const y = el.getBoundingClientRect().top + window.scrollY - headerHeight;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Approve / Reject ────────────────────────────────────
  const openReview = (missionId, action) => {
    setReviewState((prev) => ({ ...prev, [missionId]: { action, comment: "" } }));
  };

  const cancelReview = (missionId) => {
    setReviewState((prev) => { const s = { ...prev }; delete s[missionId]; return s; });
  };

  const handleApprove = async (missionId, comment = "") => {
    setActionLoading(missionId + "_approve");
    try {
      await updateDoc(doc(db, "missions", missionId), {
        "approvals.partner.approved": true,
        "approvals.partner.decidedAt": serverTimestamp(),
        "approvals.partner.decidedBy": user.uid,
        ...(comment.trim() && { "approvals.partner.note": comment.trim() }),
      });
      setMissions((prev) => prev.map((m) =>
        m.id === missionId
          ? { ...m, approvals: { ...m.approvals, partner: { approved: true, decidedBy: user.uid } } }
          : m
      ));
      cancelReview(missionId);
    } catch (err) {
      console.error("Error approving mission:", err);
      alert("Failed to approve. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (missionId, comment = "") => {
    setActionLoading(missionId + "_reject");
    try {
      await updateDoc(doc(db, "missions", missionId), {
        status: "rejected",
        "approvals.partner.approved": false,
        "approvals.partner.decidedAt": serverTimestamp(),
        "approvals.partner.decidedBy": user?.uid,
        ...(comment.trim() && { "approvals.partner.reason": comment.trim() }),
      });
      setMissions((prev) => prev.map((m) =>
        m.id === missionId ? { ...m, status: "rejected" } : m
      ));
      cancelReview(missionId);
    } catch (err) {
      console.error("Error rejecting mission:", err);
      alert("Failed to reject. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };


  // ── Render ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pd-page">
        <div className="pd-loading-screen">
          <div className="pd-loading-spinner" />
          <span>Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-page">
        {/* ── Welcome banner (white, full-width) ──────── */}
      <div className="pd-welcome-banner">
        <div className="pd-welcome-banner-inner">
          <div className="pd-welcome-left">
            {userAvatar ? (
              <img src={userAvatar} alt="avatar" className="pd-welcome-avatar" />
            ) : (
              <div className="pd-welcome-avatar pd-welcome-avatar--fallback">
                {(userName || partnerName).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="pd-welcome-text">
              <span className="pd-welcome-label">Welcome, {userName}</span>
              <h1 className="pd-welcome-title">{partnerName}</h1>
            </div>
          </div>
          <div className="pd-search-bar">
            <FaSearch className="pd-search-icon" />
            <input
              type="text"
              className="pd-search-input"
              placeholder="Search any project title or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

    <div className="pd-scroll-body">

        {/* ══════════════════════════════════════════════
            SECTION 1 — DASHBOARD
        ══════════════════════════════════════════════ */}
        <section
          id="section-dashboard"
          ref={(el) => (sectionRefs.current["section-dashboard"] = el)}
          className="pd-section"
        >
          {/* Stat cards */}
          <div className="pd-stats-grid">
            <StatCard color="blue"   icon={<FaListAlt />}       label="Total Projects"         value={myMissions.length} />
            <StatCard color="orange" icon={<FaHourglassHalf />} label="Awaiting Approval"      value={pendingApproval.length} pulse={pendingApproval.length > 0} />
            <StatCard color="green"  icon={<FaCalendarAlt />}   label="Active Projects"        value={activeMissions.length} />
            <StatCard color="purple" icon={<FaCheckCircle />}   label="Completed"              value={completedMissions.length} />
          </div>

          {/* Analytics row */}
          <div className="pd-analytics-row">
            {/* Project type */}
            <div className="pd-analytics-card">
              <div className="pd-analytics-header">
                <span className="pd-analytics-icon blue"><FaChartBar /></span>
                <h3>Project Type Breakdown</h3>
              </div>
              {slCount === 0 && ceCount === 0 ? (
                <p className="pd-no-data">No project data yet.</p>
              ) : (
                <div className="pd-breakdown-list">
                  <BreakdownBar label="Service Learning (SL)" count={slCount} total={myMissions.length} color="var(--c-blue)" />
                  <BreakdownBar label="Community Engagement (CE)" count={ceCount} total={myMissions.length} color="var(--c-green)" />
                </div>
              )}
            </div>

            {/* SDG */}
            <div className="pd-analytics-card">
              <div className="pd-analytics-header">
                <span className="pd-analytics-icon green"><FaLeaf /></span>
                <h3>Top SDGs Addressed</h3>
                {allSdgs.length > 0 && (
                  <button
                    className="pd-sdg-toggle"
                    onClick={() => setSdgExpanded((v) => !v)}
                  >
                    {sdgExpanded ? "Hide" : "See details"}
                  </button>
                )}
              </div>
              {topSdgs.length === 0 ? (
                <p className="pd-no-data">No SDG data yet.</p>
              ) : (() => {
                const totalMentions = allSdgs.reduce((s, [, c]) => s + c, 0);
                const othersCount = allSdgs.slice(5).reduce((s, [, c]) => s + c, 0);
                const pieSegments = [
                  ...topSdgs.map(([sdg, count], i) => ({ label: `SDG ${sdg}`, name: SDG_LABELS[sdg] || "", count, color: SDG_SEGMENT_COLORS[i] })),
                  ...(othersCount > 0 ? [{ label: "Others", name: "", count: othersCount, color: SDG_OTHERS_COLOR }] : []),
                ];
                let acc = 0;
                const gradientStr = pieSegments.map(s => {
                  const deg = (s.count / totalMentions) * 360;
                  const from = acc; acc += deg;
                  return `${s.color} ${from}deg ${acc}deg`;
                }).join(", ");
                return (
                  <>
                    {/* Donut chart — desktop collapsed state only */}
                    {!sdgExpanded && (
                      <div className="pd-sdg-donut-wrap">
                        <div className="pd-sdg-donut" style={{ background: `conic-gradient(${gradientStr})` }}>
                          <div className="pd-sdg-donut-hole">
                            <span className="pd-sdg-total-num">{allSdgs.length}</span>
                            <span className="pd-sdg-total-label">SDGs</span>
                          </div>
                        </div>
                        <div className="pd-sdg-legend">
                          {pieSegments.map((s, i) => (
                            <div key={i} className={`pd-sdg-legend-item${s.label === "Others" ? " muted" : ""}`}>
                              <span className="pd-sdg-legend-dot" style={{ backgroundColor: s.color }} />
                              <span className="pd-sdg-legend-text">{s.label}{s.name ? ` – ${s.name}` : ""}</span>
                              <span className="pd-sdg-legend-count">{s.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Full list — desktop expanded, mobile always (top 5 via CSS) */}
                    <div className={`pd-sdg-list${sdgExpanded ? " expanded" : ""}`}>
                      {(sdgExpanded ? allSdgs : topSdgs).map(([sdg, count]) => (
                        <div className="pd-sdg-row" key={sdg}>
                          <span className="pd-sdg-num">SDG {sdg}</span>
                          <span className="pd-sdg-name">{SDG_LABELS[sdg] || ""}</span>
                          <div className="pd-mini-bar-track">
                            <div className="pd-mini-bar-fill" style={{ width: `${(count / totalMentions) * 100}%` }} />
                          </div>
                          <span className="pd-sdg-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </section>

        <div className="pd-divider" />

        {/* ══════════════════════════════════════════════
            SECTION 2 — REVIEW PROPOSALS
        ══════════════════════════════════════════════ */}
        <section
          id="section-review"
          ref={(el) => (sectionRefs.current["section-review"] = el)}
          className="pd-section"
        >
          <button
            className="pd-review-toggle-header"
            onClick={() => setReviewExpanded((v) => !v)}
            aria-expanded={reviewExpanded}
          >
            <div className="pd-section-title-row">
              <h2 className="pd-section-title">Review Proposals</h2>
              {pendingApproval.length > 0 && (
                <span className="pd-count-chip orange">
                  {searchTerm && filteredReviews.length !== pendingApproval.length
                    ? `${filteredReviews.length} of ${pendingApproval.length} pending`
                    : `${pendingApproval.length} pending`}
                </span>
              )}
            </div>
            <FaChevronDown className={`pd-review-chevron ${reviewExpanded ? "open" : ""}`} />
          </button>

          <div className={`pd-review-body ${reviewExpanded ? "expanded" : ""}`}>
          {filteredReviews.length === 0 ? (
            <div className="pd-empty-state">
              <FaCheckCircle className="pd-empty-icon green" />
              <p>{searchTerm ? "No proposals match your search." : "You're all caught up! No proposals awaiting your review."}</p>
            </div>
          ) : (
            <div className="pd-review-list">
              {filteredReviews.map((m) => {
                const rs = reviewState[m.id];
                return (
                  <div className="pd-review-card" key={m.id}>
                    <div className="pd-review-left">
                      <div className="pd-review-title">{highlight(m.title || "Untitled", searchTerm)}</div>
                      <div className="pd-review-meta">
                        <span><FaCalendarAlt className="pd-meta-icon" />{m.targetDate || m.dateProposed || "TBA"}</span>
                        <span><FaMapMarkerAlt className="pd-meta-icon" />{m.location || "TBA"}</span>
                        <span><FaClock className="pd-meta-icon" />{m.volunteerHours || 0} volunteer hrs</span>
                        <span className={`pd-type-tag ${m.projectType} sm`}>
                          {m.projectType === "sl" ? "SL" : m.projectType === "ce" ? "CE" : "—"}
                        </span>
                      </div>
                      {m.description && (
                        <p className="pd-review-desc">
                          {m.description.slice(0, 180)}{m.description.length > 180 ? "…" : ""}
                        </p>
                      )}
                    </div>

                    {/* Default action buttons */}
                    {!rs && (
                      <div className="pd-review-actions">
                        <button
                          className="pd-btn-approve"
                          disabled={!!actionLoading}
                          onClick={() => openReview(m.id, "approve")}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="pd-btn-reject"
                          disabled={!!actionLoading}
                          onClick={() => openReview(m.id, "reject")}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}

                    {/* Expanded comment step */}
                    {rs && (
                      <div className={`pd-review-comment-box ${rs.action}`}>
                        <label className="pd-review-comment-label">
                          {rs.action === "reject"
                            ? "Reason for rejection (required)"
                            : "Add a note (optional)"}
                        </label>
                        <textarea
                          className="pd-review-comment-input"
                          rows={3}
                          placeholder={
                            rs.action === "reject"
                              ? "e.g. The proposed date conflicts with our local event…"
                              : "e.g. Please coordinate with Brgy. Captain before the event…"
                          }
                          value={rs.comment}
                          onChange={(e) =>
                            setReviewState((prev) => ({
                              ...prev,
                              [m.id]: { ...prev[m.id], comment: e.target.value },
                            }))
                          }
                        />
                        <div className="pd-review-comment-actions">
                          <button
                            className="pd-comment-cancel-btn"
                            onClick={() => cancelReview(m.id)}
                          >
                            Cancel
                          </button>
                          <button
                            className={`pd-comment-confirm-btn ${rs.action}`}
                            disabled={!!actionLoading || (rs.action === "reject" && !rs.comment.trim())}
                            onClick={() => rs.action === "approve" ? handleApprove(m.id, rs.comment) : handleReject(m.id, rs.comment)}
                          >
                            {actionLoading === m.id + `_${rs.action}`
                              ? rs.action === "approve" ? "Approving…" : "Rejecting…"
                              : rs.action === "approve" ? "✓ Confirm Approve" : "✕ Confirm Reject"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>{/* end pd-review-body */}
        </section>

        <div className="pd-divider" />

        {/* ══════════════════════════════════════════════
            SECTION 3 — PROJECT LIST
        ══════════════════════════════════════════════ */}
        <section
          id="section-projects"
          ref={(el) => (sectionRefs.current["section-projects"] = el)}
          className="pd-section"
        >
          <div className="pd-section-header">
            <div className="pd-section-title-row">
              <h2 className="pd-section-title">Project List</h2>
              <span className="pd-count-chip">{filteredProjects.length}</span>
            </div>
            <div className="pd-filter-tabs">
              {[["all", "All"], ["active", "Active"], ["completed", "Completed"]].map(([val, lbl]) => (
                <button
                  key={val}
                  className={`pd-filter-tab ${projectFilter === val ? "active" : ""}`}
                  onClick={() => setProjectFilter(val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="pd-empty-state">
              <FaFileAlt className="pd-empty-icon" />
              <p>No projects yet.</p>
            </div>
          ) : (
            <div className="pd-project-grid">
              {filteredProjects.map((m) => (
                <div
                  className="pd-project-card"
                  key={m.id}
                  onClick={() => navigate(`/current-event/${m.id}`)}
                >
                  <div className="pd-project-card-top">
                    <span className={`pd-type-tag ${m.projectType}`}>
                      {m.projectType === "sl" ? "Service Learning" : m.projectType === "ce" ? "Community Engagement" : "—"}
                    </span>
                    <span className={`pd-status-tag ${m.status}`}>
                      {(m.status || "draft").replace("_", " ")}
                    </span>
                  </div>
                  <div className="pd-project-title">{highlight(m.title || "Untitled", searchTerm)}</div>
                  <div className="pd-project-meta">
                    <span><FaCalendarAlt className="pd-meta-icon" />{m.targetDate || m.dateProposed || "TBA"}</span>
                    <span><FaMapMarkerAlt className="pd-meta-icon" />{highlight(m.location || "TBA", searchTerm)}</span>
                    <span><FaClock className="pd-meta-icon" />{m.volunteerHours || 0} hrs</span>
                  </div>
                  {(m.sdg || m.sdgs || []).length > 0 && (
                    <div className="pd-sdg-chips">
                      {(m.sdg || m.sdgs).slice(0, 3).map((s) => (
                        <span key={s} className="pd-sdg-chip">SDG {s}</span>
                      ))}
                      {(m.sdg || m.sdgs).length > 3 && (
                        <span className="pd-sdg-chip muted">+{(m.sdg || m.sdgs).length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="pd-page-end" />
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────

function highlight(text, term) {
  if (!term || !text) return text || "";
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="pd-search-highlight">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, color, pulse }) {
  return (
    <div className={`pd-stat-card ${color} ${pulse ? "pulse" : ""}`}>
      <div className={`pd-stat-icon-wrap ${color}`}>{icon}</div>
      <div className="pd-stat-body">
        <div className={`pd-stat-value pd-stat-value--${color}`}>{value}</div>
        <div className="pd-stat-label">{label}</div>
      </div>
    </div>
  );
}


function BreakdownBar({ label, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="pd-breakdown-row">
      <div className="pd-breakdown-top">
        <span className="pd-breakdown-label">{label}</span>
        <span className="pd-breakdown-count">{count}</span>
      </div>
      <div className="pd-bar-track">
        <div className="pd-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
