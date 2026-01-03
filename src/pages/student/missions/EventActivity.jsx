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
      try {
        const eventRef = doc(db, 'Missions', id); // <-- changed 'events' to 'Missions'
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          setEvent(eventSnap.data());
        }
      } catch (err) {
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
    <div style={{ display: 'flex', gap: 24, padding: 32 }}>
      {/* Left: Event Summary */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px #0002', padding: 24 }}>
        <img src={event.img || '/assets/mission1.jpg'} alt={event.alt || 'Event'} style={{ width: '100%', height: 180, objectFit: 'cover', borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />
        <div style={{ padding: 16 }}>
          <h2 style={{ color: '#7bb661', fontWeight: 700, marginBottom: 12 }}>
            {event.title}
          </h2>
          <p style={{ color: '#234e7b', fontSize: 15, marginBottom: 18 }}>
            {event.description}
          </p>
          <div style={{ background: '#f6f6f6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div><strong>Location:</strong> {event.location}</div>
            <div><strong>Date & Time:</strong> {event.date}<br />{event.time}</div>
            <div><strong>Points:</strong> {event.points} PTS</div>
            <div><strong>Event Badge:</strong><br /><img src={event.badge || '/assets/badge.png'} alt="Event Badge" style={{ width: 80, marginTop: 8 }} /></div>
            {event.waiver && <div style={{ marginTop: 8 }}><a href={event.waiver} style={{ color: '#234e7b', textDecoration: 'underline', fontWeight: 500 }}>Waiver Form</a></div>}
          </div>
          <button style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 600, fontSize: 16, cursor: 'not-allowed' }} disabled>
            INCOMPLETE
          </button>
        </div>
      </div>
      {/* Right: Activity Section */}
      <div style={{ flex: 1.2, background: '#7bb661', borderRadius: 20, padding: 24 }}>
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
