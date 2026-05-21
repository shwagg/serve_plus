import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { createNotification } from '../../../utils/notificationUtils';

import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import Header from '../../../components/Header';
import '../../../styles/student.css';
import PreActivitySurvey from '../../../forms/PreActivitySurvey';
import mission1 from '../../../assets/mission1.jpg';

export default function EventDetails({ onClose = null, missionId = null }) {
  const { id: paramId } = useParams();
  const id = missionId || paramId;
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [volunteer, setVolunteer] = useState(null);
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [volunteerAvatars, setVolunteerAvatars] = useState([]);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyData, setSurveyData] = useState(null);
  const [consentFile, setConsentFile] = useState(null);
  const [consentUploading, setConsentUploading] = useState(false);
  const [surveyError, setSurveyError] = useState('');
  const [userName, setUserName] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [attendanceFlag, setAttendanceFlag] = useState(null); // { flagged: bool, expiry: Date, missionTitle: string }
  const [copySuccess, setCopySuccess] = useState(false);
  const defaultBanner = mission1;

  const handleShare = () => {
    const url = `${window.location.origin}/preview/event/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {});
  };


  // Fetch user's attendance flag status
  useEffect(() => {
    async function fetchFlagStatus() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.attendanceFlagged) {
            const expiry = data.attendanceFlagExpiry?.toDate
              ? data.attendanceFlagExpiry.toDate()
              : new Date(data.attendanceFlagExpiry);
            setAttendanceFlag({
              flagged: true,
              expiry,
              missionTitle: data.attendanceFlaggedMissionTitle || 'a previous mission',
              expired: expiry <= new Date(),
            });
          }
        }
      } catch (_) {}
    }
    fetchFlagStatus();
  }, []);

  useEffect(() => {
    async function fetchMission() {
      try {
        const missionRef = doc(db, 'missions', id);
        const missionSnap = await getDoc(missionRef);
        if (missionSnap.exists()) {
          setMission(missionSnap.data());
          // Check if user is already a volunteer
          const user = auth.currentUser;
          const tasksRef = collection(db, "missions", id, "task");
          const tasksSnap = await getDocs(tasksRef);

          setTasks(
            tasksSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
          );

          // Fetch all volunteers for count + avatars
          const volunteersRef = collection(db, 'missions', id, 'volunteer');
          const volunteersSnap = await getDocs(volunteersRef);
          const allVolunteerIds = volunteersSnap.docs.map(d => d.id);
          setVolunteerCount(allVolunteerIds.length);

          const avatarUids = allVolunteerIds.slice(0, 3);
          const avatars = await Promise.all(
            avatarUids.map(async (uid) => {
              try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                const data = userSnap.data();
                return data?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data?.name || 'User')}&background=30bdb7&color=fff&size=64`;
              } catch {
                return `https://ui-avatars.com/api/?name=User&background=30bdb7&color=fff&size=64`;
              }
            })
          );
          setVolunteerAvatars(avatars);

          if (user) {
            const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            if (volunteerSnap.exists()) {
              setVolunteer(volunteerSnap.data());
            }
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              setUserName(uData.name || uData.username || '');
              setUserDepartment(uData.department || '');
            }
          }
        } else {
          setMission(null);
        }
      } catch (err) {
        setMission(null);
      } finally {
        setLoading(false);
      }
    }
    fetchMission();
  }, [id, navigate]);

  useEffect(() => {
    if (volunteer?.registrationStatus === "approved") {
      navigate(`/event/${id}/activity?mode=active`);
    }
  }, [volunteer, id, navigate]);

  // Proponents/organizers go straight into the event — no join step needed
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !mission) return;
    if (mission.createdBy === user.uid) {
      navigate(`/event/${id}/activity?mode=active`);
    }
  }, [mission, id, navigate]);

  const handleCancelRequest = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "missions", id, "volunteer", user.uid));
      await deleteDoc(doc(db, "userMissions", user.uid, "missions", id));
      setVolunteer(null);
    } catch (err) {
      console.error("Failed to cancel request:", err);
      alert("Failed to cancel request. Please try again.");
    }
  };

  const handleJoinEvent = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to join this event.");
      return;
    }

    // Enforce participant limit
    const limit = mission?.participantLimit ? Number(mission.participantLimit) : null;
    if (limit && volunteerCount >= limit) {
      alert(`This event is full. Maximum of ${limit} participants allowed.`);
      return;
    }

    setJoining(true);
    try {
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);

      await setDoc(volunteerRef, {
        userId: user.uid,
        joinedAt: new Date().toISOString(),
        registrationStatus: "approved",
        completionStatus: "in_progress",
        pointsEarned: 0,
        progress: {
          preSurvey: "locked",
          consent: "locked",
          attendance: "not_checked_in",
          postSurvey: "locked"
        },
      });

      // If this join fills the last slot, stamp fullBookedTime and notify all enrolled volunteers
      if (limit && volunteerCount + 1 >= limit) {
        updateDoc(doc(db, "missions", id), { fullBookedTime: serverTimestamp() })
          .catch(e => console.warn("Failed to stamp fullBookedTime:", e));

        // Notify every enrolled volunteer (fire-and-forget)
        getDocs(collection(db, "missions", id, "volunteer"))
          .then(volSnap => {
            const eventTitle = mission?.title || "this event";
            const notifPayload = {
              type: "event_full",
              title: "Event Now Full",
              message: `"${eventTitle}" has reached its maximum of ${limit} participant${limit !== 1 ? "s" : ""}. No more slots available.`,
              link: `/event/${id}/activity?mode=active`,
              eventId: id,
            };
            volSnap.docs.forEach(vDoc => {
              createNotification(vDoc.id, notifPayload)
                .catch(e => console.warn("Failed to send event_full notification:", e));
            });
          })
          .catch(e => console.warn("Failed to fetch volunteers for full-event notification:", e));
      }

      // Keep a reverse index so the chat dropdown can load instantly — non-blocking
      setDoc(doc(db, "userMissions", user.uid, "missions", id), {
        missionId: id,
        title: mission?.title || "Untitled Mission",
        role: "volunteer",
        date: mission?.targetDate || '',
        joinedAt: serverTimestamp(),
      }).catch(e => console.error("Failed to write userMissions index:", e));

      // Fire notification without awaiting — non-critical
      const notificationsRef = collection(db, "users", user.uid, "notifications");
      getDocs(query(notificationsRef, where("type", "==", "event_registration"), where("eventId", "==", id)))
        .then(existing => {
          if (existing.empty) {
            createNotification(user.uid, {
              type: "event_registration",
              title: "Enrolled Successfully",
              message: `You have been enrolled in "${mission?.title || "this event"}".`,
              link: `/event/${id}/activity?mode=active`,
              eventId: id,
            });
          }
        })
        .catch(e => console.error("Failed to create registration notification:", e));

      navigate(`/event/${id}/activity?mode=active`);
    } catch (err) {
      console.error("Failed to join event:", err);
      setJoining(false);
    }

  };

  const handleSurveyAndConsentSubmit = async (form) => {
    setSurveyData(form);
    setConsentUploading(true);
    try {
      await handleJoinEvent();
    } finally {
      setConsentUploading(false);
    }
  };

  if (loading) {
    if (onClose) return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
    return <div className="full-page"><Header /><div className="content-page" style={{ padding: 32 }}>Loading...</div></div>;
  }
  if (!mission) {
    if (onClose) return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Event not found.</div>;
    return <div className="full-page"><Header /><div className="content-page" style={{ padding: 32 }}>Event not found.</div></div>;
  }

  return (
    <div className={onClose ? "event-details-modal-root" : "full-page"}>
      {!onClose && <Header />}
      {!onClose && <div className="header-spacer"></div>}
      <div className={`content-page${onClose ? " event-details-modal-content" : ""}`}>
        <div className={`event-details-center${onClose ? " event-details-center--modal" : ""}`}>
          <div className={`event-details-image${onClose ? " event-details-image--modal" : ""}`}>
            <img
              src={mission.img && mission.img.trim() !== "" ? mission.img : defaultBanner}
              alt={mission.alt || "Event image"}
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultBanner; }}
            />
            <div className="event-details-toolbar">
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                {copySuccess && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1f2937',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}>
                    Link copied!
                  </div>
                )}
                <button
                  onClick={handleShare}
                  className="event-details-icon-btn"
                  aria-label={copySuccess ? 'Copied!' : 'Copy event link'}
                  title={copySuccess ? 'Copied!' : 'Copy event link'}
                >
                  {copySuccess
                    ? <span style={{ fontSize: 15, fontWeight: 700}}>✓</span>
                    : <IosShareRoundedIcon sx={{ fontSize: 17 }} />}
                </button>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="event-details-icon-btn"
                  aria-label="Close"
                >✕</button>
              )}
            </div>
          </div>
          <div className={`event-details-card${onClose ? " event-details-card--modal" : ""}`}>
            <div className={`event-details-grid${onClose ? " event-details-grid--modal" : ""}`}>

              {/* LEFT COLUMN */}
              <div className="event-details-left">
                <h1 className="event-details-title">{mission.title}</h1>
                <p className="event-details-desc">{mission.description}</p>
                <div className="event-details-meta">
                  <div className="event-meta-item">
                    📅 <span>{mission.targetDate || "Date TBA"}</span>
                  </div>

                  <div className="event-meta-item">
                    📍 <span>{mission.location || "Location TBA"}</span>
                  </div>

                  <div className="event-meta-item">
                    ⏱ <span>
                      {mission.volunteerHours
                        ? `${mission.volunteerHours} hours`
                        : "TBA"}
                    </span>
                  </div>

                  {(mission.preparedBy || (Array.isArray(mission.proponents) && mission.proponents.length > 0)) && (
                    <div className="event-meta-item">
                      👤 <span>
                        <strong>Proposed by: </strong>
                        {Array.isArray(mission.proponents) && mission.proponents.length > 0
                          ? mission.proponents.join(', ')
                          : mission.preparedBy}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="event-details-divider" />

              {/* RIGHT COLUMN */}
              <div className="event-details-right">
                <div className="event-details-section">
                  <ul className="event-details-activity-list">
                    {(mission.details ||
                      (mission.activities && mission.activities[0]?.details) ||
                      []).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                  </ul>
                </div>

                <div className="event-details-section">
                  <span className="event-details-activity-label">
                    Included Tasks
                  </span>

                  {tasks.length === 0 ? (
                    <p className="event-details-empty">
                      No tasks added yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 6 }}>
                      {tasks.map(task => (
                        <div key={task.id} className="event-task-item">
                          <span>☑️</span>
                          <span>{task.title}</span>
                          <span className="task-points">{task.points} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div className="event-details-cta">
              {/* Left: volunteer avatars + joined count */}
              <div className="volunteer-avatars">
                {volunteerCount > 0 && (
                  <>
                    <div className="volunteer-avatar-stack">
                      {volunteerAvatars.map((src, i) => (
                        <img key={i} src={src} alt="volunteer" />
                      ))}
                      {volunteerCount > 3 && (
                        <div className="volunteer-avatar-overflow">+{volunteerCount - 3}</div>
                      )}
                    </div>
                    <span className="volunteer-joined-text">{volunteerCount} joined</span>
                  </>
                )}
              </div>

              {/* Right: join / flagged / already enrolled button */}
              <div className="event-details-action">
                {/* Attendance flag check — active flag blocks joining.
                    Exception: the event's own proponent/creator is never blocked. */}
                {attendanceFlag?.flagged && !attendanceFlag?.expired && mission?.createdBy !== auth.currentUser?.uid ? (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      className="event-details-join-btn"
                      disabled
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        cursor: 'not-allowed',
                        opacity: 0.9,
                      }}
                    >
                      🚩 FLAGGED – CANNOT JOIN
                    </button>
                    <p style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: '#b91c1c',
                      fontWeight: 500,
                      maxWidth: 260,
                    }}>
                      You missed attendance for &ldquo;{attendanceFlag.missionTitle}&rdquo;.
                      Restriction lifts on {attendanceFlag.expiry?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.
                    </p>
                  </div>
                ) : volunteer?.registrationStatus === "approved" ? null : mission?.participantLimit && volunteerCount >= Number(mission.participantLimit) ? (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      className="event-details-join-btn"
                      disabled
                      style={{
                        background: 'linear-gradient(135deg, #9ca3af, #6b7280)',
                        cursor: 'not-allowed',
                        opacity: 0.9,
                      }}
                    >
                      🔒 EVENT FULL
                    </button>
                    <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontWeight: 500, maxWidth: 260 }}>
                      This event has reached its maximum of {mission.participantLimit} participants.
                    </p>
                  </div>
                ) : (
                  <button
                    className="event-details-join-btn"
                    disabled={joining}
                    onClick={handleJoinEvent}
                  >
                    {joining ? "JOINING..." : "JOIN EVENT"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
  {/* Modal for Pre-Activity Survey and Consent Upload */ }
  {
    showSurveyModal && (
      <div className="event-survey-modal-overlay">
        <div className="event-survey-modal">
          <button
            onClick={() => setShowSurveyModal(false)}
            style={{
              position: 'absolute', top: 12, right: 14,
              background: '#1f2937', border: 'none', color: '#fff',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', zIndex: 10,
            }}
            aria-label="Close survey modal"
          >✕</button>
          <div style={{ padding: '32px 24px 24px 24px' }}>
            <h2 style={{ color: '#23235b', fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Before Joining: Pre-Activity Survey & Consent</h2>
            <PreActivitySurvey
              initialName={userName}
              initialTitle={mission?.title || ''}
              initialCollege={userDepartment}
              onSubmit={async (form) => {
                // Validate consent file
                if (!consentFile) {
                  setSurveyError('Please upload your signed activity consent form.');
                  return;
                }
                setSurveyError('');
                await handleSurveyAndConsentSubmit(form);
              }}
            >
              {/* Consent upload and error inside form */}
              <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <label style={{ fontWeight: 600, color: '#23235b', marginBottom: 8, display: 'block', textAlign: 'center', width: '100%' }}>
                  Upload Signed Activity Consent Form *
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setConsentFile(e.target.files[0])}
                  style={{ marginBottom: 8, display: 'block' }}
                />
                {consentFile && (
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 8, textAlign: 'center' }}>
                    Selected: {consentFile.name}
                  </div>
                )}
                <div style={{ marginTop: 8, textAlign: 'center', width: '100%' }}>
                  <a
                    href="/assets/Activity%20Consent%20Form%20Fillable.pdf"
                    download
                    style={{
                      color: '#30bdb7',
                      textDecoration: 'underline',
                      fontWeight: 500,
                      fontSize: 15,
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Activity Consent Form (PDF)
                  </a>
                </div>
              </div>
              {surveyError && (
                <div style={{ color: '#c0392b', fontWeight: 500, marginBottom: 12 }}>{surveyError}</div>
              )}
            </PreActivitySurvey>
          </div>
        </div>
      </div>
    )
  }
      </div >
    </div >
  );
}
