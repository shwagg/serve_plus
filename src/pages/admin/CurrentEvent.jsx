import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc,
  query, where, serverTimestamp, Timestamp, onSnapshot,
  deleteField,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SessionContext } from "../../context/sessionContextCore";
import { QRCodeCanvas } from "qrcode.react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import "../../styles/CurrentEvent.css";
import LoadingOverlay from "../../components/LoadingOverlay";
import "../../styles/ReviewProposal.css";
import { createNotification } from "../../utils/notificationUtils";
import { showToast, showConfirm } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";

import MissionSubmissionsTable from "./MissionSubmissionsTable";
import { computeAverageRating, getProgramMultiplier } from "../../hooks/rewardSystem";
import { exportAccomplishmentPDF } from "../global/exportAccomplishmentPDF";
import { issueCertificate } from "../../utils/certificateUtils";

// ── helpers ───────────────────────────────────────────────────────────
const ROSTER_ROLE_TAG = {
  lead_organizer: { label: "🎯 Lead", bg: "#f3e8ff", color: "#7c3aed", border: "#d8b4fe" },
  organizer:      { label: "📋 Organizer", bg: "#e8f0fe", color: "#1a73e8", border: "#c5d9fd" },
  donor:          { label: "💛 Donor", bg: "#fef9c3", color: "#a16207", border: "#fde68a" },
};

function getInitials(name) {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeMissionRoles(data = {}) {
  const source = Array.isArray(data.roles) && data.roles.length > 0
    ? data.roles
    : (data.role && data.role !== "volunteer" ? [data.role] : []);
  return source.map(normalizeRole).filter(Boolean);
}

function getDateUrgency(targetDate) {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: "Past Due",      color: "#6b7280", bg: "#f3f4f6" };
  if (diff === 0) return { label: "Today!",        color: "#dc2626", bg: "#fee2e2" };
  if (diff <= 3)  return { label: `${diff}d left`, color: "#dc2626", bg: "#fee2e2" };
  if (diff <= 7)  return { label: `${diff}d left`, color: "#d97706", bg: "#fef3c7" };
  if (diff <= 14) return { label: `${diff}d left`, color: "#2563eb", bg: "#dbeafe" };
  return null;
}

// ── list card ─────────────────────────────────────────────────────────
function EventCard({ mission, onClick, onToggleStatus }) {
  const urgency = getDateUrgency(mission.targetDate);
  const typeLabel = mission.projectType === "sl" ? "Service Learning"
    : mission.projectType === "ce" ? "Community Engagement" : "Event";

  const handleStatusClick = onToggleStatus
    ? (e) => { e.stopPropagation(); onToggleStatus(mission); }
    : undefined;

  return (
    <div className="rp-card ce-event-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick()}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ background: "#e8f0fe", color: "#1a73e8", padding: "3px 10px", borderRadius: 99, fontSize: "0.71rem", fontWeight: 600 }}>
          {typeLabel}
        </span>
        {mission.status === "completed" ? (
          <span
            onClick={handleStatusClick}
            title={onToggleStatus ? "Click to reopen event" : undefined}
            style={{ background: "#e8f0fe", color: "#1a73e8", padding: "3px 8px", borderRadius: 99, fontSize: "0.71rem", fontWeight: 700, cursor: onToggleStatus ? "pointer" : "default" }}
          >
            ✓ Closed
          </span>
        ) : mission.status === "cancelled" ? (
          <span
            onClick={handleStatusClick}
            title={onToggleStatus ? "Click to reopen event" : undefined}
            style={{ background: "#fce8e6", color: "#d93025", padding: "3px 8px", borderRadius: 99, fontSize: "0.71rem", fontWeight: 700, cursor: onToggleStatus ? "pointer" : "default" }}
          >
            ✕ Cancelled
          </span>
        ) : (
          <span
            onClick={handleStatusClick}
            title={onToggleStatus ? "Click to close event" : undefined}
            style={{ background: "#e6f4ea", color: "#137333", padding: "3px 8px", borderRadius: 99, fontSize: "0.71rem", fontWeight: 700, cursor: onToggleStatus ? "pointer" : "default" }}
          >
            ● Active
          </span>
        )}
      </div>

      <h3 style={{ margin: "0 0 5px", color: "#202124", fontSize: "0.97rem", fontWeight: 700, lineHeight: 1.3 }}>
        {mission.title || "Untitled Event"}
      </h3>

      {(mission.preparedBy || (Array.isArray(mission.proponents) && mission.proponents.length > 0)) && (
        <div style={{ fontSize: "0.77rem", color: "#5f6368", marginBottom: 6 }}>
          by <span style={{ fontWeight: 600, color: "#3c4043" }}>
            {Array.isArray(mission.proponents) && mission.proponents.length > 0
              ? mission.proponents[0] : mission.preparedBy}
          </span>
        </div>
      )}

      {mission.description && (
        <p style={{ margin: "0 0 8px", fontSize: "0.81rem", color: "#5f6368", lineHeight: 1.5 }}>
          {mission.description.length > 100
            ? mission.description.slice(0, 100) + "…"
            : mission.description}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 10, marginTop: "auto", borderTop: "1px solid #f1f3f4", fontSize: "0.77rem", color: "#5f6368", alignItems: "center" }}>
        {mission.targetDate && <span>📅 {mission.targetDate}</span>}
        <span className="ce-live-count">
          <span className="ce-live-dot" />
          {mission.volunteerCount} participant{mission.volunteerCount !== 1 ? "s" : ""}
        </span>
      </div>

      {urgency && (
        <div className="ce-urgency-bar" style={{ background: urgency.bg, color: urgency.color, marginTop: 8 }}>
          {urgency.label}
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        style={{ marginTop: 12, width: "100%", padding: "8px 0", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.83rem", cursor: "pointer" }}
      >
        View Roster
      </button>
    </div>
  );
}

// ── detail sub-components ─────────────────────────────────────────────
function DetailField({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>{value}</div>
    </div>
  );
}

function CheckBadge({ ok }) {
  return ok
    ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Done</span>
    : <span style={{ color: "#9ca3af" }}>—</span>;
}

function MetaItem({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: "0.85rem", color: "#1e293b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function CurrentEvent() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useContext(SessionContext);
  const isFaculty = (userData?.role || userData?.userRole || "").toLowerCase() === "faculty";

  // ── list view state ───────────────────────────────────────────────
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const volunteerUnsubRefs = useRef({});

  const [autoFlagStatus, setAutoFlagStatus] = useState(null);
  const [globalFlagging, setGlobalFlagging] = useState(false);
  const [globalFlagResult, setGlobalFlagResult] = useState(null);

  const [showFlaggedModal, setShowFlaggedModal] = useState(false);
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [togglingFlag, setTogglingFlag] = useState({});

  // ── detail view state ─────────────────────────────────────────────
  const [rosterVolunteers, setRosterVolunteers] = useState([]);
  const [missionTitle, setMissionTitle] = useState("");
  const [missionData, setMissionData] = useState(null);
  const [refreshingDetails, setRefreshingDetails] = useState(false);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
    // Allow deep-linking to a tab via ?tab=accomplishment etc.
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return ["roster","details","docs","feedback","accomplishment"].includes(tab) ? tab : "roster";
  });
  // Tracks whether the docs tab has ever been opened so MissionSubmissionsTable
  // stays mounted (via display:none) after first load instead of re-fetching every tab switch.
  const [docsTabVisited, setDocsTabVisited] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "docs";
  });
  const [flagging, setFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState(null);
  const [togglingAttendance, setTogglingAttendance] = useState({});
  const [assigningRole, setAssigningRole] = useState({});   // userId → true while saving
  const [editingRoleFor, setEditingRoleFor] = useState(null); // userId whose role is being edited
  const [pendingRoles, setPendingRoles] = useState([]);       // selected roles in the checkbox UI
  const [roleEditPos, setRoleEditPos] = useState({ top: 0, left: 0 });
  const [volunteerCard, setVolunteerCard] = useState(null);   // { volunteer, x, y }


  // ── edit details state ────────────────────────────────────────────
  const [editingDetails, setEditingDetails] = useState(false);
  const [editDetailsData, setEditDetailsData] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calViewYear, setCalViewYear] = useState(new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth());

  // ── community feedback tab state ─────────────────────────────────
  const [feedbackResponses, setFeedbackResponses] = useState([]);
  const [feedbackLoading, setFeedbackLoading]     = useState(false);

  // ── accomplishment report tab state ───────────────────────────────
  const [accomplishmentReport, setAccomplishmentReport]       = useState(null);
  const [accomplishmentLoading, setAccomplishmentLoading]     = useState(false);
  const [accomplishmentReviewing, setAccomplishmentReviewing] = useState(false);
  const [accomplishmentExporting, setAccomplishmentExporting] = useState(false);
  const [accomplishmentPreviewUrl, setAccomplishmentPreviewUrl] = useState(null);
  const [accomplishmentPreviewGenerating, setAccomplishmentPreviewGenerating] = useState(false);
  const [revisionNote, setRevisionNote]                       = useState("");
  const accomplishmentPreviewUrlRef = useRef(null);

  // ── doc library answer modal state ────────────────────────────────
  // (handled by MissionSubmissionsTable)

  const FLAG_DURATION_DAYS = 30;

  // ── QR + close event state ────────────────────────────────────────
  const [togglingStatus, setTogglingStatus] = useState({});
  const [showAttQR, setShowAttQR]           = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [qrGenerating, setQrGenerating]     = useState(false);
  const [closingEvent, setClosingEvent]     = useState(false);
  const [togglingFeedback, setTogglingFeedback] = useState(false);

  // ── location picker state ─────────────────────────────────────────
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerCoords, setPickerCoords]             = useState(null); // { lat, lng }
  const [pickerAddress, setPickerAddress]           = useState("");
  const [pickerSaving, setPickerSaving]             = useState(false);
  const [pickerSearch, setPickerSearch]             = useState("");
  const [pickerSearching, setPickerSearching]       = useState(false);
  const [pickerSearchError, setPickerSearchError]   = useState("");
  const mapDivRef    = useRef(null);
  const gmapRef      = useRef(null);
  const gmapMarkerRef = useRef(null);

  // ── load published missions with live volunteer counts ────────────
  useEffect(() => {
    if (missionId) return;
    setLoading(true);

    const loadMissions = async () => {
      const q = query(collection(db, "missions"), where("status", "in", ["published", "completed", "cancelled"]));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        volunteerCount: 0,
      }));
      setMissions(data);
      setLoading(false);

      Object.values(volunteerUnsubRefs.current).forEach(u => u());
      volunteerUnsubRefs.current = {};

      data.forEach(m => {
        const vRef = collection(db, "missions", m.id, "volunteer");
        const unsub = onSnapshot(vRef, vSnap => {
          setMissions(prev => prev.map(p =>
            p.id === m.id ? { ...p, volunteerCount: vSnap.size } : p
          ));
        });
        volunteerUnsubRefs.current[m.id] = unsub;
      });
    };

    loadMissions();
    return () => {
      Object.values(volunteerUnsubRefs.current).forEach(u => u());
      volunteerUnsubRefs.current = {};
    };
  }, [missionId]);

  // ── fetch mission title + full data for detail view ───────────────
  const loadMissionDetails = async ({ silent = false } = {}) => {
    if (!missionId) return;
    if (!silent) setRefreshingDetails(true);
    try {
      const d = await getDoc(doc(db, "missions", missionId));
      if (d.exists()) {
        const data = d.data();
        setMissionTitle(data.title || "Event");
        setMissionData({ id: d.id, ...data });
        setEditDetailsData({
          title: data.title || "",
          description: data.description || "",
          objectives: data.objectives || "",
          location: data.location || "",
          targetDate: data.targetDate || "",
          volunteerHours: data.volunteerHours ? String(data.volunteerHours) : "",
          budget: data.budget || "",
          stakeholdersText: Array.isArray(data.stakeholders)
            ? data.stakeholders.join("\n") : (data.stakeholders || ""),
          partnerSchool: data.partnerSchool || data.partnerName || "",
          affiliatedDepartment: data.affiliatedDepartment || data.department || "",
          studentOutcomes: data.studentOutcomes || "",
        });
      }
      await fetchMissionVolunteers();
    } finally {
      if (!silent) setRefreshingDetails(false);
    }
  };

  useEffect(() => {
    loadMissionDetails({ silent: true });
  }, [missionId]);

  const handleSaveDetails = async () => {
    // Published missions: only the target date may be changed
    if (missionData?.status === "published") {
      if (!editDetailsData.targetDate) { showToast("Target date is required."); return; }
      setSavingDetails(true);
      try {
        // Normalise the existing date to a YYYY-MM-DD string for comparison
        let oldDateStr = "";
        if (missionData.targetDate?.toDate) {
          oldDateStr = missionData.targetDate.toDate().toLocaleDateString("en-CA");
        } else if (typeof missionData.targetDate === "string") {
          oldDateStr = missionData.targetDate;
        }
        const newDateStr = editDetailsData.targetDate;

        const updatePayload = { targetDate: newDateStr, updatedAt: serverTimestamp() };
        // On first date change, freeze the approved date as plannedTargetDate
        if (!missionData.plannedTargetDate) {
          updatePayload.plannedTargetDate = oldDateStr;
        }
        await updateDoc(doc(db, "missions", missionId), updatePayload);

        // Best-effort: auto-populate actualStart in the accomplishment report
        try {
          const reportRef = doc(db, "missions", missionId, "accomplishmentReport", "submission");
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists()) {
            const fd = reportSnap.data().formData || {};
            const reportUpdate = {
              "formData.actualStart": newDateStr,
              updatedAt: serverTimestamp(),
            };
            // Also back-fill plannedStart if it was never saved
            if (!fd.plannedStart) {
              reportUpdate["formData.plannedStart"] = oldDateStr || newDateStr;
            }
            await updateDoc(reportRef, reportUpdate);
          }
        } catch (_) { /* non-critical */ }

        logAudit({
          action: "EVENT_DATE_CHANGED",
          category: "event",
          details: {
            missionId,
            missionTitle: missionData.title || "",
            oldDate: oldDateStr,
            newDate: newDateStr,
          },
        });

        const refreshed = await getDoc(doc(db, "missions", missionId));
        if (refreshed.exists()) {
          setMissionData({ id: refreshed.id, ...refreshed.data() });
          setMissionTitle(refreshed.data().title || "Event");
        }
        showToast("Event date updated.");
        setEditingDetails(false);
      } catch {
        showToast("Failed to save. Try again.");
      } finally {
        setSavingDetails(false);
      }
      return;
    }

    // Non-published missions: full edit
    if (!editDetailsData.title.trim()) { showToast("Title is required."); return; }
    setSavingDetails(true);
    try {
      const stakeholdersArr = editDetailsData.stakeholdersText
        .split("\n").map(s => s.trim()).filter(Boolean);
      await updateDoc(doc(db, "missions", missionId), {
        title: editDetailsData.title.trim(),
        description: editDetailsData.description,
        objectives: editDetailsData.objectives,
        location: editDetailsData.location,
        targetDate: editDetailsData.targetDate,
        volunteerHours: parseInt(editDetailsData.volunteerHours) || 0,
        budget: editDetailsData.budget,
        stakeholders: stakeholdersArr,
        partnerSchool: editDetailsData.partnerSchool,
        affiliatedDepartment: editDetailsData.affiliatedDepartment,
        studentOutcomes: editDetailsData.studentOutcomes,
        updatedAt: serverTimestamp(),
      });
      logAudit({
        action: "EVENT_DETAILS_UPDATED",
        category: "event",
        details: { missionId, missionTitle: editDetailsData.title },
      });
      const refreshed = await getDoc(doc(db, "missions", missionId));
      if (refreshed.exists()) {
        setMissionData({ id: refreshed.id, ...refreshed.data() });
        setMissionTitle(refreshed.data().title || "Event");
      }
      showToast("Event details saved.");
      setEditingDetails(false);
    } catch {
      showToast("Failed to save. Try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  // ── auto-flag on list page load ───────────────────────────────────
  useEffect(() => {
    if (missionId) return;
    let cancelled = false;
    (async () => {
      setAutoFlagStatus("running");
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA");
        const missionsSnap = await getDocs(collection(db, "missions"));
        let total = 0;
        for (const mDoc of missionsSnap.docs) {
          if (cancelled) break;
          const m = mDoc.data();
          if (m.status !== "published" && m.status !== "completed") continue;
          total += await flagMission(mDoc, now, todayStr, { allowReFlag: false });
        }
        if (!cancelled) setAutoFlagStatus({ count: total });
      } catch (_) {
        if (!cancelled) setAutoFlagStatus(null);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fetch all volunteers for detail view ──────────────────────────
  async function fetchMissionVolunteers() {
    const vRef = collection(db, "missions", missionId, "volunteer");
    const snap = await getDocs(vRef);

    const results = await Promise.all(snap.docs.map(async (docSnap) => {
      const userId = docSnap.id;
      const vData = docSnap.data();
      const userDoc = await getDoc(doc(db, "users", userId));
      const uData = userDoc.exists() ? userDoc.data() : {};
      const scannedAt = vData.scanAttendance?.scannedAt;
      return {
        id: userId,
        name: uData.name || "Unknown",
        level: uData.level || "--",
        email: uData.email || "",
        department: uData.department || "",
        photoURL: (() => { const p = uData.avatar || uData.photoURL || uData.profilePhoto || ""; return p.includes("ui-avatars.com") ? "" : p; })(),
        totalPoints: uData.totalPoints || 0,
        role: normalizeMissionRoles(vData)[0] || "volunteer",
        roles: normalizeMissionRoles(vData),
        joinedAt: vData.joinedAt,
        registrationStatus: vData.registrationStatus || "pending",
        attendanceStatus: vData.progress?.attendance || null,
        tookAttendanceAt: scannedAt?.toDate ? scannedAt.toDate() : null,
        isFlagged: uData.attendanceFlagged === true,
        flagExpiry: uData.attendanceFlagExpiry?.toDate?.() || null,
      };
    }));

    setRosterVolunteers(results);

    // Auto-sync: keep volunteer.roles aligned with pre-survey participation.
    const docsNeedingRoles = snap.docs.filter(d => normalizeMissionRoles(d.data()).length === 0);
    if (docsNeedingRoles.length > 0) {
      const preSurveySnaps = await Promise.all(
        docsNeedingRoles.map(d =>
          getDoc(doc(db, "missions", missionId, "volunteer", d.id, "preSurvey", "response")).catch(() => null)
        )
      );
      const syncUpdates = [];
      docsNeedingRoles.forEach((d, i) => {
        const pSnap = preSurveySnaps[i];
        if (!pSnap?.exists()) return;
        const participation = pSnap.data()?.engagement?.participation || [];
        const allRoles = participation.map(normalizeRole).filter(Boolean);
        if (allRoles.length > 0) syncUpdates.push({ id: d.id, roles: allRoles });
      });
      if (syncUpdates.length > 0) {
        await Promise.all(syncUpdates.map(u =>
          updateDoc(doc(db, "missions", missionId, "volunteer", u.id), { roles: u.roles, role: deleteField() })
        ));
        setRosterVolunteers(prev => prev.map(v => {
          const upd = syncUpdates.find(u => u.id === v.id);
          return upd ? { ...v, role: upd.roles[0] || "volunteer", roles: upd.roles } : v;
        }));
      }
    }
  }

  useEffect(() => {
    if (!missionId) return;
    fetchMissionVolunteers();
  }, [missionId]);

  useEffect(() => {
    if (!volunteerCard) return;
    const close = () => setVolunteerCard(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [volunteerCard]);

  useEffect(() => {
    if (activeTab === "docs") setDocsTabVisited(true);
  }, [activeTab]);

  useEffect(() => {
    if (editingDetails && missionData?.status === "published") {
      const d = editDetailsData.targetDate ? new Date(editDetailsData.targetDate + "T00:00:00") : new Date();
      setCalViewYear(d.getFullYear());
      setCalViewMonth(d.getMonth());
      setTimeout(() => setCalOpen(true), 60);
    } else {
      setCalOpen(false);
    }
  }, [editingDetails]);

  useEffect(() => {
    if (!missionId || activeTab !== "feedback") return;
    setFeedbackLoading(true);
    getDocs(collection(db, "missions", missionId, "feedbackResponses")).then(snap => {
      setFeedbackResponses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).finally(() => setFeedbackLoading(false));
  }, [missionId, activeTab, detailRefreshKey]);

  useEffect(() => {
    if (!missionId || activeTab !== "accomplishment") return;
    setAccomplishmentLoading(true);
    getDoc(doc(db, "missions", missionId, "accomplishmentReport", "submission"))
      .then(snap => setAccomplishmentReport(snap.exists() ? snap.data() : null))
      .catch(() => setAccomplishmentReport(null))
      .finally(() => setAccomplishmentLoading(false));
  }, [missionId, activeTab, detailRefreshKey]);

  const getAccomplishmentPdfPayload = (report) => ({
    projectType: report?.reportType || "sl",
    formData: {
      ...(report?.formData || {}),
      declarationDate: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
    },
  });

  useEffect(() => {
    if (activeTab !== "accomplishment" || !accomplishmentReport) {
      if (accomplishmentPreviewUrlRef.current) {
        URL.revokeObjectURL(accomplishmentPreviewUrlRef.current);
        accomplishmentPreviewUrlRef.current = null;
      }
      setAccomplishmentPreviewUrl(null);
      setAccomplishmentPreviewGenerating(false);
      return;
    }

    let cancelled = false;
    setAccomplishmentPreviewGenerating(true);

    const generatePreview = async () => {
      try {
        const url = await exportAccomplishmentPDF({
          ...getAccomplishmentPdfPayload(accomplishmentReport),
          returnUrl: true,
        });
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (accomplishmentPreviewUrlRef.current) {
          URL.revokeObjectURL(accomplishmentPreviewUrlRef.current);
        }
        accomplishmentPreviewUrlRef.current = url;
        setAccomplishmentPreviewUrl(url);
      } catch {
        if (!cancelled) setAccomplishmentPreviewUrl(null);
      } finally {
        if (!cancelled) setAccomplishmentPreviewGenerating(false);
      }
    };

    generatePreview();
    return () => { cancelled = true; };
  }, [activeTab, accomplishmentReport]);

  useEffect(() => {
    return () => {
      if (accomplishmentPreviewUrlRef.current) {
        URL.revokeObjectURL(accomplishmentPreviewUrlRef.current);
      }
    };
  }, []);

  const handleAccomplishmentReview = async (status) => {
    if (!missionId) return;
    setAccomplishmentReviewing(true);
    try {
      const reportRef = doc(db, "missions", missionId, "accomplishmentReport", "submission");
      await updateDoc(reportRef, {
        status,
        reviewedAt: serverTimestamp(),
        ...(status === "revision_needed" ? { revisionNote } : { revisionNote: "" }),
      });
      setAccomplishmentReport(prev => prev ? { ...prev, status, ...(status === "revision_needed" ? { revisionNote } : { revisionNote: "" }) } : prev);

      if (status === "approved" && accomplishmentReport?.submittedBy) {
        // Auto-issue certificate for the organizer/lead organizer
        try {
          const submitterId = accomplishmentReport.submittedBy;
          const userSnap = await getDoc(doc(db, "users", submitterId));
          const userData = userSnap.exists() ? userSnap.data() : {};
          const recipientName = userData.name || "Organizer";

          const rawDate = missionData?.targetDate;
          let certDate = rawDate?.toDate ? rawDate.toDate() : rawDate ? new Date(rawDate) : new Date();
          if (isNaN(certDate)) certDate = new Date();
          const certDay   = String(certDate.getDate());
          const certMonth = certDate.toLocaleString("en-US", { month: "long" });
          const certYear  = String(certDate.getFullYear());

          await issueCertificate({
            userId: submitterId,
            recipient: recipientName,
            course: missionData?.title || missionTitle || "",
            date: `${certMonth} ${certDay}, ${certYear}`,
            loc: missionData?.location || "",
            day: certDay,
            month: certMonth,
            year: certYear,
          });

          await updateDoc(doc(db, "missions", missionId, "volunteer", submitterId), {
            certIssuedAt: new Date().toISOString(),
          }).catch(() => {});
        } catch (certErr) {
          console.error("Auto-cert issuance failed:", certErr);
        }
      }

      // Notify the submitter
      if (accomplishmentReport?.submittedBy) {
        await createNotification(accomplishmentReport.submittedBy, {
          type: status === "approved" ? "accomplishment_report_approved" : "accomplishment_report_revision",
          title: status === "approved" ? "Accomplishment Report Approved" : "Accomplishment Report: Revision Needed",
          message: status === "approved"
            ? "Your accomplishment report has been approved! Your certificate has been issued."
            : `Your accomplishment report requires revision: ${revisionNote || "Please review and resubmit."}`,
          link: `/event/${missionId}/activity`,
          missionId,
        });
      }
      showToast(status === "approved" ? "Report approved and certificate issued." : "Revision request sent.", "success");
      setRevisionNote("");
    } catch (e) {
      showToast("Failed to update report status.", "error");
    } finally {
      setAccomplishmentReviewing(false);
    }
  };

  // ── flagging helpers ──────────────────────────────────────────────
  const flagMission = async (missionDoc, now, todayStr, { allowReFlag = true } = {}) => {
    const mission = missionDoc.data ? missionDoc.data() : missionDoc;
    const mid = missionDoc.id;
    let targetDateStr = null;
    if (mission.targetDate?.toDate) {
      targetDateStr = mission.targetDate.toDate().toLocaleDateString("en-CA");
    } else if (typeof mission.targetDate === "string") {
      targetDateStr = mission.targetDate;
    }
    if (!targetDateStr || targetDateStr >= todayStr) return 0;

    const vSnap = await getDocs(
      query(collection(db, "missions", mid, "volunteer"), where("registrationStatus", "==", "approved"))
    );
    let count = 0;
    // The event creator and anyone with an organizer role are exempt from flagging
    const isOrganizerRole = r => r === "organizer" || r === "lead_organizer" || r === "lead organizer";

    for (const vDoc of vSnap.docs) {
      const vData = vDoc.data();
      const userId = vDoc.id;
      if (vData.progress?.attendance === "present") continue;
      if (!allowReFlag && vData.attendanceFlagProcessed === true) continue;
      // Skip the event organizer/proponent — they ran the event, should not be flagged
      if (userId === mission.createdBy) continue;
      if (isOrganizerRole(vData.role)) continue;
      const flagExpiry = new Date(now);
      flagExpiry.setDate(flagExpiry.getDate() + FLAG_DURATION_DAYS);
      await updateDoc(doc(db, "users", userId), {
        attendanceFlagged: true,
        attendanceFlaggedAt: serverTimestamp(),
        attendanceFlagExpiry: Timestamp.fromDate(flagExpiry),
        attendanceFlaggedMissionId: mid,
        attendanceFlaggedMissionTitle: mission.title || "a mission",
      });
      await updateDoc(doc(db, "missions", mid, "volunteer", userId), { attendanceFlagProcessed: true });
      await addDoc(collection(db, "users", userId, "notifications"), {
        type: "attendance_flag",
        title: "Attendance Flag – Mission Restriction",
        message: `You missed attendance for "${mission.title || "a mission"}". You cannot join new missions for ${FLAG_DURATION_DAYS} days (until ${flagExpiry.toLocaleDateString("en-PH")}).`,
        link: `/event/${mid}`,
        eventId: mid,
        read: false,
        createdAt: serverTimestamp(),
      });
      count++;
    }
    return count;
  };

  const handleFlagThisEvent = async () => {
    setFlagging(true);
    setFlagResult(null);
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA");
      const missionDoc = await getDoc(doc(db, "missions", missionId));
      if (!missionDoc.exists()) throw new Error("Mission not found");
      const count = await flagMission(missionDoc, now, todayStr);
      setFlagResult({ ok: true, count });
      await fetchMissionVolunteers();
    } catch (err) {
      setFlagResult({ ok: false, error: err.message });
    } finally {
      setFlagging(false);
    }
  };

  const handleFlagAllEvents = async () => {
    setGlobalFlagging(true);
    setGlobalFlagResult(null);
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA");
      const missionsSnap = await getDocs(collection(db, "missions"));
      let total = 0;
      for (const mDoc of missionsSnap.docs) {
        const m = mDoc.data();
        if (m.status !== "published" && m.status !== "completed") continue;
        total += await flagMission(mDoc, now, todayStr);
      }
      setGlobalFlagResult({ ok: true, count: total });
    } catch (err) {
      setGlobalFlagResult({ ok: false, error: err.message });
    } finally {
      setGlobalFlagging(false);
    }
  };

  const fetchFlaggedStudents = async () => {
    setFlaggedLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("attendanceFlagged", "==", true)));
      setFlaggedStudents(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().email || d.id,
        email: d.data().email || "",
        level: d.data().level || "--",
        flaggedMissionTitle: d.data().attendanceFlaggedMissionTitle || "",
        flagExpiry: d.data().attendanceFlagExpiry?.toDate?.() || null,
      })));
    } finally {
      setFlaggedLoading(false);
    }
  };

  const handleToggleFlag = async (userId, currentlyFlagged) => {
    setTogglingFlag(prev => ({ ...prev, [userId]: true }));
    try {
      if (currentlyFlagged) {
        await updateDoc(doc(db, "users", userId), {
          attendanceFlagged: false,
          attendanceFlagExpiry: null,
          attendanceFlaggedAt: null,
          attendanceFlaggedMissionId: null,
          attendanceFlaggedMissionTitle: null,
        });
        await addDoc(collection(db, "users", userId, "notifications"), {
          type: "attendance_unflag",
          title: "Attendance Flag Removed",
          message: "An admin has removed your attendance flag. You can join missions again.",
          read: false,
          createdAt: serverTimestamp(),
        });
        logAudit({
          action: "VOLUNTEER_UNFLAGGED",
          category: "event",
          details: {
            targetUserId: userId,
            targetUserName: flaggedStudents.find(s => s.id === userId)?.name || rosterVolunteers.find(v => v.id === userId)?.name || "",
          },
        });
        setFlaggedStudents(prev => prev.filter(s => s.id !== userId));
        if (missionId) {
          setRosterVolunteers(prev => prev.map(v =>
            v.id === userId ? { ...v, isFlagged: false, flagExpiry: null } : v
          ));
        }
      } else {
        // Protect the event organizer/proponent from manual flagging
        const targetVolunteer = rosterVolunteers.find(v => v.id === userId);
        const targetRoles = normalizeMissionRoles(targetVolunteer);
        const isOrganizer =
          targetRoles.includes("organizer") ||
          targetRoles.includes("lead_organizer") ||
          userId === missionData?.createdBy;
        if (isOrganizer) {
          showToast("The event organizer/proponent cannot be flagged.");
          return;
        }
        const now = new Date();
        const flagExpiry = new Date(now);
        flagExpiry.setDate(flagExpiry.getDate() + FLAG_DURATION_DAYS);
        await updateDoc(doc(db, "users", userId), {
          attendanceFlagged: true,
          attendanceFlaggedAt: serverTimestamp(),
          attendanceFlagExpiry: Timestamp.fromDate(flagExpiry),
          attendanceFlaggedMissionTitle: "Manual flag by admin",
        });
        await addDoc(collection(db, "users", userId, "notifications"), {
          type: "attendance_flag",
          title: "Attendance Flag – Mission Restriction",
          message: `You have been manually flagged by an admin. You cannot join new missions for 30 days (until ${flagExpiry.toLocaleDateString("en-PH")}).`,
          read: false,
          createdAt: serverTimestamp(),
        });
        logAudit({
          action: "VOLUNTEER_FLAGGED",
          category: "event",
          details: {
            targetUserId: userId,
            targetUserName: rosterVolunteers.find(v => v.id === userId)?.name || "",
            reason: "Manual flag by admin",
          },
        });
        if (showFlaggedModal) await fetchFlaggedStudents();
        if (missionId) {
          setRosterVolunteers(prev => prev.map(v =>
            v.id === userId ? { ...v, isFlagged: true, flagExpiry } : v
          ));
        }
      }
    } finally {
      setTogglingFlag(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleAttendance = async (userId, currentStatus) => {
    const isPresent = currentStatus === "present";
    setTogglingAttendance(prev => ({ ...prev, [userId]: true }));
    try {
      const payload = isPresent
        ? { "progress.attendance": null, "scanAttendance.scannedAt": null, "scanAttendance.markedManually": false }
        : { "progress.attendance": "present", "scanAttendance.scannedAt": serverTimestamp(), "scanAttendance.markedManually": true };
      await updateDoc(doc(db, "missions", missionId, "volunteer", userId), payload);
      const newStatus = isPresent ? null : "present";
      logAudit({
        action: "VOLUNTEER_ATTENDANCE_TOGGLED",
        category: "event",
        details: {
          missionId,
          missionTitle: missionData?.title || "",
          targetUserId: userId,
          targetUserName: rosterVolunteers.find(v => v.id === userId)?.name || "",
          newStatus: isPresent ? "absent" : "present",
          markedManually: true,
        },
      });
      setRosterVolunteers(prev => prev.map(v =>
        v.id === userId
          ? { ...v, attendanceStatus: isPresent ? null : "present", tookAttendanceAt: isPresent ? null : new Date() }
          : v
      ));
    } catch {
      showToast("Failed to update attendance. Try again.");
    } finally {
      setTogglingAttendance(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── assign volunteer roles (admin only, supports multiple) ──────────
  const handleAssignVolunteerRole = async (userId, newRoles) => {
    if (!newRoles || newRoles.length === 0) return;
    const priorityMap = { lead_organizer: 0, organizer: 1, donor: 2, participant: 3, volunteer: 3 };
    const sorted = [...newRoles].sort((a, b) => (priorityMap[a] ?? 99) - (priorityMap[b] ?? 99));
    const primaryRole = sorted[0] || "volunteer";
    setAssigningRole(prev => ({ ...prev, [userId]: true }));
    try {
      await updateDoc(doc(db, "missions", missionId, "volunteer", userId), { roles: newRoles, role: deleteField() });
      updateDoc(doc(db, "userMissions", userId, "missions", missionId), { roles: newRoles, role: deleteField() }).catch(() => {});
      const volunteer = rosterVolunteers.find(v => v.id === userId);
      logAudit({
        action: "VOLUNTEER_ROLE_ASSIGNED",
        category: "event",
        details: {
          missionId,
          missionTitle: missionData?.title || "",
          targetUserId: userId,
          targetUserName: volunteer?.name || "",
          previousRole: volunteer?.role || "",
          newRole: newRoles.join(", "),
        },
      });
      setRosterVolunteers(prev => prev.map(v =>
        v.id === userId ? { ...v, role: undefined, roles: newRoles } : v
      ));
      setEditingRoleFor(null);
      setPendingRoles([]);
      showToast(`Role updated for ${volunteer?.name || "volunteer"}.`);
    } catch {
      showToast("Failed to update role. Please try again.");
    } finally {
      setAssigningRole(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── attendance QR helpers ─────────────────────────────────────────
  const generateAttendanceQR = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by this browser.");
      return;
    }
    setQrGenerating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const newTimestamp = Date.now();
          const qrLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          let qrLocationName = null;
          try {
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${qrLocation.lat},${qrLocation.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
            const geoResp = await fetch(geoUrl);
            if (geoResp.ok) {
              const geoJson = await geoResp.json();
              qrLocationName = geoJson.results?.[0]?.formatted_address ?? null;
            }
          } catch (_) {}
          const payload = { validQRTimestamp: newTimestamp, qrLocation, updatedAt: serverTimestamp() };
          if (qrLocationName) payload.qrLocationName = qrLocationName;
          await updateDoc(doc(db, "missions", missionId), payload);
          const refreshed = await getDoc(doc(db, "missions", missionId));
          if (refreshed.exists()) setMissionData({ id: refreshed.id, ...refreshed.data() });
        } catch (_) {
          showToast("Failed to save QR location. Try again.");
        } finally {
          setQrGenerating(false);
        }
      },
      () => {
        setQrGenerating(false);
        showToast("Could not get your location. Please allow GPS access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Generate QR at a manually picked location
  const generateAttendanceQRAtLocation = async (lat, lng, address) => {
    setPickerSaving(true);
    try {
      const newTimestamp = Date.now();
      const qrLocation = { lat, lng, accuracy: 0 };
      const payload = { validQRTimestamp: newTimestamp, qrLocation, updatedAt: serverTimestamp() };
      if (address) payload.qrLocationName = address;
      await updateDoc(doc(db, "missions", missionId), payload);
      const refreshed = await getDoc(doc(db, "missions", missionId));
      if (refreshed.exists()) setMissionData({ id: refreshed.id, ...refreshed.data() });
      setShowLocationPicker(false);
    } catch (_) {
      showToast("Failed to save location. Try again.");
    } finally {
      setPickerSaving(false);
    }
  };

  const searchPickerLocation = async () => {
    const queryText = pickerSearch.trim();
    if (!queryText) {
      setPickerSearchError("Enter an area or address to search.");
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setPickerSearchError("Google Maps API key not configured.");
      return;
    }
    if (!gmapRef.current || !gmapMarkerRef.current) {
      setPickerSearchError("Map is still loading. Try again in a moment.");
      return;
    }

    setPickerSearching(true);
    setPickerSearchError("");
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryText)}&region=ph&key=${apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("lookup_failed");

      const json = await resp.json();
      const result = json.results?.[0];
      const locationResult = result?.geometry?.location;
      if (!locationResult || typeof locationResult.lat !== "number" || typeof locationResult.lng !== "number") {
        setPickerSearchError("No matching location found. Try a more specific area or address.");
        return;
      }

      const nextCoords = { lat: locationResult.lat, lng: locationResult.lng };
      gmapRef.current.setCenter(nextCoords);
      gmapRef.current.setZoom(17);
      gmapMarkerRef.current.setPosition(nextCoords);
      setPickerCoords(nextCoords);
      setPickerAddress(result.formatted_address || queryText);
    } catch (_) {
      setPickerSearchError("Could not search that location. Try again.");
    } finally {
      setPickerSearching(false);
    }
  };

  // Initialise Google Maps inside the picker modal
  const initLocationPickerMap = () => {
    if (!mapDivRef.current) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { showToast("Google Maps API key not configured."); return; }

    const initMap = (center) => {
      const map = new window.google.maps.Map(mapDivRef.current, {
        center,
        zoom: 17,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: "Drag to set location",
      });
      gmapRef.current = map;
      gmapMarkerRef.current = marker;
      setPickerCoords({ lat: center.lat, lng: center.lng });

      const updateAddress = async (lat, lng) => {
        try {
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
          if (r.ok) {
            const j = await r.json();
            setPickerAddress(j.results?.[0]?.formatted_address ?? "");
          }
        } catch (_) { setPickerAddress(""); }
      };

      updateAddress(center.lat, center.lng);

      marker.addListener("dragend", (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setPickerSearchError("");
        setPickerCoords({ lat, lng });
        updateAddress(lat, lng);
      });

      map.addListener("click", (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        marker.setPosition(e.latLng);
        setPickerSearchError("");
        setPickerCoords({ lat, lng });
        updateAddress(lat, lng);
      });
    };

    const loadAndInit = (center) => {
      if (window.google?.maps) { initMap(center); return; }
      const scriptId = "gmap-picker-script";
      if (!document.getElementById(scriptId)) {
        const s = document.createElement("script");
        s.id = scriptId;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        s.async = true;
        s.onload = () => initMap(center);
        document.head.appendChild(s);
      } else {
        // script tag exists but maps not ready yet — poll briefly
        const poll = setInterval(() => {
          if (window.google?.maps) { clearInterval(poll); initMap(center); }
        }, 100);
      }
    };

    const existingLoc = missionData?.qrLocation;
    if (existingLoc?.lat && existingLoc?.lng) {
      loadAndInit({ lat: existingLoc.lat, lng: existingLoc.lng });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadAndInit({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()    => loadAndInit({ lat: 14.5995, lng: 120.9842 }), // fallback: Manila
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      loadAndInit({ lat: 14.5995, lng: 120.9842 });
    }
  };

  const getAttendanceQRValue = () =>
    JSON.stringify({
      eventId: missionId,
      location: missionData?.qrLocation ?? null,
      timestamp: missionData?.validQRTimestamp ?? null,
    });

  // Init map when picker modal opens
  useEffect(() => {
    if (!showLocationPicker) return;
    // reset state from last open
    setPickerCoords(null);
    setPickerAddress("");
    setPickerSearch("");
    setPickerSearching(false);
    setPickerSearchError("");
    gmapRef.current = null;
    gmapMarkerRef.current = null;
    // defer so the modal div is in the DOM
    const t = setTimeout(() => initLocationPickerMap(), 80);
    return () => clearTimeout(t);
  }, [showLocationPicker]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseEvent = async () => {
    // Decide cancelled vs completed based on whether today is before the target date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let targetDate = null;
    if (missionData?.targetDate?.toDate) {
      targetDate = missionData.targetDate.toDate();
    } else if (typeof missionData?.targetDate === "string") {
      targetDate = new Date(missionData.targetDate);
    }
    if (targetDate) targetDate.setHours(0, 0, 0, 0);
    const isCancelled = targetDate && today < targetDate;
    const newStatus = isCancelled ? "cancelled" : "completed";
    const statusLabel = isCancelled ? "Cancelled" : "Completed";

    if (!await showConfirm(`Close this event? Status will be set to ${statusLabel}. All enrolled volunteers will be notified.`)) return;
    setClosingEvent(true);
    try {
      await updateDoc(doc(db, "missions", missionId), {
        status: newStatus,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Notify every enrolled volunteer
      const notifTitle = isCancelled ? "Event Cancelled" : "Event Completed";
      const notifMessage = isCancelled
        ? `The event "${missionData?.title || "an event"}" has been cancelled.`
        : `The event "${missionData?.title || "an event"}" has been marked as completed. Thank you for participating!`;
      await Promise.all(
        rosterVolunteers.map(v =>
          addDoc(collection(db, "users", v.id, "notifications"), {
            type: isCancelled ? "event_cancelled" : "event_completed",
            title: notifTitle,
            message: notifMessage,
            link: `/event/${missionId}`,
            eventId: missionId,
            read: false,
            createdAt: serverTimestamp(),
          })
        )
      );
      showToast(`Event closed and marked as ${statusLabel}. ${rosterVolunteers.length} volunteer(s) notified.`);
      // Notify the proponent (event creator) when the event is completed
      if (!isCancelled && missionData?.createdBy) {
        try {
          await addDoc(collection(db, "users", missionData.createdBy, "notifications"), {
            type: "event_proponent_recognition",
            title: "🎉 Your Event Was Completed!",
            message: `Great work! "${missionData?.title || "Your event"}" has been successfully completed with ${rosterVolunteers.length} volunteer(s). Thank you for organizing this initiative!`,
            link: `/event/${missionId}`,
            eventId: missionId,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (_) { /* non-critical */ }
      }
      // Stay on the detail page so grades/requirements can still be managed
      setMissionData(prev => prev ? { ...prev, status: newStatus, completedAt: new Date() } : prev);
    } catch (_) {
      showToast("Failed to close event. Try again.");
    } finally {
      setClosingEvent(false);
    }
  };

  // ── reopen event (detail view) ────────────────────────────────────
  const handleReopenEvent = async () => {
    if (!await showConfirm("Reopen this event? Status will be set back to Active.")) return;
    setClosingEvent(true);
    try {
      await updateDoc(doc(db, "missions", missionId), {
        status: "published",
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
      logAudit({
        action: "EVENT_REOPENED",
        category: "event",
        details: { missionId, missionTitle: missionData?.title || "" },
      });
      setMissionData(prev => prev ? { ...prev, status: "published", completedAt: null } : prev);
      showToast("Event reopened and set to Active.");
    } catch {
      showToast("Failed to reopen event. Try again.");
    } finally {
      setClosingEvent(false);
    }
  };

  // ── toggle status from list card ──────────────────────────────────
  const handleToggleEventStatus = async (mission) => {
    if (togglingStatus[mission.id]) return;
    const isOpen = mission.status === "published";

    if (isOpen) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let targetDate = null;
      if (mission.targetDate?.toDate) {
        targetDate = mission.targetDate.toDate();
      } else if (typeof mission.targetDate === "string") {
        targetDate = new Date(mission.targetDate);
      }
      if (targetDate) targetDate.setHours(0, 0, 0, 0);
      const isCancelled = targetDate && today < targetDate;
      const newStatus = isCancelled ? "cancelled" : "completed";
      const statusLabel = isCancelled ? "Cancelled" : "Completed";

      if (!await showConfirm(`Close this event? Status will be set to ${statusLabel}.`)) return;
      setTogglingStatus(prev => ({ ...prev, [mission.id]: true }));
      try {
        await updateDoc(doc(db, "missions", mission.id), {
          status: newStatus,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, status: newStatus } : m));
        logAudit({
          action: "EVENT_STATUS_CHANGED",
          category: "event",
          details: { missionId: mission.id, missionTitle: mission.title, newStatus },
        });
        showToast(`Event marked as ${statusLabel}.`);
      } catch {
        showToast("Failed to update event status. Try again.");
      } finally {
        setTogglingStatus(prev => ({ ...prev, [mission.id]: false }));
      }
    } else {
      if (!await showConfirm("Reopen this event? Status will be set back to Active.")) return;
      setTogglingStatus(prev => ({ ...prev, [mission.id]: true }));
      try {
        await updateDoc(doc(db, "missions", mission.id), {
          status: "published",
          completedAt: null,
          updatedAt: serverTimestamp(),
        });
        setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, status: "published" } : m));
        logAudit({
          action: "EVENT_REOPENED",
          category: "event",
          details: { missionId: mission.id, missionTitle: mission.title },
        });
        showToast("Event reopened and set to Active.");
      } catch {
        showToast("Failed to reopen event. Try again.");
      } finally {
        setTogglingStatus(prev => ({ ...prev, [mission.id]: false }));
      }
    }
  };

  const handleToggleFeedback = async () => {
    const isActive = missionData?.feedback?.isActive;
    const action = isActive ? "close" : "open";
    if (!await showConfirm(`${isActive ? "Close" : "Open"} the community partner feedback form? ${isActive ? "No new responses will be accepted after closing." : "The form will accept responses from the QR link."}`)) return;
    setTogglingFeedback(true);
    try {
      const update = isActive
        ? { "feedback.isActive": false, "feedback.closedAt": serverTimestamp() }
        : { "feedback.isActive": true, "feedback.openedAt": serverTimestamp() };
      await updateDoc(doc(db, "missions", missionId), update);
      const refreshed = await getDoc(doc(db, "missions", missionId));
      if (refreshed.exists()) setMissionData({ id: refreshed.id, ...refreshed.data() });
      showToast(`Feedback form ${isActive ? 'closed' : 'opened'}.`);
    } catch {
      showToast(`Failed to ${action} feedback form. Try again.`);
    } finally {
      setTogglingFeedback(false);
    }
  };

  const buildQRImage = (canvasId, headerText, footerLine1, footerLine2, accentColor) => {
    const qrCanvas = document.getElementById(canvasId);
    if (!qrCanvas) return null;
    const qrSize = qrCanvas.width;
    const pad = 24;
    const headerH = 48;
    const footerH = footerLine2 ? 58 : 40;
    const out = document.createElement("canvas");
    out.width = qrSize + pad * 2;
    out.height = headerH + qrSize + pad + footerH;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = accentColor;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    const truncated = headerText.length > 38 ? headerText.slice(0, 35) + "..." : headerText;
    ctx.fillText(truncated, out.width / 2, 30);
    ctx.drawImage(qrCanvas, pad, headerH);
    ctx.fillStyle = "#374151";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(footerLine1, out.width / 2, headerH + qrSize + pad + 18);
    if (footerLine2) {
      ctx.fillStyle = "#dc2626";
      ctx.font = "12px sans-serif";
      ctx.fillText(footerLine2, out.width / 2, headerH + qrSize + pad + 36);
    }
    return out;
  };

  const downloadAttendanceQR = () => {
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    const expiryStr = expiry.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const out = buildQRImage(
      "att-qr-canvas",
      missionData?.title || missionTitle || "Event",
      "Attendance QR",
      `Expires at: ${expiryStr}`,
      "#234e7b"
    );
    if (!out) return;
    const link = document.createElement("a");
    link.download = `${(missionData?.title || missionTitle || "event").replace(/[^a-z0-9]/gi, "_")}_attendance_qr.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };

  const downloadFeedbackQR = () => {
    const out = buildQRImage(
      "feedback-qr-canvas",
      missionData?.title || missionTitle || "Event",
      "Partner Feedback QR",
      null,
      "#0f766e"
    );
    if (!out) return;
    const link = document.createElement("a");
    link.download = `${(missionData?.title || missionTitle || "event").replace(/[^a-z0-9]/gi, "_")}_partner_feedback_qr.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };

  // ── DETAIL VIEW ───────────────────────────────────────────────────
  if (missionId) {
    const tabs = [
      { key: "roster",         label: "Roster" },
      { key: "details",        label: "Project Details" },
      { key: "docs",           label: "Document Library" },
      { key: "feedback",       label: "Community Feedback" },
      { key: "accomplishment", label: "Accomplishment Report" },
    ];

    const typeLabel =
      missionData?.projectType === "sl" ? "Service Learning"
      : missionData?.projectType === "ce" ? "Community Engagement"
      : "Event";

    return (
      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>

        {/* ── back link ── */}
        <button
          onClick={() => navigate(isFaculty ? "/faculty/current-event" : "/admin/current-event")}
          style={{
            background: "none", border: "none", color: "#1a73e8",
            fontSize: "0.82rem", cursor: "pointer", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 4, padding: 0, fontWeight: 600,
          }}
        >
          ← Back to Events
        </button>

        {/* ── mission hero card ── */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "20px 24px",
          marginBottom: 16, border: "1px solid #e8eaed",
          boxShadow: "0 1px 3px rgba(60,64,67,0.05)",
        }}>
          <div className="ce-detail-header">
            <div className="ce-detail-title-block">
            <h2 style={{ margin: "0 0 10px", color: "#202124", fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3 }}>
              {missionTitle || "Loading…"}
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: "#e8f0fe", color: "#1a73e8", padding: "3px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600 }}>
                {typeLabel}
              </span>
              {missionData?.status === "completed" ? (
                <span style={{ background: "#e8f0fe", color: "#1a73e8", padding: "3px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 700 }}>
                  ✓ Closed
                </span>
              ) : missionData?.status === "cancelled" ? (
                <span style={{ background: "#fce8e6", color: "#d93025", padding: "3px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 700 }}>
                  ✕ Cancelled
                </span>
              ) : (
                <span style={{ background: "#e6f4ea", color: "#137333", padding: "3px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 700 }}>
                  ● Active
                </span>
              )}
              <span style={{ background: "#f8f9fa", color: "#5f6368", padding: "3px 10px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600, border: "1px solid #e8eaed" }}>
                {rosterVolunteers.length}{missionData?.maxStudents ? ` / ${missionData.maxStudents}` : ""} volunteers
              </span>
            </div>
            </div>
          </div>

          {missionData && (
            <div className="ce-meta-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px 20px", paddingTop: 14, borderTop: "1px solid #f1f3f4" }}>
              <MetaItem icon="📅" label="Date"       value={missionData.targetDate} />
              <MetaItem icon="⏰" label="Time"       value={missionData.startTime} />
              <MetaItem icon="📍" label="Location"   value={missionData.location} />
              <MetaItem icon="🏫" label="Dept."      value={missionData.affiliatedDepartment || missionData.department} />
              <MetaItem icon="🤝" label="Partner"    value={missionData.partnerSchool} />
              <MetaItem icon="⏱" label="Hours"      value={missionData.volunteerHours ? `${missionData.volunteerHours}h` : null} />
              <MetaItem icon="⭐" label="Points"     value={missionData.points} />
              <MetaItem icon="👤" label="Prepared by" value={missionData.preparedBy} />
            </div>
          )}

          {missionData?.qrLocationName && (
            <div style={{ marginTop: 10, fontSize: "0.77rem", color: "#5f6368", display: "flex", alignItems: "center", gap: 5, paddingTop: 10, borderTop: "1px solid #f1f3f4" }}>
              <span>📱</span>
              <span>QR pinned at: <b style={{ color: "#3c4043" }}>{missionData.qrLocationName}</b></span>
            </div>
          )}
        </div>

        {/* ── action strip ── */}
        <div className="ce-action-strip" style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {/* QR buttons — visible to all roles */}
          <button className="ce-action-btn" onClick={() => setShowAttQR(true)}>
            Attendance QR
          </button>
          <button className="ce-action-btn" onClick={() => setShowFeedbackQR(true)}>
            Feedback QR
          </button>

          {/* Admin-only actions */}
          {!isFaculty && (
            <>
              <div className="ce-action-divider" style={{ width: 1, height: 28, background: "#e8eaed", margin: "0 4px" }} />
              <div className="ce-tooltip-wrap">
                <button
                  className="ce-action-btn"
                  onClick={handleFlagThisEvent}
                  disabled={flagging}
                >
                  {flagging ? "Flagging…" : "Flag Absent"}
                </button>
                <span className="ce-tooltip">Marks volunteers who missed attendance in this event. Flagged volunteers cannot join new missions for {FLAG_DURATION_DAYS} days.</span>
              </div>
              {missionData?.status === "published" && (
                <button
                  onClick={handleCloseEvent}
                  disabled={closingEvent}
                  style={{
                    padding: "8px 14px",
                    background: closingEvent ? "#f8f9fa" : "#ea4335",
                    color: closingEvent ? "#9aa0a6" : "#fff",
                    border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.82rem",
                    cursor: closingEvent ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {closingEvent ? "Closing…" : "Close Event"}
                </button>
              )}
              {(missionData?.status === "completed" || missionData?.status === "cancelled") && (
                <button
                  onClick={handleReopenEvent}
                  disabled={closingEvent}
                  style={{
                    padding: "8px 14px",
                    background: closingEvent ? "#f8f9fa" : "#137333",
                    color: closingEvent ? "#9aa0a6" : "#fff",
                    border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.82rem",
                    cursor: closingEvent ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {closingEvent ? "Reopening…" : "↺ Reopen Event"}
                </button>
              )}
              {flagResult && (
                <span style={{ fontSize: 12, color: flagResult.ok ? "#137333" : "#d93025", fontWeight: 600 }}>
                  {flagResult.ok ? `${flagResult.count} flagged` : `Error: ${flagResult.error}`}
                </span>
              )}
            </>
          )}
        </div>

        {/* ── tab navigation ── */}
        <div className="ce-tab-nav" style={{ display: "flex", borderBottom: "2px solid #e8eaed", marginBottom: 20 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={`ce-tab-btn${activeTab === t.key ? " active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.key === "roster" && rosterVolunteers.length > 0 && (
                <span style={{
                  background: activeTab === "roster" ? "#1a73e8" : "#e8eaed",
                  color: activeTab === "roster" ? "#fff" : "#5f6368",
                  borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px",
                }}>
                  {rosterVolunteers.length}
                </span>
              )}
              {t.key === "feedback" && (missionData?.feedback?.avgRating != null || feedbackResponses.length > 0) && (
                <span style={{
                  background: activeTab === "feedback" ? "#1a73e8" : "#e8eaed",
                  color: activeTab === "feedback" ? "#fff" : "#5f6368",
                  borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px",
                }}>
                  {feedbackResponses.length > 0 ? feedbackResponses.length : "✓"}
                </span>
              )}
              {t.key === "accomplishment" && accomplishmentReport && (
                <span style={{
                  background: accomplishmentReport.status === "approved"
                    ? "#16a34a"
                    : accomplishmentReport.status === "revision_needed"
                      ? "#d97706"
                      : activeTab === "accomplishment" ? "#1a73e8" : "#e8eaed",
                  color: (accomplishmentReport.status === "approved" || accomplishmentReport.status === "revision_needed" || activeTab === "accomplishment") ? "#fff" : "#5f6368",
                  borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px",
                }}>
                  {accomplishmentReport.status === "approved" ? "✓" : accomplishmentReport.status === "revision_needed" ? "!" : "●"}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Roster tab ── */}
        {activeTab === "roster" && (
          rosterVolunteers.length === 0 ? (
            <div className="empty-label">No volunteers have joined yet.</div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaed" }}>
              <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #e8eaed" }}>
                    <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", letterSpacing: "0.02em", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>
                      Community Members
                      <span style={{ marginLeft: 8, background: "#f1f3f4", color: "#5f6368", borderRadius: 99, fontSize: "0.68rem", padding: "2px 7px", fontWeight: 600 }}>
                        {rosterVolunteers.length}
                      </span>
                    </th>
                    {!isFaculty && <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Flag</th>}
                    <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Level</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Joined</th>
                    <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Attendance</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rosterVolunteers].sort((a, b) => {
                    const rank = r => r === "lead_organizer" ? 0 : r === "organizer" ? 1 : 2;
                    const aRoles = normalizeMissionRoles(a);
                    const bRoles = normalizeMissionRoles(b);
                    const aIsProponent = a.id === missionData?.createdBy ? 0 : Math.min(...aRoles.map(rank));
                    const bIsProponent = b.id === missionData?.createdBy ? 0 : Math.min(...bRoles.map(rank));
                    return aIsProponent - bIsProponent;
                  }).map((v, idx) => {
                    const vAllRoles = normalizeMissionRoles(v);
                    const isOrgHighlight = v.id === missionData?.createdBy || vAllRoles.includes("organizer") || vAllRoles.includes("lead_organizer");
                    return (
                    <tr key={v.id} style={{ borderBottom: idx < rosterVolunteers.length - 1 ? "1px dashed #e8eaed" : "none",
                      ...(isOrgHighlight ? { background: "#f8f6ff" } : {}) }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {v.photoURL ? (
                            <img src={v.photoURL} alt={v.name}
                              style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1.5px solid #e8eaed" }} />
                          ) : (
                            <div style={{
                              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                              background: "#30bdb7", color: "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 700, fontSize: "0.88rem",
                            }}>
                              {getInitials(v.name)}
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span
                                style={{ fontWeight: 600, color: "#202124", cursor: "pointer" }}
                                onClick={e => {
                                  e.stopPropagation();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setVolunteerCard(prev => prev?.volunteer.id === v.id ? null : { volunteer: v, x: r.right + 8, y: r.top });
                                }}
                              >{v.name}</span>
                              {v.isFlagged && (
                                <span
                                  title={`Flagged${v.flagExpiry ? " until " + v.flagExpiry.toLocaleDateString() : ""}`}
                                  style={{ fontSize: 13, lineHeight: 1 }}
                                >🚩</span>
                              )}
                              {normalizeMissionRoles(v).filter(role => role !== "participant" && role !== "volunteer").map(role => {
                                const tag = ROSTER_ROLE_TAG[role];
                                if (!tag) return null;
                                return (
                                  <span key={role} style={{ padding: "1px 7px", background: tag.bg, color: tag.color, borderRadius: 99, fontSize: 10.5, fontWeight: 700, border: `1px solid ${tag.border}` }}>
                                    {tag.label}
                                  </span>
                                );
                              })}
                            </div>
                            {v.email && <div style={{ fontSize: "0.72rem", color: "#80868b", marginTop: 1 }}>{v.email}</div>}
                          </div>
                        </div>
                      </td>
                      {!isFaculty && (
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {v.isFlagged ? (
                            <button
                              disabled={!!togglingFlag[v.id]}
                              onClick={() => handleToggleFlag(v.id, true)}
                              style={{
                                padding: "1px 7px",
                                background: togglingFlag[v.id] ? "#f1f3f4" : "#e6f4ea",
                                color: togglingFlag[v.id] ? "#9aa0a6" : "#137333",
                                border: "none", borderRadius: 4, fontSize: 10.5, fontWeight: 600,
                                cursor: togglingFlag[v.id] ? "not-allowed" : "pointer",
                              }}
                            >
                              {togglingFlag[v.id] ? "…" : "✔ Unflag"}
                            </button>
                          ) : (
                            <span style={{ color: "#dadce0", fontSize: 15 }}>—</span>
                          )}
                        </td>
                      )}
                      <td style={{ padding: "12px 16px", color: "#5f6368", fontSize: "0.82rem" }}>{v.level}</td>
                      <td style={{ padding: "12px 16px", color: "#5f6368", fontSize: "0.82rem" }}>
                        {v.joinedAt ? new Date(v.joinedAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", background: "#f8f9fa" }}>
                        {v.attendanceStatus === "present"
                          ? <span style={{ color: "#137333", fontWeight: 700, fontSize: "0.82rem" }}>✓ Present</span>
                          : <span style={{ color: "#80868b", fontSize: "0.82rem" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            disabled={!!togglingAttendance[v.id]}
                            onClick={() => handleToggleAttendance(v.id, v.attendanceStatus)}
                            style={{
                              padding: "4px 10px",
                              background: v.attendanceStatus === "present" ? "#fce8e6" : "#e6f4ea",
                              color: v.attendanceStatus === "present" ? "#d93025" : "#137333",
                              border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              cursor: togglingAttendance[v.id] ? "not-allowed" : "pointer",
                              opacity: togglingAttendance[v.id] ? 0.6 : 1, whiteSpace: "nowrap",
                            }}
                          >
                            {togglingAttendance[v.id] ? "Saving…" : v.attendanceStatus === "present" ? "Mark Absent" : "Mark Present"}
                          </button>

                          {/* ── Assign roles (admin only, multi-select) ── */}
                          {!isFaculty && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const dropW = 220;
                                const dropH = 280;
                                const wouldClipRight = rect.left + dropW > window.innerWidth - 8;
                                const wouldClipBottom = rect.bottom + 6 + dropH > window.innerHeight - 8;
                                setRoleEditPos({
                                  top: wouldClipBottom ? rect.top - dropH - 6 : rect.bottom + 6,
                                  ...(wouldClipRight
                                    ? { right: window.innerWidth - rect.right }
                                    : { left: rect.left }),
                                });
                                setEditingRoleFor(v.id);
                                setPendingRoles(normalizeMissionRoles(v).length > 0 ? normalizeMissionRoles(v) : ["participant"]);
                              }}
                              style={{
                                padding: "4px 10px", background: "#e8f0fe", color: "#1a73e8",
                                border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                cursor: "pointer", whiteSpace: "nowrap",
                              }}
                            >
                              Assign Role
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )
        )}

        {/* ── Project Details tab ── */}
        {activeTab === "details" && (
          missionData ? (
            <div>
              {/* Edit / Save controls */}
              {!isFaculty && (missionData?.status !== "published" || editingDetails) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
                  {!editingDetails ? (
                    <button onClick={() => setEditingDetails(true)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit Details
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSaveDetails} disabled={savingDetails}
                        style={{ padding: "8px 20px", background: savingDetails ? "#f8f9fa" : "#1a73e8", color: savingDetails ? "#9aa0a6" : "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: savingDetails ? "not-allowed" : "pointer" }}>
                        {savingDetails ? "Saving…" : "Save Changes"}
                      </button>
                      <button onClick={() => setEditingDetails(false)} disabled={savingDetails}
                        style={{ padding: "8px 16px", background: "#fff", color: "#5f6368", border: "1px solid #dadce0", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}

              {editingDetails && missionData?.status !== "published" ? (
                (
                /* ── Full edit form (non-published) ── */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0 32px" }}>
                  {[
                    { label: "Title *", key: "title", type: "text" },
                    { label: "Location", key: "location", type: "text" },
                    { label: "Target Date", key: "targetDate", type: "date" },
                    { label: "Volunteer Hours", key: "volunteerHours", type: "number" },
                    { label: "Partner School / Organization", key: "partnerSchool", type: "text" },
                    { label: "Affiliated Department", key: "affiliatedDepartment", type: "text" },
                  ].map(({ label, key, type }) => (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>{label}</div>
                      <input type={type} value={editDetailsData[key] || ""}
                        onChange={e => setEditDetailsData(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: "0.9rem", fontFamily: "inherit", color: "#1e293b", outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "#1a73e8"}
                        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                      />
                    </div>
                  ))}
                  {[
                    { label: "Description", key: "description", rows: 4 },
                    { label: "Objectives", key: "objectives", rows: 4 },
                    { label: "Budget", key: "budget", rows: 3 },
                    { label: "Student Outcomes", key: "studentOutcomes", rows: 2 },
                    { label: "Stakeholders (one per line)", key: "stakeholdersText", rows: 3 },
                  ].map(({ label, key, rows }) => (
                    <div key={key} style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>{label}</div>
                      <textarea rows={rows} value={editDetailsData[key] || ""}
                        onChange={e => setEditDetailsData(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: "0.9rem", fontFamily: "inherit", color: "#1e293b", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "#1a73e8"}
                        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                      />
                    </div>
                  ))}
                </div>
                )
              ) : (() => {
                /* ── Display view (+ dimmed published date-edit) — CE Proposal Form table layout ── */
                const de = editingDetails && missionData?.status === "published";
                const dLbl    = de ? "#c4cdd6" : "#475569";
                const dVal    = de ? "#b0bec5" : "#1e293b";
                const dGrayBg = de ? "#f4f6f8" : "#f1f5f9";
                const dCellBg = de ? "#fafbfc" : "transparent";

                const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
                const selDate    = editDetailsData.targetDate ? new Date(editDetailsData.targetDate + "T00:00:00") : null;
                const totalCells = new Date(calViewYear, calViewMonth, 1).getDay();
                const daysInMo   = new Date(calViewYear, calViewMonth + 1, 0).getDate();
                const prevMo = () => { if (calViewMonth === 0) { setCalViewMonth(11); setCalViewYear(y => y - 1); } else setCalViewMonth(m => m - 1); };
                const nextMo = () => { if (calViewMonth === 11) { setCalViewMonth(0); setCalViewYear(y => y + 1); } else setCalViewMonth(m => m + 1); };
                const pickDay = d => {
                  const val = `${calViewYear}-${String(calViewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  setEditDetailsData(p => ({ ...p, targetDate: val }));
                  setCalOpen(false);
                };
                const isSelected = d => selDate && d === selDate.getDate() && calViewMonth === selDate.getMonth() && calViewYear === selDate.getFullYear();
                const today = new Date();
                const isToday = d => d === today.getDate() && calViewMonth === today.getMonth() && calViewYear === today.getFullYear();

                return (
                <>
                  <div style={{ border: "1.5px solid #94a3b8", borderRadius: 8, overflow: "hidden" }}>

                    {/* Row: Title | Date Proposed */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", borderRight: "1.5px solid #94a3b8", background: dCellBg }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: dLbl, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Title of Community Engagement Initiative</div>
                        <div style={{ fontSize: "0.93rem", color: dVal }}>{missionData.title || "—"}</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Date Proposed</div>
                        <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>
                          {(() => {
                            const raw = missionData.dateProposed || missionData.createdAt;
                            if (!raw) return "—";
                            const d = raw?.toDate ? raw.toDate() : new Date(raw);
                            return isNaN(d) ? "—" : d.toLocaleDateString("en-CA");
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Row: Proponent(s) + Dept + Partner | Student Outcomes */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", borderRight: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Name of Proponent(s) / College / Program / Department</div>
                        <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>
                          {Array.isArray(missionData.proponents) && missionData.proponents.length > 0
                            ? missionData.proponents.join(", ")
                            : missionData.preparedBy || "—"}
                        </div>
                        {(missionData.affiliatedDepartment || missionData.department) && (
                          <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: 3 }}>{missionData.affiliatedDepartment || missionData.department}</div>
                        )}
                        {missionData.partnerSchool && (
                          <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: 2 }}>Partner: {missionData.partnerSchool}</div>
                        )}
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Student Outcomes</div>
                        <div style={{ fontSize: "0.93rem", color: missionData.studentOutcomes ? "#1e293b" : "#94a3b8", lineHeight: 1.6 }}>{missionData.studentOutcomes || "—"}</div>
                      </div>
                    </div>

                    {/* Row: SDG(s) — gray label column + list */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRight: "1.5px solid #94a3b8", display: "flex", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>SDG(s)</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        {Array.isArray(missionData.sdgs) && missionData.sdgs.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {missionData.sdgs.map((sdg, i) => (
                              <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b", marginBottom: 2 }}>{sdg}</li>
                            ))}
                          </ul>
                        ) : <span style={{ fontSize: "0.93rem", color: "#94a3b8" }}>—</span>}
                      </div>
                    </div>

                    {/* Row: Nature of Engagement — gray label column */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRight: "1.5px solid #94a3b8", display: "flex", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nature of Engagement</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>{missionData.ceFields?.nature || typeLabel || "—"}</div>
                      </div>
                    </div>

                    {/* Row: Target Date | Location */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", borderRight: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Target Date</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {de ? (
                            <div style={{ position: "relative", flex: 1 }}>
                              <div onClick={() => setCalOpen(o => !o)}
                                style={{ padding: "5px 10px", border: "1.5px solid #1a73e8", borderRadius: 7, fontSize: "0.88rem", cursor: "pointer", color: "#1e293b", background: "#fff", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                <span>{editDetailsData.targetDate || "Select date…"}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                              </div>
                              {calOpen && (
                                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1200, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px", boxShadow: "0 6px 24px rgba(0,0,0,0.14)", minWidth: 248 }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                    <button onClick={prevMo} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#475569", padding: "2px 6px" }}>‹</button>
                                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>{CAL_MONTHS[calViewMonth]} {calViewYear}</span>
                                    <button onClick={nextMo} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#475569", padding: "2px 6px" }}>›</button>
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                                    {CAL_DAYS.map(d => <div key={d} style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", padding: "2px 0", marginBottom: 2 }}>{d}</div>)}
                                    {Array.from({ length: totalCells }).map((_, i) => <div key={"e" + i} />)}
                                    {Array.from({ length: daysInMo }, (_, i) => i + 1).map(d => (
                                      <div key={d} onClick={() => pickDay(d)}
                                        style={{ padding: "5px 2px", fontSize: "0.82rem", borderRadius: 6, cursor: "pointer",
                                          background: isSelected(d) ? "#1a73e8" : isToday(d) ? "#e8f0fe" : "transparent",
                                          color: isSelected(d) ? "#fff" : isToday(d) ? "#1a73e8" : "#1e293b" }}>
                                        {d}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>{missionData.targetDate || "—"}</div>
                          )}
                          {!isFaculty && missionData?.status === "published" && !de && (
                            <button onClick={() => { setEditDetailsData({ targetDate: missionData.targetDate || "" }); setEditingDetails(true); }}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "#e8f0fe", color: "#1a73e8", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit Date
                            </button>
                          )}
                        </div>
                        {missionData.startTime && !de && (
                          <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: 2 }}>{missionData.startTime}</div>
                        )}
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Location</div>
                        <div style={{ fontSize: "0.93rem", color: missionData.location ? "#1e293b" : "#94a3b8" }}>{missionData.location || "—"}</div>
                      </div>
                    </div>

                    {/* Row: Stakeholders | Number of Volunteer Hours */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", borderRight: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Stakeholders</div>
                        {Array.isArray(missionData.stakeholders) && missionData.stakeholders.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {missionData.stakeholders.map((s, i) => (
                              <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b" }}>{s}</li>
                            ))}
                          </ul>
                        ) : <span style={{ fontSize: "0.93rem", color: "#94a3b8" }}>—</span>}
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Number of Volunteer Hours</div>
                        <div style={{ fontSize: "0.93rem", color: "#1e293b" }}>{missionData.volunteerHours ?? "—"}</div>
                      </div>
                    </div>

                    {/* Row: Description — gray label column */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRight: "1.5px solid #94a3b8", display: "flex", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.93rem", color: missionData.description ? "#1e293b" : "#94a3b8", lineHeight: 1.65 }}>{missionData.description || "—"}</div>
                      </div>
                    </div>

                    {/* Row: Objectives — gray label column */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRight: "1.5px solid #94a3b8", display: "flex", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Objectives</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.93rem", color: missionData.objectives ? "#1e293b" : "#94a3b8", lineHeight: 1.65 }}>{missionData.objectives || "—"}</div>
                      </div>
                    </div>

                    {/* Row: Specific Activities | Success Indicators */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", borderRight: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Specific Activities</div>
                        {Array.isArray(missionData.specificActivities) && missionData.specificActivities.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {missionData.specificActivities.map((a, i) => (
                              <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b", marginBottom: 2 }}>{a}</li>
                            ))}
                          </ul>
                        ) : typeof missionData.specificActivities === "string" && missionData.specificActivities ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {missionData.specificActivities.split("\n").filter(a => a.trim()).map((a, i) => (
                              <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b", marginBottom: 2 }}>{a}</li>
                            ))}
                          </ul>
                        ) : <span style={{ fontSize: "0.93rem", color: "#94a3b8" }}>—</span>}
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Success Indicators</div>
                        {Array.isArray(missionData.successIndicators) && missionData.successIndicators.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {missionData.successIndicators.map((s, i) => (
                              <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b" }}>{s}</li>
                            ))}
                          </ul>
                        ) : <span style={{ fontSize: "0.93rem", color: "#94a3b8" }}>—</span>}
                      </div>
                    </div>

                    {/* Row: Budget — gray label column */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1.5px solid #94a3b8" }}>
                      <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRight: "1.5px solid #94a3b8", display: "flex", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Budget</div>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.93rem", color: missionData.budget ? "#1e293b" : "#94a3b8", lineHeight: 1.65 }}>{missionData.budget || "—"}</div>
                      </div>
                    </div>

                    {/* Row: Supplemental (Max Volunteers, Limit, Points) */}
                    <div style={{ display: "flex" }}>
                      {[
                        { label: "Max Volunteers",    value: missionData.maxStudents },
                        { label: "Participant Limit",  value: missionData.participantLimit ? `${missionData.participantLimit} students` : null },
                        { label: "Points",             value: missionData.points },
                      ].map(({ label, value }, i, arr) => (
                        <div key={label} style={{ flex: 1, padding: "10px 14px", borderRight: i < arr.length - 1 ? "1.5px solid #94a3b8" : "none" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: "0.93rem", color: value != null ? "#1e293b" : "#94a3b8" }}>{value ?? "—"}</div>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* SL / CE type-specific fields */}
                  {missionData.slFields && (
                    <div style={{ marginTop: 12, border: "1.5px solid #94a3b8", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "8px 14px", background: "#f1f5f9", borderBottom: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Service Learning Fields</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                        {[
                          { label: "Section",          value: missionData.slFields.section },
                          { label: "Course",           value: missionData.slFields.course },
                          { label: "Course Code",      value: missionData.slFields.courseCode },
                          { label: "Assigned Faculty", value: missionData.slFields.assignedFaculty },
                        ].map(({ label, value }, i, arr) => (
                          <div key={label} style={{ padding: "10px 14px", borderRight: i < arr.length - 1 ? "1.5px solid #94a3b8" : "none" }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: "0.93rem", color: value ? "#1e293b" : "#94a3b8" }}>{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {missionData.ceFields && (
                    <div style={{ marginTop: 12, border: "1.5px solid #94a3b8", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "8px 14px", background: "#f1f5f9", borderBottom: "1.5px solid #94a3b8" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Community Engagement Fields</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                        {[
                          { label: "Nature",           value: missionData.ceFields.nature },
                          { label: "Assigned Faculty", value: missionData.ceFields.assignedFaculty },
                        ].map(({ label, value }, i, arr) => (
                          <div key={label} style={{ padding: "10px 14px", borderRight: i < arr.length - 1 ? "1.5px solid #94a3b8" : "none" }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: "0.93rem", color: value ? "#1e293b" : "#94a3b8" }}>{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
                );
              })()}
            </div>
          ) : (
            <div className="loading-message">Loading details…</div>
          )
        )}

        {/* ── Document Library tab ── */}
        {docsTabVisited && (
          <div style={{ display: activeTab === "docs" ? "block" : "none" }}>
            <MissionSubmissionsTable missionId={missionId} missionTitle={missionData?.title || missionTitle || ""} refreshKey={detailRefreshKey} />
          </div>
        )}

        {/* ── Community Feedback tab ── */}
        {activeTab === "feedback" && (() => {
          const RATING_LABELS = {
            overallOrganization: "Overall Organization",
            qualityOfService: "Quality of Service",
            participation: "Participation",
            continuity: "Continuity",
            socialImpact: "Social Impact",
            relevance: "Relevance",
            inclusivity: "Inclusivity",
            knowledge: "Knowledge",
            alignment: "Alignment",
          };

          const avgRating = missionData?.feedback?.avgRating ?? null;
          const multiplier = missionData?.feedback?.multiplier ?? null;
          const responseCount = feedbackResponses.length;

          // Compute per-category averages from responses
          const categoryAverages = {};
          if (responseCount > 0) {
            Object.keys(RATING_LABELS).forEach(key => {
              const vals = feedbackResponses.map(r => r.ratings?.[key]).filter(v => typeof v === "number");
              categoryAverages[key] = vals.length > 0
                ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2))
                : 0;
            });
          }

          return (
            <div>
              {feedbackLoading ? (
                <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>Loading feedback…</div>
              ) : (
                <>
                  {/* ── Stat cards ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Responses", value: responseCount, color: "#0f766e", bg: "#f0fdf4", icon: "📋" },
                      { label: "Avg. Rating", value: avgRating != null ? `${avgRating} / 5` : "—", color: "#d97706", bg: "#fffbeb", icon: "⭐" },
                      { label: "Multiplier", value: multiplier != null ? `×${multiplier}` : "—", color: "#1a73e8", bg: "#e8f0fe", icon: "🔢" },
                    ].map(({ label, value, color, bg, icon }) => (
                      <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px", border: `1px solid ${color}22` }}>
                        <div style={{ fontSize: "1.3rem", marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                    {avgRating != null && (
                      <div style={{ background: "#f8f9fa", borderRadius: 12, padding: "16px 18px", border: "1px solid #e8eaed" }}>
                        <div style={{ fontSize: "1.3rem", marginBottom: 4 }}>📊</div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Rating Tier</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: avgRating >= 4.5 ? "#15803d" : avgRating >= 3.5 ? "#1a73e8" : avgRating >= 2.5 ? "#d97706" : "#dc2626" }}>
                          {avgRating >= 4.5 ? "Excellent" : avgRating >= 3.5 ? "Good" : avgRating >= 2.5 ? "Fair" : "Needs Work"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Per-category vertical bar graph ── */}
                  {responseCount > 0 && (() => {
                    const CHART_H = 180;
                    const Y_TICKS = [0, 1, 2, 3, 4, 5];
                    const ABBR = {
                      overallOrganization: "OO", qualityOfService: "QS",
                      participation: "PA", continuity: "CO", socialImpact: "SI",
                      relevance: "RE", inclusivity: "IN", knowledge: "KN", alignment: "AL",
                    };
                    const getColor = v => v >= 4 ? "#16a34a" : v >= 3 ? "#1a73e8" : v >= 2 ? "#d97706" : "#dc2626";
                    const keys = Object.keys(RATING_LABELS);
                    return (
                      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                        <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" }}>Per-Category Averages</h3>

                        {/* value labels row — sits above the chart, aligned with bars */}
                        <div style={{ display: "flex", gap: 8, paddingLeft: 28, paddingRight: 4, marginBottom: 2 }}>
                          {keys.map(key => {
                            const val = categoryAverages[key] ?? 0;
                            return (
                              <div key={key} style={{ flex: 1, textAlign: "center", fontSize: "0.62rem", fontWeight: 700, color: getColor(val) }}>
                                {val}
                              </div>
                            );
                          })}
                        </div>

                        {/* chart row: y-axis + plot area */}
                        <div style={{ display: "flex" }}>
                          {/* Y-axis labels */}
                          <div style={{ width: 24, flexShrink: 0, position: "relative", height: CHART_H }}>
                            {Y_TICKS.map(v => (
                              <span key={v} style={{
                                position: "absolute", right: 4,
                                bottom: `${(v / 5) * 100}%`,
                                transform: "translateY(50%)",
                                fontSize: "0.58rem", color: "#94a3b8", lineHeight: 1,
                              }}>{v}</span>
                            ))}
                          </div>

                          {/* plot area */}
                          <div style={{ flex: 1, height: CHART_H, position: "relative" }}>
                            {/* gridlines */}
                            {Y_TICKS.map(v => (
                              <div key={v} style={{
                                position: "absolute", left: 0, right: 0,
                                bottom: `${(v / 5) * 100}%`,
                                height: v === 0 ? 2 : 1,
                                background: v === 0 ? "#c4c9d4" : "#f1f3f4",
                              }} />
                            ))}
                            {/* bars */}
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 8, padding: "0 4px" }}>
                              {keys.map(key => {
                                const val = categoryAverages[key] ?? 0;
                                const color = getColor(val);
                                return (
                                  <div key={key} style={{
                                    flex: 1,
                                    height: `${(val / 5) * 100}%`,
                                    minHeight: val > 0 ? 3 : 0,
                                    background: `linear-gradient(to top, ${color}, ${color}99)`,
                                    borderRadius: "4px 4px 0 0",
                                    transition: "height 0.45s ease",
                                  }} />
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* X-axis category name labels */}
                        <div style={{ display: "flex", gap: 8, paddingLeft: 28, paddingRight: 4, marginTop: 5 }}>
                          {keys.map(key => (
                            <div key={key} style={{ flex: 1, textAlign: "center", fontSize: "0.55rem", color: "#64748b", fontWeight: 600, wordBreak: "break-word", lineHeight: 1.2 }}>
                              {RATING_LABELS[key]}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Responses list ── */}
                  <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f3f4", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Responses</span>
                      {responseCount > 0 && (
                        <span style={{ background: "#f1f3f4", color: "#5f6368", borderRadius: 99, fontSize: "0.68rem", padding: "1px 7px", fontWeight: 700 }}>{responseCount}</span>
                      )}
                    </div>
                    {responseCount === 0 ? (
                      <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: "0.88rem" }}>
                        <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
                        No responses yet. Share the feedback QR with the community partner.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "1.5px solid #e8eaed", background: "#f8f9fa" }}>
                              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.78rem", textAlign: "left" }}>Respondent</th>
                              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.78rem", textAlign: "center" }}>Avg Score</th>
                              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.78rem", textAlign: "left" }}>Comments</th>
                              <th style={{ padding: "10px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.78rem", textAlign: "left" }}>Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feedbackResponses.map((r, idx) => {
                              const indivAvg = r.ratings ? computeAverageRating(r.ratings) : 0;
                              const submittedAt = r.submittedAt?.toDate ? r.submittedAt.toDate() : null;
                              return (
                                <tr key={r.id} style={{ borderBottom: idx < feedbackResponses.length - 1 ? "1px dashed #e8eaed" : "none" }}>
                                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#202124" }}>{r.name || <span style={{ color: "#94a3b8" }}>Anonymous</span>}</td>
                                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                    <span style={{
                                      fontWeight: 700, fontSize: "0.85rem",
                                      color: indivAvg >= 4 ? "#16a34a" : indivAvg >= 3 ? "#1a73e8" : indivAvg >= 2 ? "#d97706" : "#dc2626",
                                    }}>{indivAvg} / 5</span>
                                  </td>
                                  <td style={{ padding: "10px 16px", color: "#5f6368", maxWidth: 280 }}>
                                    {r.comments ? (
                                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.comments}</span>
                                    ) : <span style={{ color: "#c4c9d4" }}>—</span>}
                                  </td>
                                  <td style={{ padding: "10px 16px", color: "#80868b", whiteSpace: "nowrap" }}>
                                    {submittedAt ? submittedAt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Accomplishment Report tab ── */}
        {activeTab === "accomplishment" && (() => {
          const fd = accomplishmentReport?.formData || {};
          const photoUrls = accomplishmentReport?.photoUrls || [];
          const statusColors = {
            submitted: { bg: "#dbeafe", color: "#1e40af", label: "Submitted — Awaiting Review" },
            approved:  { bg: "#dcfce7", color: "#166534", label: "Approved" },
            revision_needed: { bg: "#fef3c7", color: "#92400e", label: "Revision Requested" },
          };
          const statusInfo = statusColors[accomplishmentReport?.status] || null;

          const SectionRow = ({ label, value }) => value ? (
            <div className="ce-section-row" style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px dashed #f1f5f9" }}>
              <span className="ce-section-label" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", minWidth: 200, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: "0.85rem", color: "#1e293b", flex: 1 }}>{value}</span>
            </div>
          ) : null;

          return (
            <div>
              {accomplishmentLoading ? (
                <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Loading report…</div>
              ) : !accomplishmentReport ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📝</div>
                  <p style={{ fontWeight: 600, color: "#64748b" }}>No Accomplishment Report submitted yet.</p>
                  <p style={{ fontSize: "0.82rem" }}>The event organizer will submit this after the event ends.</p>
                </div>
              ) : (
                <>
                  {/* Status + meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                    {statusInfo && (
                      <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700 }}>
                        {statusInfo.label}
                      </span>
                    )}
                    {accomplishmentReport.reportType && (
                      <span style={{ background: "#f1f5f9", color: "#475569", padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600 }}>
                        {accomplishmentReport.reportType === "sl" ? "Service-Learning" : "Community Engagement"}
                      </span>
                    )}
                    {accomplishmentReport.submittedAt && (
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                        Submitted: {accomplishmentReport.submittedAt?.toDate?.()?.toLocaleString?.() || "—"}
                      </span>
                    )}
                    {/* Export PDF */}
                    <button
                      onClick={async () => {
                        setAccomplishmentExporting(true);
                        try {
                          await exportAccomplishmentPDF({
                            ...getAccomplishmentPdfPayload(accomplishmentReport),
                            returnUrl: false,
                          });
                        } catch (e) {
                          showToast("PDF export failed: " + e.message);
                        } finally {
                          setAccomplishmentExporting(false);
                        }
                      }}
                      disabled={accomplishmentExporting}
                      style={{ marginLeft: "auto", padding: "7px 16px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: "0.82rem", cursor: accomplishmentExporting ? "not-allowed" : "pointer", opacity: accomplishmentExporting ? 0.6 : 1, whiteSpace: "nowrap" }}
                    >
                      {accomplishmentExporting ? "Exporting…" : "⬇ Export PDF"}
                    </button>
                  </div>

                  {/* PDF Preview */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ padding: "10px 14px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
                      PDF Preview (for verification)
                    </div>
                    {accomplishmentPreviewGenerating ? (
                      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.84rem" }}>
                        Generating preview…
                      </div>
                    ) : accomplishmentPreviewUrl ? (
                      <iframe
                        src={`${accomplishmentPreviewUrl}#navpanes=0&toolbar=0`}
                        title="Accomplishment Report PDF Preview"
                        style={{ width: "100%", height: 340, border: "none", background: "#fff" }}
                      />
                    ) : (
                      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.84rem" }}>
                        Preview unavailable.
                      </div>
                    )}
                  </div>

                  {/* Section I */}
                  <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Section I — Background Information</div>
                    <SectionRow label="Faculty-in-Charge / Student Leader" value={fd.leaderName} />
                    <SectionRow label="Activity Title" value={fd.activityTitle} />
                    <SectionRow label="Location" value={fd.location} />
                    <SectionRow label="Summary Details" value={fd.summaryDetails} />
                    <SectionRow label="SDG(s)" value={fd.sdgs} />
                    <SectionRow label="Volunteer Hours Rendered" value={fd.volunteerHours} />
                    <SectionRow label="Planned Start → End" value={fd.plannedStart && fd.plannedEnd ? `${fd.plannedStart} → ${fd.plannedEnd}` : null} />
                    <SectionRow label="Actual Start → End" value={fd.actualStart && fd.actualEnd ? `${fd.actualStart} → ${fd.actualEnd}` : null} />
                    <SectionRow label="Proposed Budget" value={fd.proposedBudget} />
                    <SectionRow label="Budget Incurred" value={fd.incurredBudget} />
                    {fd.ceNature && <SectionRow label="Nature of CE" value={fd.ceNature} />}
                  </div>

                  {/* Section II */}
                  <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Section II — Results & Beneficiaries</div>
                    <SectionRow label="Goals & Objectives" value={fd.goalsObjectives} />
                    <SectionRow label="Extent Achieved" value={fd.extentAchieved} />
                    <SectionRow label="Recommendations" value={fd.recommendations} />
                    <SectionRow label="Who Benefited" value={fd.beneWho} />
                    <SectionRow label="What Benefits / Involvement" value={fd.beneWhat} />
                    <SectionRow label="Number of Beneficiaries" value={fd.beneCount} />
                  </div>

                  {/* Section III–IV */}
                  {(fd.followUpPlans || fd.comments) && (
                    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Section III–IV — Follow-Up & Comments</div>
                      <SectionRow label="Follow-Up Plans" value={fd.followUpPlans} />
                      <SectionRow label="Comments / Recommendations" value={fd.comments} />
                    </div>
                  )}

                  {/* Section V — Photos */}
                  {photoUrls.length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Section V — Photographs ({photoUrls.length})</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                        {photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", display: "block" }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin review actions */}
                  {accomplishmentReport.status !== "approved" && (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Admin Review</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <button
                          onClick={() => handleAccomplishmentReview("approved")}
                          disabled={accomplishmentReviewing}
                          style={{ padding: "9px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: accomplishmentReviewing ? 0.6 : 1 }}
                        >
                          ✓ Approve Report
                        </button>
                        <div style={{ display: "flex", flex: 1, gap: 8, minWidth: 240 }}>
                          <input
                            style={{ flex: 1, padding: "9px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.85rem" }}
                            placeholder="Revision note (optional)…"
                            value={revisionNote}
                            onChange={e => setRevisionNote(e.target.value)}
                          />
                          <button
                            onClick={() => handleAccomplishmentReview("revision_needed")}
                            disabled={accomplishmentReviewing}
                            style={{ padding: "9px 18px", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap", opacity: accomplishmentReviewing ? 0.6 : 1 }}
                          >
                            ✏ Request Revision
                          </button>
                        </div>
                      </div>
                      {accomplishmentReport.status === "revision_needed" && accomplishmentReport.revisionNote && (
                        <div style={{ marginTop: 10, fontSize: "0.82rem", color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "8px 12px" }}>
                          Last revision note: {accomplishmentReport.revisionNote}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ── Location Picker Modal ── */}
        {showLocationPicker && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowLocationPicker(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, width: "min(520px, 96vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.26)", overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Pick Attendance Location</h3>
                <button className="admin-modal-close" onClick={() => setShowLocationPicker(false)}>×</button>
              </div>
              {/* hint */}
              <div style={{ padding: "8px 18px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontSize: "0.78rem", color: "#475569" }}>
                Search for an area or address, then click the map or drag the marker to fine-tune the QR attendance location.
              </div>
              {/* search */}
              <form
                onSubmit={(e) => { e.preventDefault(); searchPickerLocation(); }}
                style={{ padding: "12px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Search area or address..."
                    value={pickerSearch}
                    onChange={e => {
                      setPickerSearch(e.target.value);
                      if (pickerSearchError) setPickerSearchError("");
                    }}
                    disabled={pickerSearching}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      fontSize: "0.86rem",
                      color: "#1e293b",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={pickerSearching || !pickerSearch.trim()}
                    style={{
                      padding: "10px 14px",
                      background: (pickerSearching || !pickerSearch.trim()) ? "#f8f9fa" : "#1a73e8",
                      color: (pickerSearching || !pickerSearch.trim()) ? "#9aa0a6" : "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: (pickerSearching || !pickerSearch.trim()) ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pickerSearching ? "Searching..." : "Search"}
                  </button>
                </div>
                {pickerSearchError && (
                  <div style={{ fontSize: "0.76rem", color: "#b91c1c", fontWeight: 600 }}>
                    {pickerSearchError}
                  </div>
                )}
              </form>
              {/* map */}
              <div
                ref={mapDivRef}
                className="ce-picker-map"
                style={{ width: "100%", height: 320 }}
              />
              {/* selected address */}
              <div style={{ padding: "10px 18px", borderTop: "1px solid #e5e7eb", fontSize: "0.8rem", color: "#334155", minHeight: 36, display: "flex", alignItems: "center", gap: 6 }}>
                {pickerCoords ? (
                  <>
                    <span>📍</span>
                    <span style={{ flex: 1 }}>{pickerAddress || `${pickerCoords.lat.toFixed(6)}, ${pickerCoords.lng.toFixed(6)}`}</span>
                  </>
                ) : (
                  <span style={{ color: "#94a3b8" }}>No location selected yet.</span>
                )}
              </div>
              {/* actions */}
              <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid #e5e7eb" }}>
                <button
                  onClick={() => setShowLocationPicker(false)}
                  style={{ flex: 1, padding: "10px 0", background: "#f8f9fa", color: "#5f6368", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  disabled={!pickerCoords || pickerSaving}
                  onClick={() => pickerCoords && generateAttendanceQRAtLocation(pickerCoords.lat, pickerCoords.lng, pickerAddress)}
                  style={{
                    flex: 2, padding: "10px 0",
                    background: (!pickerCoords || pickerSaving) ? "#f8f9fa" : "#1a73e8",
                    color: (!pickerCoords || pickerSaving) ? "#9aa0a6" : "#fff",
                    border: "none", borderRadius: 8,
                    fontWeight: 600, fontSize: "0.85rem",
                    cursor: (!pickerCoords || pickerSaving) ? "not-allowed" : "pointer",
                  }}
                >
                  {pickerSaving ? "Saving…" : "Use This Location & Generate QR"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Attendance QR Modal ── */}
        {showAttQR && (
          <div
            onClick={() => setShowAttQR(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, width: "min(420px, 94vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Attendance QR</h3>
                <button className="admin-modal-close" onClick={() => setShowAttQR(false)}>×</button>
              </div>
              <div style={{ padding: "24px 20px", textAlign: "center" }}>
                {missionData?.validQRTimestamp ? (
                  <>
                    <div style={{ display: "inline-block", padding: 14, background: "#f8fafc", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 14 }}>
                      <QRCodeCanvas id="att-qr-canvas" value={getAttendanceQRValue()} size={220} />
                    </div>
                    {missionData?.qrLocationName && (
                      <div style={{ fontSize: "0.8rem", color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <span>📍</span><span>{missionData.qrLocationName}</span>
                      </div>
                    )}
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 18px 0" }}>
                      Students must be within 200 m of the pinned location to scan.
                    </p>
                  </>
                ) : (
                  <div style={{ padding: "20px 0 24px", color: "#64748b" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 10 }}>📱</div>
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>No QR generated yet.<br />Use your current location or pick one on the map.</p>
                  </div>
                )}
                <button
                  disabled={qrGenerating}
                  onClick={generateAttendanceQR}
                  style={{
                    width: "100%", padding: "11px 0",
                    background: qrGenerating ? "#f8f9fa" : "#1a73e8",
                    color: qrGenerating ? "#9aa0a6" : "#fff", border: "none", borderRadius: 8,
                    fontWeight: 600, fontSize: "0.88rem",
                    cursor: qrGenerating ? "not-allowed" : "pointer",
                  }}
                >
                  {qrGenerating ? "Getting location…" : "📍 Use My Current Location"}
                </button>
                <button
                  disabled={qrGenerating}
                  onClick={() => { setShowAttQR(false); setShowLocationPicker(true); }}
                  style={{
                    width: "100%", marginTop: 8, padding: "11px 0",
                    background: "#fff", color: "#1a73e8",
                    border: "1px solid #1a73e8", borderRadius: 8,
                    fontWeight: 600, fontSize: "0.88rem",
                    cursor: qrGenerating ? "not-allowed" : "pointer",
                  }}
                >
                  🗺 Pick Location on Map
                </button>
                {missionData?.validQRTimestamp && (
                  <button
                    onClick={downloadAttendanceQR}
                    style={{
                      width: "100%", marginTop: 8, padding: "10px 0",
                      background: "#f8f9fa", color: "#5f6368",
                      border: "none", borderRadius: 8,
                      fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                    }}
                  >
                    ⬇ Download QR Image
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Partner Feedback QR Modal ── */}
        {showFeedbackQR && (
          <div
            onClick={() => setShowFeedbackQR(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, width: "min(420px, 94vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Partner Feedback QR</h3>
                <button className="admin-modal-close" onClick={() => setShowFeedbackQR(false)}>×</button>
              </div>
              <div style={{ padding: "20px", textAlign: "center" }}>
                {/* status pill */}
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                  <span style={{
                    padding: "4px 14px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700,
                    background: missionData?.feedback?.isActive ? "#dcfce7" : "#fee2e2",
                    color: missionData?.feedback?.isActive ? "#15803d" : "#b91c1c",
                  }}>
                    {missionData?.feedback?.isActive ? "● Form Open — accepting responses" : "● Form Closed — not accepting responses"}
                  </span>
                </div>
                {missionData?.feedback?.avgRating && !missionData.feedback.isActive && (
                  <div style={{ marginBottom: 12, fontSize: "0.82rem", color: "#64748b" }}>
                    Avg. Rating: <b style={{ color: "#1e293b" }}>{missionData.feedback.avgRating}/5</b>
                    {missionData.feedback.multiplier != null && (
                      <> · Multiplier: <b style={{ color: "#1e293b" }}>×{missionData.feedback.multiplier}</b></>
                    )}
                  </div>
                )}
                <div style={{ display: "inline-block", padding: 14, background: "#f8fafc", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 12, opacity: missionData?.feedback?.isActive ? 1 : 0.5 }}>
                  <QRCodeCanvas id="feedback-qr-canvas" value={`${window.location.origin}/global/feedback/${missionId}`} size={200} />
                </div>
                {!missionData?.feedback?.isActive && (
                  <p style={{ fontSize: "0.78rem", color: "#b91c1c", margin: "0 0 10px", fontWeight: 600 }}>
                    QR inactive — open the form first to collect responses.
                  </p>
                )}
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 14px 0" }}>
                  Share with your community partner to collect feedback.
                </p>
                <button
                  onClick={handleToggleFeedback}
                  disabled={togglingFeedback}
                  style={{
                    width: "100%", padding: "10px 0", marginBottom: 8,
                    background: missionData?.feedback?.isActive ? "#ea4335" : "#34a853",
                    color: "#fff", border: "none", borderRadius: 10,
                    fontWeight: 700, fontSize: "0.85rem",
                    cursor: togglingFeedback ? "not-allowed" : "pointer",
                    opacity: togglingFeedback ? 0.7 : 1,
                  }}
                >
                  {togglingFeedback
                    ? "Updating…"
                    : missionData?.feedback?.isActive
                    ? "🔒 Close Feedback Form"
                    : "🔓 Open Feedback Form"}
                </button>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => window.open(`/global/feedback/${missionId}`, "_blank")}
                    style={{ flex: 1, padding: "10px 0", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Open Form ↗
                  </button>
                  <button
                    onClick={() => setShowFeedbackQR(false)}
                    style={{ flex: 1, padding: "10px 0", background: "#f8f9fa", color: "#5f6368", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
                <button
                  onClick={downloadFeedbackQR}
                  style={{
                    width: "100%", padding: "10px 0",
                    background: "#f8f9fa", color: "#5f6368",
                    border: "none", borderRadius: 8,
                    fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                  }}
                >
                  ⬇ Download QR Image
                </button>
              </div>
            </div>
          </div>
        )}

      {/* volunteer contact card popover – detail view */}
      {volunteerCard && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(volunteerCard.y, window.innerHeight - 220),
            left: Math.min(volunteerCard.x, window.innerWidth - 272),
            zIndex: 999,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            border: "1px solid #e8eaed",
            width: 260,
            padding: "16px 18px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {volunteerCard.volunteer.photoURL ? (
              <img
                src={volunteerCard.volunteer.photoURL}
                alt={volunteerCard.volunteer.name}
                style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #e8eaed" }}
              />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#30bdb7",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, flexShrink: 0,
              }}>
                {getInitials(volunteerCard.volunteer.name)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.93rem", color: "#202124", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {volunteerCard.volunteer.name}
              </div>
              {volunteerCard.volunteer.email && (
                <div style={{ fontSize: "0.72rem", color: "#5f6368", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {volunteerCard.volunteer.email}
                </div>
              )}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f3f4", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "Department", value: /\(([^)]+)\)$/.exec(volunteerCard.volunteer.department)?.[1] || volunteerCard.volunteer.department },
              { label: "Level", value: volunteerCard.volunteer.level },
              { label: "Points", value: volunteerCard.volunteer.totalPoints ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                <span style={{ color: "#80868b" }}>{label}</span>
                <span style={{ color: "#202124", fontWeight: 600 }}>{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Floating role assignment dropdown ── */}
      {editingRoleFor && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 14000 }}
            onClick={() => { setEditingRoleFor(null); setPendingRoles([]); }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed",
              top: roleEditPos.top,
              ...(roleEditPos.right != null ? { right: roleEditPos.right } : { left: roleEditPos.left }),
              zIndex: 14001,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              border: "1px solid #e2e8f0",
              minWidth: 210,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                Assign Role
              </div>
              <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                {(() => {
                  const vol = rosterVolunteers.find(v => v.id === editingRoleFor);
                  const current = (vol?.roles?.filter(r => r !== "volunteer") ?? []);
                  return current.length > 0
                    ? current.map(r => ({ lead_organizer: "Lead Organizer", organizer: "Organizer", donor: "Donor", participant: "Participant" })[r] || r).join(", ")
                    : "No role set";
                })()}
              </div>
            </div>

            {/* Role options */}
            <div style={{ padding: "6px 0" }}>
              {[
                { value: "lead_organizer", label: "Lead Organizer"},
                { value: "organizer",      label: "Organizer"},
                { value: "donor",          label: "Donor"},
                { value: "participant",    label: "Participant"},
              ].map(opt => {
                const checked = pendingRoles.includes(opt.value) || (opt.value === "participant" && pendingRoles.includes("volunteer"));
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 16px", cursor: "pointer", userSelect: "none",
                      background: checked ? "#eff6ff" : "transparent",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: checked ? 600 : 400, color: checked ? "#1d4ed8" : "#1e293b" }}>
                      {opt.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!assigningRole[editingRoleFor]}
                      onChange={e => setPendingRoles(prev =>
                        e.target.checked
                          ? [...prev.filter(r => r !== "volunteer"), opt.value]
                          : prev.filter(r => r !== opt.value && r !== "volunteer")
                      )}
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#1a73e8" }}
                    />
                  </label>
                );
              })}
            </div>

            {/* Footer actions */}
            <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8 }}>
              <button
                onClick={() => { setEditingRoleFor(null); setPendingRoles([]); }}
                style={{ padding: "8px 14px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
              >
                ✕
              </button>
              <button
                disabled={pendingRoles.length === 0 || !!assigningRole[editingRoleFor]}
                onClick={() => handleAssignVolunteerRole(editingRoleFor, pendingRoles)}
                style={{
                  flex: 1, padding: "8px 14px", background: "#1a73e8", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
                  cursor: (pendingRoles.length === 0 || assigningRole[editingRoleFor]) ? "not-allowed" : "pointer",
                  opacity: (pendingRoles.length === 0 || assigningRole[editingRoleFor]) ? 0.55 : 1,
                }}
              >
                {assigningRole[editingRoleFor] ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────
  const filtered = missions.filter(m =>
    !searchTerm.trim() || (m.title || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-projects-page">
      {/* header */}
      <div className="ap-header">
        <h1 className="page-title">Current Events</h1>
        <div className="ap-controls">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <svg
              className="search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {!isFaculty && (
          <div className="ce-tooltip-wrap">
            <button
              onClick={() => { setShowFlaggedModal(true); fetchFlaggedStudents(); }}
              style={{
                padding: "7px 14px", background: "#fff", color: "#1a73e8",
                border: "1px solid #1a73e8", borderRadius: 16, fontWeight: 600,
                fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Flagged Volunteers
            </button>
            <span className="ce-tooltip">Shows a list of all volunteers currently flagged for absence. You can manually remove flags from here.</span>
          </div>
          )}
          {!isFaculty && (
          <div className="ce-tooltip-wrap">
            <button
              onClick={handleFlagAllEvents}
              disabled={globalFlagging}
              style={{
                padding: "7px 14px",
                background: globalFlagging ? "#f8f9fa" : "#ea4335",
                color: globalFlagging ? "#9aa0a6" : "#fff",
                border: "none", borderRadius: 16, fontWeight: 600,
                fontSize: "0.82rem", cursor: globalFlagging ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {globalFlagging ? "Flagging..." : "Flag All Events"}
            </button>
            <span className="ce-tooltip">Scans every past event and flags volunteers who missed attendance. This may take a while.</span>
          </div>
          )}
        </div>
      </div>

      {autoFlagStatus === "running" && (
        <div style={{ fontSize: 12, color: "#5f6368", marginBottom: 4 }}>⏳ Checking attendance flags…</div>
      )}
      {autoFlagStatus && autoFlagStatus !== "running" && autoFlagStatus.count > 0 && (
        <div style={{ fontSize: 12, color: "#137333", marginBottom: 4 }}>
          ✅ Auto-flagged {autoFlagStatus.count} volunteer(s)
        </div>
      )}
      {globalFlagResult && (
        <div style={{ fontSize: 13, color: globalFlagResult.ok ? "#137333" : "#d93025", fontWeight: 600, marginBottom: 8 }}>
          {globalFlagResult.ok
            ? `${globalFlagResult.count} volunteer(s) flagged across all events`
            : `Error: ${globalFlagResult.error}`}
        </div>
      )}

      <hr className="ap-divider" />

      {loading ? (
        <LoadingOverlay />
      ) : filtered.length === 0 ? (
        <div className="rp-empty">
          <div className="rp-empty-icon">📅</div>
          <p>{searchTerm ? "No events match your search." : "No active events right now."}</p>
        </div>
      ) : (
        <div className="rp-card-grid">
          {filtered.map(m => (
            <EventCard
              key={m.id}
              mission={m}
              onClick={() => navigate(`${isFaculty ? "/faculty" : "/admin"}/current-event/${m.id}`, { state: { missionTitle: m.title } })}
              onToggleStatus={isFaculty ? null : handleToggleEventStatus}
            />
          ))}
        </div>
      )}

      {/* volunteer contact card popover */}
      {volunteerCard && (
        <>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed",
              top: Math.min(volunteerCard.y, window.innerHeight - 220),
              left: Math.min(volunteerCard.x, window.innerWidth - 272),
              zIndex: 999,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
              border: "1px solid #e8eaed",
              width: 260,
              padding: "16px 18px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {volunteerCard.volunteer.photoURL ? (
                <img
                  src={volunteerCard.volunteer.photoURL}
                  alt={volunteerCard.volunteer.name}
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #e8eaed" }}
                />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "#e8f0fe",
                  color: "#1a73e8", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 700, flexShrink: 0,
                }}>
                  {(volunteerCard.volunteer.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.93rem", color: "#202124", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {volunteerCard.volunteer.name}
                </div>
                {volunteerCard.volunteer.email && (
                  <div style={{ fontSize: "0.72rem", color: "#5f6368", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {volunteerCard.volunteer.email}
                  </div>
                )}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #f1f3f4", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { label: "Department", value: /\(([^)]+)\)$/.exec(volunteerCard.volunteer.department)?.[1] || volunteerCard.volunteer.department },
                { label: "Level", value: volunteerCard.volunteer.level },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                  <span style={{ color: "#80868b" }}>{label}</span>
                  <span style={{ color: "#202124", fontWeight: 600 }}>{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* flagged students modal */}
      {showFlaggedModal && (
        <div
          onClick={() => setShowFlaggedModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            className="ce-flagged-modal-inner"
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 28,
              width: "min(680px, 95vw)", maxHeight: "80vh",
              display: "flex", flexDirection: "column", gap: 16,
              boxShadow: "0 4px 24px rgba(60,64,67,0.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "#202124" }}>🚩 Flagged Absent Volunteers</h3>
              <button
                onClick={() => setShowFlaggedModal(false)}
                className="admin-modal-close"
              >×</button>
            </div>
            {flaggedLoading ? (
              <div style={{ color: "#6b7280", padding: 16 }}>Loading…</div>
            ) : flaggedStudents.length === 0 ? (
              <div style={{ color: "#6b7280", padding: 16 }}>No flagged volunteers.</div>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #e8eaed", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", letterSpacing: "0.02em" }}>Name</th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem" }}>Level</th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem" }}>Flagged For</th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem" }}>Expires</th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedStudents.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: idx < flaggedStudents.length - 1 ? "1px dashed #e8eaed" : "none" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#202124" }}>{s.name}</div>
                          {s.email && s.email !== s.name && (
                            <div style={{ fontSize: "0.75rem", color: "#80868b" }}>{s.email}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#5f6368" }}>{s.level}</td>
                        <td style={{ padding: "10px 12px", color: "#5f6368", fontSize: "0.8rem" }}>
                          {s.flaggedMissionTitle || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "0.8rem", color: "#5f6368" }}>
                          {s.flagExpiry ? s.flagExpiry.toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button
                            disabled={!!togglingFlag[s.id]}
                            onClick={() => handleToggleFlag(s.id, true)}
                            style={{
                              padding: "4px 12px",
                              background: togglingFlag[s.id] ? "#f1f3f4" : "#e6f4ea",
                              color: togglingFlag[s.id] ? "#9aa0a6" : "#137333",
                              border: "none", borderRadius: 6,
                              fontWeight: 600, fontSize: "0.78rem",
                              cursor: togglingFlag[s.id] ? "not-allowed" : "pointer",
                            }}
                          >
                            {togglingFlag[s.id] ? "…" : "✔ Unflag"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
