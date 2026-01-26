import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import "../../styles/CurrentEventMonitoring.css";

export default function CurrentEventMonitoring() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allMissions, setAllMissions] = useState([]);
  const [taskParticipants, setTaskParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);

        // fetch missions for completion statistics
        const missionsRef = collection(db, "Missions");
        const missionsSnap = await getDocs(missionsRef);
        const missionsData = missionsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllMissions(missionsData);

        // Fetch mission data
        const missionRef = doc(db, "Missions", eventId);
        const missionSnap = await getDoc(missionRef);

        if (missionSnap.exists()) {
          setMission({ id: missionSnap.id, ...missionSnap.data() });

          // Fetch volunteers
          const volunteersRef = collection(
            db,
            "Missions",
            eventId,
            "volunteer",
          );
          const volunteersSnap = await getDocs(volunteersRef);
          const volunteersData = volunteersSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setVolunteers(volunteersData);

          // Fetch tasks
          const tasksRef = collection(db, "Missions", eventId, "task");
          const tasksSnap = await getDocs(tasksRef);
          const tasksData = tasksSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTasks(tasksData);

          // Fetch all participants from all tasks
          const allParticipants = [];
          for (const task of tasksData) {
            const participantsRef = collection(
              db,
              "Missions",
              eventId,
              "task",
              task.id,
              "participants"
            );
            const participantsSnap = await getDocs(participantsRef);
            participantsSnap.docs.forEach((doc) => {
              allParticipants.push({
                id: doc.id,
                taskId: task.id,
                ...doc.data(),
              });
            });
          }
          setTaskParticipants(allParticipants);
        }
      } catch (error) {
        console.error("Error fetching event data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  if (loading) {
    return <div className="loading">Loading event details...</div>;
  }

  if (!mission) {
    return <div className="error">Event not found</div>;
  }

  // calculate completion stats
  const activeMissions = allMissions.filter(
    (m) => m.status === "published"
  ).length;
  const completedMissions = allMissions.filter(
    (m) => m.status === "completed"
  ).length;

  // Calculate metrics
  const volunteersRegistered = volunteers.length;
  const studentsPresent = volunteers.filter(
    (v) => v.attendanceStatus === "attended",
  ).length;
  const facultyPresent = 0; // TODO: Calculate from faculty subcollection
  const attendanceRate =
    volunteersRegistered > 0
      ? ((studentsPresent / volunteersRegistered) * 100).toFixed(1)
      : 0;

  const totalTasks = tasks.length;
  const totalTaskParticipants = taskParticipants.length;
  const completedTaskParticipants = taskParticipants.filter(
    (p) => p.status === "completed"
  ).length;
  const taskCompletionRate =
    totalTaskParticipants > 0
      ? ((completedTaskParticipants / totalTaskParticipants) * 100).toFixed(0)
      : 0;

  const isHappeningToday = () => {
    const today = new Date();
    const eventDate = mission.dateAt?.toDate
      ? mission.dateAt.toDate()
      : new Date(mission.date);
    return (
      today.getFullYear() === eventDate.getFullYear() &&
      today.getMonth() === eventDate.getMonth() &&
      today.getDate() === eventDate.getDate()
    );
  };

  return (
    <div className="current-event-monitoring">
      {/* Header */}
      <div className="cem-header">
        <div className="cem-header-left">
          <button
            className="cem-back-btn"
            onClick={() => navigate("/admin/dashboard")}
          >
            ✕
          </button>
          <h1 className="cem-title">Current Event Monitoring</h1>
        </div>
        <div className="cem-header-right">
          <span className="cem-stats">Active: {activeMissions} | Complete: {completedMissions}</span>
          {isHappeningToday() && (
            <span className="cem-badge happening">Happening Today</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="cem-content">
        {/* Left Panel - Project Summary */}
        <div className="cem-panel cem-summary">
          <h2 className="cem-panel-title">Project Summary & Details</h2>

          <div className="cem-summary-content">
            <h3 className="cem-project-name">{mission.title}</h3>
            <p className="cem-published">
              Published By:{" "}
              <strong>{mission.waiver || "wala pa sa firestore"}</strong>
            </p>
            <p className="cem-partner">
              Partnering Organization:{""}
              <strong>
                {"wala pa sa firestore"}
              </strong>
            </p>
            <p></p>
            <strong>Details</strong>

            <div className="cem-description">
              <p>
                {mission.description}
              </p>
            </div>

            <div className="cem-info-section">
              <h4 className="cem-info-title">Location:</h4>
              <ul className="cem-info-list">
                <li>
                  {mission.location ||
                    "San Juan River, Brgy. Poblacion II, Calamba City, Laguna"}
                </li>
              </ul>
            </div>

            <div className="cem-info-section">
              <h4 className="cem-info-title">Date & Time:</h4>
              <ul className="cem-info-list">
                <li>
                  {mission.date || "November 9, 2025"} | 7:00 AM to 12:00 PM
                </li>
              </ul>
            </div>

            <div className="cem-info-section">
              <h4 className="cem-info-title">SDG Alignment:</h4>
              <ul className="cem-info-list">
                <li>Pa-edit na lang sa kukuha nung sa SDG</li>
              </ul>
            </div>

            <button className="cem-btn-primary">Edit Details</button>
          </div>
        </div>

        {/* Right Panel - Analytics */}
        <div className="cem-panel-group">
          {/* Participation & Roster Analytics */}
          <div className="cem-panel cem-analytics">
            <h2 className="cem-panel-title">
              Participation & Roster Analytics
            </h2>

            <div className="cem-analytics-content">
              <div className="cem-metric-row">
                <span className="cem-metric-label">Volunteers Registered</span>
                <span className="cem-metric-value">
                  {volunteersRegistered} Students
                </span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">Students Present</span>
                <span className="cem-metric-value">
                  {studentsPresent} Students
                </span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">Faculty Present</span>
                <span className="cem-metric-value">
                  {facultyPresent} Faculty
                </span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">
                  Attendance Success Rate
                </span>
                <span className="cem-metric-badge success">
                  {attendanceRate}%
                </span>
              </div>

              <button className="cem-btn-secondary">
                View & Validate Roster
              </button>
            </div>
          </div>

          {/* Impact & Feedback Analytics */}
          <div className="cem-panel cem-analytics">
            <h2 className="cem-panel-title">Impact & Feedback Analytics</h2>

            <div className="cem-analytics-content">
              <div className="cem-metric-row">
                <span className="cem-metric-label">
                  Total Beneficiaries Served
                </span>
                <span className="cem-metric-value">wala pa sa firestore</span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">
                  Vulnerable Sector Reach
                </span>
                <span className="cem-metric-value">wala pa sa firestore</span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">Task Completion Status</span>
                <span className="cem-metric-value">{taskCompletionRate}%</span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">
                  Community Feedback Score
                </span>
                <span className="cem-metric-badge feedback">wala pa sa firestore</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="cem-actions">
            <button className="cem-btn-action">
              Review Submitted Activity Files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
