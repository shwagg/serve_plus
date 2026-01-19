
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Header from '../../../components/Header';
import GlobalAnnouncements from '../../../components/GlobalAnnouncements';


export default function EventDetails() {
    const [open, setOpen] = useState(false);
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
              // User is already a volunteer, redirect to activity page
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
    return <div style={{ padding: 32 }}>Loading...</div>;
  }
  if (!mission) {
    return <div style={{ padding: 32 }}>Event not found.</div>;
  }

  return (
    <>
      <Header />
      <div style={{ background: '#f6f6f6', minHeight: '100vh', minWidth: '100vw', width: '100vw', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden', padding: 0, paddingTop: 80, overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 24, padding: '32px 0 32px 0', width: '100%', boxSizing: 'border-box', justifyContent: 'center', margin: '0 16px 16px 16px' }}>
          {/* Event Section with image background and overlay card */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: 900, position: 'relative' }}>
            {/* Large event image */}
            <div style={{ width: '100%', height: 260, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', position: 'relative', background: '#eee' }}>
              <img src={mission.img} alt={mission.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* Close button (optional, not functional) */}
              <button style={{ position: 'absolute', top: 18, left: 18, background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 22, fontWeight: 700, color: '#234e7b', cursor: 'pointer', zIndex: 2 }}>×</button>
            </div>
            {/* Overlayed card with green background */}
            <div style={{ background: '#7bb661', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, padding: 0, position: 'relative' }}>
              <div style={{ background: '#fff', borderRadius: 20, margin: '0 24px', marginTop: -60, padding: '36px 32px 28px 32px', boxShadow: '0 4px 24px #0002', position: 'relative', zIndex: 2 }}>
                <h2 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16, fontSize: 24 }}>{mission.title}</h2>
                <p style={{ color: '#234e7b', fontSize: 16, marginBottom: 18 }}>{mission.description}</p>
                <div style={{ marginBottom: 18 }}>
                  <span style={{ fontWeight: 600 }}>Activity Details:</span>
                  <ul style={{ color: '#234e7b', fontSize: 15, marginTop: 8 }}>
                    {(mission.details || (mission.activities && mission.activities[0]?.details) || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <button
                  style={{ background: '#7bb661', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginTop: 8 }}
                  onClick={async () => {
                    const user = auth.currentUser;
                    if (!user) {
                      alert('Please log in to join this event.');
                      return;
                    }
                    
                    try {
                      // Add user to volunteer subcollection with UID as document ID
                      const volunteerRef = doc(db, 'Missions', id, 'volunteer', user.uid);
                      await setDoc(volunteerRef, {
                        joinedAt: new Date().toISOString(),
                        attendanceStatus: 'pending',
                        pointsEarned: 0,
                        verified: false
                      });
                      
                      // Navigate to activity page
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
          </div>
          {/* Community Updates Toggle Button and Slide-in Panel (like StudentHome) */}
          <button
            className="global-feed-toggle"
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Toggle Community Updates"
            style={{ position: 'fixed', top: 120, right: 24, zIndex: 3000 }}
          >
            📰
            <span className="global-feed-badge">1</span>
          </button>

          {open && (
            <aside className="global-feed open"
              style={{ position: 'fixed', top: 80, right: 0, height: 'calc(100vh - 80px)', width: 380, background: '#fff', boxShadow: '0 2px 8px #0001', borderLeft: '2px solid #30bdb7', zIndex: 3001, transition: 'transform 0.3s' }}>
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
      </div>
    </>
  );
}
