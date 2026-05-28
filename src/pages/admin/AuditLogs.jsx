import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  orderBy,
  query,
  getDocs,
  doc,
  getDoc,
  where,
} from "firebase/firestore";
import "../../styles/AuditLogs.css";

const PAGE_SIZE = 20;

function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function RoleBadge({ role }) {
  return (
    <span className={`audit-role-badge role-${(role || "unknown").toLowerCase()}`}>
      {role || "—"}
    </span>
  );
}

function StatusBadge({ action }) {
  const map = {
    LOGIN: { cls: "login", label: "Logged In" },
    LOGOUT: { cls: "logout", label: "Logged Out" },
  };
  const info = map[action] || { cls: "unknown", label: action || "—" };
  return <span className={`audit-status-badge status-${info.cls}`}>{info.label}</span>;
}

/* ─────────────────────────── Login Sessions Tab ─────────────────────────── */
function LoginSessionsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);

        // Only keep login/logout events in this tab
        const rawRows = snap.docs.filter((d) => {
          const a = d.data().action;
          return a === "LOGIN" || a === "LOGOUT";
        }).map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid || data.userId || "",
            name: data.name || data.displayName || "",
            email: data.email || "—",
            role: data.role || "—",
            action: data.action || "—",
            ipAddress: data.ipAddress || null,
            deviceInfo: data.deviceInfo || null,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
          };
        });

        const missingName = rawRows.filter((r) => !r.name && r.uid);
        const uniqueUids = [...new Set(missingName.map((r) => r.uid))];
        const nameMap = {};
        await Promise.all(
          uniqueUids.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) {
                const u = userSnap.data();
                nameMap[uid] = u.name || u.displayName || "—";
              }
            } catch {
              nameMap[uid] = "—";
            }
          })
        );

        const merged = rawRows.map((r) => ({
          ...r,
          name: r.name || nameMap[r.uid] || "—",
        }));

        if (!cancelled) setRows(merged);
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((r) => {
    if (roleFilter !== "all" && r.role.toLowerCase() !== roleFilter) return false;
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleRole = (v) => { setRoleFilter(v); setPage(1); };
  const handleAction = (v) => { setActionFilter(v); setPage(1); };

  return (
    <div className="audit-tab-content">
      <div className="audit-filters">
        <div className="audit-search-wrap">
          <svg className="audit-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#94a3b8" strokeWidth="1.6"/>
            <path d="M13 13l3.5 3.5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            className="audit-search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select className="audit-select" value={roleFilter} onChange={(e) => handleRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="student">Student / Volunteer</option>
          <option value="faculty">Faculty</option>
          <option value="partner">Partner</option>
          <option value="admin">Admin</option>
          <option value="sysadmin">SysAdmin</option>
        </select>
        <select className="audit-select" value={actionFilter} onChange={(e) => handleAction(e.target.value)}>
          <option value="all">Login & Logout</option>
          <option value="LOGIN">Login Only</option>
          <option value="LOGOUT">Logout Only</option>
        </select>
        <span className="audit-record-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="audit-loading">
          <span className="audit-spinner" />
          Loading activity logs…
        </div>
      ) : (
        <>
          <div className="audit-table-wrap">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>IP Address</th>
                  <th>Device / Browser</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="no-logs">No records match your filters.</td>
                  </tr>
                ) : (
                  paged.map((r, i) => (
                    <tr key={r.id}>
                      <td className="col-num">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td>
                        <div className="audit-user-name">{r.name}</div>
                        <div className="audit-user-email">{r.email}</div>
                      </td>
                      <td><RoleBadge role={r.role} /></td>
                      <td><StatusBadge action={r.action} /></td>
                      <td className="audit-ip">{r.ipAddress || <span className="audit-meta-unknown">Unknown</span>}</td>
                      <td className="audit-device">
                        {r.deviceInfo ? (
                          <>
                            <div className="audit-device-browser">{r.deviceInfo.browser || "Unknown Browser"}</div>
                            <div className="audit-device-os">{[r.deviceInfo.os, r.deviceInfo.device].filter(Boolean).join(" · ")}</div>
                          </>
                        ) : (
                          <span className="audit-meta-unknown">Unknown</span>
                        )}
                      </td>
                      <td className="audit-date">{formatDate(r.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="audit-pagination">
              <button
                className="audit-pg-btn"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="audit-pg-info">Page {safePage} of {totalPages}</span>
              <button
                className="audit-pg-btn"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ──────────────────────── Failed Attempts Tab ────────────────────────────── */
function FailedAttemptsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLocked, setFilterLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "loginAttempts"));
        const now = new Date();
        const data = snap.docs
          .map((d) => {
            const raw = d.data();
            const lockUntil = raw.lockUntil?.toDate ? raw.lockUntil.toDate() : null;
            return {
              id: d.id,
              email: raw.email || d.id,
              attempts: raw.attempts || 0,
              maxAttempts: 5,
              locked: !!(lockUntil && lockUntil > now),
              lockUntil,
              lastAttempt: raw.lastAttempt?.toDate ? raw.lastAttempt.toDate() : null,
            };
          })
          .sort((a, b) => (b.lastAttempt || 0) - (a.lastAttempt || 0));
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = filterLocked ? rows.filter((r) => r.locked) : rows;

  return (
    <div className="audit-tab-content">
      <div className="audit-filters">
        <label className="audit-toggle-label">
          <input
            type="checkbox"
            checked={filterLocked}
            onChange={(e) => setFilterLocked(e.target.checked)}
          />
          Show locked accounts only
        </label>
        <span className="audit-record-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="audit-loading">
          <span className="audit-spinner" />
          Loading failed attempts…
        </div>
      ) : (
        <div className="audit-table-wrap">
          <table className="audit-logs-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Email</th>
                <th>Failed Attempts</th>
                <th>Account Status</th>
                <th>Timeout / Locked Until</th>
                <th>Last Attempt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="no-logs">No failed login attempts on record.</td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id} className={r.locked ? "row-locked" : ""}>
                    <td className="col-num">{i + 1}</td>
                    <td className="audit-user-name">{r.email}</td>
                    <td>
                      <div className="audit-attempts-bar">
                        <div
                          className="audit-attempts-fill"
                          style={{
                            width: `${Math.min((r.attempts / r.maxAttempts) * 100, 100)}%`,
                            backgroundColor:
                              r.attempts >= r.maxAttempts
                                ? "#ef4444"
                                : r.attempts >= 3
                                ? "#f59e0b"
                                : "#22c55e",
                          }}
                        />
                      </div>
                      <span className="audit-attempts-text">
                        {r.attempts} / {r.maxAttempts} attempts
                      </span>
                    </td>
                    <td>
                      {r.locked ? (
                        <span className="audit-status-badge status-locked">Locked</span>
                      ) : (
                        <span className="audit-status-badge status-active">Active</span>
                      )}
                    </td>
                    <td className="audit-date">
                      {r.locked ? formatDate(r.lockUntil) : "—"}
                    </td>
                    <td className="audit-date">{formatDate(r.lastAttempt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Proposal Approvals Tab ─────────────────────────── */
function ProposalApprovalsTab() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const APPROVAL_STEPS = [
    { field: "reviewedBy", approvalKey: "reviewedBy", label: "Program Chair Review" },
    { field: "recommendedBy", approvalKey: "recommendedBy", label: "College Dean Recommendation" },
    { field: "endorsedBy", approvalKey: "endorsedBy", label: "Admin Endorsement" },
    { field: "approvedBy", approvalKey: "approvedBy", label: "Director Approval" },
  ];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "missions"));
        const data = snap.docs
          .map((d) => {
            const raw = d.data();
            const steps = APPROVAL_STEPS
              .filter((s) => raw[s.field])
              .map((s) => ({
                stepLabel: s.label,
                approvedBy: raw[s.field],
                decidedAt:
                  raw.approvals?.[s.approvalKey]?.decidedAt?.toDate
                    ? raw.approvals[s.approvalKey].decidedAt.toDate()
                    : null,
              }));
            return {
              id: d.id,
              title: raw.title || raw.name || "Untitled Proposal",
              status: raw.status || "unknown",
              lastApprovedAt: raw.lastApprovedAt?.toDate ? raw.lastApprovedAt.toDate() : null,
              steps,
            };
          })
          .filter((p) => p.steps.length > 0)
          .sort((a, b) => (b.lastApprovedAt || 0) - (a.lastApprovedAt || 0));

        if (!cancelled) setProposals(data);
      } catch {
        if (!cancelled) setProposals([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = proposals.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  );

  const statusCls = (s) => {
    if (s === "published") return "status-login";
    if (s === "draft") return "status-draft";
    if (s === "pending") return "status-logout";
    return "status-unknown";
  };

  return (
    <div className="audit-tab-content">
      <div className="audit-filters">
        <div className="audit-search-wrap">
          <svg className="audit-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#94a3b8" strokeWidth="1.6"/>
            <path d="M13 13l3.5 3.5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            className="audit-search"
            placeholder="Search proposal name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="audit-record-count">
          {filtered.length} proposal{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="audit-loading">
          <span className="audit-spinner" />
          Loading proposal approvals…
        </div>
      ) : (
        <div className="audit-table-wrap">
          <table className="audit-logs-table audit-proposals-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Proposal Name</th>
                <th>Approval Step</th>
                <th>Approved By</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-logs">No proposal approvals recorded.</td>
                </tr>
              ) : (
                filtered.map((p, pi) =>
                  p.steps.map((step, si) => (
                    <tr
                      key={`${p.id}-${si}`}
                      className={si === 0 ? "audit-group-first" : "audit-group-cont"}
                    >
                      <td className="col-num">{si === 0 ? pi + 1 : ""}</td>
                      <td className="audit-proposal-cell">
                        {si === 0 && (
                          <>
                            <div className="audit-user-name">{p.title}</div>
                            <span className={`audit-status-badge ${statusCls(p.status)}`}>
                              {p.status}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="audit-step-pill">{step.stepLabel}</span>
                      </td>
                      <td className="audit-user-name">{step.approvedBy}</td>
                      <td className="audit-date">{formatDate(step.decidedAt)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Generic Audit Tab helpers ─────────────────────────── */
const ACTION_LABELS = {
  // account
  ROLE_CHANGED: "Role Changed",
  // proposal
  PROPOSAL_SUBMITTED: "Proposal Submitted",
  PROPOSAL_UPDATED: "Proposal Updated",
  PROPOSAL_REJECTED: "Proposal Rejected",
  PROPOSAL_PUBLISHED: "Proposal Published",
  PROPOSAL_DELETED: "Proposal Deleted",
  PROPOSAL_ARCHIVED: "Proposal Archived",
  // event
  VOLUNTEER_ATTENDANCE_TOGGLED: "Attendance Toggled",
  VOLUNTEER_FLAGGED: "Volunteer Flagged",
  VOLUNTEER_UNFLAGGED: "Volunteer Unflagged",
  VOLUNTEER_PARTICIPATION_UPDATED: "Participation Updated",
  TASK_CREATED: "Task Created",
  TASK_UPDATED: "Task Updated",
  TASK_DELETED: "Task Deleted",
  // reward
  BADGE_AWARDED_MANUAL: "Badge Awarded (Manual)",
  BADGE_AWARDED_AUTO: "Badge Awarded (Auto)",
  POINTS_RELEASED: "Points Released",
  // system
  ANNOUNCEMENT_POSTED: "Announcement Posted",
  ANNOUNCEMENT_DELETED: "Announcement Deleted",
  BANNER_UPDATED: "Banner Updated",
  AGREEMENTS_PUBLISHED: "Agreements Published",
  SUPPORT_TICKET_CREATED: "Support Ticket Created",
  SUPPORT_MESSAGE_SENT: "Support Message Sent",
  SUPPORT_ADMIN_REPLIED: "Admin Replied",
  SUPPORT_TICKET_STATUS_CHANGED: "Ticket Status Changed",
};

function formatDetails(row) {
  const d = row.details || {};
  switch (row.action) {
    case "ROLE_CHANGED":
      return `${d.targetUserName || d.targetUserId || "User"}: ${d.previousRole || "?"} → ${d.newRole || "?"}${d.newPosition ? ` (${d.newPosition})` : ""}`;
    case "PROPOSAL_SUBMITTED":
    case "PROPOSAL_UPDATED":
    case "PROPOSAL_PUBLISHED":
    case "PROPOSAL_ARCHIVED":
    case "PROPOSAL_DELETED":
      return d.proposalTitle || d.proposalId || "—";
    case "PROPOSAL_REJECTED":
      return `${d.proposalTitle || d.proposalId || "—"}${d.rejectionReason ? ` — "${d.rejectionReason}"` : ""}`;
    case "QR_ATTENDANCE_SCANNED":
      return [
        d.missionName || "—",
        d.targetLocation ? `Target: ${d.targetLocation}` : null,
        d.scannedLocation ? `Scanned at: ${d.scannedLocation}` : null,
      ].filter(Boolean).join(" | ");
    case "VOLUNTEER_ATTENDANCE_TOGGLED":
      return `${d.targetUserName || d.targetUserId || "User"} → ${d.newStatus || "?"}${d.missionTitle ? ` (${d.missionTitle})` : ""}`;
    case "VOLUNTEER_FLAGGED":
      return `${d.targetUserName || d.targetUserId || "User"}${d.reason ? ` — ${d.reason}` : ""}`;
    case "VOLUNTEER_UNFLAGGED":
      return `${d.targetUserName || d.targetUserId || "User"} flag removed`;
    case "VOLUNTEER_PARTICIPATION_UPDATED":
      return `${d.targetUserName || d.targetUserId || "User"} → ${d.participationStatus || "?"}`;
    case "TASK_CREATED":
    case "TASK_UPDATED":
    case "TASK_DELETED":
      return `${d.taskTitle || d.taskId || "Task"}${d.missionTitle ? ` in "${d.missionTitle}"` : ""}`;
    case "BADGE_AWARDED_MANUAL":
    case "BADGE_AWARDED_AUTO":
      return `${d.badgeName || d.badgeId || "Badge"} → ${d.targetUserName || d.targetUserId || "User"}`;
    case "POINTS_RELEASED":
      return `${d.targetUserName || d.targetUserId || "User"}: ${d.pointsEarned ?? "?"} pts${d.missionId ? ` (mission ${d.missionId})` : ""}`;
    case "ANNOUNCEMENT_POSTED":
    case "ANNOUNCEMENT_DELETED":
      return d.announcementTitle || "—";
    case "BANNER_UPDATED":
      return d.bannerTitle || "Banner";
    case "AGREEMENTS_PUBLISHED":
      return `v${d.version || "?"}${d.updatedTab ? ` (${d.updatedTab})` : ""}`;
    case "SUPPORT_TICKET_CREATED":
      return `${d.ticketType || "Ticket"}${d.ticketPreview ? `: "${d.ticketPreview}"` : ""}`;
    case "SUPPORT_MESSAGE_SENT":
      return `Message in ticket ${d.ticketId || "?"}${d.messagePreview ? `: "${d.messagePreview}"` : ""}`;
    case "SUPPORT_ADMIN_REPLIED":
      return `Replied to ticket ${d.ticketId || "?"}`;
    case "SUPPORT_TICKET_STATUS_CHANGED":
      return `Ticket ${d.ticketId || "?"} → ${d.newStatus || "?"}`;
    default:
      return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ") || "—";
  }
}

function actionBadgeCls(action) {
  if (!action) return "neutral";
  const a = action.toUpperCase();
  if (a.includes("CREAT") || a.includes("SUBMIT") || a.includes("AWARD") || a.includes("POST")) return "create";
  if (a.includes("DELET") || a.includes("REJECT")) return "delete";
  if (a.includes("UPDAT") || a.includes("TOGGLE") || a.includes("CHANGE") || a.includes("FLAG")) return "update";
  if (a.includes("PUBLISH") || a.includes("RELEASE") || a.includes("APPROV")) return "publish";
  if (a.includes("ARCHIV") || a.includes("REPLI")) return "neutral";
  return "neutral";
}

/* ─────────────────────────── Generic Audit Tab ────────────────────────────── */
function GenericAuditTab({ category, emptyMessage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "auditLogs"), where("category", "==", category));
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => {
            const raw = d.data();
            // Handle both storage formats:
            //   new format: details stored as nested map under raw.details
            //   old format: details were spread at root level
            const { action, category, actorName, actorEmail, actorUid, timestamp, details: nestedDetails, ...spreadFields } = raw;
            const details = (nestedDetails && typeof nestedDetails === "object") ? nestedDetails : spreadFields;
            return {
              id: d.id,
              action: action || "—",
              actorName: actorName || "",
              actorEmail: actorEmail || "",
              actorUid: actorUid || "",
              details,
              timestamp: timestamp?.toDate ? timestamp.toDate() : null,
            };
          })
          .sort((a, b) => (b.timestamp?.getTime?.() ?? 0) - (a.timestamp?.getTime?.() ?? 0));
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [category]);

  const uniqueActions = [...new Set(rows.map((r) => r.action))].sort();

  const filtered = rows.filter((r) => {
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const det = formatDetails(r).toLowerCase();
      if (
        !r.actorName.toLowerCase().includes(q) &&
        !r.actorEmail.toLowerCase().includes(q) &&
        !det.includes(q)
      ) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="audit-tab-content">
      <div className="audit-filters">
        <div className="audit-search-wrap">
          <svg className="audit-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#94a3b8" strokeWidth="1.6"/>
            <path d="M13 13l3.5 3.5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            className="audit-search"
            placeholder="Search by actor or detail…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="audit-select"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <span className="audit-record-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="audit-loading">
          <span className="audit-spinner" />
          Loading audit records…
        </div>
      ) : (
        <>
          <div className="audit-table-wrap">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Performed By</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="no-logs">{emptyMessage || "No records found."}</td>
                  </tr>
                ) : (
                  paged.map((r, i) => (
                    <tr key={r.id}>
                      <td className="col-num">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td>
                        <div className="audit-user-name">{r.actorName || r.actorEmail || "—"}</div>
                        {r.actorName && r.actorEmail && (
                          <div className="audit-user-email">{r.actorEmail}</div>
                        )}
                      </td>
                      <td>
                        <span className={`action-badge ${actionBadgeCls(r.action)}`}>
                          {ACTION_LABELS[r.action] || r.action}
                        </span>
                      </td>
                      <td className="audit-detail-cell">{formatDetails(r)}</td>
                      <td className="audit-date">{formatDate(r.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="audit-pagination">
              <button className="audit-pg-btn" disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <span className="audit-pg-info">Page {safePage} of {totalPages}</span>
              <button className="audit-pg-btn" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────── Main Page ─────────────────────────────── */
export default function AuditLogs() {
  const [mainTab, setMainTab] = useState("login");
  const [loginSubTab, setLoginSubTab] = useState("sessions");
  const [proposalSubTab, setProposalSubTab] = useState("approvals");

  const mainTabs = [
    {
      key: "login",
      label: "Login Activity",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
        </svg>
      ),
    },
    {
      key: "proposals",
      label: "Proposals",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ),
    },
    {
      key: "accounts",
      label: "Account Changes",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/>
        </svg>
      ),
    },
    {
      key: "events",
      label: "Event Activity",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
        </svg>
      ),
    },
    {
      key: "rewards",
      label: "Badges & Rewards",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ),
    },
    {
      key: "system",
      label: "System Actions",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="audit-tab-icon">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="admin-outlet">
      <div className="audit-logs-container">
        {/* Page header */}
        <div className="audit-page-header">
          <div>
            <h2 className="audit-page-title">Audit Logs</h2>
            <p className="audit-page-sub">
              Complete user activity trail — logins, proposals, accounts, events, badges, and system actions.
            </p>
          </div>
        </div>

        {/* Main tabs */}
        <div className="audit-main-tabs">
          {mainTabs.map((t) => (
            <button
              key={t.key}
              className={`audit-main-tab ${mainTab === t.key ? "active" : ""}`}
              onClick={() => setMainTab(t.key)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Login Activity ── */}
        {mainTab === "login" && (
          <>
            <div className="audit-sub-tabs">
              <button
                className={`audit-sub-tab ${loginSubTab === "sessions" ? "active" : ""}`}
                onClick={() => setLoginSubTab("sessions")}
              >
                Login &amp; Logout Sessions
              </button>
              <button
                className={`audit-sub-tab ${loginSubTab === "attempts" ? "active" : ""}`}
                onClick={() => setLoginSubTab("attempts")}
              >
                Failed Attempts &amp; Lockouts
              </button>
            </div>
            {loginSubTab === "sessions" ? <LoginSessionsTab /> : <FailedAttemptsTab />}
          </>
        )}

        {/* ── Proposals ── */}
        {mainTab === "proposals" && (
          <>
            <div className="audit-sub-tabs">
              <button
                className={`audit-sub-tab ${proposalSubTab === "approvals" ? "active" : ""}`}
                onClick={() => setProposalSubTab("approvals")}
              >
                Approval Chain
              </button>
              <button
                className={`audit-sub-tab ${proposalSubTab === "activity" ? "active" : ""}`}
                onClick={() => setProposalSubTab("activity")}
              >
                Proposal Activity Log
              </button>
            </div>
            {proposalSubTab === "approvals" ? (
              <ProposalApprovalsTab />
            ) : (
              <GenericAuditTab
                category="proposal"
                emptyMessage="No proposal activity recorded yet."
              />
            )}
          </>
        )}

        {/* ── Account Changes ── */}
        {mainTab === "accounts" && (
          <GenericAuditTab
            category="account"
            emptyMessage="No account changes recorded yet."
          />
        )}

        {/* ── Event Activity ── */}
        {mainTab === "events" && (
          <GenericAuditTab
            category="event"
            emptyMessage="No event activity recorded yet."
          />
        )}

        {/* ── Badges & Rewards ── */}
        {mainTab === "rewards" && (
          <GenericAuditTab
            category="reward"
            emptyMessage="No badge or reward activity recorded yet."
          />
        )}

        {/* ── System Actions ── */}
        {mainTab === "system" && (
          <GenericAuditTab
            category="system"
            emptyMessage="No system actions recorded yet."
          />
        )}
      </div>
    </div>
  );
}
