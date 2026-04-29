import { useState, useEffect, useContext } from "react";
import { db } from "../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { QRCodeCanvas } from "qrcode.react";
import ProposalTimeline from "../../components/ProposalTimeline";
import { SessionContext } from "../../context/SessionContext";
import { createNotification, notifyUsersByRoles } from "../../utils/notificationUtils";
import mission1 from "../../assets/mission1.jpg";
import "../../styles/ProjectDetailSidebar.css";

function isForApproval(status = "") {
  const s = String(status).toLowerCase();
  return s === "for_approval" || s === "for-approval" || s === "pending";
}

function PieChart({ present, total }) {
  const pct = total > 0 ? present / total : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="#eef2f7" />
      <circle
        cx={50} cy={50} r={r}
        fill="none"
        stroke="#30bdb7"
        strokeWidth={12}
        strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.6s" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize="18" fontWeight="bold" fill="#1f3b73">
        {total > 0 ? Math.round(pct * 100) : 0}%
      </text>
    </svg>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function ProjectDetailSidebar({ project, onClose, onApprovalChange }) {
  const { userData } = useContext(SessionContext);
  const [volunteers, setVolunteers] = useState([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectText, setRejectText] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const statusStr = (project?.status || "").toLowerCase();
  const isApprovalStage = isForApproval(statusStr) || statusStr === "draft";
  const isPublishedOrDone = statusStr === "published" || statusStr === "completed";

  useEffect(() => {
    if (!project?.id || !isPublishedOrDone) return;
    setLoadingData(true);
    Promise.all([
      getDocs(collection(db, "missions", project.id, "volunteer")),
      getDocs(collection(db, "missions", project.id, "feedbackResponses")),
    ]).then(async ([volSnap, fbSnap]) => {
      const volData = volSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const profileSnaps = await Promise.all(
        volData.map(v => getDoc(doc(db, "users", v.uid)))
      );
      const enriched = volData.map((v, i) => {
        const p = profileSnaps[i].exists() ? profileSnaps[i].data() : {};
        return {
          ...v,
          displayName: p.name || p.username || p.email?.split("@")[0] || "Unknown",
          role: p.role || "",
          avatar: p.avatar && !p.avatar.includes("ui-avatars.com") ? p.avatar : null,
        };
      });
      setVolunteers(enriched);
      setFeedbackCount(fbSnap.size);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [project?.id, isPublishedOrDone]);

  // Approval role logic
  const role = (userData?.role || "").toLowerCase();
  const positionField = userData?.position || userData?.positions || "";
  const userPositions = Array.isArray(positionField) ? positionField : positionField ? [positionField] : [];
  const normalizedPositions = userPositions.map(p => String(p).toLowerCase().trim().replace(/\s+/g, " "));

  function getApprovalLevel() {
    if (role === "faculty") {
      if (normalizedPositions.includes("program chair")) return "reviewedBy";
      if (normalizedPositions.includes("college dean") || normalizedPositions.includes("cluster head")) return "recommendedBy";
    }
    if (role === "admin") {
      if (normalizedPositions.includes("regular")) return "endorsedBy";
      if (normalizedPositions.includes("director")) return "approvedBy";
    }
    return null;
  }
  const approvalLevel = getApprovalLevel();

  function canApprove() {
    if (!approvalLevel || !project) return false;
    const p = project;
    if (approvalLevel === "reviewedBy")    return !p.reviewedBy && !p.recommendedBy && !p.endorsedBy && !p.approvedBy;
    if (approvalLevel === "recommendedBy") return !!p.reviewedBy && !p.recommendedBy && !p.endorsedBy && !p.approvedBy;
    if (approvalLevel === "endorsedBy")    return !!p.reviewedBy && !!p.recommendedBy && !p.endorsedBy && !p.approvedBy;
    if (approvalLevel === "approvedBy")    return !!p.reviewedBy && !!p.recommendedBy && !!p.endorsedBy && !p.approvedBy;
    return false;
  }

  const alreadyApproved = approvalLevel && !!project?.[approvalLevel];

  const handleApprove = async () => {
    if (!approvalLevel || !userData) return;
    setApproving(true);
    try {
      const name = userData.name || userData.email;
      const merged = { ...project, [approvalLevel]: name };
      const allDone = merged.reviewedBy && merged.recommendedBy && merged.endorsedBy && merged.approvedBy;
      const newStatus = allDone ? "draft" : "pending";
      await updateDoc(doc(db, "missions", project.id), {
        [approvalLevel]: name,
        status: newStatus,
        lastApprovedAt: serverTimestamp(),
        lastApprovedBy: approvalLevel,
        [`approvals.${approvalLevel}.approved`]: true,
        [`approvals.${approvalLevel}.decidedAt`]: serverTimestamp(),
        [`approvals.${approvalLevel}.name`]: name,
        ...(approveNote.trim() ? { [`approvals.${approvalLevel}.note`]: approveNote.trim() } : {}),
      });
      setActionMsg(allDone ? "All signatures collected! Status updated to Draft." : "Approval recorded!");
      if (onApprovalChange) onApprovalChange();
      setTimeout(onClose, 1500);

      const statusLabel = allDone ? "Draft" : "For Approval";
      const notifData = {
        type: "proposal_status",
        title: "Proposal Status Updated",
        message: `"${project.title || "Untitled"}" is now ${statusLabel}.`,
        link: "/global/review-proposals",
        proposalId: project.id,
      };
      Promise.allSettled([
        project.createdBy ? createNotification(project.createdBy, { ...notifData, message: `Your proposal "${project.title || "Untitled"}" is now ${statusLabel}.` }) : Promise.resolve(),
        notifyUsersByRoles(["admin", "faculty"], notifData),
      ]).catch(() => {});
    } catch {
      setActionMsg("Error approving. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!approvalLevel || !rejectText.trim()) return;
    setApproving(true);
    try {
      const name = userData?.name || userData?.email;
      await updateDoc(doc(db, "missions", project.id), {
        status: "for_approval",
        rejectionReason: rejectText,
        rejectedBy: approvalLevel,
        rejectedAt: serverTimestamp(),
        rejectedByUser: name,
        reviewedBy: "", recommendedBy: "", endorsedBy: "", approvedBy: "",
        "approvals.reviewedBy": null,
        "approvals.recommendedBy": null,
        "approvals.endorsedBy": null,
        "approvals.approvedBy": null,
      });
      setActionMsg("Returned to proposer. All approvals cleared.");
      if (onApprovalChange) onApprovalChange();
      setTimeout(onClose, 1500);
    } catch {
      setActionMsg("Error returning. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  if (!project) return null;

  const registered = volunteers.length;
  const attended = volunteers.filter(v => v.progress?.attendance === "present").length;
  const attendedVolunteers = volunteers.filter(v => v.progress?.attendance === "present");
  const adviserVolunteers = volunteers.filter(v => v.role === "faculty");

  const feedbackUrl = `${window.location.origin}/global/feedback/${project.id}`;
  const studentQRValue = JSON.stringify({ eventId: project.id, type: "attendance" });

  const typeLabel = project.projectType === "sl"
    ? "Service Learning"
    : project.projectType === "ce"
    ? "Community Engagement"
    : project.projectType || "Proposal";

  const statusLabel = isForApproval(project.status)
    ? "For Approval"
    : project.status
    ? project.status.charAt(0).toUpperCase() + project.status.slice(1)
    : "Draft";

  const statusClass = isForApproval(project.status) ? "pending" : (project.status || "draft").toLowerCase();

  const formatDate = (value) => {
    if (!value) return "N/A";
    try {
      const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
      return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    } catch { return "N/A"; }
  };

  const bannerSrc = project.img || mission1;
  const adviserName = project.adviser || project.facultyAdviser || project.projectAdviser || null;
  const activities = project.activities || project.agenda || project.programOfActivities || null;

  return (
    <>
      <div className="pds-overlay" onClick={onClose} />
      <div className="pds-panel">

        {/* ── Banner ── */}
        <div className="pds-banner">
          <img src={bannerSrc} alt={project.title || "Project banner"} className="pds-banner-img" />
        </div>

        {/* ── Header ── */}
        <div className="pds-header">
          <div className="pds-header-meta">
            <span className="rp-type-tag">{typeLabel}</span>
            <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
          </div>
          <button className="pds-close" onClick={onClose} aria-label="Close">×</button>
          <h2 className="pds-title">{project.title || "Untitled Project"}</h2>
        </div>

        {/* ── Body ── */}
        <div className="pds-body">

          {isApprovalStage ? (
            /* ────── For Approval / Draft view ────── */
            <>
              {/* Meta info */}
              <div className="pds-section">
                <div className="pds-meta-grid">
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Proposed by</span>
                    <span className="pds-meta-value">{project.preparedBy || "N/A"}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Target Date</span>
                    <span className="pds-meta-value">{project.targetDate || "N/A"}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Date Submitted</span>
                    <span className="pds-meta-value">{formatDate(project.dateProposed || project.createdAt)}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Location</span>
                    <span className="pds-meta-value">{project.location || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <div className="pds-section">
                  <div className="pds-section-label">Description</div>
                  <p className="pds-field-value">{project.description}</p>
                </div>
              )}

              {/* Project details */}
              {(project.objectives || project.stakeholders || project.budget) && (
                <div className="pds-section">
                  <div className="pds-section-label">Project Details</div>
                  {project.objectives && (
                    <div className="pds-field">
                      <span className="pds-field-label">Objectives</span>
                      <p className="pds-field-value">{project.objectives}</p>
                    </div>
                  )}
                  {project.stakeholders && (
                    <div className="pds-field">
                      <span className="pds-field-label">Partner / Stakeholder</span>
                      <p className="pds-field-value">{project.stakeholders}</p>
                    </div>
                  )}
                  {project.budget && (
                    <div className="pds-field">
                      <span className="pds-field-label">Budget</span>
                      <p className="pds-field-value">{project.budget}</p>
                    </div>
                  )}
                </div>
              )}

              {/* PDF button */}
              {project.signedDocUrl && (
                <div className="pds-section">
                  <div className="pds-section-label">Submitted Document</div>
                  <button className="pds-btn-pdf" onClick={() => setPdfModalOpen(true)}>
                    📄 View Submitted Proposal
                  </button>
                </div>
              )}

              {/* Signatory flow */}
              <div className="pds-section">
                <div className="pds-section-label">Signatory Flow</div>
                <ProposalTimeline proposal={project} />
              </div>

              {/* Approval actions — below signatory flow */}
              {isForApproval(project.status) && approvalLevel && (
                <div className="pds-section pds-action-section">
                  <div className="pds-section-label">Your Action</div>
                  {actionMsg ? (
                    <div className="pds-action-msg">{actionMsg}</div>
                  ) : alreadyApproved ? (
                    <div className="pds-status-note">You have already approved this proposal.</div>
                  ) : !canApprove() ? (
                    <div className="pds-status-note">Not your turn yet — waiting for the previous signatory.</div>
                  ) : (
                    <>
                      <textarea
                        className="pds-textarea"
                        placeholder="Optional note for approval…"
                        value={approveNote}
                        onChange={e => setApproveNote(e.target.value)}
                        rows={2}
                        disabled={approving}
                        style={{ marginBottom: 8 }}
                      />
                      <button className="pds-btn-approve" onClick={handleApprove} disabled={approving}>
                        {approving ? "Approving…" : "✓ Approve"}
                      </button>
                      <div className="pds-return-label" style={{ marginTop: 16 }}>Reject / Return to proposer</div>
                      <textarea
                        className="pds-textarea"
                        placeholder="Reason for rejection (required)…"
                        value={rejectText}
                        onChange={e => setRejectText(e.target.value)}
                        rows={3}
                        disabled={approving}
                      />
                      <button
                        className="pds-btn-return"
                        onClick={handleReject}
                        disabled={approving || !rejectText.trim()}
                      >
                        {approving ? "Rejecting…" : "✗ Reject"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ────── Published / Completed view ────── */
            <>
              {/* Description */}
              {project.description && (
                <div className="pds-section">
                  <div className="pds-section-label">About this Event</div>
                  <p className="pds-field-value">{project.description}</p>
                </div>
              )}

              {/* Info grid */}
              <div className="pds-section">
                <div className="pds-meta-grid">
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Location</span>
                    <span className="pds-meta-value">{project.location || "N/A"}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Partner / Stakeholder</span>
                    <span className="pds-meta-value">{project.stakeholders || project.partnerName || "N/A"}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Target Date</span>
                    <span className="pds-meta-value">{project.targetDate || "N/A"}</span>
                  </div>
                  <div className="pds-meta-item">
                    <span className="pds-meta-label">Community Surveys</span>
                    <span className="pds-meta-value">{loadingData ? "…" : feedbackCount}</span>
                  </div>
                </div>
              </div>

              {/* Adviser / Professor */}
              {(adviserName || (!loadingData && adviserVolunteers.length > 0)) && (
                <div className="pds-section">
                  <div className="pds-section-label">Adviser / Professor</div>
                  <p className="pds-field-value">
                    {adviserName || adviserVolunteers.map(v => v.displayName).join(", ")}
                  </p>
                </div>
              )}

              {/* Activities */}
              {activities && (
                <div className="pds-section">
                  <div className="pds-section-label">Activities</div>
                  <p className="pds-field-value">{activities}</p>
                </div>
              )}

              {/* Attendance pie chart */}
              <div className="pds-section">
                <div className="pds-section-label">Attendance</div>
                {loadingData ? (
                  <p className="pds-loading">Loading…</p>
                ) : (
                  <div className="pds-pie-row">
                    <PieChart present={attended} total={registered} />
                    <div className="pds-pie-legend">
                      <div className="pds-legend-item">
                        <span className="pds-legend-dot pds-legend-registered" />
                        <div>
                          <div className="pds-legend-count">{registered}</div>
                          <div className="pds-legend-label">Registered</div>
                        </div>
                      </div>
                      <div className="pds-legend-item">
                        <span className="pds-legend-dot pds-legend-attended" />
                        <div>
                          <div className="pds-legend-count">{attended}</div>
                          <div className="pds-legend-label">Attended</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance roster */}
              {!loadingData && attendedVolunteers.length > 0 && (
                <div className="pds-section">
                  <div className="pds-section-label">Attendance Roster</div>
                  <div className="pds-roster">
                    {attendedVolunteers.map((v, i) => (
                      <div key={v.uid || i} className="pds-roster-row">
                        <div className="pds-roster-avatar">
                          {v.avatar
                            ? <img src={v.avatar} alt="" />
                            : <span>{getInitials(v.displayName)}</span>
                          }
                        </div>
                        <span className="pds-roster-name">{v.displayName}</span>
                        {v.role === "faculty" && (
                          <span className="pds-roster-badge">Adviser</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF link */}
              {project.signedDocUrl && (
                <div className="pds-section">
                  <button className="pds-btn-pdf" onClick={() => setPdfModalOpen(true)}>
                    📄 View Project Document
                  </button>
                </div>
              )}

              {/* QR codes */}
              <div className="pds-section">
                <div className="pds-section-label">QR Codes</div>
                <div className="pds-qr-grid">
                  <div className="pds-qr-card">
                    <div className="pds-qr-label">Student Attendance</div>
                    <QRCodeCanvas value={studentQRValue} size={110} />
                  </div>
                  <div className="pds-qr-card">
                    <div className="pds-qr-label">Community Partner Feedback</div>
                    <QRCodeCanvas value={feedbackUrl} size={110} />
                  </div>
                </div>
              </div>

              {/* Signatory flow */}
              <div className="pds-section">
                <div className="pds-section-label">Signatory Flow</div>
                <ProposalTimeline proposal={project} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* PDF popup viewer */}
      {pdfModalOpen && project.signedDocUrl && (
        <div className="pds-pdf-modal-overlay" onClick={() => setPdfModalOpen(false)}>
          <div className="pds-pdf-modal" onClick={e => e.stopPropagation()}>
            <button className="pds-pdf-modal-close" onClick={() => setPdfModalOpen(false)}>×</button>
            <iframe
              src={project.signedDocUrl}
              title="Project Document"
              className="pds-pdf-modal-iframe"
            />
          </div>
        </div>
      )}
    </>
  );
}
