import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Header from '../../../components/Header';
import GlobalAnnouncements from '../../../components/GlobalAnnouncements';
import '../../../styles/student.css';

function SurveyModal({ open, onClose, onSubmit, screenshot, setScreenshot }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (screenshot) {
      const url = URL.createObjectURL(screenshot);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [screenshot]);

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ textAlign: 'center' }}>Pre-Activity Survey Required</h2>
        <p style={{ textAlign: 'center', maxWidth: 350 }}>
          Please answer the pre-activity survey and upload a screenshot as proof before joining the event.
        </p>
        <a href="https://forms.office.com/r/DnaS8u9U9m" target="_blank" rel="noopener noreferrer" style={{ color: '#30bdb7', marginBottom: 16 }}>Go to Survey</a>
        <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files[0])} style={{ margin: '0 auto' }} />
        </div>
        {previewUrl && (
          <div style={{ position: 'relative', marginBottom: 16, display: 'inline-block' }}>
            <img src={previewUrl} alt="Proof Preview" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
            <button
              onClick={() => setScreenshot(null)}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={onSubmit} style={{ padding: '10px 24px', borderRadius: 20, background: '#222', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Submit Proof</button>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 20, background: '#222', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 2000;
        }
        .modal-content {
          background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.18); min-width: 320px;
        }
      `}</style>
    </div>
  );
}

export default function EventDetails() {
  const [open, setOpen] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMission() {
      try {
        const missionRef = doc(db, 'Missions', id);
        const missionSnap = await getDoc(missionRef);
        if (missionSnap.exists()) {
          setMission(missionSnap.data());
          // Check if user is already a volunteer
          const user = auth.currentUser;
          if (user) {
            const volunteerRef = doc(db, 'Missions', id, 'volunteer', user.uid);
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

  const handleJoinEvent = async () => {
    if (!surveyCompleted) {
      setShowSurveyModal(true);
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      alert('Please log in to join this event.');
      return;
    }
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const userName = userData.name || user.displayName || '';
      const userEmail = user.email || '';
      const volunteerRef = doc(db, 'Missions', id, 'volunteer', user.uid);
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
  };

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
            onClick={handleJoinEvent}
          >
            
            JOIN EVENT
          </button>
        </div>
      </div>
      <SurveyModal
        open={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        screenshot={screenshot}
        setScreenshot={setScreenshot}
        onSubmit={() => {
          if (!screenshot) {
            alert('Please upload a screenshot as proof.');
            return;
          }
          setSurveyCompleted(true);
          setShowSurveyModal(false);
          // Redirect to event details/activity page
          navigate(`/event/${id}/activity`);
        }}
      />
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
