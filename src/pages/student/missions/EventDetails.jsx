import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { createNotification } from '../../../utils/notificationUtils';

import Header from '../../../components/Header';
import GlobalAnnouncements from '../../../components/GlobalAnnouncements';
import '../../../styles/student.css';
import { GlobalNotificationButton } from "../../../components/GlobalAnnouncements";

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
    } finally {
      setJoining(false);
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
            <button className="ui-btn" style={{ marginTop: 16 }} onClick={() => navigate('/student')}>Back to Home</button>
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
          <p className="global-feed-subtitle">Whats happening this week</p>
        </div>
        <div className="global-feed-list">
          <GlobalAnnouncements />
        </div>
      </aside>
    </div>
  );
}
