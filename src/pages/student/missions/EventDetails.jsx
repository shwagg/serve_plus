
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Header from '../../../components/Header';
import GlobalAnnouncements from '../../../components/GlobalAnnouncements';
import '../../../styles/student.css';

export default function EventDetails() {
  const [open, setOpen] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMission() {
      try {
        const missionRef = doc(db, 'missions', id);
        const missionSnap = await getDoc(missionRef);
        if (missionSnap.exists()) {
          setMission(missionSnap.data());
          // Check if user is already a volunteer
          const user = auth.currentUser;
          if (user) {
            const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            if (volunteerSnap.exists()) {
              navigate(`/event/${id}/activity`, { replace: true });
              return;
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

  if (loading) {
    return <div className="full-page"><Header /><div className="content-page" style={{padding: 32}}>Loading...</div></div>;
  }
  if (!mission) {
    return <div className="full-page"><Header /><div className="content-page" style={{padding: 32}}>Event not found.</div></div>;
  }

  return (
    <div className="full-page event-details-bg">
      <Header />
      <div className="event-details-center">
        <div className="event-details-image">
          <img src={mission.img} alt={mission.alt} />
        </div>
        <div className="event-details-card">
          <div className="event-details-title">{mission.title}</div>
          <div className="event-details-desc">{mission.description}</div>
          <span className="event-details-activity-label">Activity Details:</span>
          <ul className="event-details-activity-list">
            {(mission.details || (mission.activities && mission.activities[0]?.details) || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <button
            className="event-details-join-btn"
            onClick={async () => {
              const user = auth.currentUser;
              if (!user) {
                alert('Please log in to join this event.');
                return;
              }
              try {
                // Get user data from users collection
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const userName = userData.name || user.displayName || '';
                const userEmail = user.email || '';

                const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
                await setDoc(volunteerRef, {
                  joinedAt: new Date().toISOString(),
                  attendanceStatus: 'pending',
                  pointsEarned: 0,
                  verified: false,
                  name: userName,
                  email: userEmail
                });
                navigate(`/event/${id}/activity`);
              } catch (error) {
                console.error('Error joining event:', error);
                alert('Failed to join event. Please try again.');
              }
            }}
          >
            JOIN EVENT
          </button>
        </div>
      </div>
      {/* Community Updates Toggle Button and Slide-in Panel */}
      <button
        className="global-feed-toggle"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          top: 90,
          right: 20,
          background: '#30bdb7',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 16px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}
      >
        📢 Update
        <span className="global-feed-badge">1</span>
      </button>
      {open && (
        <aside className="global-feed open"
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
            transition: 'transform 0.3s'
          }}>
          <div className="global-feed-header">
            <h3 className="global-feed-title">Community Updates</h3>
            <p className="global-feed-subtitle">Whats happening this week</p>
          </div>
          <div className="global-feed-list">
            <GlobalAnnouncements />
          </div>
        </aside>
      )}
    </div>
  );
}
