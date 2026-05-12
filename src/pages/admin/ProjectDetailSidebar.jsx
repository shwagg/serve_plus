import { useState, useEffect, useContext, useRef } from "react";
import { db, storage } from "../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, collection, getDocs, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { QRCodeCanvas } from "qrcode.react";
import ProposalTimeline from "../../components/ProposalTimeline";
import { SessionContext } from "../../context/SessionContext";
import { createNotification, notifyUsersByRoles } from "../../utils/notificationUtils";
import { logAudit } from "../../utils/auditLogger";
import { showToast, showConfirm } from "../../utils/toast";
import mission1 from "../../assets/mission1.jpg";
import ImpactMetrics from "./ImpactMetrics";
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
  const [coverUrl, setCoverUrl] = useState(project?.img || null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [impactModalOpen, setImpactModalOpen] = useState(false);
  const [impactModalType, setImpactModalType] = useState(null); // 'pre' or 'post'
  const [volunteersWithSurveys, setVolunteersWithSurveys] = useState([]);

  // Task management
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    enrollmentDeadline: "",
    points: 0,
    type: "individual",
    maxParticipants: 5,
  });

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
      const enriched = await Promise.all(
        volData.map(async (v, i) => {
          const p = profileSnaps[i].exists() ? profileSnaps[i].data() : {};
          let preSurveyAnswers = null;
          let postSurveyAnswers = null;
          try {
            const preDoc = await getDoc(doc(db, "missions", project.id, "volunteer", v.uid, "preSurvey", "response"));
            if (preDoc.exists()) preSurveyAnswers = preDoc.data();
          } catch (_) {}
          try {
            const postDoc = await getDoc(doc(db, "missions", project.id, "volunteer", v.uid, "postSurvey", "response"));
            if (postDoc.exists()) postSurveyAnswers = postDoc.data();
          } catch (_) {}
          return {
            ...v,
            name: p.name || p.username || p.email?.split("@")[0] || "Unknown",
            displayName: p.name || p.username || p.email?.split("@")[0] || "Unknown",
            role: p.role || "",
            avatar: p.avatar && !p.avatar.includes("ui-avatars.com") ? p.avatar : null,
            preSurveyAnswers,
            postSurveyAnswers,
          };
        })
      );
      setVolunteers(enriched);
      setVolunteersWithSurveys(enriched);
      setFeedbackCount(fbSnap.size);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [project?.id, isPublishedOrDone]);

  useEffect(() => {
    if (project?.id) loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

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
  const isAdmin = role === "admin";

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !project?.id) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      alert("Please select a valid image file (JPG, PNG, WEBP, GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5 MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const fileRef = storageRef(storage, `mission-covers/${project.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "missions", project.id), { img: url, updatedAt: serverTimestamp() });
      setCoverUrl(url);
      logAudit({
        action: "PROPOSAL_COVER_UPDATED",
        category: "proposal",
        actorName: userData?.name || userData?.email || "",
        details: { proposalId: project.id, proposalTitle: project.title || "" },
      });
    } catch {
      alert("Failed to upload cover photo. Please try again.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

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
      logAudit({
        action: "PROPOSAL_REJECTED",
        category: "proposal",
        actorName: name,
        details: {
          proposalId: project.id,
          proposalTitle: project.title || "",
          rejectionReason: rejectText,
          rejectedByRole: approvalLevel,
        },
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

  // ── Task management ──────────────────────────────────────────────
  const loadTasks = async () => {
    if (!project?.id) return;
    setLoadingTasks(true);
    try {
      const snap = await getDocs(collection(db, "missions", project.id, "task"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
      setTasks(list);
    } catch (_) {}
    finally { setLoadingTasks(false); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) { showToast("Task title is required."); return; }
    setSavingTask(true);
    try {
      const snap = await getDocs(collection(db, "missions", project.id, "task"));
      const nextId = snap.size.toString();
      const taskData = {
        title: taskFormData.title,
        description: taskFormData.description,
        enrollmentDeadline: taskFormData.enrollmentDeadline,
        points: parseInt(taskFormData.points) || 0,
        type: taskFormData.type || "individual",
        createdAt: new Date().toISOString(),
      };
      if (taskFormData.type === "grouped") taskData.maxParticipants = parseInt(taskFormData.maxParticipants) || 5;
      await setDoc(doc(db, "missions", project.id, "task", nextId), taskData);
      logAudit({ action: "TASK_CREATED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskTitle: taskFormData.title } });
      cancelTaskForm();
      await loadTasks();
    } catch (_) { showToast("Failed to create task."); }
    finally { setSavingTask(false); }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) { showToast("Task title is required."); return; }
    setSavingTask(true);
    try {
      const updateData = {
        title: taskFormData.title,
        description: taskFormData.description,
        enrollmentDeadline: taskFormData.enrollmentDeadline,
        points: parseInt(taskFormData.points) || 0,
        type: taskFormData.type || "individual",
      };
      if (taskFormData.type === "grouped") updateData.maxParticipants = parseInt(taskFormData.maxParticipants) || 5;
      await updateDoc(doc(db, "missions", project.id, "task", editingTaskId), updateData);
      logAudit({ action: "TASK_UPDATED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskId: editingTaskId, taskTitle: taskFormData.title } });
      cancelTaskForm();
      await loadTasks();
    } catch (_) { showToast("Failed to update task."); }
    finally { setSavingTask(false); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!await showConfirm("Delete this task? This cannot be undone.")) return;
    setSavingTask(true);
    try {
      await deleteDoc(doc(db, "missions", project.id, "task", taskId));
      logAudit({ action: "TASK_DELETED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskId } });
      await loadTasks();
    } catch (_) { showToast("Failed to delete task."); }
    finally { setSavingTask(false); }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskFormData({ title: task.title || "", description: task.description || "", enrollmentDeadline: task.enrollmentDeadline || "", points: task.points || 0, type: task.type || "individual", maxParticipants: task.maxParticipants || 5 });
    setShowTaskForm(true);
  };

  const cancelTaskForm = () => {
    setShowTaskForm(false);
    setEditingTaskId(null);
    setTaskFormData({ title: "", description: "", enrollmentDeadline: "", points: 0, type: "individual", maxParticipants: 5 });
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

  const bannerSrc = coverUrl || project.img || mission1;
  const adviserName = project.adviser || project.facultyAdviser || project.projectAdviser || null;
  const activities = project.activities || project.agenda || project.programOfActivities || null;

  return (
    <>
      <div className="pds-overlay" onClick={onClose} />
      <div className="pds-panel">

        {/* ── Banner ── */}
        <div className="pds-banner">
          <img src={bannerSrc} alt={project.title || "Project banner"} className="pds-banner-img" />
          {isAdmin && (
            <>
              <button
                className="pds-cover-btn"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                title="Change cover photo"
              >
                {uploadingCover ? (
                  <span className="pds-cover-spinner" />
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Change Cover
                  </>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={handleCoverUpload}
              />
            </>
          )}
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
                        {approving
                          ? "Submitting…"
                          : approvalLevel === "endorsedBy"
                            ? "✓ Endorse"
                            : "✓ Approve"}
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

              {/* View Full Roster button */}
              {!loadingData && volunteers.length > 0 && (
                <div className="pds-section">
                  <button
                    className="pds-btn-pdf"
                    style={{ background: "#1f3b73", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer", width: "100%" }}
                    onClick={() => setShowRosterModal(true)}
                  >
                    👥 View Full Roster
                  </button>
                </div>
              )}

              {/* Roster Modal */}
              {showRosterModal && (
                <div
                  style={{ position: "fixed", inset: 0, background: "rgba(44,62,80,0.25)", zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => setShowRosterModal(false)}
                >
                  <div
                    style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 400, maxWidth: "92vw", boxShadow: "0 4px 24px #0003", position: "relative", color: "#111", maxHeight: "80vh", overflowY: "auto" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#23335b", fontWeight: 700 }}
                      onClick={() => setShowRosterModal(false)}
                    >×</button>
                    <h2 style={{ textAlign: "center", marginBottom: 6, color: "#1f3b73", fontSize: 20 }}>Volunteer Roster</h2>
                    <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 20 }}>
                      {project.title} — {volunteers.length} registered
                    </p>
                    {/* Summary bar */}
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
                      <div style={{ background: "#eef9f8", borderRadius: 10, padding: "8px 20px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: "#30bdb7" }}>{volunteers.length}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Registered</div>
                      </div>
                      <div style={{ background: "#e8f0fe", borderRadius: 10, padding: "8px 20px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: "#1f3b73" }}>{attended}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Present</div>
                      </div>
                      <div style={{ background: "#fef3e8", borderRadius: 10, padding: "8px 20px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: "#e07b2a" }}>{volunteers.length - attended}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Absent</div>
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 10, overflow: "hidden" }}>
                      <thead>
                        <tr style={{ background: "#f3f4f8", color: "#23335b" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700 }}>Name</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700 }}>Role</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volunteers.map((v, idx) => {
                          const isPresent = v.progress?.attendance === "present";
                          return (
                            <tr key={v.uid || idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                              <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#1f3b73", fontSize: 13, flexShrink: 0, overflow: "hidden" }}>
                                  {v.avatar ? <img src={v.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(v.displayName)}
                                </div>
                                <span style={{ color: "#111", fontWeight: 500 }}>{v.displayName}</span>
                              </td>
                              <td style={{ padding: "10px 12px", color: "#555", fontSize: 13 }}>
                                {v.role === "faculty" ? "Adviser" : "Volunteer"}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{ background: isPresent ? "#d4f5ef" : "#f5f5f5", color: isPresent ? "#1a7a6e" : "#888", borderRadius: 20, padding: "3px 14px", fontSize: 13, fontWeight: 600 }}>
                                  {isPresent ? "Present" : "Absent"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pre/Post Survey Analytics */}
              {!loadingData && volunteersWithSurveys.length > 0 && (
                <div className="pds-section">
                  <div className="pds-section-label">Survey Analytics</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#555" }}>
                      Pre-Survey: <strong>{volunteersWithSurveys.filter(v => v.preSurveyAnswers).length}</strong> submitted
                    </span>
                    <span style={{ fontSize: 13, color: "#aaa" }}>·</span>
                    <span style={{ fontSize: 13, color: "#555" }}>
                      Post-Survey: <strong>{volunteersWithSurveys.filter(v => v.postSurveyAnswers).length}</strong> submitted
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="pds-btn-pdf"
                      style={{ flex: 1, background: "#1f3b73", color: "#fff", border: "none", borderRadius: 10, padding: "8px 10px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                      onClick={() => { setImpactModalType("pre"); setImpactModalOpen(true); }}
                    >
                      View Pre-Survey Analytics
                    </button>
                    <button
                      className="pds-btn-pdf"
                      style={{ flex: 1, background: "#30bdb7", color: "#fff", border: "none", borderRadius: 10, padding: "8px 10px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                      onClick={() => { setImpactModalType("post"); setImpactModalOpen(true); }}
                    >
                      View Post-Survey Analytics
                    </button>
                  </div>
                </div>
              )}

              {/* ImpactMetrics Modal */}
              {impactModalOpen && (
                <ImpactMetrics
                  open={impactModalOpen}
                  onClose={() => setImpactModalOpen(false)}
                  volunteers={volunteersWithSurveys}
                  showType={impactModalType}
                />
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

              {/* ── Tasks section ── */}
              <div className="pds-section">
                <div className="pds-section-label" style={{ marginBottom: 10 }}>
                  Tasks ({tasks.length})
                </div>

                {!showTaskForm ? (
                  <button
                    onClick={() => setShowTaskForm(true)}
                    style={{ background: "#007bff", color: "#fff", padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 12 }}
                  >
                    + Create New Task
                  </button>
                ) : (
                  <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 10, background: "#f9f9f9", marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#111" }}>
                      {editingTaskId ? "Edit Task" : "Create New Task"}
                    </h4>
                    <form onSubmit={editingTaskId ? handleEditTask : handleCreateTask}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Title *</label>
                        <input type="text" value={taskFormData.title} onChange={e => setTaskFormData(p => ({ ...p, title: e.target.value }))} required style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Description</label>
                        <textarea value={taskFormData.description} onChange={e => setTaskFormData(p => ({ ...p, description: e.target.value }))} rows={3} style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Enrollment Deadline Time</label>
                        <input type="time" value={taskFormData.enrollmentDeadline} onChange={e => setTaskFormData(p => ({ ...p, enrollmentDeadline: e.target.value }))} style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Points (0–1000)</label>
                        <input type="number" value={taskFormData.points} onChange={e => setTaskFormData(p => ({ ...p, points: e.target.value }))} min="0" max="1000" style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Task Type</label>
                        <div style={{ display: "flex", gap: 20 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#111", fontSize: 14 }}>
                            <input type="radio" value="individual" checked={taskFormData.type === "individual"} onChange={() => setTaskFormData(p => ({ ...p, type: "individual" }))} /> Individual
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#111", fontSize: 14 }}>
                            <input type="radio" value="grouped" checked={taskFormData.type === "grouped"} onChange={() => setTaskFormData(p => ({ ...p, type: "grouped" }))} /> Grouped
                          </label>
                        </div>
                      </div>
                      {taskFormData.type === "grouped" && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Max Members per Group</label>
                          <input type="number" value={taskFormData.maxParticipants} onChange={e => setTaskFormData(p => ({ ...p, maxParticipants: e.target.value }))} min="2" max="50" style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button type="submit" disabled={savingTask} style={{ background: "#28a745", color: "#fff", padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                          {savingTask ? "Saving…" : editingTaskId ? "Update Task" : "Create Task"}
                        </button>
                        <button type="button" onClick={cancelTaskForm} disabled={savingTask} style={{ background: "#6c757d", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {loadingTasks ? (
                  <p style={{ color: "#888", fontSize: 13 }}>Loading tasks…</p>
                ) : tasks.length === 0 ? (
                  <p style={{ color: "#aaa", fontSize: 13 }}>No tasks yet. Create one above.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tasks.map(task => (
                      <div key={task.id} style={{ border: "1px solid #e0e4ea", borderRadius: 8, padding: "12px 14px", background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: "#111", fontSize: 14, marginBottom: 4 }}>{task.title}</div>
                            {task.description && <p style={{ margin: "0 0 6px 0", color: "#555", fontSize: 13 }}>{task.description}</p>}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
                              <span style={{ color: "#007bff", fontWeight: 600 }}>
                                Type: {task.type === "grouped" ? "Grouped" : "Individual"}
                              </span>
                              {task.type === "grouped" && task.maxParticipants && (
                                <span style={{ color: "#1976d2", fontWeight: 600 }}>Max/Group: {task.maxParticipants}</span>
                              )}
                              {task.points !== undefined && (
                                <span style={{ color: "#388e3c", fontWeight: 600 }}>Points: {task.points}</span>
                              )}
                              {task.enrollmentDeadline && (
                                <span style={{ color: "#555" }}>Deadline: {task.enrollmentDeadline}</span>
                              )}
                              {task.createdAt && (
                                <span style={{ color: "#aaa" }}>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button onClick={() => startEditTask(task)} disabled={savingTask} style={{ background: "#007bff", color: "#fff", padding: "5px 12px", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Edit</button>
                            <button onClick={() => handleDeleteTask(task.id)} disabled={savingTask} style={{ background: "#dc3545", color: "#fff", padding: "5px 12px", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
