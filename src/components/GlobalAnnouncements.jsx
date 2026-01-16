import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";

const GlobalAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Fetch the latest event proposals from Firestore (from 'Missions' collection)
        const q = query(collection(db, "Missions"), orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAnnouncements(events);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <aside style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 2px 8px #0001', minWidth: 320, maxWidth: 360, marginLeft: 8, marginRight: 32, border: '2px solid #30bdb7' }}>
      <h3 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16 }}>Global Announcements</h3>
      {announcements.length === 0 ? (
        <div style={{ color: '#888' }}>No new event proposals.</div>
      ) : (
        announcements.map((event, idx) => (
          <div
            key={event.id}
            style={{
              marginBottom: 16,
              cursor: 'pointer',
              borderRadius: 10,
              padding: 12,
              transition: 'background 0.2s',
              background: '#f8f8f8',
              boxShadow: '0 1px 4px #0001',
              border: '1px solid #e0e0e0',
            }}
            onClick={() => window.location.href = `/event/${event.id}`}
            onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
            onMouseOut={e => e.currentTarget.style.background = '#f8f8f8'}
          >
            <div style={{ fontWeight: 700, color: '#234e7b' }}>{event.title || 'New Event Proposal'}</div>
            <div style={{ color: '#555' }}>{event.description || 'A new event has been proposed.'}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString() : ''}</div>
          </div>
        ))
      )}
    </aside>
  );
};

export default GlobalAnnouncements;
