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
            if (count >= 3) { // Change to desired milestone number
              const joinDates = [];
              volunteerSnap.forEach(doc => {
                const data = doc.data();
                if (data.joinedAt) {
                  const ts = new Date(data.joinedAt);
                  if (!isNaN(ts.getTime())) joinDates.push(ts);
                }
              });
              joinDates.sort((a, b) => a - b);
              milestoneTime = joinDates[2] || null; // change index based on milestone number
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
    <div style={{ height: '110%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: 8 }}>
      {/* Milestone announcements for events*/}
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
          console.log('Announcement:', event.title, 'targetDates:', event.targetDates);
          const { icon, className } = getIconAndClass(event);
          const closingSoon = isClosingSoon(event.date);
          const announcementsToShow = [];
          // Default announcement
          announcementsToShow.push(
            <div
              key={event.id + '-default'}
              className={`global-feed-item ${className}`}
              style={{
                marginBottom: 30,
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
                <div style={{ maxWidth: '200px', overflow: 'hidden' }}>
                  <p className="feed-title" style={{ fontWeight: 700, color: '#234e7b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', display: 'block' }}>{event.title || 'New Event Proposal'}</p>
                </div>
                <p className="feed-desc" style={{ color: '#555', margin: '2px 0 0 0' }}>A new event has been proposed.</p>
                <span className="feed-time" style={{ fontSize: 12, color: '#999' }}>{
                  (() => {
                    let created = event.createdAt?.toDate ? event.createdAt.toDate() : (event.createdAt ? new Date(event.createdAt) : null);
                    if (!created) return '';
                    const now = new Date();
                    const diffMs = now - created;
                    const diffSec = Math.floor(diffMs / 1000);
                    const diffMin = Math.floor(diffSec / 60);
                    const diffHour = Math.floor(diffMin / 60);
                    const diffDay = Math.floor(diffHour / 24);
                    if (diffDay > 0) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
                    if (diffHour > 0) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
                    if (diffMin > 0) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
                    return 'just now';
                  })()
                }</span>
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
                   background: '#e6f3ff',
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
                  <p className="feed-desc" style={{ color: '#555', margin: '2px 0 0 0' }}>
                    {(() => {
                      let eventDate = event.date ? new Date(event.date) : null;
                      if (!eventDate || isNaN(eventDate.getTime())) return '';
                      const now = new Date();
                      const diffMs = eventDate - now;
                      const diffSec = Math.floor(diffMs / 1000);
                      const diffMin = Math.floor(diffSec / 60);
                      const diffHour = Math.floor(diffMin / 60);
                      const diffDay = Math.floor(diffHour / 24);
                      if (diffDay > 0) return `Only ${diffDay === 1 ? '1 more day' : diffDay + ' more days to join this event!'}`;
                      if (diffHour > 0) return `Only ${diffHour === 1 ? '1 more hour' : diffHour + ' more hours to join this event!'}`;
                      if (diffMin > 0) return `Only ${diffMin === 1 ? '1 more minute' : diffMin + ' more minutes to join this event!'}`;
                      return 'Closing very soon!';
                    })()}
                  </p>
                  <span className="feed-event-title" style={{ color: '#555', margin: '2px 0 0 0', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', display: 'inline-block' }}>
                    {event.title || 'Untitled Event'}
                    {event.date && (
                      <span style={{ fontSize: 13, color: '#df3131', marginLeft: 8, fontWeight: 400 }}>
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    )}
                  </span>
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
