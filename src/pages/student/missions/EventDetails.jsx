import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { createNotification } from '../../../utils/notificationUtils';

import Header from '../../../components/Header';
import '../../../styles/student.css';
import PreActivitySurvey from '../../../forms/PreActivitySurvey';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [volunteer, setVolunteer] = useState(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyData, setSurveyData] = useState(null);
  const [consentFile, setConsentFile] = useState(null);
  const [consentUploading, setConsentUploading] = useState(false);
  const [surveyError, setSurveyError] = useState('');
  const [userName, setUserName] = useState('');


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

  const handleCancelRequest = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "missions", id, "volunteer", user.uid));
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

    setJoining(true);
    try {
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);

      await setDoc(volunteerRef, {
        userId: user.uid,
        joinedAt: new Date().toISOString(),
        registrationStatus: "pending",
        completionStatus: "pending_approval",
        pointsEarned: 0,
        progress: {
          preSurvey: "locked",
          consent: "locked",
          attendance: "not_checked_in",
          postSurvey: "locked"
        },
      });

      setVolunteer({ registrationStatus: "pending" });
<<<<<<< HEAD


      await setDoc(volunteerRef, {
        joinedAt: new Date().toISOString(),

        registrationStatus: "pending", //for admin approval
        completionStatus: "pending_approval", // event completion requirements
        pointsEarned: 0,

        progress: {
          preSurvey: "locked",
          consent: "locked",
          attendance: "not_checked_in",
          postSurvey: "locked"
        },

      });
      //updates the UI button to 'pending'
      setVolunteer({
        registrationStatus: "pending"
      });


      await setDoc(volunteerRef, {
        joinedAt: new Date().toISOString(),

        registrationStatus: "pending", //for admin approval
        completionStatus: "pending_approval", // event completion requirements
        pointsEarned: 0,

        progress: {
          preSurvey: "locked",
          consent: "locked",
          attendance: "not_checked_in",
          postSurvey: "locked"
        },

      });
      //updates the UI button to 'pending'
      setVolunteer({
        registrationStatus: "pending"
      });

      // Create a registration notification (once per event)
      try {
        const notificationsRef = collection(db, "users", user.uid, "notifications");
        const existingQuery = query(
          notificationsRef,
          where("type", "==", "event_registration"),
          where("eventId", "==", id)
        );
        const existing = await getDocs(existingQuery);
        if (existing.empty) {
          await createNotification(user.uid, {
            type: "event_registration",
            title: "Registration Submitted",
            message: `Your registration for "${mission?.title || "this event"}" is submitted.`,
            link: `/event/${id}`,
            eventId: id,
          });
        }
      } catch (e) {
        console.error("Failed to create registration notification:", e);
      }
      setShowSurveyModal(false);
=======
>>>>>>> 1704ac3 (fix join event button)
    } catch (err) {
      setSurveyError('Failed to upload consent form or submit survey. Please try again.');
    } finally {
      setJoining(false);
    }

    // Create a registration notification (once per event)
    try {
      const notificationsRef = collection(db, "users", user.uid, "notifications");
      const existingQuery = query(
        notificationsRef,
        where("type", "==", "event_registration"),
        where("eventId", "==", id)
      );
      const existing = await getDocs(existingQuery);

      if (existing.empty) {
        await createNotification(user.uid, {
          type: "event_registration",
          title: "Registration Submitted",
          message: `Your registration for "${mission?.title || "this event"}" is submitted.`,
          link: `/event/${id}`,
          eventId: id,
        });
      }
    } catch (e) {
      // Non-blocking: joining the event should still succeed even if notification fails.
      console.error("Failed to create registration notification:", e);
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
    <div className={onClose ? undefined : "full-page"} style={onClose ? { position: 'relative' } : undefined}>
      {!onClose && <Header />}
      {!onClose && <div className="header-spacer"></div>}
      <div className="content-page" style={onClose ? { height: 'auto', overflow: 'visible', padding: 0 } : undefined}>
        <div className="event-details-center">
          <div className="event-details-image" style={{ position: 'relative', ...(onClose ? { height: '160px' } : {}) }}>
            <img
              src={mission.img && mission.img.trim() !== "" ? mission.img : defaultBanner}
              alt={mission.alt || "Event image"}
            />
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: 10, right: 12,
                  background: 'none', border: 'none',
                  fontSize: 28, color: '#111',
                  cursor: 'pointer', zIndex: 20,
                  padding: 0, lineHeight: 1,
                  fontWeight: 700,
                }}
                aria-label="Close"
              >✕</button>
            )}
          </div>
          <div className="event-details-card" style={onClose ? { marginTop: -16, padding: '16px 20px 20px', transform: 'none', boxShadow: 'none' } : undefined}>
            <div className="event-details-grid" style={onClose ? { gap: '16px', padding: '0' } : undefined}>

              {/* LEFT COLUMN */}
              <div className="event-details-left">
                <h1 className="event-details-title" style={onClose ? { fontSize: 28 } : undefined}>{mission.title}</h1>
                <p className="event-details-desc" style={onClose ? { fontSize: 13, lineHeight: 1.4, margin: 0 } : undefined}>{mission.description}</p>
                <div className="event-details-meta" style={onClose ? { gap: 4 } : undefined}>
                  <div className="event-meta-item" style={onClose ? { fontSize: 13 } : undefined}>
                    📅 <span>{mission.targetDate || "Date TBA"}</span>
                  </div>

                  <div className="event-meta-item" style={onClose ? { fontSize: 13 } : undefined}>
                    📍 <span>{mission.location || "Location TBA"}</span>
                  </div>

                  <div className="event-meta-item" style={onClose ? { fontSize: 13 } : undefined}>
                    ⏱ <span>
                      {mission.volunteerHours
                        ? `${mission.volunteerHours} hours`
                        : "TBA"}
                    </span>
                  </div>
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
            <div className="event-details-cta" style={onClose ? { margin: '12px 0 0' } : undefined}>
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

              {/* Right: join / pending button */}
              {volunteer?.registrationStatus === "pending" ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'stretch',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                }}>
                  <span style={{
                    padding: '12px 20px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                    whiteSpace: 'nowrap',
                  }}>
                    Pending Request
                  </span>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.4)' }} />
                  <button
                    onClick={handleCancelRequest}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 14px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Cancel request"
                  >
                    ✕
                  </button>
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
<<<<<<< HEAD
  {/* Modal for Pre-Activity Survey and Consent Upload */ }
  {
    showSurveyModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(44,62,80,0.18)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(44,62,80,0.18)',
          padding: 0,
          minWidth: 380,
          maxWidth: 650,
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}>
          <button
            onClick={() => setShowSurveyModal(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 18,
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              color: '#888',
              cursor: 'pointer',
              zIndex: 10,
            }}
            aria-label="Close survey modal"
          >×</button>
          <div style={{ padding: '32px 24px 24px 24px' }}>
            <h2 style={{ color: '#23235b', fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Before Joining: Pre-Activity Survey & Consent</h2>
            <PreActivitySurvey
              initialName={userName}
              initialTitle={mission?.title || ''}
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
