import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth, storage } from '../../../firebaseConfig';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createNotification } from '../../../utils/notificationUtils';

import Header from '../../../components/Header';
import GlobalAnnouncements from '../../../components/GlobalAnnouncements';
import '../../../styles/student.css';
import { GlobalNotificationButton } from "../../../components/GlobalAnnouncements";
import PreActivitySurvey from '../../../forms/PreActivitySurvey';

export default function EventDetails() {
  const [open, setOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const { id } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [volunteer, setVolunteer] = useState(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyData, setSurveyData] = useState(null);
  const [consentFile, setConsentFile] = useState(null);
  const [consentUploading, setConsentUploading] = useState(false);
  const [surveyError, setSurveyError] = useState('');
  const [userName, setUserName] = useState('');


  useEffect(() => {
    const checkCount = () => {
      if (window.announcementActions?.getUnreadCount) {
        setAnnouncementUnreadCount(window.announcementActions.getUnreadCount());
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 500);
    return () => clearInterval(interval);
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

          if (user) {
            const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            //if (volunteerSnap.exists()) {
            // navigate(`/event/${id}/activity`, { replace: true });
            //return;
            //} DELETING THIS FOR TESTING, REPLACED WITH THIS:
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


  // Show modal instead of joining directly
  const handleJoinEvent = async () => {
    setSurveyError('');
    // Try to get the user's name from Firebase Auth or Firestore profile
    let name = '';
    const user = auth.currentUser;
    if (user) {
      // Try displayName first
      name = user.displayName || '';
      // Optionally, fetch from Firestore user profile if needed
      if (!name) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            name = userDocSnap.data().name || '';
          }
        } catch {}
      }
    }
    setUserName(name);
    setShowSurveyModal(true);
  };

  // Handles the actual join after survey and consent
  const handleSurveyAndConsentSubmit = async (surveyForm) => {
    setSurveyError('');
    if (!consentFile) {
      setSurveyError('Please upload your signed activity consent form.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setSurveyError('Please log in to join this event.');
      return;
    }
    setConsentUploading(true);
    try {
      // Upload consent file to Firebase Storage (optional: adjust path as needed)
      let consentUrl = '';
      if (consentFile) {
        const storageModule = await import('firebase/storage');
        const { getStorage, ref, uploadBytes, getDownloadURL } = storageModule;
        const storage = getStorage();
        const fileRef = ref(storage, `missions/${id}/consent_forms/${user.uid}_${consentFile.name}`);
        await uploadBytes(fileRef, consentFile);
        consentUrl = await getDownloadURL(fileRef);
      }

      // Save volunteer registration with survey and consent info
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
      await setDoc(volunteerRef, {
        joinedAt: new Date().toISOString(),
        registrationStatus: "pending",
        completionStatus: "pending_approval",
        pointsEarned: 0,
        progress: {
          preSurvey: "submitted",
          consent: "submitted",
          attendance: "not_checked_in",
          postSurvey: "locked"
        },
        preActivitySurvey: surveyForm,
        consentFormUrl: consentUrl,
      }, { merge: true });

      // Also save pre-activity survey to subcollection preSurvey/response
      const preSurveyResponseRef = doc(db, "missions", id, "volunteer", user.uid, "preSurvey", "response");
      await setDoc(preSurveyResponseRef, surveyForm);
      setVolunteer({ registrationStatus: "pending" });

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
    } catch (err) {
      setSurveyError('Failed to upload consent form or submit survey. Please try again.');
    } finally {
      setConsentUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="full-page">
        <Header />
        <div className="header-spacer"></div>
        <div className="content-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="page-spinner" />
            <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>Loading event...</p>
          </div>
        </div>
      </div>
    );
  }
  if (!mission) {
    return (
      <div className="full-page">
        <Header />
        <div className="header-spacer"></div>
        <div className="content-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>😕</span>
            <h2 style={{ color: '#374151', marginTop: 12 }}>Event not found</h2>
            <p style={{ color: '#6b7280' }}>This event may have been removed or doesn't exist.</p>
            <button className="ui-btn" style={{ marginTop: 16 }} onClick={() => navigate('/student/home')}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <Header />
      <div className="header-spacer"></div>
      <div className="content-page">
        <div className="event-details-center">
          <div className="event-details-image">
            {mission.img && mission.img.trim() !== "" && (
              <img src={mission.img} alt={mission.alt || "Event image"} loading="lazy" />
            )}
          </div>
          <div className="event-details-card">
            <div className="event-details-grid">
              {/* LEFT COLUMN */}
              <div className="event-details-left">
                <h1 className="event-details-title">{mission.title}</h1>
                <p className="event-details-desc">{mission.description}</p>
                <div className="event-details-meta" role="list" aria-label="Event information">
                  <div className="event-meta-item" role="listitem">
                    📅 <span>{mission.targetDate || "Date TBA"}</span>
                  </div>
                  <div className="event-meta-item" role="listitem">
                    📍 <span>{mission.location || "Location TBA"}</span>
                  </div>
                  <div className="event-meta-item" role="listitem">
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
                    <ul className="event-details-activity-list">
                      {tasks.map(task => (
                        <li key={task.id} className="event-task-item">
                          <div className="event-task-item">
                            <span className="event-task-title">
                              {task.title}
                            </span>
                            <span className="task-points">
                              ({task.points} pts)
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div className="event-details-cta">
              <button
                className={`event-details-join-btn ${volunteer?.registrationStatus === "pending"
                  ? "pending"
                  : volunteer?.registrationStatus === "rejected"
                    ? "rejected"
                    : ""
                  }`}
                disabled={volunteer?.registrationStatus === "pending" || joining}
                aria-busy={joining}
                onClick={() => {
                  if (!volunteer) {
                    handleJoinEvent();
                  } else if (volunteer.registrationStatus === "approved") {
                    navigate(`/event/${id}/activity?mode=active`);
                  } else if (volunteer.registrationStatus === "rejected") {
                    handleJoinEvent();
                  }
                }}
              >
                {joining
                  ? "Joining..."
                  : !volunteer
                    ? "JOIN EVENT"
                    : volunteer.registrationStatus === "pending"
                      ? "⏳ PENDING REQUEST"
                      : volunteer.registrationStatus === "approved"
                        ? "VIEW EVENT →"
                        : volunteer.registrationStatus === "rejected"
                          ? "RE-REQUEST"
                          : "JOIN EVENT"}
              </button>
            </div>
          </div>
        </div>
        {/* Modal for Pre-Activity Survey and Consent Upload */}
        {showSurveyModal && (
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
                  initialInitiativeTitle={mission?.title || ''}
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
        )}
      </div>
      {/* TOGGLE BUTTON */}
      <GlobalNotificationButton
        unreadCount={announcementUnreadCount}
        onClick={() => setOpen(!open)}
      />
      <aside className={`global-feed ${open ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 80,
          right: 0,
          height: 'calc(100vh - 80px)',
          width: 380,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '2px solid #30bdb7',
          zIndex: 999,
          transition: 'transform 0.3s',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: open ? 'auto' : 'none'
        }}>
        <div className="global-feed-header">
          <h3 className="global-feed-title">Community Updates</h3>
          <p className="global-feed-subtitle">What's happening this week</p>
        </div>
        <div className="global-feed-list">
          <GlobalAnnouncements />
        </div>
      </aside>
    </div>
  );
}
