import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";

const GlobalAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [announcementCount, setAnnouncementCount] = useState(0); // total announcements
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState([]); // ids of unread announcements
  const [lastAnnouncementTimestamp, setLastAnnouncementTimestamp] = useState(null); // last announcement time

  const [milestones, setMilestones] = useState([]); // [{eventId, title, count}]

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Fetch the latest event proposals from Firestore (from 'Missions' collection)
        const q = query(collection(db, "Missions"));
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched event IDs:', events.map(e => e.id));
        setAnnouncements(events);
        setAnnouncementCount(querySnapshot.size);
        if (events.length > 0) {
          setLastAnnouncementTimestamp(events[0].createdAt?.toDate ? events[0].createdAt.toDate() : null);
        }
        setUnreadAnnouncementIds([]);

        // For each event, check volunteer count in subcollection 'volunteer'
        const milestoneArr = [];
        for (const event of events) {
          try {
            const volunteerCol = collection(db, `Missions/${event.id}/volunteer`);
            const volunteerSnap = await getDocs(volunteerCol);
            const count = volunteerSnap.size;
            let milestoneTime = null;
            if (count >= 3) {
              // Collect all joinedAt dates, sort, and pick the 3rd
              const joinDates = [];
              volunteerSnap.forEach(doc => {
                const data = doc.data();
                if (data.joinedAt) {
                  const ts = new Date(data.joinedAt);
                  if (!isNaN(ts.getTime())) joinDates.push(ts);
                }
              });
              joinDates.sort((a, b) => a - b);
              milestoneTime = joinDates[2] || null; // 3rd joined
              milestoneArr.push({ eventId: event.id, title: event.title || 'Untitled Event', count, milestoneTime });
            }
            console.log(`Event: ${event.title || event.id}, ID: ${event.id}, Volunteers: ${count}`);
          } catch (err) {
            console.warn(`Error checking volunteers for event ${event.id}:`, err);
          }
        }
        setMilestones(milestoneArr);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };
    fetchAnnouncements();
  }, []);


  // Helper: is event closing soon (within 4 days before the event, but not after)
  const isClosingSoon = (dateAt) => {
    if (!dateAt) return false;
    const now = new Date();
    const eventTime = dateAt?.toDate ? dateAt.toDate() : new Date(dateAt);
    const diffDays = (eventTime - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 4;
  };

  const getIconAndClass = (event) => {
    return { icon: '🆕', className: 'new' };
  };

  return (
    <div style={{ height: 650, overflowY: 'auto', paddingRight: 8 }}>
      {/* Milestone announcements for events with 3+ volunteers */}
      {milestones.map(milestone => (
        <div
          key={milestone.eventId + '-milestone'}
          className="global-feed-item milestone"
          style={{
            marginBottom: 16,
            borderRadius: 10,
            padding: 12,
            background: '#e6ffe6',
            border: '1px solid #b2e6b2',
            boxShadow: '0 1px 4px #0001',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span className="feed-icon" style={{ fontSize: 28, marginTop: 2 }}>🏆</span>
          <div className="feed-content" style={{ flex: 1 }}>
            <p className="feed-title" style={{ fontWeight: 700, color: '#234e7b', margin: 0 }}>Milestone Reached!</p>
            <p className="feed-desc" style={{ color: '#555', margin: '2px 0 0 0' }}>3+ volunteers have joined <b>{milestone.title}</b>!</p>
            <span className="feed-time" style={{ fontSize: 12, color: '#999' }}>
              {milestone.milestoneTime ? milestone.milestoneTime.toLocaleString() : ''}
            </span>
          </div>
        </div>
      ))}
      {/* Existing announcements */}
      {announcements.length === 0 ? (
        <div style={{ color: '#888', padding: 16 }}>No new announcements.</div>
      ) : (
        announcements.flatMap((event, idx) => {
          const { icon, className } = getIconAndClass(event);
          const closingSoon = isClosingSoon(event.targetDates);
          const announcementsToShow = [];
          // Default announcement
          announcementsToShow.push(
            <div
              key={event.id + '-default'}
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
          // Closing soon announcement
          if (closingSoon) {
            announcementsToShow.push(
              <div
                key={event.id + '-closing'}
                className="global-feed-item closing-soon"
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
                <span className="feed-icon" style={{ fontSize: 28, marginTop: 2 }}>⌛</span>
                <div className="feed-content" style={{ flex: 1 }}>
                  <p className="feed-title" style={{ fontWeight: 700, color: '#234e7b', margin: 0 }}>Mission Closing Soon</p>
                  <p className="feed-desc" style={{ color: '#555', margin: '2px 0 0 0' }}>Only a few days left to join this event!</p>
                  <p className="feed-event-title" style={{ color: '#315488', fontWeight: 400, fontFamily: 'inherit', margin: '2px 0 0 0', fontSize: 15 }}>{event.title || 'Untitled Event'}</p>
                  <span className="feed-time" style={{ fontSize: 12, color: '#999' }}>{event.targetDates?.toDate ? event.targetDates.toDate().toLocaleString() : ''}</span>
                </div>
              </div>
            );
          }
          return announcementsToShow;
        })
      )}
    </div>
  );
};

export default GlobalAnnouncements;
