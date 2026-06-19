import { useState, useEffect, useContext } from "react";
import { db } from "../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, collection, getDocs, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { QRCodeCanvas } from "qrcode.react";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ProposalTimeline from "../../components/ProposalTimeline";
import AccomplishmentReportModal from "../../components/AccomplishmentReportModal";
import { SessionContext } from "../../context/sessionContextCore";
import { createNotification, notifyUsersByRoles } from "../../utils/notificationUtils";
import { logAudit } from "../../utils/auditLogger";
import { showToast, showConfirm } from "../../utils/toast";
import ImpactMetrics from "./ImpactMetrics";
import { computeAverageRating } from "../../hooks/rewardSystem";
import "../../styles/ProjectDetailSidebar.css";

const TASK_POINTS_BUDGET = 30;

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
      <circle cx={50} cy={50} r={r} fill="none" stroke="#30bdb7" strokeWidth={12}
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

function FeedbackDonut({ score }) {
  const pct = score ? Math.min(score / 5, 1) : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="#fef9ec" />
      <circle cx={50} cy={50} r={r} fill="none" stroke="#f59e0b" strokeWidth={12}
        strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.6s" }}
      />
      <text x="50%" y="43%" textAnchor="middle" dominantBaseline="central"
        fontSize="17" fontWeight="bold" fill="#1f3b73">
        {score ? score.toFixed(1) : "—"}
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="central"
        fontSize="9" fill="#94a3b8">
        / 5
      </text>
    </svg>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export default function ProjectDetailSidebar({ project, onClose, onApprovalChange }) {
  const { userData } = useContext(SessionContext);
  const [volunteers, setVolunteers] = useState([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [feedbackAvgScore, setFeedbackAvgScore] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectText, setRejectText] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [impactModalOpen, setImpactModalOpen] = useState(false);
  const [impactModalType, setImpactModalType] = useState(null);
  const [volunteersWithSurveys, setVolunteersWithSurveys] = useState([]);
  const [feedbackQROpen, setFeedbackQROpen] = useState(false);
  const [accomplishmentReport, setAccomplishmentReport] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // QR attendance
  const [qrLocation, setQrLocation] = useState(null);
  const [qrLocationName, setQrLocationName] = useState(null);
  const [validQRTimestamp, setValidQRTimestamp] = useState(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [attendanceQROpen, setAttendanceQROpen] = useState(false);

  // Task management
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    title: "", description: "", enrollmentDeadline: "", points: 0,
    type: "individual", maxParticipants: 5,
  });

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const statusStr = (project?.status || "").toLowerCase();
  const isApprovalStage = isForApproval(statusStr) || statusStr === "draft" || statusStr === "rejected";
  const isPublishedOrDone = statusStr === "published" || statusStr === "completed";

  // Init edit data when project changes
  useEffect(() => {
    if (!project) return;
    let targetDateStr = "";
    if (project.targetDate) {
      if (typeof project.targetDate.toDate === "function") {
        targetDateStr = project.targetDate.toDate().toISOString().split("T")[0];
      } else {
        targetDateStr = String(project.targetDate);
      }
    }
    setEditData({
      title: project.title || "",
      description: project.description || "",
      objectives: project.objectives || "",
      location: project.location || "",
      targetDate: targetDateStr,
      volunteerHours: project.volunteerHours ? String(project.volunteerHours) : "",
      budget: project.budget || "",
      stakeholdersText: Array.isArray(project.stakeholders)
        ? project.stakeholders.join("\n")
        : (project.stakeholders || ""),
      partnerSchool: project.partnerSchool || project.partnerName || "",
      affiliatedDepartment: project.affiliatedDepartment || "",
      studentOutcomes: project.studentOutcomes || "",
      successIndicators: Array.isArray(project.successIndicators)
        ? project.successIndicators.join("\n")
        : (project.successIndicators || ""),
    });
    setEditMode(false);
  }, [project?.id]);

  const handleSaveEdit = async () => {
    if (!editData.title.trim()) { showToast("Title is required."); return; }
    setSavingEdit(true);
    try {
      const stakeholdersArr = editData.stakeholdersText.split("\n").map(s => s.trim()).filter(Boolean);
      const successIndicatorsArr = editData.successIndicators.split("\n").map(s => s.trim()).filter(Boolean);
      await updateDoc(doc(db, "missions", project.id), {
        title: editData.title.trim(),
        description: editData.description,
        objectives: editData.objectives,
        location: editData.location,
        targetDate: editData.targetDate,
        volunteerHours: parseInt(editData.volunteerHours) || 0,
        budget: editData.budget,
        stakeholders: stakeholdersArr,
        partnerSchool: editData.partnerSchool,
        affiliatedDepartment: editData.affiliatedDepartment,
        studentOutcomes: editData.studentOutcomes,
        successIndicators: successIndicatorsArr,
        updatedAt: serverTimestamp(),
      });
      logAudit({
        action: "PROJECT_DETAILS_UPDATED",
        category: "proposal",
        actorName: userData?.name || userData?.email || "",
        details: { proposalId: project.id, proposalTitle: editData.title },
      });
      showToast("Project details saved.");
      setEditMode(false);
      if (onApprovalChange) onApprovalChange();
    } catch {
      showToast("Failed to save. Try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const loadEventData = () => {
    if (!project?.id || !isPublishedOrDone) return;
    setLoadingData(true);
    Promise.all([
      getDocs(collection(db, "missions", project.id, "volunteer")),
      getDocs(collection(db, "missions", project.id, "feedbackResponses")),
      getDoc(doc(db, "missions", project.id, "accomplishmentReport", "submission")),
    ]).then(async ([volSnap, fbSnap, arSnap]) => {
      const volData = volSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const profileSnaps = await Promise.all(volData.map(v => getDoc(doc(db, "users", v.uid))));
      const enriched = await Promise.all(
        volData.map(async (v, i) => {
          const p = profileSnaps[i].exists() ? profileSnaps[i].data() : {};
          let preSurveyAnswers = null, postSurveyAnswers = null;
          try {
            const preDoc = await getDoc(doc(db, "missions", project.id, "volunteer", v.uid, "preSurvey", "response"));
            if (preDoc.exists()) preSurveyAnswers = preDoc.data();
          } catch {
            // Optional survey data may not exist yet.
          }
          try {
            const postDoc = await getDoc(doc(db, "missions", project.id, "volunteer", v.uid, "postSurvey", "response"));
            if (postDoc.exists()) postSurveyAnswers = postDoc.data();
          } catch {
            // Optional survey data may not exist yet.
          }
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
      setAccomplishmentReport(arSnap.exists() ? arSnap.data() : null);

      const allAverages = [];
      fbSnap.docs.forEach(d => {
        const data = d.data();
        if (data.ratings && typeof data.ratings === "object") {
          const avg = computeAverageRating(data.ratings);
          if (avg > 0) allAverages.push(avg);
        }
      });
      const missionAvg = allAverages.length > 0
        ? Number((allAverages.reduce((sum, v) => sum + v, 0) / allAverages.length).toFixed(2))
        : null;
      setFeedbackAvgScore(missionAvg);
    }).catch(() => {}).finally(() => setLoadingData(false));
  };

  useEffect(() => {
    loadEventData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, isPublishedOrDone]);

  useEffect(() => {
    if (project?.id) loadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

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
  const canEditProject = isAdmin && !isPublishedOrDone;

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
        [approvalLevel]: name, status: newStatus,
        lastApprovedAt: serverTimestamp(), lastApprovedBy: approvalLevel,
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
        type: "proposal_status", title: "Proposal Status Updated",
        message: `"${project.title || "Untitled"}" is now ${statusLabel}.`,
        link: "/global/review-proposals", proposalId: project.id,
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
        status: "rejected", rejectionReason: rejectText.trim(),
        rejectedBy: approvalLevel, rejectedAt: serverTimestamp(), rejectedByUser: name,
        reviewedBy: "", recommendedBy: "", endorsedBy: "", approvedBy: "",
        "approvals.reviewedBy": null, "approvals.recommendedBy": null,
        "approvals.endorsedBy": null, "approvals.approvedBy": null,
      });
      logAudit({ action: "PROPOSAL_REJECTED", category: "proposal", actorName: name, details: { proposalId: project.id, proposalTitle: project.title || "", rejectionReason: rejectText.trim(), rejectedByRole: approvalLevel } });
      const notifData = {
        type: "proposal_rejected",
        title: "Proposal Rejected",
        message: `${name || "An approver"} rejected your proposal "${project.title || "Untitled"}": ${rejectText.trim()} You can edit and resubmit it.`,
        link: "/student",
        proposalId: project.id,
      };
      Promise.allSettled([
        project.createdBy ? createNotification(project.createdBy, notifData) : Promise.resolve(),
      ]).catch(() => {});
      setActionMsg("Returned to proposer for revision. All approvals cleared.");
      if (onApprovalChange) onApprovalChange();
      setTimeout(onClose, 1500);
    } catch {
      setActionMsg("Error returning. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const loadTasks = async () => {
    if (!project?.id) return;
    setLoadingTasks(true);
    try {
      const snap = await getDocs(collection(db, "missions", project.id, "task"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
      setTasks(list);
    } catch {
      // Task data is optional for older projects.
    }
    finally { setLoadingTasks(false); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) { showToast("Task title is required."); return; }
    setSavingTask(true);
    try {
      const snap = await getDocs(collection(db, "missions", project.id, "task"));
      const nextId = snap.size.toString();
      const currentTotal = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0);
      const budgetLeft = Math.max(0, TASK_POINTS_BUDGET - currentTotal);
      const taskData = {
        title: taskFormData.title, description: taskFormData.description,
        enrollmentDeadline: taskFormData.enrollmentDeadline,
        points: Math.min(budgetLeft, parseInt(taskFormData.points) || 0),
        type: taskFormData.type || "individual", createdAt: new Date().toISOString(),
      };
      if (taskFormData.type === "grouped") taskData.maxParticipants = parseInt(taskFormData.maxParticipants) || 5;
      await setDoc(doc(db, "missions", project.id, "task", nextId), taskData);
      logAudit({ action: "TASK_CREATED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskTitle: taskFormData.title } });
      cancelTaskForm();
      await loadTasks();
    } catch { showToast("Failed to create task."); }
    finally { setSavingTask(false); }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) { showToast("Task title is required."); return; }
    setSavingTask(true);
    try {
      const currentTotal = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0);
      const existingPts = tasks.find(t => t.id === editingTaskId)?.points || 0;
      const maxAllowed = Math.min(TASK_POINTS_BUDGET, Math.max(0, TASK_POINTS_BUDGET - currentTotal + existingPts));
      const updateData = {
        title: taskFormData.title, description: taskFormData.description,
        enrollmentDeadline: taskFormData.enrollmentDeadline,
        points: Math.min(maxAllowed, parseInt(taskFormData.points) || 0), type: taskFormData.type || "individual",
      };
      if (taskFormData.type === "grouped") updateData.maxParticipants = parseInt(taskFormData.maxParticipants) || 5;
      await updateDoc(doc(db, "missions", project.id, "task", editingTaskId), updateData);
      logAudit({ action: "TASK_UPDATED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskId: editingTaskId, taskTitle: taskFormData.title } });
      cancelTaskForm();
      await loadTasks();
    } catch { showToast("Failed to update task."); }
    finally { setSavingTask(false); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!await showConfirm("Delete this task? This cannot be undone.")) return;
    setSavingTask(true);
    try {
      await deleteDoc(doc(db, "missions", project.id, "task", taskId));
      logAudit({ action: "TASK_DELETED", category: "event", details: { missionId: project.id, missionTitle: project.title || "", taskId } });
      await loadTasks();
    } catch { showToast("Failed to delete task."); }
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

  const generateAttendanceQR = () => {
    if (!navigator.geolocation) { showToast("Geolocation is not supported by your browser."); return; }
    setQrGenerating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setQrLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setValidQRTimestamp(Date.now());
        setQrLocationName(null);
        setAttendanceQROpen(true);
        setQrGenerating(false);
      },
      () => { showToast("Could not get location. Please allow location access."); setQrGenerating(false); }
    );
  };

  if (!project) return null;

  const totalAssignedPoints = tasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  const remainingBudget = Math.max(0, TASK_POINTS_BUDGET - totalAssignedPoints);

  const registered = volunteers.length;
  const attended = volunteers.filter(v => v.progress?.attendance === "present").length;

  const feedbackUrl = `${window.location.origin}/global/feedback/${project.id}`;
  const attendanceQRValue = qrLocation
    ? JSON.stringify({ eventId: project.id, location: qrLocation, timestamp: validQRTimestamp })
    : null;

  const typeLabel = project.projectType === "sl" ? "Service Learning"
    : project.projectType === "ce" ? "Community Engagement"
    : project.projectType || "Proposal";

  const statusLabel = isForApproval(project.status) ? "For Approval"
    : statusStr === "rejected" ? "Returned for Revision"
    : project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1)
    : "Draft";

  const statusClass = isForApproval(project.status) ? "pending" : (project.status || "draft").toLowerCase();

  const formatDate = (value) => {
    if (!value) return "N/A";
    try {
      const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
      return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    } catch { return "N/A"; }
  };

  const adviserName = project.adviser || project.facultyAdviser || project.projectAdviser || null;
  const activities = project.activities || project.agenda || project.programOfActivities || null;
  const proponentsText = Array.isArray(project.proponents) && project.proponents.length > 0
    ? project.proponents.join(", ")
    : project.preparedBy || "—";
  const sdgSource = project.sdgs || project.sdg || project.sdgGoals;
  const sdgText = Array.isArray(sdgSource) && sdgSource.length > 0
    ? sdgSource.join(", ")
    : sdgSource || "—";
  const stakeholdersText = Array.isArray(project.stakeholders) && project.stakeholders.length > 0
    ? project.stakeholders.join(", ")
    : project.stakeholders || project.partnerName || "—";
  const activitiesSource = project.specificActivities || activities;
  const activitiesContent = Array.isArray(activitiesSource) && activitiesSource.length > 0
    ? activitiesSource.map((item, index) => (
        <span key={index} className="pds-detail-list-item">
          {typeof item === "string" ? item : item?.name || item?.title || "—"}
        </span>
      ))
    : activitiesSource || "—";
  const successSource = project.successIndicators;
  const successContent = Array.isArray(successSource) && successSource.length > 0
    ? successSource.map((item, index) => <span key={index} className="pds-detail-list-item">{item}</span>)
    : successSource || "—";
  const natureLabel = project.ceFields?.nature || project.slFields?.course || project.nature || typeLabel;
  const assignedFaculty = project.ceFields?.assignedFaculty || project.slFields?.assignedFaculty || adviserName || "—";
  const maxVolunteers = project.maxVolunteers || project.maxParticipants || "—";
  const participantLimit = project.participantLimit || "—";

  const renderProjectDetailsTable = () => (
    <div className="pds-project-sheet">
      <div className="pds-sheet-row pds-sheet-row--top">
        <div className="pds-sheet-cell pds-sheet-cell--wide">
          <div className="pds-sheet-label">Title of Community Engagement Initiative</div>
          <div className="pds-sheet-value">{project.title || "Untitled Project"}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Date Proposed</div>
          <div className="pds-sheet-value">{formatDate(project.dateProposed || project.createdAt)}</div>
        </div>
      </div>

      <div className="pds-sheet-row">
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Name of Proponent(s) / College / Program / Department</div>
          <div className="pds-sheet-value">{proponentsText}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Student Outcomes</div>
          <div className="pds-sheet-value">{project.studentOutcomes || project.ceFields?.learningOutcomes || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">SDG(s)</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value">{sdgText}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Nature of Engagement</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value">{natureLabel}</div>
        </div>
      </div>

      <div className="pds-sheet-row">
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Target Date</div>
          <div className="pds-sheet-value">{project.targetDate || "—"}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Location</div>
          <div className="pds-sheet-value">{project.location || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row">
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Stakeholders</div>
          <div className="pds-sheet-value">{stakeholdersText}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Number of Volunteer Hours</div>
          <div className="pds-sheet-value">{project.volunteerHours || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Description</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value">{project.description || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Objectives</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value">{project.objectives || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Specific Activities</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value pds-sheet-value--stack">{activitiesContent}</div>
          {renderTasksCRUD()}
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Success Indicators</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value pds-sheet-value--stack">{successContent}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--label-value">
        <div className="pds-sheet-label-cell">Budget</div>
        <div className="pds-sheet-cell pds-sheet-cell--value">
          <div className="pds-sheet-value">{project.budget || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row pds-sheet-row--thirds">
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Max Volunteers</div>
          <div className="pds-sheet-value">{maxVolunteers}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Participant Limit</div>
          <div className="pds-sheet-value">{participantLimit}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Points</div>
          <div className="pds-sheet-value">{totalAssignedPoints || "—"}</div>
        </div>
      </div>

      <div className="pds-sheet-row">
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Community Engagement Fields</div>
          <div className="pds-sheet-value">{natureLabel}</div>
        </div>
        <div className="pds-sheet-cell">
          <div className="pds-sheet-label">Assigned Faculty</div>
          <div className="pds-sheet-value">{assignedFaculty}</div>
        </div>
      </div>
    </div>
  );

  const renderRosterAnalyticsPanel = () => (
    <div className="pds-roster-analytics">
      <div className="pds-roster-count-card">
        <span className="pds-roster-count-label">Number of Volunteers in Project Roster</span>
        <strong>{loadingData ? "…" : volunteers.length}</strong>
      </div>
      <button className="pds-roster-action" onClick={() => setShowRosterModal(true)} disabled={loadingData || volunteers.length === 0}>
        View Full Roster
      </button>
      <div className="pds-analytics-actions">
        <button className="pds-analytics-btn pds-analytics-btn--pre"
          onClick={() => { setImpactModalType("pre"); setImpactModalOpen(true); }}
          disabled={loadingData || volunteersWithSurveys.length === 0}>
          View Pre-Survey Analytics
        </button>
        <button className="pds-analytics-btn pds-analytics-btn--post"
          onClick={() => { setImpactModalType("post"); setImpactModalOpen(true); }}
          disabled={loadingData || volunteersWithSurveys.length === 0}>
          View Post-Survey Analytics
        </button>
      </div>
    </div>
  );

  // ── Edit form ─────────────────────────────────────────────────────
  const renderEditForm = () => (
    <div className="pds-ef-wrap">
      <div className="pds-ef-section">
        <div className="pds-ef-section-title">Basic Information</div>
        <div className="pds-ef-field">
          <label>Title *</label>
          <input className="pds-ef-input" value={editData.title}
            onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} />
        </div>
        <div className="pds-ef-row">
          <div className="pds-ef-field">
            <label>Target Date</label>
            <input type="date" className="pds-ef-input" value={editData.targetDate}
              onChange={e => setEditData(p => ({ ...p, targetDate: e.target.value }))} />
          </div>
          <div className="pds-ef-field">
            <label>Volunteer Hours</label>
            <input type="number" className="pds-ef-input" value={editData.volunteerHours}
              onChange={e => setEditData(p => ({ ...p, volunteerHours: e.target.value }))} min="0" />
          </div>
        </div>
        <div className="pds-ef-field">
          <label>Location</label>
          <input className="pds-ef-input" value={editData.location}
            onChange={e => setEditData(p => ({ ...p, location: e.target.value }))}
            placeholder="Venue or community" />
        </div>
        <div className="pds-ef-row">
          <div className="pds-ef-field">
            <label>Partner School / Organization</label>
            <input className="pds-ef-input" value={editData.partnerSchool}
              onChange={e => setEditData(p => ({ ...p, partnerSchool: e.target.value }))} />
          </div>
          <div className="pds-ef-field">
            <label>Affiliated Department</label>
            <input className="pds-ef-input" value={editData.affiliatedDepartment}
              onChange={e => setEditData(p => ({ ...p, affiliatedDepartment: e.target.value }))} />
          </div>
        </div>
        <div className="pds-ef-field">
          <label>Stakeholders <span className="pds-ef-hint">(one per line)</span></label>
          <textarea className="pds-ef-textarea" rows={3} value={editData.stakeholdersText}
            onChange={e => setEditData(p => ({ ...p, stakeholdersText: e.target.value }))}
            placeholder="e.g. Barangay Council&#10;Local school" />
        </div>
      </div>

      <div className="pds-ef-section">
        <div className="pds-ef-section-title">Project Details</div>
        <div className="pds-ef-field">
          <label>Description</label>
          <textarea className="pds-ef-textarea" rows={4} value={editData.description}
            onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
            placeholder="Describe the project" />
        </div>
        <div className="pds-ef-field">
          <label>Objectives</label>
          <textarea className="pds-ef-textarea" rows={4} value={editData.objectives}
            onChange={e => setEditData(p => ({ ...p, objectives: e.target.value }))}
            placeholder="List the main objectives" />
        </div>
        <div className="pds-ef-field">
          <label>Success Indicators <span className="pds-ef-hint">(one per line)</span></label>
          <textarea className="pds-ef-textarea" rows={3} value={editData.successIndicators}
            onChange={e => setEditData(p => ({ ...p, successIndicators: e.target.value }))}
            placeholder="How will you measure success?" />
        </div>
        <div className="pds-ef-field">
          <label>Budget</label>
          <textarea className="pds-ef-textarea" rows={3} value={editData.budget}
            onChange={e => setEditData(p => ({ ...p, budget: e.target.value }))}
            placeholder="Budget breakdown" />
        </div>
        {(project.projectType === "ce") && (
          <div className="pds-ef-field">
            <label>Student Outcomes</label>
            <input className="pds-ef-input" value={editData.studentOutcomes}
              onChange={e => setEditData(p => ({ ...p, studentOutcomes: e.target.value }))}
              placeholder="Expected student outcomes" />
          </div>
        )}
      </div>

      <div className="pds-ef-actions">
        <button className="pds-ef-cancel" onClick={() => setEditMode(false)} disabled={savingEdit}>
          Cancel
        </button>
        <button className="pds-ef-save" onClick={handleSaveEdit} disabled={savingEdit}>
          {savingEdit ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );

  // ── Signatory + Approval actions (right col) ──────────────────────
  const renderRightColApproval = () => (
    <>
      <div className="pds-section">
        <div className="pds-section-label">Signatory Flow</div>
        <ProposalTimeline proposal={project} />
      </div>

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
              <textarea className="pds-textarea" placeholder="Optional note for approval…"
                value={approveNote} onChange={e => setApproveNote(e.target.value)}
                rows={2} disabled={approving} style={{ marginBottom: 8 }} />
              <button className="pds-btn-approve" onClick={handleApprove} disabled={approving}>
                {approving ? "Submitting…" : approvalLevel === "endorsedBy" ? "✓ Endorse" : "✓ Approve"}
              </button>
              <div className="pds-return-label" style={{ marginTop: 16 }}>Reject / Return to proposer</div>
              <textarea className="pds-textarea" placeholder="Reason for rejection (required)…"
                value={rejectText} onChange={e => setRejectText(e.target.value)}
                rows={3} disabled={approving} />
              <button className="pds-btn-return" onClick={handleReject}
                disabled={approving || !rejectText.trim()}>
                {approving ? "Rejecting…" : "✗ Reject"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  // ── QR + Signatory (right col for published) ──────────────────────
  const renderRightColPublished = () => (
    <>
      <div className="pds-section">
        <div className="pds-section-label">QR Codes</div>
        <div className="pds-qr-grid">
          <div className={`pds-qr-card${attendanceQRValue ? " pds-qr-card--clickable" : ""}`}
            onClick={() => attendanceQRValue && setAttendanceQROpen(true)}
            title={attendanceQRValue ? "Click to view attendance QR" : undefined}>
            <div className="pds-qr-label">Student Attendance</div>
            {attendanceQRValue ? (
              <>
                {qrLocationName && <span className="pds-qr-location">{qrLocationName}</span>}
                {validQRTimestamp && (
                  <span className="pds-qr-time">
                    {new Date(validQRTimestamp).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <button className="pds-qr-gen-btn" type="button" onClick={(e) => { e.stopPropagation(); setAttendanceQROpen(true); }}>
                  View QR
                </button>
                {isAdmin && (
                  <button className="pds-qr-regen-btn" type="button" onClick={(e) => { e.stopPropagation(); generateAttendanceQR(); }} disabled={qrGenerating}>
                    {qrGenerating ? "Getting location…" : "Re-generate"}
                  </button>
                )}
              </>
            ) : isAdmin ? (
              <button className="pds-qr-gen-btn" onClick={generateAttendanceQR} disabled={qrGenerating}>
                {qrGenerating ? "Getting location…" : "Generate QR"}
              </button>
            ) : (
              <span className="pds-qr-pending">Not yet generated</span>
            )}
          </div>
          <div className="pds-qr-card pds-qr-card--clickable" onClick={() => setFeedbackQROpen(true)}
            title="Click to enlarge or open link">
            <div className="pds-qr-label">Community Partner Feedback</div>
            <QRCodeCanvas value={feedbackUrl} size={110} />
            <span className="pds-qr-tap-hint">Tap to expand</span>
          </div>
        </div>
      </div>

      <div className="pds-section">
        <div className="pds-section-label">Signatory Flow</div>
        <ProposalTimeline proposal={project} />
      </div>

      {accomplishmentReport && (
        <div className="pds-section">
          <div className="pds-section-label">Accomplishment Report</div>
          <div className="pds-report-block">
            <div className="pds-report-status">
              {accomplishmentReport.status === "approved" ? "Approved" : accomplishmentReport.status === "revision_needed" ? "Revision Needed" : "Submitted"}
            </div>
            <button className="pds-btn-pdf" type="button" onClick={() => setReportModalOpen(true)}>
              View Submitted Report
            </button>
          </div>
        </div>
      )}
    </>
  );

  // ── Tasks CRUD section (published left col) ───────────────────────
  const renderTasksCRUD = () => {
    const editingTaskCurrentPts = editingTaskId ? (tasks.find(t => t.id === editingTaskId)?.points || 0) : 0;
    const maxForForm = editingTaskId
      ? Math.min(TASK_POINTS_BUDGET, remainingBudget + editingTaskCurrentPts)
      : remainingBudget;
    return (
    <div className="pds-section">
      <div className="pds-section-label" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span>Tasks ({tasks.length})</span>
        <span style={{
          background: remainingBudget === 0 ? "#fee2e2" : remainingBudget <= 8 ? "#fef3c7" : "#dcfce7",
          color: remainingBudget === 0 ? "#dc2626" : remainingBudget <= 8 ? "#b45309" : "#15803d",
          borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700,
        }}>
          {totalAssignedPoints}/{TASK_POINTS_BUDGET} pts · {remainingBudget} remaining
        </span>
      </div>

      {!showTaskForm ? (
        canEditProject && (
        <button onClick={() => setShowTaskForm(true)}
          style={{ background: "#007bff", color: "#fff", padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          + Create New Task
        </button>
        )
      ) : (
        canEditProject && (
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
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>
                Points
                <span style={{ fontWeight: 400, color: remainingBudget === 0 && !editingTaskId ? "#dc2626" : "#888", fontSize: 12, marginLeft: 6 }}>
                  ({maxForForm} pts available)
                </span>
              </label>
              <input type="number" value={taskFormData.points} onChange={e => setTaskFormData(p => ({ ...p, points: e.target.value }))} min="0" max={String(maxForForm)} disabled={maxForForm === 0} style={{ width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: `1px solid ${maxForForm === 0 ? "#fca5a5" : "#ccc"}`, boxSizing: "border-box" }} />
              {maxForForm === 0 && !editingTaskId && (
                <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0" }}>Task points budget of 30 is fully used.</p>
              )}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "#111", fontSize: 13 }}>Task Type</label>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
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
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <button type="submit" disabled={savingTask} style={{ background: "#28a745", color: "#fff", padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {savingTask ? "Saving…" : editingTaskId ? "Update Task" : "Create Task"}
              </button>
              <button type="button" onClick={cancelTaskForm} disabled={savingTask} style={{ background: "#6c757d", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        )
      )}

      {loadingTasks ? (
        <p style={{ color: "#888", fontSize: 13 }}>Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: "#aaa", fontSize: 13 }}>{canEditProject ? "No tasks yet. Create one above." : "No tasks yet."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(task => (
            <div key={task.id} style={{ border: "1px solid #e0e4ea", borderRadius: 8, padding: "12px 14px", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#111", fontSize: 14, marginBottom: 4 }}>{task.title}</div>
                  {task.description && <p style={{ margin: "0 0 6px 0", color: "#555", fontSize: 13 }}>{task.description}</p>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
                    <span style={{ color: "#007bff", fontWeight: 600 }}>Type: {task.type === "grouped" ? "Grouped" : "Individual"}</span>
                    {task.type === "grouped" && task.maxParticipants && (
                      <span style={{ color: "#1976d2", fontWeight: 600 }}>Max/Group: {task.maxParticipants}</span>
                    )}
                    {task.points !== undefined && <span style={{ color: "#388e3c", fontWeight: 600 }}>Points: {task.points}</span>}
                    {task.enrollmentDeadline && <span style={{ color: "#555" }}>Deadline: {task.enrollmentDeadline}</span>}
                    {task.createdAt && <span style={{ color: "#aaa" }}>Created: {new Date(task.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                {canEditProject && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                    <button onClick={() => startEditTask(task)} disabled={savingTask} style={{ background: "#007bff", color: "#fff", padding: "5px 12px", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDeleteTask(task.id)} disabled={savingTask} style={{ background: "#dc3545", color: "#fff", padding: "5px 12px", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  return (
    <>
      <div className="pds-overlay" onClick={onClose} />
      <div className="pds-panel">

        {/* ── Header ── */}
        <div className="pds-header">
          <div className="pds-header-row">
            <div className="pds-header-meta">
              <span className="rp-type-tag">{typeLabel}</span>
              <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
            </div>
            <div className="pds-header-actions">
              <button
                className="pds-refresh-btn"
                onClick={() => { loadTasks(); loadEventData(); if (onApprovalChange) onApprovalChange(); }}
                title="Refresh"
              >
                <AutorenewRoundedIcon style={{ fontSize: 18 }} />
              </button>
              {canEditProject && (
                <button
                  className={`pds-edit-btn${editMode ? " pds-edit-btn--active" : ""}`}
                  onClick={() => setEditMode(!editMode)}
                  title={editMode ? "Cancel edit" : "Edit project details"}
                >
                  <EditRoundedIcon style={{ fontSize: 18 }} />
                </button>
              )}
              
              <button className="pds-close" onClick={onClose} aria-label="Close">×</button>
            </div>
          </div>
          <h2 className="pds-title">{project.title || "Untitled Project"}</h2>
        </div>

        {/* ── Two-column body ── */}
        <div className="pds-body">
          <div className="pds-two-col">

            {/* ── LEFT: main content ── */}
            <div className="pds-col-main">
              <div className="pds-col-main-content">
              {canEditProject && editMode ? renderEditForm() : (
                isApprovalStage ? (
                  /* ── Approval / Draft display ── */
                  <>
                    {renderProjectDetailsTable()}
                    {renderRosterAnalyticsPanel()}

                    {project.signedDocUrl && (
                      <div className="pds-section">
                        <div className="pds-section-label">Submitted Document</div>
                        <button className="pds-btn-pdf" onClick={() => setPdfModalOpen(true)}>
                          📄 View Submitted Proposal
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Published / Completed display ── */
                  <>
                    {renderProjectDetailsTable()}
                    {renderRosterAnalyticsPanel()}

                    <div className="pds-stats-container">
                      <div className="pds-section-label">Attendance &amp; Community Feedback</div>
                      {loadingData ? (
                        <p className="pds-loading">Loading…</p>
                      ) : (
                        <div className="pds-stats-row">
                          <div className="pds-stat-block">
                            <div className="pds-stat-sub-label">Attendance</div>
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
                          </div>

                          <div className="pds-stats-divider" />

                          <div className="pds-stat-block">
                            <div className="pds-stat-sub-label">Community Feedback</div>
                            <div className="pds-pie-row">
                              <FeedbackDonut score={feedbackAvgScore} count={feedbackCount} />
                              <div className="pds-pie-legend">
                                <div className="pds-legend-item">
                                  <span className="pds-legend-dot" style={{ background: "#fde68a", border: "2px solid #f59e0b" }} />
                                  <div>
                                    <div className="pds-legend-count">{feedbackCount}</div>
                                    <div className="pds-legend-label">Responses</div>
                                  </div>
                                </div>
                                <div className="pds-legend-item">
                                  <span className="pds-legend-dot" style={{ background: "#f59e0b" }} />
                                  <div>
                                    <div className="pds-legend-count">{feedbackAvgScore ? feedbackAvgScore.toFixed(1) : "—"}</div>
                                    <div className="pds-legend-label">Avg Score</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {impactModalOpen && (
                      <ImpactMetrics open={impactModalOpen} onClose={() => setImpactModalOpen(false)}
                        volunteers={volunteersWithSurveys} showType={impactModalType} />
                    )}

                    {project.signedDocUrl && (
                      <div className="pds-section">
                        <button className="pds-btn-pdf" onClick={() => setPdfModalOpen(true)}>
                          📄 View Project Document
                        </button>
                      </div>
                    )}

                  </>
                )
              )}
              </div> {/* pds-col-main-content */}
            </div>

            {/* ── RIGHT: workflow / QR ── */}
            <div className="pds-col-side">
              {isApprovalStage ? renderRightColApproval() : renderRightColPublished()}
            </div>
          </div>
        </div>
      </div>

      {accomplishmentReport && reportModalOpen && (
        <AccomplishmentReportModal
          missionId={project.id}
          event={project}
          existingReport={accomplishmentReport}
          onClose={() => setReportModalOpen(false)}
          onSubmitted={loadEventData}
        />
      )}

      {/* ── Roster Modal ── */}
      {showRosterModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,62,80,0.25)", zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowRosterModal(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "min(560px, 92vw)", boxSizing: "border-box", boxShadow: "0 4px 24px #0003", position: "relative", color: "#111", maxHeight: "80vh", overflowY: "auto", overflowX: "auto" }}
            onClick={e => e.stopPropagation()}>
            <button className="admin-modal-close admin-modal-close--absolute"
              onClick={() => setShowRosterModal(false)}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: 6, color: "#000", fontSize: 20 }}>Volunteer Roster</h2>
            <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 20 }}>
              {project.title} — {volunteers.length} registered
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ background: "#eef9f8", borderRadius: 10, padding: "8px 20px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#30bdb7" }}>{volunteers.length}</div>
                <div style={{ fontSize: 12, color: "#666" }}>Registered</div>
              </div>
              <div style={{ background: "#e8f0fe", borderRadius: 10, padding: "8px 20px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#000" }}>{attended}</div>
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
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>Points</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((v, idx) => {
                  const isPresent = v.progress?.attendance === "present";
                  const pts = v.pointsEarned ?? v.points ?? null;
                  return (
                    <tr key={v.uid || idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#000", fontSize: 13, flexShrink: 0, overflow: "hidden" }}>
                          {v.avatar ? <img src={v.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(v.displayName)}
                        </div>
                        <span style={{ color: "#111", fontWeight: 500 }}>{v.displayName}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#555", fontSize: 13 }}>
                        {v.role === "faculty" ? "Adviser" : "Volunteer"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {pts !== null ? (
                          <span style={{ background: "#eef9f8", color: "#1a7a6e", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                            {pts} pts
                          </span>
                        ) : (
                          <span style={{ color: "#bbb", fontSize: 13 }}>—</span>
                        )}
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

      {/* ── Feedback QR modal ── */}
      {feedbackQROpen && (
        <div className="pds-pdf-modal-overlay" onClick={() => setFeedbackQROpen(false)}>
          <div className="pds-fqr-modal" onClick={e => e.stopPropagation()}>
            <button className="pds-pdf-modal-close" onClick={() => setFeedbackQROpen(false)}>×</button>
            <div className="pds-fqr-label">Community Partner Feedback</div>
            <QRCodeCanvas value={feedbackUrl} size={220} />
            <div className="pds-fqr-url">{feedbackUrl}</div>
            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer" className="pds-fqr-open-btn">
              Open Link ↗
            </a>
          </div>
        </div>
      )}

      {/* ── Attendance QR modal ── */}
      {attendanceQROpen && attendanceQRValue && (
        <div className="pds-pdf-modal-overlay" onClick={() => setAttendanceQROpen(false)}>
          <div className="pds-fqr-modal" onClick={e => e.stopPropagation()}>
            <button className="pds-pdf-modal-close" onClick={() => setAttendanceQROpen(false)}>×</button>
            <div className="pds-fqr-label">Student Attendance</div>
            <QRCodeCanvas value={attendanceQRValue} size={220} />
            {qrLocationName && <div className="pds-fqr-url">{qrLocationName}</div>}
            {validQRTimestamp && (
              <div className="pds-fqr-url">
                Generated {new Date(validQRTimestamp).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            {isAdmin && (
              <button className="pds-fqr-open-btn" type="button" onClick={generateAttendanceQR} disabled={qrGenerating}>
                {qrGenerating ? "Getting location…" : "Re-generate"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PDF popup viewer ── */}
      {pdfModalOpen && project.signedDocUrl && (
        <div className="pds-pdf-modal-overlay" onClick={() => setPdfModalOpen(false)}>
          <div className="pds-pdf-modal" onClick={e => e.stopPropagation()}>
            <button className="pds-pdf-modal-close" onClick={() => setPdfModalOpen(false)}>×</button>
            <iframe src={project.signedDocUrl} title="Project Document" className="pds-pdf-modal-iframe" />
          </div>
        </div>
      )}
    </>
  );
}
