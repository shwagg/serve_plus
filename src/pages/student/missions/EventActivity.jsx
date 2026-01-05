import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function EventActivity() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      console.log("Fetching event with id:", id);
      try {
        const eventRef = doc(db, 'Missions', id);
        console.log("eventRef:", eventRef);
        const eventSnap = await getDoc(eventRef);
        console.log("eventSnap.exists():", eventSnap.exists());
        console.log("eventSnap.data():", eventSnap.data());
        if (eventSnap.exists()) {
          setEvent(eventSnap.data());
        }
      } catch (err) {
        console.error("Error fetching event:", err);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }
  if (!event) {
    return <div style={{ padding: 32 }}>Event not found.</div>;
  }const eventRef = doc(db, 'Missions', id);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 32, justifyContent: 'center', background: '#fff', minHeight: '100vh' }}>
      {/* Left: Event Summary styled as per screenshot */}
      <div style={{ flex: '0 0 40%', maxWidth: '40%', minWidth: 340, background: 'transparent', borderRadius: 24, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Top image */}
        <div style={{ width: '100%', height: 180, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', position: 'relative' }}>
          <img src={event.img || '/assets/mission1.jpg'} alt={event.alt || 'Event'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Optional close button */}
          {/* <button style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 22, fontWeight: 700, color: '#234e7b', cursor: 'pointer', zIndex: 2 }}>×</button> */}
        </div>
        {/* Green card */}
        <div style={{ background: '#7bb661', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: '32px 24px 24px 24px', width: '100%', boxSizing: 'border-box', marginTop: -4, minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 12, fontSize: 26, lineHeight: 1.2 }}>{event.title}</h2>
          <p style={{ color: '#fff', fontSize: 15, marginBottom: 18, fontWeight: 400, lineHeight: 1.5 }}>{event.description}</p>
          {/* White info box */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 18, color: '#222', fontSize: 15, boxShadow: '0 2px 8px #0001' }}>
            <div style={{ marginBottom: 10 }}><strong>Location:</strong> <span style={{ color: '#234e7b' }}>{event.location}</span></div>
            <div style={{ marginBottom: 10 }}><strong>Date & Time:</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{event.date}</li>
                <li>{event.time}</li>
              </ul>
            </div>
            <div style={{ marginBottom: 10 }}><strong>Points:</strong> <span style={{ color: '#388e3c' }}>{event.points} PTS</span></div>
            <div style={{ marginBottom: 10 }}><strong>Event Badge:</strong><br /><img src={event.badge || '/assets/badge.png'} alt="Event Badge" style={{ width: 90, marginTop: 8, borderRadius: 8, border: '2px solid #eee' }} /></div>
            {event.waiver && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}><a href={event.waiver} style={{ color: '#30bdb7', textDecoration: 'underline', fontWeight: 500, fontSize: 15 }}>Waiver Form</a></div>}
          </div>
          <button style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 600, fontSize: 18, cursor: 'not-allowed', width: '100%', marginTop: 8, letterSpacing: 1 }} disabled>
            INCOMPLETE
          </button>
        </div>
      </div>
      {/* Right: Activity Section */}
      <div style={{ flex: '0 0 60%', maxWidth: '60%', minWidth: 400, background: '#7bb661', borderRadius: 20, padding: 24 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 16 }}>Activity</h2>
        {event.activities && event.activities.map((activity, idx) => (
          <div key={idx} style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: '#234e7b', fontWeight: 700 }}>{activity.title}</h3>
              <button style={{ background: '#7bb661', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                JOIN THE ACTIVITY!
              </button>
            </div>
            <ul style={{ color: '#234e7b', fontSize: 15, marginBottom: 8 }}>
              {activity.details && activity.details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
            {activity.required && <div style={{ color: '#234e7b', fontSize: 15, marginBottom: 8 }}><strong>Required:</strong> {activity.required}</div>}
            <input type="file" style={{ marginBottom: 8, width: '100%' }} />
            <textarea placeholder="Journal Reflection" style={{ width: '100%', minHeight: 60, marginBottom: 8, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span>Task Progress</span>
              <progress value="0" max="100" style={{ flex: 1 }} />
            </div>
            <button style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontWeight: 600, fontSize: 14, cursor: 'not-allowed' }} disabled>
              SUBMIT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
