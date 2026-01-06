import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Header from '../../../components/Header';


export default function EventDetails() {
  const { id } = useParams();
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMission() {
      try {
        const missionRef = doc(db, 'Missions', id);
        const missionSnap = await getDoc(missionRef);
        if (missionSnap.exists()) {
          setMission(missionSnap.data());
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
  }, [id]);


  // Example notifications (replace with real data as needed)
  const notifications = [
    { title: "New Event Added:", bold: "The Disaster Risk Reduction Training in Los Baños is now open!", text: "Sign up and secure your slot today." },
    { title: "2 New Volunteers Joined the Hydroponics Workshop!", text: "You are now 80% full. Get your tasks before they run out" },
    { title: "Leaderboard Alert!", bold: "You have surpassed Alyzza Ocoma and are now ranked #2.", text: "Keep earning those points!" },
    { title: "Opportunity Alert:", bold: "The 'Bayan Ko, Titser Ko' team needs one (1) more volunteer skilled in Literacy Coaching.", text: "Are you ready to serve?" },
    { title: "Certificate Ready:", bold: "Your official Certificate of Participation for the Laguna Lake Cleanup is now available in your Profile!" }
  ];

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
                  onClick={() => window.location.href = `/event/${id}/activity`}
                >
                  JOIN EVENT
                </button>
              </div>
            </div>
          </div>
          {/* Notification Panel */}
          <aside style={{ flex: 1, background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 2px 8px #0001', minWidth: 320, maxWidth: 360, marginLeft: 8, marginRight: 16, alignSelf: 'flex-start', border: '2px solid #30bdb7' }}>
            <h3 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16 }}>Global Notification</h3>
            <div style={{ color: '#234e7b', fontWeight: 500, lineHeight: '1.7', fontSize: 15 }}>
              {notifications.map((notif, idx) => (
                <div key={idx} style={{ marginTop: idx === 0 ? 0 : 16 }}>
                  {notif.title && <span style={{ fontWeight: 700 }}>{notif.title} </span>}
                  {notif.bold && <span style={{ fontWeight: 700 }}>{notif.bold} </span>}
                  {notif.text && <span>{notif.text}</span>}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
