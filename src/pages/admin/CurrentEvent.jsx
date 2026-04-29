import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc,
  query, where, serverTimestamp, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "../../styles/CurrentEvent.css";
import "../../styles/ReviewProposal.css";
import { createNotification } from "../../utils/notificationUtils";
import { showToast, showConfirm } from "../../utils/toast";

// ── helpers ───────────────────────────────────────────────────────────
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
function EventCard({ mission, onClick }) {
  const urgency = getDateUrgency(mission.targetDate);
  return (
    <div className="rp-card ce-event-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick()}>

      <div className="rp-card-top">
        <div className="rp-card-tags">
          <span className="rp-type-tag">
            {mission.projectType === "sl" ? "Service Learning"
              : mission.projectType === "ce" ? "Community Engagement"
              : "Event"}
          </span>
        </div>
        <span className="status-badge published">Active</span>
      </div>

      <h3 className="rp-card-title">{mission.title || "Untitled Event"}</h3>

      {mission.description && (
        <p className="rp-card-desc">
          {mission.description.length > 100
            ? mission.description.slice(0, 100) + "…"
            : mission.description}
        </p>
      )}

      <div className="rp-card-meta">
        {mission.targetDate && <span>📅 {mission.targetDate}</span>}
        <span className="ce-live-count">
          <span className="ce-live-dot" />
          {mission.volunteerCount} participant{mission.volunteerCount !== 1 ? "s" : ""}
        </span>
      </div>

      {urgency && (
        <div className="ce-urgency-bar" style={{ background: urgency.bg, color: urgency.color }}>
          {urgency.label}
        </div>
      )}

      <div className="rp-card-footer">
        <button className="rp-review-btn" onClick={e => { e.stopPropagation(); onClick(); }}>
          View Roster →
        </button>
      </div>
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
  const [activeTab, setActiveTab] = useState("roster");
  const [docLibVolunteers, setDocLibVolunteers] = useState([]);
  const [docLibLoading, setDocLibLoading] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState(null);
  const [togglingAttendance, setTogglingAttendance] = useState({});

  const FLAG_DURATION_DAYS = 30;

  // ── QR + close event state ────────────────────────────────────────
  const [showAttQR, setShowAttQR]           = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [qrGenerating, setQrGenerating]     = useState(false);
  const [closingEvent, setClosingEvent]     = useState(false);
  const [togglingFeedback, setTogglingFeedback] = useState(false);

  // ── load published missions with live volunteer counts ────────────
  useEffect(() => {
    if (missionId) return;
    setLoading(true);

    const loadMissions = async () => {
      const q = query(collection(db, "missions"), where("status", "==", "published"));
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
  useEffect(() => {
    if (!missionId) return;
    getDoc(doc(db, "missions", missionId)).then(d => {
      if (d.exists()) {
        setMissionTitle(d.data().title || "Event");
        setMissionData({ id: d.id, ...d.data() });
      }
    });
  }, [missionId]);

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
        joinedAt: vData.joinedAt,
        registrationStatus: vData.registrationStatus || "pending",
        attendanceStatus: vData.progress?.attendance || null,
        tookAttendanceAt: scannedAt?.toDate ? scannedAt.toDate() : null,
        isFlagged: uData.attendanceFlagged === true,
        flagExpiry: uData.attendanceFlagExpiry?.toDate?.() || null,
      };
    }));

    setRosterVolunteers(results);
  }

  useEffect(() => {
    if (!missionId) return;
    fetchMissionVolunteers();
  }, [missionId]);

  // ── load document library tab data ────────────────────────────────
  const loadDocLib = async () => {
    if (docLibVolunteers.length > 0) return;
    setDocLibLoading(true);
    try {
      const vRef = collection(db, "missions", missionId, "volunteer");
      const snap = await getDocs(vRef);

      const results = await Promise.all(snap.docs.map(async (d) => {
        const userId = d.id;
        const vData = d.data();
        const userDoc = await getDoc(doc(db, "users", userId));
        const uData = userDoc.exists() ? userDoc.data() : {};

        let preSurvey = false, postSurvey = false;
        try {
          const preDoc = await getDoc(doc(db, "missions", missionId, "volunteer", userId, "preSurvey", "response"));
          preSurvey = preDoc.exists();
        } catch (_) {}
        try {
          const postDoc = await getDoc(doc(db, "missions", missionId, "volunteer", userId, "postSurvey", "response"));
          postSurvey = postDoc.exists();
        } catch (_) {}

        return {
          id: userId,
          name: uData.name || "Unknown",
          preSurvey,
          consent: vData.progress?.consent === "submitted",
          attendance: vData.progress?.attendance === "present",
          postSurvey,
        };
      }));

      setDocLibVolunteers(results);
    } finally {
      setDocLibLoading(false);
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
    for (const vDoc of vSnap.docs) {
      const vData = vDoc.data();
      const userId = vDoc.id;
      if (vData.progress?.attendance === "present") continue;
      if (!allowReFlag && vData.attendanceFlagProcessed === true) continue;
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
        setFlaggedStudents(prev => prev.filter(s => s.id !== userId));
        if (missionId) {
          setRosterVolunteers(prev => prev.map(v =>
            v.id === userId ? { ...v, isFlagged: false, flagExpiry: null } : v
          ));
        }
      } else {
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
      setRosterVolunteers(prev => prev.map(v =>
        v.id === userId
          ? { ...v, attendanceStatus: isPresent ? null : "present", tookAttendanceAt: isPresent ? null : new Date() }
          : v
      ));
    } finally {
      setTogglingAttendance(prev => ({ ...prev, [userId]: false }));
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

  const getAttendanceQRValue = () =>
    JSON.stringify({
      eventId: missionId,
      expiresAt: Date.now() + 30 * 60 * 1000,
      location: missionData?.qrLocation ?? null,
    });

  const handleCloseEvent = async () => {
    if (!await showConfirm("Close this event? Status will be set to Completed. This action is visible to volunteers.")) return;
    setClosingEvent(true);
    try {
      await updateDoc(doc(db, "missions", missionId), {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("Event closed and marked as Completed.");
      navigate("/admin/current-event");
    } catch (_) {
      showToast("Failed to close event. Try again.");
    } finally {
      setClosingEvent(false);
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
      showToast(`Feedback form ${action}d.`);
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
      { key: "roster",  label: "Roster" },
      { key: "details", label: "Project Details" },
      { key: "docs",    label: "Document Library" },
    ];

    const typeLabel =
      missionData?.projectType === "sl" ? "Service Learning"
      : missionData?.projectType === "ce" ? "Community Engagement"
      : "Event";

    return (
      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>

        {/* ── back link ── */}
        <button
          onClick={() => navigate("/admin/current-event")}
          style={{
            background: "none", border: "none", color: "#64748b",
            fontSize: "0.82rem", cursor: "pointer", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 4, padding: 0, fontWeight: 600,
          }}
        >
          ← Back to Events
        </button>

        {/* ── mission hero card ── */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "20px 24px",
          marginBottom: 16, border: "1px solid #e5e7eb",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.3rem", fontWeight: 800, lineHeight: 1.2 }}>
                {missionTitle || "Loading…"}
              </h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ background: "#e8edf7", color: "#1f3b73", padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700 }}>
                  {typeLabel}
                </span>
                <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700 }}>
                  ● Active
                </span>
                <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 600 }}>
                  {rosterVolunteers.length}{missionData?.maxStudents ? ` / ${missionData.maxStudents}` : ""} volunteers
                </span>
              </div>
            </div>
          </div>

          {missionData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px 20px" }}>
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
            <div style={{ marginTop: 12, fontSize: "0.78rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
              <span>📱</span>
              <span>QR pinned at: <b>{missionData.qrLocationName}</b></span>
            </div>
          )}
        </div>

        {/* ── action strip ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
          <button
            onClick={() => setShowAttQR(true)}
            style={{
              padding: "9px 16px", background: "#234e7b", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            📱 Attendance QR
          </button>
          <button
            onClick={() => setShowFeedbackQR(true)}
            style={{
              padding: "9px 16px", background: "#0f766e", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            📋 Partner Feedback QR
          </button>
          <button
            onClick={handleToggleFeedback}
            disabled={togglingFeedback}
            style={{
              padding: "9px 16px",
              background: missionData?.feedback?.isActive ? "#7c3aed" : "#9ca3af",
              color: "#fff", border: "none", borderRadius: 10, fontWeight: 700,
              fontSize: "0.85rem", cursor: togglingFeedback ? "not-allowed" : "pointer",
              whiteSpace: "nowrap", opacity: togglingFeedback ? 0.7 : 1,
            }}
          >
            {togglingFeedback
              ? "Updating…"
              : missionData?.feedback?.isActive
              ? "🔓 Close Feedback Form"
              : "🔒 Open Feedback Form"}
          </button>
          <button
            onClick={handleFlagThisEvent}
            disabled={flagging}
            style={{
              padding: "9px 16px",
              background: flagging ? "#9ca3af" : "#b45309",
              color: "#fff", border: "none", borderRadius: 10, fontWeight: 700,
              fontSize: "0.85rem", cursor: flagging ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}
          >
            {flagging ? "Flagging…" : "🚩 Flag Absent"}
          </button>
          <button
            onClick={handleCloseEvent}
            disabled={closingEvent}
            style={{
              padding: "9px 16px",
              background: closingEvent ? "#9ca3af" : "#dc2626",
              color: "#fff", border: "none", borderRadius: 10, fontWeight: 700,
              fontSize: "0.85rem", cursor: closingEvent ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}
          >
            {closingEvent ? "Closing…" : "✓ Close Event"}
          </button>
          {flagResult && (
            <span style={{ fontSize: 13, color: flagResult.ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
              {flagResult.ok ? `${flagResult.count} flagged` : `Error: ${flagResult.error}`}
            </span>
          )}
        </div>

        {/* ── tab navigation ── */}
        <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); if (t.key === "docs") loadDocLib(); }}
              style={{
                padding: "10px 20px", background: "none", border: "none",
                borderBottom: activeTab === t.key ? "2px solid #234e7b" : "2px solid transparent",
                marginBottom: -2,
                fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? "#234e7b" : "#6b7280",
                cursor: "pointer", fontSize: "0.9rem", transition: "color 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              {t.key === "roster" && rosterVolunteers.length > 0 && (
                <span style={{
                  background: activeTab === "roster" ? "#234e7b" : "#e8edf7",
                  color: activeTab === "roster" ? "#fff" : "#234e7b",
                  borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, padding: "1px 7px",
                }}>
                  {rosterVolunteers.length}
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
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table className="admin-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Level</th>
                    <th>Joined</th>
                    <th>Attendance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterVolunteers.map(v => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{v.name}</div>
                            {v.email && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{v.email}</div>}
                          </div>
                          {v.isFlagged && (
                            <>
                              <span title={`Flagged${v.flagExpiry ? " until " + v.flagExpiry.toLocaleDateString() : ""}`}>🚩</span>
                              <button
                                disabled={!!togglingFlag[v.id]}
                                onClick={() => handleToggleFlag(v.id, true)}
                                style={{
                                  padding: "2px 8px",
                                  background: togglingFlag[v.id] ? "#9ca3af" : "#16a34a",
                                  color: "#fff", border: "none", borderRadius: 4,
                                  fontSize: 11, fontWeight: 600,
                                  cursor: togglingFlag[v.id] ? "not-allowed" : "pointer",
                                }}
                              >
                                {togglingFlag[v.id] ? "…" : "Unflag"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ color: "#64748b" }}>{v.level}</td>
                      <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                        {v.joinedAt ? new Date(v.joinedAt).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        {v.attendanceStatus === "present"
                          ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Present</span>
                          : <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          disabled={!!togglingAttendance[v.id]}
                          onClick={() => handleToggleAttendance(v.id, v.attendanceStatus)}
                          style={{
                            padding: "4px 10px",
                            background: v.attendanceStatus === "present" ? "#fff3cd" : "#d4edda",
                            color: v.attendanceStatus === "present" ? "#856404" : "#155724",
                            border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
                            cursor: togglingAttendance[v.id] ? "not-allowed" : "pointer",
                            opacity: togglingAttendance[v.id] ? 0.6 : 1, whiteSpace: "nowrap",
                          }}
                        >
                          {togglingAttendance[v.id] ? "Saving…" : v.attendanceStatus === "present" ? "Mark Absent" : "Mark Present"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Project Details tab ── */}
        {activeTab === "details" && (
          missionData ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0 28px" }}>
                <DetailField label="Type"           value={typeLabel} />
                <DetailField label="Target Date"    value={missionData.targetDate} />
                <DetailField label="Start Time"     value={missionData.startTime} />
                <DetailField label="Location"       value={missionData.location} />
                <DetailField label="Department"     value={missionData.affiliatedDepartment || missionData.department} />
                <DetailField label="Partner"        value={missionData.partnerSchool} />
                <DetailField label="Prepared By"    value={missionData.preparedBy} />
                <DetailField label="Max Volunteers" value={missionData.maxStudents} />
                <DetailField label="Volunteer Hours" value={missionData.volunteerHours} />
                <DetailField label="Points"         value={missionData.points} />
                <DetailField label="Budget"         value={missionData.budget} />
              </div>

              {missionData.description && (
                <div style={{ marginTop: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: "0.93rem", color: "#1e293b", lineHeight: 1.65 }}>{missionData.description}</div>
                </div>
              )}
              {missionData.objectives && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Objectives</div>
                  <div style={{ fontSize: "0.93rem", color: "#1e293b", lineHeight: 1.65 }}>{missionData.objectives}</div>
                </div>
              )}
              {missionData.studentOutcomes && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Student Outcomes</div>
                  <div style={{ fontSize: "0.93rem", color: "#1e293b", lineHeight: 1.65 }}>{missionData.studentOutcomes}</div>
                </div>
              )}
              {Array.isArray(missionData.successIndicators) && missionData.successIndicators.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Success Indicators</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {missionData.successIndicators.map((s, i) => <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b" }}>{s}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(missionData.stakeholders) && missionData.stakeholders.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Stakeholders</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {missionData.stakeholders.map((s, i) => <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b" }}>{s}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(missionData.sdgs) && missionData.sdgs.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>SDGs</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {missionData.sdgs.map((sdg, i) => (
                      <span key={i} style={{ background: "#e8edf7", color: "#1f3b73", padding: "3px 10px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600 }}>{sdg}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* type-specific fields */}
              {missionData.slFields && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Service Learning Fields</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 28px" }}>
                    <DetailField label="Section"          value={missionData.slFields.section} />
                    <DetailField label="Course"           value={missionData.slFields.course} />
                    <DetailField label="Course Code"      value={missionData.slFields.courseCode} />
                    <DetailField label="Assigned Faculty" value={missionData.slFields.assignedFaculty} />
                  </div>
                </div>
              )}
              {missionData.ceFields && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Community Engagement Fields</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 28px" }}>
                    <DetailField label="Nature"           value={missionData.ceFields.nature} />
                    <DetailField label="Assigned Faculty" value={missionData.ceFields.assignedFaculty} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="loading-message">Loading details…</div>
          )
        )}

        {/* ── Document Library tab ── */}
        {activeTab === "docs" && (
          docLibLoading ? (
            <div className="loading-message">Loading documents…</div>
          ) : docLibVolunteers.length === 0 ? (
            <div className="empty-label">No volunteers have joined yet.</div>
          ) : (
            <div style={{ overflowX: "auto", width: "100%" }}>
              {/* Community feedback summary */}
              {missionData?.feedback?.isActive === false && missionData.feedback.avgRating ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: "10px 24px", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#15803d", fontSize: "0.85rem" }}>✓ Community Feedback Closed</span>
                  <span style={{ fontSize: "0.82rem", color: "#374151" }}>
                    Avg. Rating: <b>{missionData.feedback.avgRating}/5</b>
                  </span>
                  {missionData.feedback.multiplier != null && (
                    <span style={{ fontSize: "0.82rem", color: "#374151" }}>
                      Grade Multiplier: <b>×{missionData.feedback.multiplier}</b>
                    </span>
                  )}
                  {missionData.points && missionData.feedback.multiplier != null && (
                    <span style={{ fontSize: "0.82rem", color: "#374151" }}>
                      Final Score per Volunteer: <b>{(Number(missionData.points) * Number(missionData.feedback.multiplier)).toFixed(1)} pts</b>
                    </span>
                  )}
                </div>
              ) : !missionData?.feedback?.isActive && !missionData?.feedback?.avgRating ? (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: "0.82rem", color: "#92400e" }}>
                  ⚠️ Community feedback form is not yet closed. Open and close the form to compute grades.
                </div>
              ) : null}
              <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 12 }}>
                Submission status per volunteer. ✓ = submitted / marked present.
              </p>
              <table className="admin-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pre-Survey</th>
                    <th>Consent</th>
                    <th>Attendance</th>
                    <th>Post-Survey</th>
                    {missionData?.feedback?.isActive === false && missionData.feedback.avgRating && <th>Grade</th>}
                  </tr>
                </thead>
                <tbody>
                  {docLibVolunteers.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td><CheckBadge ok={v.preSurvey} /></td>
                      <td><CheckBadge ok={v.consent} /></td>
                      <td><CheckBadge ok={v.attendance} /></td>
                      <td><CheckBadge ok={v.postSurvey} /></td>
                      {missionData?.feedback?.isActive === false && missionData.feedback.avgRating && (
                        <td>
                          {v.attendance && missionData.feedback.multiplier != null && missionData.points
                            ? <span style={{ color: "#15803d", fontWeight: 700 }}>
                                {(Number(missionData.points) * Number(missionData.feedback.multiplier)).toFixed(1)} pts
                              </span>
                            : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>📱 Attendance QR</h3>
                <button onClick={() => setShowAttQR(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b", lineHeight: 1 }}>✕</button>
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
                      Valid 30 min from generation · Students must be within 200 m of pinned location.
                    </p>
                  </>
                ) : (
                  <div style={{ padding: "20px 0 24px", color: "#64748b" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 10 }}>📱</div>
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>No QR generated yet.<br />Generate one at your current location.</p>
                  </div>
                )}
                <button
                  disabled={qrGenerating}
                  onClick={generateAttendanceQR}
                  style={{
                    width: "100%", padding: "11px 0",
                    background: qrGenerating ? "#9ca3af" : "#234e7b",
                    color: "#fff", border: "none", borderRadius: 10,
                    fontWeight: 700, fontSize: "0.9rem",
                    cursor: qrGenerating ? "not-allowed" : "pointer",
                  }}
                >
                  {qrGenerating ? "Getting location…" : missionData?.validQRTimestamp ? "Regenerate QR (update location)" : "Generate Attendance QR"}
                </button>
                {missionData?.validQRTimestamp && (
                  <button
                    onClick={downloadAttendanceQR}
                    style={{
                      width: "100%", marginTop: 8, padding: "10px 0",
                      background: "#f1f5f9", color: "#334155",
                      border: "none", borderRadius: 10,
                      fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>📋 Partner Feedback QR</h3>
                <button onClick={() => setShowFeedbackQR(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b", lineHeight: 1 }}>✕</button>
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
                    background: missionData?.feedback?.isActive ? "#dc2626" : "#15803d",
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
                    style={{ flex: 1, padding: "10px 0", background: "#0f766e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Open Form ↗
                  </button>
                  <button
                    onClick={() => setShowFeedbackQR(false)}
                    style={{ flex: 1, padding: "10px 0", background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
                <button
                  onClick={downloadFeedbackQR}
                  style={{
                    width: "100%", padding: "10px 0",
                    background: "#f1f5f9", color: "#334155",
                    border: "none", borderRadius: 10,
                    fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                  }}
                >
                  ⬇ Download QR Image
                </button>
              </div>
            </div>
          </div>
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
          </div>
          <button
            onClick={() => { setShowFlaggedModal(true); fetchFlaggedStudents(); }}
            style={{
              padding: "7px 14px", background: "#1d4ed8", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 700,
              fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            📄 Flagged Volunteers
          </button>
          <button
            onClick={handleFlagAllEvents}
            disabled={globalFlagging}
            title="Scans every past event — may take a while"
            style={{
              padding: "7px 14px",
              background: globalFlagging ? "#9ca3af" : "#b91c1c",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700,
              fontSize: "0.82rem", cursor: globalFlagging ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}
          >
            {globalFlagging ? "Flagging..." : "🚩 Flag All"}
          </button>
        </div>
      </div>

      {autoFlagStatus === "running" && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>⏳ Checking attendance flags…</div>
      )}
      {autoFlagStatus && autoFlagStatus !== "running" && autoFlagStatus.count > 0 && (
        <div style={{ fontSize: 12, color: "#15803d", marginBottom: 4 }}>
          ✅ Auto-flagged {autoFlagStatus.count} volunteer(s)
        </div>
      )}
      {globalFlagResult && (
        <div style={{ fontSize: 13, color: globalFlagResult.ok ? "#15803d" : "#b91c1c", fontWeight: 600, marginBottom: 8 }}>
          {globalFlagResult.ok
            ? `${globalFlagResult.count} volunteer(s) flagged across all events`
            : `Error: ${globalFlagResult.error}`}
        </div>
      )}

      <hr className="ap-divider" />

      {loading ? (
        <div className="loading-message">Loading events…</div>
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
              onClick={() => navigate(`/admin/current-event/${m.id}`, { state: { missionTitle: m.title } })}
            />
          ))}
        </div>
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
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 28,
              width: "min(680px, 95vw)", maxHeight: "80vh",
              display: "flex", flexDirection: "column", gap: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🚩 Flagged Volunteers</h3>
              <button
                onClick={() => setShowFlaggedModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}
              >×</button>
            </div>
            {flaggedLoading ? (
              <div style={{ color: "#6b7280", padding: 16 }}>Loading…</div>
            ) : flaggedStudents.length === 0 ? (
              <div style={{ color: "#6b7280", padding: 16 }}>No flagged volunteers.</div>
            ) : (
              <div style={{ overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Name</th>
                      <th style={{ padding: "8px 10px" }}>Level</th>
                      <th style={{ padding: "8px 10px" }}>Flagged For</th>
                      <th style={{ padding: "8px 10px" }}>Flag Expires</th>
                      <th style={{ padding: "8px 10px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedStudents.map(s => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          {s.email && s.email !== s.name && (
                            <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>{s.email}</div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{s.level}</td>
                        <td style={{ padding: "8px 10px", color: "#6b7280", fontSize: "0.82rem" }}>
                          {s.flaggedMissionTitle || "—"}
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: "0.82rem" }}>
                          {s.flagExpiry ? s.flagExpiry.toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <button
                            disabled={!!togglingFlag[s.id]}
                            onClick={() => handleToggleFlag(s.id, true)}
                            style={{
                              padding: "4px 12px",
                              background: togglingFlag[s.id] ? "#9ca3af" : "#16a34a",
                              color: "#fff", border: "none", borderRadius: 6,
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
