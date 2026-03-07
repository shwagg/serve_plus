import { collection, getDocs, getDoc, doc, updateDoc, query, where } from "firebase/firestore";
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
                    status: mission.eventStatus || "Accepting Students",
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

            approvedResults.push({
                id: userId,
                name: userData.name || "Unknown",
                level: userData.level || "--",
                joinedAt: volunteerData.joinedAt
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

    if (missionId) {
        return (
            <div className="admin-table-container">
                <h2>{missionTitle}</h2>

                {/* ================= PENDING SECTION ================= */}
                <div className="section-header">
                    <h3>Pending Requests</h3>
                </div>

                {pendingVolunteers.length === 0 ? (
                    <div className="empty-label">
                        No students awaiting approval.
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
                            </tr>
                        </thead>
                        <tbody>
                            {approvedVolunteers.map(volunteer => (
                                <tr key={volunteer.id} className="approved-row">
                                    <td>{volunteer.name}</td>
                                    <td>{volunteer.level}</td>
                                    <td>
                                        {volunteer.joinedAt
                                            ? new Date(volunteer.joinedAt).toLocaleDateString()
                                            : "-"}
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
        </div>
    );
}
