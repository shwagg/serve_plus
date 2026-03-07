
import { collection, doc, getDoc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { createNotification } from "../../utils/notificationUtils";
import "../../styles/CurrentEventMonitoring.css";
import ImpactMetrics from "./ImpactMetrics";

export default function CurrentEventMonitoring() {
  // Support both missionId (partner route) and eventId (admin route)
  const params = useParams();
  const missionId = params.missionId || params.eventId;
  // Guard: If missionId is missing, do not attempt to fetch or render event data
  if (!missionId) {
    return <div className="error">No event selected. Please select an event from the dashboard or project list.</div>;
  }
  // Guard: If missionId is missing, do not attempt to fetch or render event data
  if (!missionId) {
    console.error("No missionId provided in route params.");
    return <div className="error">No event selected. Please select an event from the dashboard or project list.</div>;
  }
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allMissions, setAllMissions] = useState([]);
  const [taskParticipants, setTaskParticipants] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showPreSurveyAnalytics, setShowPreSurveyAnalytics] = useState(false);
  const [preSurveyAnalytics, setPreSurveyAnalytics] = useState(null);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!missionId) return; // Guard: do not fetch if missionId is missing
      try {
        setLoading(true);

        // fetch missions for completion statistics
        const missionsRef = collection(db, "missions");
        const missionsSnap = await getDocs(missionsRef);
        const missionsData = missionsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllMissions(missionsData);

        const usersSnap = await getDocs(collection(db, "users"));
        const userMap = {};
        usersSnap.docs.forEach((userDoc) => {
          userMap[userDoc.id] = userDoc.data();
        });
        setUsersById(userMap);

        // Fetch mission data
        const missionRef = doc(db, "missions", missionId);
        const missionSnap = await getDoc(missionRef);

        if (missionSnap.exists()) {
          setMission({ id: missionSnap.id, ...missionSnap.data() });

          // Fetch volunteers and their preSurveyAnswers (match DocumentLibrary logic)
          const volunteersRef = collection(
            db,
            "missions",
            missionId,
            "volunteer",
          );
          const volunteersSnap = await getDocs(volunteersRef);
          const volunteersRaw = volunteersSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Fetch preSurveyAnswers for each volunteer
          const volunteersWithSurveys = await Promise.all(
            volunteersRaw.map(async (v) => {
              let preSurveyAnswers = null;
              let postSurveyAnswers = null;
              try {
                const preDoc = await getDoc(
                  doc(db, "missions", missionId, "volunteer", v.id, "preSurvey", "response")
                );
                if (preDoc.exists()) preSurveyAnswers = preDoc.data();
              } catch (e) {}
              try {
                const postDoc = await getDoc(
                  doc(db, "missions", missionId, "volunteer", v.id, "postSurvey", "response")
                );
                if (postDoc.exists()) postSurveyAnswers = postDoc.data();
              } catch (e) {}
              return {
                ...v,
                preSurveyAnswers,
                postSurveyAnswers,
              };
            })
          );
          setVolunteers(volunteersWithSurveys);

          // Fetch tasks
          const tasksRef = collection(db, "missions", missionId, "task");
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
              "missions",
              missionId,
              "task",
              task.id,
              "participants",
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

          // No need to fetch preActivitySurvey subcollection; DocumentLibrary counts volunteers with preSurveyAnswers
        }
      } catch (error) {
        console.error("Error fetching event data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [missionId]);

  if (loading) {
    return <div className="loading">Loading event details...</div>;
  }

  if (!mission || typeof mission !== 'object') {
    console.error("Event not found for missionId:", missionId);
    return <div className="error">Event not found</div>;
  }

  // Only allow published missions, with defensive check
  if (!mission.status || typeof mission.status !== 'string' || mission.status !== "published") {
    return <div className="error">Event is not published or not available for monitoring.</div>;
  }


  // calculate completion stats
  const activeMissions = allMissions.filter(
    (m) => m.status === "published",
  ).length;
  const completedMissions = allMissions.filter(
    (m) => m.status === "completed",
  ).length;

  // Calculate metrics
  const volunteersRegistered = volunteers.length;
  // Count students who have submitted attendance (progress.attendance === 'present')
  const studentsPresent = volunteers.filter(
    (v) => v.progress?.attendance === "present"
  ).length;
  const facultyPresent = 0; // TODO: Calculate from faculty subcollection
  // Attendance rate as percent of registered users
  const attendanceRate =
    volunteersRegistered > 0
      ? ((studentsPresent / volunteersRegistered) * 100).toFixed(0)
      : 0;

  // Pie chart constants (must be after attendanceRate is defined)
  const PIE_SIZE = 120;
  const PIE_RADIUS = 54;
  const PIE_CIRCUM = 2 * Math.PI * PIE_RADIUS;
  const attendancePercent = Number(attendanceRate);
  const attendanceStroke = (attendancePercent / 100) * PIE_CIRCUM;

  const totalTasks = tasks.length;
  const totalTaskParticipants = taskParticipants.length;
  const completedTaskParticipants = taskParticipants.filter(
    (p) => p.status === "completed",
  ).length;
  const taskCompletionRate =
    totalTaskParticipants > 0
      ? ((completedTaskParticipants / totalTaskParticipants) * 100).toFixed(0)
      : 0;

  const isHappeningToday = () => {
    const today = new Date();
    let eventDate;
    if (mission.targetDate?.toDate) {
      eventDate = mission.targetDate.toDate();
    } else if (mission.targetDate) {
      eventDate = new Date(mission.targetDate);
    } else {
      return false;
    }
    return (
      today.getFullYear() === eventDate.getFullYear() &&
      today.getMonth() === eventDate.getMonth() &&
      today.getDate() === eventDate.getDate()
    );
  };

  const reflectionItems = taskParticipants.filter(
    (participant) => participant.reflection && participant.reflection.trim()
  );

  const taskTitleById = tasks.reduce((acc, task) => {
    acc[task.id] = task.title || "Task";
    return acc;
  }, {});

  const handleReflectionReview = async (participant, action) => {
    const participantRef = doc(
      db,
      "missions",
      missionId,
      "task",
      participant.taskId,
      "participants",
      participant.id
    );

    const newStatus = action === "approve" ? "approved" : "needs_revision";

    await updateDoc(participantRef, {
      reflectionStatus: newStatus,
      reflectionReviewedAt: serverTimestamp(),
    });

    await createNotification(participant.id, {
      type: newStatus === "approved" ? "reflection_approved" : "reflection_needs_revision",
      title: newStatus === "approved" ? "Reflection Approved" : "Reflection Needs Revision",
      message:
        newStatus === "approved"
          ? `Your reflection for "${taskTitleById[participant.taskId]}" was approved.`
          : `Your reflection for "${taskTitleById[participant.taskId]}" needs revision.`,
      link: `/event/${missionId}/activity?mode=active`,
      eventId: missionId,
      taskId: participant.taskId,
    });

    setTaskParticipants((prev) =>
      prev.map((item) =>
        item.id === participant.id && item.taskId === participant.taskId
          ? { ...item, reflectionStatus: newStatus }
          : item
      )
    );
  };

  return (
    <div className="current-event-monitoring">
      {/* Header */}
      <div className="cem-header">
        <div className="cem-header-left">
          <button
            className="cem-back-btn"
            onClick={() => navigate(-1)}
          >
            ✕
          </button>
          <h1 className="cem-title">Current Event Monitoring</h1>
        </div>
        <div className="cem-header-right">
          <span className="cem-stats">
            Active: {activeMissions} | Complete: {completedMissions}
          </span>
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

            <h3 className="cem-project-name">{mission.title || "Untitled Event"}</h3>
            <p className="cem-published">
              Published By:{" "}
              <strong>{typeof mission.waiver === 'string' ? mission.waiver : "wala pa sa firestore"}</strong>
            </p>
            <p className="cem-partner">
              Partnering Organization:{""}
              <strong>{mission.partnerOrg || "wala pa sa firestore"}</strong>
            </p>
            <p></p>
            <strong>Details</strong>

            <div className="cem-description">
              <p>{mission.description || "No description provided."}</p>
            </div>

            <div className="cem-info-section">
              <h4 className="cem-info-title">Location:</h4>
              <ul className="cem-info-list">
                <li>
                  {mission.location && typeof mission.location === 'string'
                    ? mission.location
                    : "San Juan River, Brgy. Poblacion II, Calamba City, Laguna"}
                </li>
              </ul>
            </div>

            <div className="cem-info-section">
              <h4 className="cem-info-title">Date & Time:</h4>
              <ul className="cem-info-list">
                <li>
                  {mission.targetDate && typeof mission.targetDate === 'object' && typeof mission.targetDate.toDate === 'function'
                    ? mission.targetDate.toDate().toLocaleDateString()
                    : mission.targetDate && typeof mission.targetDate === 'string'
                      ? new Date(mission.targetDate).toLocaleDateString()
                      : "Date not set"}{" "}
                  | 7:00 AM to 12:00 PM
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
                  {attendanceRate}% out of 100
                </span>
              </div>

              <button className="cem-btn-secondary" onClick={() => setShowRosterModal(true)}>
                View & Validate Roster
              </button>
                  {/* Roster Modal */}
                  {showRosterModal && (
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(44,62,80,0.18)',
                        zIndex: 11000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => setShowRosterModal(false)}
                    >
                      <div
                        style={{
                          background: '#fff',
                          borderRadius: 16,
                          padding: 32,
                          minWidth: 400,
                          maxWidth: '90vw',
                          boxShadow: '0 2px 16px #0002',
                          position: 'relative',
                          color: '#000',
                          maxHeight: '80vh',
                          overflowY: 'auto',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'none',
                            border: 'none',
                            fontSize: 22,
                            cursor: 'pointer',
                            color: '#23335b',
                          }}
                          onClick={() => setShowRosterModal(false)}
                        >
                          ×
                        </button>
                        <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#000' }}>Registered Volunteers</h2>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                          <svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`} style={{ marginRight: 24 }}>
                            <circle
                              cx={PIE_SIZE / 2}
                              cy={PIE_SIZE / 2}
                              r={PIE_RADIUS}
                              fill="#f3f4f8"
                              stroke="#e0e4ea"
                              strokeWidth={12}
                            />
                            <circle
                              cx={PIE_SIZE / 2}
                              cy={PIE_SIZE / 2}
                              r={PIE_RADIUS}
                              fill="none"
                              stroke="#30bdb7"
                              strokeWidth={12}
                              strokeDasharray={`${attendanceStroke} ${PIE_CIRCUM - attendanceStroke}`}
                              strokeDashoffset={PIE_CIRCUM / 4}
                              style={{ transition: 'stroke-dasharray 0.6s' }}
                            />
                            <text
                              x="50%"
                              y="50%"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize="1.5rem"
                              fontWeight="bold"
                              fill="#23335b"
                            >
                              {attendanceRate}%
                            </text>
                          </svg>
                          <div style={{ fontWeight: 600, color: '#23335b', fontSize: '1.1rem' }}>
                            Attendance Success Rate
                            <div style={{ fontWeight: 400, color: '#888', fontSize: '0.95rem', marginTop: 4 }}>
                              {studentsPresent} of {volunteersRegistered} present
                            </div>
                          </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 8px #0001' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f8', color: '#23335b', borderBottom: '2px solid #e0e4ea' }}>
                              <th style={{ padding: '12px 10px', fontWeight: 700, textAlign: 'left' }}>Name</th>
                              <th style={{ padding: '12px 10px', fontWeight: 700, textAlign: 'center' }}>Attendance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {volunteers.length === 0 ? (
                              <tr>
                                <td colSpan={2} style={{ textAlign: 'center', padding: 24, color: '#888', background: '#fff' }}>No volunteers registered.</td>
                              </tr>
                            ) : (
                              volunteers.map((v, idx) => {
                                const user = usersById[v.id] || {};
                                const name = user.name || user.username || user.email || v.id;
                                const attendance = v.progress?.attendance === 'present' ? 'Present' : '';
                                return (
                                  <tr key={v.id}>
                                    <td style={{ padding: '10px 8px', color: '#111' }}>{name}</td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{attendance}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
            </div>
          </div>

          {/* Impact & Feedback Analytics */}
          <div className="cem-panel cem-analytics">
            <h2 className="cem-panel-title">Impact & Feedback Analytics</h2>
            <div className="cem-analytics-content">
              <div className="cem-metric-row">
                <span className="cem-metric-label">Volunteers Registered</span>
                <span className="cem-metric-value">{volunteersRegistered} Students</span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">Pre Activity Survey Answers</span>
                <span className="cem-metric-value">
                  {(() => {
                    const preSurveyCount = volunteers.filter(v => v.preSurveyAnswers).length;
                    return preSurveyCount === 1
                      ? '1 student submitted'
                      : `${preSurveyCount} students submitted`;
                  })()}
                </span>
              </div>
                    {/* Pre Activity Survey Analytics Modal */}
                    {showPreSurveyAnalytics && (
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          width: '100vw',
                          height: '100vh',
                          background: 'rgba(44,62,80,0.18)',
                          zIndex: 12000,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => setShowPreSurveyAnalytics(false)}
                      >
                        <div
                          style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: 32,
                            minWidth: 400,
                            maxWidth: '90vw',
                            boxShadow: '0 2px 16px #0002',
                            position: 'relative',
                            color: '#000',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            style={{
                              position: 'absolute',
                              top: 16,
                              right: 16,
                              background: 'none',
                              border: 'none',
                              fontSize: 22,
                              cursor: 'pointer',
                              color: '#23335b',
                            }}
                            onClick={() => setShowPreSurveyAnalytics(false)}
                          >
                            ×
                          </button>
                          <ImpactMetrics
                            open={showPreSurveyAnalytics}
                            onClose={() => setShowPreSurveyAnalytics(false)}
                            preSurveyAnalytics={preSurveyAnalytics}
                            volunteers={volunteers}
                          />
                        </div>
                      </div>
                    )}
              <div className="cem-metric-row">
                <span className="cem-metric-label">Post Activity Survey Answers</span>
                <span className="cem-metric-value">
                  {(() => {
                    const postSurveyCount = volunteers.filter(v => v.postSurveyAnswers).length;
                    return postSurveyCount === 1
                      ? '1 student submitted'
                      : `${postSurveyCount} students submitted`;
                  })()}
                </span>
              </div>
              <div className="cem-metric-row">
                <span className="cem-metric-label">Community Feedback Answers</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  className="cem-btn-secondary"
                  style={{ fontSize: 13, padding: '4px 12px' }}
                  onClick={async () => {
                    // Compute analytics from preSurveyAnswers
                    const answers = volunteers
                      .map(v => v.preSurveyAnswers)
                      .filter(Boolean);
                    if (answers.length === 0) {
                      setPreSurveyAnalytics(null);
                    } else {
                      const keys = Object.keys(answers[0]);
                      const analytics = {};
                      keys.forEach(key => {
                        const counts = {};
                        answers.forEach(ans => {
                          const val = ans[key];
                          if (val !== undefined && val !== null && val !== "") {
                            counts[val] = (counts[val] || 0) + 1;
                          }
                        });
                        analytics[key] = counts;
                      });
                      setPreSurveyAnalytics(analytics);
                    }
                    setShowPreSurveyAnalytics(true);
                  }}
                >
                  View Analytics
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="cem-actions">
            <button className="cem-btn-action">
              Review Submitted Activity Files
            </button>
          </div>

          <div className="cem-panel cem-analytics">
            <h2 className="cem-panel-title">Reflection Reviews</h2>
            {reflectionItems.length === 0 ? (
              <div className="cem-analytics-content">
                No reflections submitted.
              </div>
            ) : (
              <div
                className="cem-analytics-content"
                style={{ overflowX: "auto" }}
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Task</th>
                      <th>Reflection</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reflectionItems.map((participant) => {
                      const userData = usersById[participant.id] || {};
                      const studentName =
                        userData.name ||
                        userData.username ||
                        userData.email ||
                        participant.id;
                      return (
                        <tr key={`${participant.id}-${participant.taskId}`}>
                          <td>{studentName}</td>
                          <td>{taskTitleById[participant.taskId]}</td>
                          <td style={{ maxWidth: 360 }}>
                            {participant.reflection}
                          </td>
                          <td>{participant.reflectionStatus || "submitted"}</td>
                          <td>
                            <button
                              className="approve-btn"
                              onClick={() =>
                                handleReflectionReview(participant, "approve")
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() =>
                                handleReflectionReview(
                                  participant,
                                  "needs_revision",
                                )
                              }
                            >
                              Needs Revision
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
