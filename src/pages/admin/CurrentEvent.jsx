import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc,
  query, where, serverTimestamp, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../../styles/CurrentEvent.css";
import "../../styles/ReviewProposal.css";
import { createNotification } from "../../utils/notificationUtils";

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

  // ── DETAIL VIEW ───────────────────────────────────────────────────
  if (missionId) {
    const tabs = [
      { key: "roster",  label: "Roster" },
      { key: "details", label: "Project Details" },
      { key: "docs",    label: "Document Library" },
    ];

    return (
      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        {/* header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8, marginBottom: 20,
        }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1e293b" }}>{missionTitle}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleFlagThisEvent}
              disabled={flagging}
              style={{
                padding: "8px 14px", background: flagging ? "#9ca3af" : "#dc2626",
                color: "#fff", border: "none", borderRadius: 8, fontWeight: 700,
                fontSize: "0.82rem", cursor: flagging ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {flagging ? "Flagging..." : "🚩 Flag Absent Volunteers"}
            </button>
            {flagResult && (
              <span style={{ fontSize: 13, color: flagResult.ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                {flagResult.ok ? `${flagResult.count} volunteer(s) flagged` : `Error: ${flagResult.error}`}
              </span>
            )}
          </div>
        </div>

        {/* tab navigation */}
        <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (t.key === "docs") loadDocLib();
              }}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: activeTab === t.key ? "2px solid #234e7b" : "2px solid transparent",
                marginBottom: -2,
                fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? "#234e7b" : "#6b7280",
                cursor: "pointer",
                fontSize: "0.9rem",
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Roster tab ── */}
        {activeTab === "roster" && (
          rosterVolunteers.length === 0 ? (
            <div className="empty-label">No volunteers have joined yet.</div>
          ) : (
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table className="admin-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Level</th>
                    <th>Joined At</th>
                    <th>Attendance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterVolunteers.map(v => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{v.name}</span>
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
                      <td>{v.level}</td>
                      <td>{v.joinedAt ? new Date(v.joinedAt).toLocaleDateString() : "-"}</td>
                      <td>
                        {v.attendanceStatus === "present"
                          ? <span style={{ color: "#16a34a", fontWeight: 600 }}>Present</span>
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
                          {togglingAttendance[v.id]
                            ? "Saving…"
                            : v.attendanceStatus === "present" ? "Mark Absent" : "Mark Present"}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0 24px" }}>
              <DetailField label="Title" value={missionData.title} />
              <DetailField label="Type" value={
                missionData.projectType === "sl" ? "Service Learning"
                : missionData.projectType === "ce" ? "Community Engagement"
                : missionData.projectType
              } />
              <DetailField label="Status" value={missionData.status} />
              <DetailField label="Target Date" value={missionData.targetDate} />
              <DetailField label="Start Time" value={missionData.startTime} />
              <DetailField label="Location" value={missionData.location} />
              <DetailField label="Department" value={missionData.affiliatedDepartment || missionData.department} />
              <DetailField label="Prepared By" value={missionData.preparedBy} />
              <DetailField label="Max Volunteers" value={missionData.maxStudents} />
              <DetailField label="Volunteer Hours" value={missionData.volunteerHours} />
              <DetailField label="Points" value={missionData.points} />
              <DetailField label="Budget" value={missionData.budget} />
              {missionData.description && (
                <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    Description
                  </div>
                  <div style={{ fontSize: "0.93rem", color: "#1e293b", lineHeight: 1.6 }}>{missionData.description}</div>
                </div>
              )}
              {missionData.objectives && (
                <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    Objectives
                  </div>
                  <div style={{ fontSize: "0.93rem", color: "#1e293b", lineHeight: 1.6 }}>{missionData.objectives}</div>
                </div>
              )}
              {Array.isArray(missionData.stakeholders) && missionData.stakeholders.length > 0 && (
                <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    Stakeholders
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {missionData.stakeholders.map((s, i) => (
                      <li key={i} style={{ fontSize: "0.93rem", color: "#1e293b" }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(missionData.sdgs) && missionData.sdgs.length > 0 && (
                <div style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    SDGs
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {missionData.sdgs.map((sdg, i) => (
                      <span key={i} style={{
                        background: "#e8edf7", color: "#1f3b73",
                        padding: "3px 10px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600,
                      }}>{sdg}</span>
                    ))}
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
          ) : docLibVolunteers.length === 0 && !docLibLoading ? (
            <div className="empty-label">No volunteers have joined yet.</div>
          ) : (
            <div style={{ overflowX: "auto", width: "100%" }}>
              <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 12 }}>
                Submission status per volunteer. "Done" = submitted or marked present.
              </p>
              <table className="admin-table" style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pre-Survey</th>
                    <th>Consent</th>
                    <th>Attendance</th>
                    <th>Post-Survey</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
