import { collection, getDocs, getDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../../styles/CurrentEvent.css";
import { createNotification } from "../../utils/notificationUtils";

export default function CurrentEvent() {
    const { missionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [missions, setMissions] = useState([]);
    const [pendingVolunteers, setPendingVolunteers] = useState([]);
    const [approvedVolunteers, setApprovedVolunteers] = useState([]);

    useEffect(() => {
        async function fetchMissions() {
            const missionSnap = await getDocs(collection(db, "missions"));
            const missionData = [];

            for (const missionDoc of missionSnap.docs) {
                const missionId = missionDoc.id;
                const mission = missionDoc.data();

                const volunteerRef = collection(db, "missions", missionId, "volunteer");

                const pendingSnap = await getDocs(
                    query(volunteerRef, where("status", "==", "pending"))
                );

                const approvedSnap = await getDocs(
                    query(volunteerRef, where("status", "==", "approved"))
                );

                missionData.push({
                    id: missionId,
                    title: mission.title,
                    status: mission.eventStatus || "Accepting Students",
                    pendingCount: pendingSnap.size,
                    approvedCount: approvedSnap.size
                });
            }

            setMissions(missionData);
        }

        fetchMissions();
    }, []);

    //fetch mission volunteers wanting to join
    useEffect(() => {
        if (!missionId) return;

        async function fetchMissionVolunteers() {
            const volunteersRef = collection(
                db,
                "missions",
                missionId,
                "volunteer"
            );

            const pendingSnap = await getDocs(
                query(volunteersRef, where("status", "==", "pending"))
            );

            const approvedSnap = await getDocs(
                query(volunteersRef, where("status", "==", "approved"))
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
                    level: userData.level || 1,
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
                    level: userData.level || 1,
                    joinedAt: volunteerData.joinedAt
                });
            }

            setPendingVolunteers(pendingResults);
            setApprovedVolunteers(approvedResults);
        }

        fetchMissionVolunteers();
    }, [missionId]);

    const handleApprove = async (userId) => {
        await updateDoc(
            doc(db, "missions", missionId, "volunteer", userId),
            { status: "approved" }
        );

        setPendingVolunteers(prev =>
            prev.filter(v => v.id !== userId)
        );

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
            { status: "rejected" }
        );

        setPendingVolunteers(prev =>
            prev.filter(v => v.id !== userId)
        );
    };

    if (missionId) {
        return (
            <div className="admin-table-container">
                <h2>{location.state?.missionTitle}</h2>

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
        <div className="current-events-container">
            {missions.map(mission => (
                <div
                    key={mission.id}
                    className="mission-card"
                    onClick={() =>
                        navigate(`/admin/current-event/${mission.id}`, {
                            state: { missionTitle: mission.title }
                        })
                    }
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
            ))}
        </div>
    );
}
