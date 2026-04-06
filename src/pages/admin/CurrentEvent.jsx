import { collection, getDocs, getDoc, doc, updateDoc, addDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useState, useEffect, memo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../../styles/CurrentEvent.css";
import { createNotification } from "../../utils/notificationUtils";

const MissionCard = memo(function MissionCard({ mission, onClick }) {
    return (
        <div
            className="mission-card"
            onClick={onClick}
        >
            {mission.pendingCount > 0 && (
                <span className="pending-badge">
                    {mission.pendingCount}
                </span>
            )}
            <h3>{mission.title}</h3>
            <div className="mission-info">
                <p>Status: <strong>{mission.status}</strong></p>
                <p>Volunteers Joined: <strong>{mission.approvedCount}</strong></p>
            </div>
        </div>
    );
});

export default function CurrentEvent() {
    const { missionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingVolunteers, setPendingVolunteers] = useState([]);
    const [approvedVolunteers, setApprovedVolunteers] = useState([]);
    const [flagging, setFlagging] = useState(false);
    const [flagResult, setFlagResult] = useState(null);
    const [globalFlagging, setGlobalFlagging] = useState(false);
    const [globalFlagResult, setGlobalFlagResult] = useState(null);
    const [autoFlagStatus, setAutoFlagStatus] = useState(null); // null | "running" | { count }
    const [showFlaggedModal, setShowFlaggedModal] = useState(false);
    const [flaggedStudents, setFlaggedStudents] = useState([]);
    const [flaggedLoading, setFlaggedLoading] = useState(false);
    const [togglingFlag, setTogglingFlag] = useState({}); // userId -> true while toggling
    const [missionTitle, setMissionTitle] = useState("");

    useEffect(() => {
        let isMounted = true;
        async function fetchMissions() {
            setLoading(true);
            const missionSnap = await getDocs(collection(db, "missions"));
            const missionData = [];
            for (const missionDoc of missionSnap.docs) {
                const mId = missionDoc.id;
                const mission = missionDoc.data();
                const volunteerRef = collection(db, "missions", mId, "volunteer");
                const [pendingSnap, approvedSnap] = await Promise.all([
                    getDocs(query(volunteerRef, where("registrationStatus", "==", "pending"))),
                    getDocs(query(volunteerRef, where("registrationStatus", "==", "approved")))
                ]);
                missionData.push({
                    id: mId,
                    title: mission.title,
                    status: mission.eventStatus || "Accepting Volunteers",
                    pendingCount: pendingSnap.size,
                    approvedCount: approvedSnap.size
                });
            }
            if (isMounted) {
                setMissions(missionData);
                setLoading(false);
            }
        }
        fetchMissions();
        return () => { isMounted = false; };
    }, []);

    // Fetch mission title if not provided in location.state
    useEffect(() => {
        async function fetchTitle() {
            if (!missionId) return;
            if (location.state && location.state.missionTitle) {
                setMissionTitle(location.state.missionTitle);
            } else {
                // Fetch from Firestore
                const missionDoc = await getDoc(doc(db, "missions", missionId));
                if (missionDoc.exists()) {
                    setMissionTitle(missionDoc.data().title || "Event");
                } else {
                    setMissionTitle("Event");
                }
            }
        }
        fetchTitle();
    }, [missionId, location.state]);

    //fetch mission volunteers wanting to join
    async function fetchMissionVolunteers() {
        const volunteersRef = collection(
            db,
            "missions",
            missionId,
            "volunteer"
        );
        const pendingSnap = await getDocs(
            query(volunteersRef, where("registrationStatus", "==", "pending"))
        );

        const approvedSnap = await getDocs(
            query(volunteersRef, where("registrationStatus", "==", "approved"))
        );

        const pendingResults = [];
        const approvedResults = [];

        for (const docSnap of pendingSnap.docs) {
            const userId = docSnap.id;
            const volunteerData = docSnap.data();

            const userDoc = await getDoc(doc(db, "users", userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

            pendingResults.push({
                id: userId,
                name: userData.name || "Unknown",
                level: userData.level || "--",
                joinedAt: volunteerData.joinedAt
            });
        }

        for (const docSnap of approvedSnap.docs) {
            const userId = docSnap.id;
            const volunteerData = docSnap.data();

            const userDoc = await getDoc(doc(db, "users", userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

            // scannedAt is a Firestore Timestamp or undefined
            const scannedAt = volunteerData.scanAttendance?.scannedAt;
            const scannedAtDate = scannedAt?.toDate ? scannedAt.toDate() : null;

            approvedResults.push({
                id: userId,
                name: userData.name || "Unknown",
                level: userData.level || "--",
                joinedAt: volunteerData.joinedAt,
                tookAttendanceAt: scannedAtDate,
                attendanceStatus: volunteerData.progress?.attendance || null,
                isFlagged: userData.attendanceFlagged === true,
            });
        }
        setPendingVolunteers(pendingResults);
        setApprovedVolunteers(approvedResults);
    }

    useEffect(() => {
        if (!missionId) return;
        fetchMissionVolunteers();
    }, [missionId]);

    const handleApprove = async (userId) => {
        await updateDoc(
            doc(db, "missions", missionId, "volunteer", userId),
            {
                registrationStatus: "approved", //if admin approved request to join an event
                completionStatus: "in_progress" //volunteers status for submission of requirements
            }
        );
        //Moving users from pending approval to approved list
        //Auto refresh list
        await fetchMissionVolunteers();

        try {
            const notificationsRef = collection(db, "users", userId, "notifications");
            const existingQuery = query(
                notificationsRef,
                where("type", "==", "event_approved"),
                where("eventId", "==", missionId)
            );
            const existing = await getDocs(existingQuery);

            if (existing.empty) {
                await createNotification(userId, {
                    type: "event_approved",
                    title: "Registration Approved",
                    message: `Your registration for "${location.state?.missionTitle || "this event"}" has been approved.`,
                    link: `/event/${missionId}/activity?mode=active`,
                    eventId: missionId,
                });
            }
        } catch (e) {
            console.error("Failed to create approval notification:", e);
        }
    };

    const handleReject = async (userId) => {
        await updateDoc(
            doc(db, "missions", missionId, "volunteer", userId),
            { registrationStatus: "rejected" }
        );

        await fetchMissionVolunteers();
    };

    // Fetch all flagged students (deduplicated by userId)
    const fetchFlaggedStudents = async () => {
        setFlaggedLoading(true);
        try {
            const usersSnap = await getDocs(
                query(collection(db, "users"), where("attendanceFlagged", "==", true))
            );
            const results = usersSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.data().email || d.id,
                email: d.data().email || "",
                level: d.data().level || "--",
                flaggedMissionTitle: d.data().attendanceFlaggedMissionTitle || "",
                flagExpiry: d.data().attendanceFlagExpiry?.toDate?.() || null,
            }));
            setFlaggedStudents(results);
        } finally {
            setFlaggedLoading(false);
        }
    };

    const handleOpenFlaggedModal = () => {
        setShowFlaggedModal(true);
        fetchFlaggedStudents();
    };

    const handleToggleFlag = async (userId, currentlyFlagged) => {
        setTogglingFlag(prev => ({ ...prev, [userId]: true }));
        try {
            if (currentlyFlagged) {
                // Unflag
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
            } else {
                // Manually flag
                const now = new Date();
                const flagExpiry = new Date(now);
                flagExpiry.setDate(flagExpiry.getDate() + 30);
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
                // Refresh list
                await fetchFlaggedStudents();
            }
        } finally {
            setTogglingFlag(prev => ({ ...prev, [userId]: false }));
        }
    };

    const FLAG_DURATION_DAYS = 30;

    // Core: flag absent volunteers for a single mission doc. Returns count flagged.
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

        const volunteersSnap = await getDocs(
            query(collection(db, "missions", mid, "volunteer"), where("registrationStatus", "==", "approved"))
        );

        let count = 0;
        for (const volunteerDoc of volunteersSnap.docs) {
            const vData = volunteerDoc.data();
            const userId = volunteerDoc.id;
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
                title: "Attendance Flag \u2013 Mission Restriction",
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

    // Flag only this specific event
    const handleFlagThisEvent = async () => {
        setFlagging(true);
        setFlagResult(null);
        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString("en-CA");
            const missionDoc = await getDoc(doc(db, "missions", missionId));
            if (!missionDoc.exists()) throw new Error("Mission not found");
            const mission = missionDoc.data();
            if (mission.status !== "published" && mission.status !== "completed") {
                setFlagResult({ ok: true, count: 0, note: "Event is not published/completed" });
                return;
            }
            const count = await flagMission(missionDoc, now, todayStr);
            setFlagResult({ ok: true, count });
            // Refresh list to update 🚩 badges
            await fetchMissionVolunteers();
        } catch (err) {
            setFlagResult({ ok: false, error: err.message });
        } finally {
            setFlagging(false);
        }
    };

    // Flag ALL past events (slow — warns the user via the button label/title)
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

    // Auto-flag: silently runs on list page load, skips already-processed volunteers
    useEffect(() => {
        if (missionId) return; // only run on the list view
        let cancelled = false;
        async function autoFlag() {
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
        }
        autoFlag();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (missionId) {
        return (
            <div className="admin-table-container">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>{missionTitle}</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            onClick={handleFlagThisEvent}
                            disabled={flagging}
                            style={{
                                padding: "8px 14px",
                                background: flagging ? "#9ca3af" : "#dc2626",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                cursor: flagging ? "not-allowed" : "pointer",
                                whiteSpace: "nowrap",
                            }}
                            title="Flag volunteers in this event who missed attendance"
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

                {/* ================= PENDING SECTION ================= */}
                <div className="section-header">
                    <h3>Pending Requests</h3>
                </div>

                {pendingVolunteers.length === 0 ? (
                    <div className="empty-label">
                        No volunteers awaiting approval.
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Level</th>
                                <th>Joined At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingVolunteers.map(volunteer => (
                                <tr key={volunteer.id} className="pending-row">
                                    <td>{volunteer.name}</td>
                                    <td>{volunteer.level}</td>
                                    <td>
                                        {volunteer.joinedAt
                                            ? new Date(volunteer.joinedAt).toLocaleDateString()
                                            : "-"}
                                    </td>
                                    <td>
                                        <button
                                            className="approve-btn"
                                            onClick={() => handleApprove(volunteer.id)}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            className="reject-btn"
                                            onClick={() => handleReject(volunteer.id)}
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* ================= APPROVED SECTION ================= */}
                <div className="section-header approved-section">
                    <h3>Approved Volunteers</h3>
                </div>

                {approvedVolunteers.length === 0 ? (
                    <div className="empty-label">
                        No approved volunteers yet.
                    </div>
                ) : (
                    <table className="admin-table approved-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Level</th>
                                <th>Joined At</th>
                                <th>Took Attendance At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvedVolunteers.map(volunteer => (
                                <tr key={volunteer.id} className="approved-row">
                                    <td>
                                        {volunteer.name}
                                        {volunteer.isFlagged && (
                                            <span title="Flagged for missed attendance" style={{ marginLeft: 6, fontSize: "0.85em" }}>🚩</span>
                                        )}
                                    </td>
                                    <td>{volunteer.level}</td>
                                    <td>
                                        {volunteer.joinedAt
                                            ? new Date(volunteer.joinedAt).toLocaleDateString()
                                            : "-"}
                                    </td>
                                    <td>
                                        {volunteer.tookAttendanceAt
                                            ? volunteer.tookAttendanceAt.toLocaleString()
                                            : volunteer.attendanceStatus === "present"
                                                ? "Present (no timestamp)"
                                                : <span style={{ color: "#9ca3af" }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

        );
    }

    return (
        <div className="current-events-horizontal-container">
            {/* Auto-flag status */}
            {autoFlagStatus === "running" && (
                <div style={{ fontSize: 12, color: "#6b7280", padding: "4px 0 0 4px" }}>
                    ⏳ Auto-checking attendance flags...
                </div>
            )}
            {autoFlagStatus && autoFlagStatus !== "running" && autoFlagStatus.count > 0 && (
                <div style={{ fontSize: 12, color: "#15803d", padding: "4px 0 0 4px" }}>
                    ✅ Auto-flagged {autoFlagStatus.count} volunteer(s) with missed attendance
                </div>
            )}

            {/* Flag All Events button */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px 4px" }}>
                <button
                    onClick={handleFlagAllEvents}
                    disabled={globalFlagging}
                    title="Scans every past event — may take a while"
                    style={{
                        padding: "7px 14px",
                        background: globalFlagging ? "#9ca3af" : "#b91c1c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: globalFlagging ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    {globalFlagging ? "Flagging all events..." : "🚩 Flag All Events (slow)"}
                </button>
                <button
                    onClick={handleOpenFlaggedModal}
                    style={{
                        padding: "7px 14px",
                        background: "#1d4ed8",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    📄 View Flagged Volunteers
                </button>
                {globalFlagResult && (
                    <span style={{ fontSize: 13, color: globalFlagResult.ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                        {globalFlagResult.ok
                            ? `${globalFlagResult.count} volunteer(s) flagged across all events`
                            : `Error: ${globalFlagResult.error}`}
                    </span>
                )}
            </div>

            {loading ? (
                <div style={{ color: '#888', fontSize: 18, padding: 32 }}>Loading events...</div>
            ) : (
                <div className="current-events-row">
                    {missions.map(mission => (
                        <MissionCard
                            key={mission.id}
                            mission={mission}
                            onClick={() =>
                                navigate(`/admin/current-event/${mission.id}`, {
                                    state: { missionTitle: mission.title }
                                })
                            }
                        />
                    ))}
                </div>
            )}

            {/* ===== Flagged Students Modal ===== */}
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
                            <div style={{ color: "#6b7280", padding: 16 }}>Loading...</div>
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
                                                    {s.flagExpiry
                                                        ? s.flagExpiry.toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td style={{ padding: "8px 10px" }}>
                                                    <button
                                                        disabled={!!togglingFlag[s.id]}
                                                        onClick={() => handleToggleFlag(s.id, true)}
                                                        style={{
                                                            padding: "4px 12px",
                                                            background: togglingFlag[s.id] ? "#9ca3af" : "#16a34a",
                                                            color: "#fff",
                                                            border: "none",
                                                            borderRadius: 6,
                                                            fontWeight: 600,
                                                            fontSize: "0.78rem",
                                                            cursor: togglingFlag[s.id] ? "not-allowed" : "pointer",
                                                        }}
                                                    >
                                                        {togglingFlag[s.id] ? "..." : "✔ Unflag"}
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
