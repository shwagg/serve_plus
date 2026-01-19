import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";

const GlobalAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [announcementCount, setAnnouncementCount] = useState(0); // total announcements
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState([]); // ids of unread announcements
  const [lastAnnouncementTimestamp, setLastAnnouncementTimestamp] = useState(null); // last announcement time

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Fetch the latest event proposals from Firestore (from 'Missions' collection)
        const q = query(collection(db, "Missions"), orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAnnouncements(events);
        setAnnouncementCount(querySnapshot.size);
        if (events.length > 0) {
          setLastAnnouncementTimestamp(events[0].createdAt?.toDate ? events[0].createdAt.toDate() : null);
        }
        // Placeholder: In future, fetch unread IDs from user profile or DB
        setUnreadAnnouncementIds([]);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };
    fetchAnnouncements();
  }, []);

  const getIconAndClass = (event) => {
    return { icon: '🆕', className: 'new' };
  };

  return (
    <>
      {announcements.length === 0 ? (
        <div style={{ color: '#888', padding: 16 }}>No new announcements.</div>
      ) : (
        announcements.map((event, idx) => {
          const { icon, className } = getIconAndClass(event);
          return (
            <div
              key={event.id}
              className={`global-feed-item ${className}`}
              style={{
                marginBottom: 16,
                cursor: 'pointer',
                borderRadius: 10,
                padding: 12,
                transition: 'background 0.2s',
                background: '#f8f8f8',
                boxShadow: '0 1px 4px #0001',
                border: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
              onClick={() => window.location.href = `/event/${event.id}`}
              onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
              onMouseOut={e => e.currentTarget.style.background = '#f8f8f8'}
            >
              <span className="feed-icon" style={{ fontSize: 28, marginTop: 2 }}>{icon}</span>
              <div className="feed-content" style={{ flex: 1 }}>
                <p className="feed-title" style={{ fontWeight: 700, color: '#234e7b', margin: 0 }}>{event.title || 'New Event Proposal'}</p>
                <p className="feed-desc" style={{ color: '#555', margin: '2px 0 0 0' }}>A new event has been proposed.</p>
                <span className="feed-time" style={{ fontSize: 12, color: '#999' }}>{event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString() : ''}</span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
};

export default GlobalAnnouncements;
