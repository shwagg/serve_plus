import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "../styles/GlobalAnnouncements.css";

const GlobalAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [announcementCount, setAnnouncementCount] = useState(0); // total announcements
  const [unreadCount, setUnreadCount] = useState(0); // count of unseen announcements
  const [lastAnnouncementTimestamp, setLastAnnouncementTimestamp] = useState(null); // last announcement time

  const [milestones, setMilestones] = useState([]); // [{eventId, title, count}]
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalType, setModalType] = useState('event'); // 'event', 'closing', or 'milestone'

  // Load seen announcements from localStorage
  const getSeenAnnouncements = () => {
    try {
      const seen = localStorage.getItem('seenAnnouncements');
      return seen ? JSON.parse(seen) : { events: [], milestones: [], closingSoon: [] };
    } catch {
      return { events: [], milestones: [], closingSoon: [] };
    }
  };

  // Mark announcement as seen
  const markAsSeen = (id, type = 'event') => {
    const seen = getSeenAnnouncements();
    if (type === 'milestone' && !seen.milestones.includes(id)) {
      seen.milestones.push(id);
    } else if (type === 'closing' && !seen.closingSoon.includes(id)) {
      seen.closingSoon.push(id);
    } else if (type === 'event' && !seen.events.includes(id)) {
      seen.events.push(id);
    }
    localStorage.setItem('seenAnnouncements', JSON.stringify(seen));
    calculateUnreadCount();
  };

  const markAllAsRead = () => {
    const allEventIds = announcements.map(a => a.id);
    const allMilestoneIds = milestones.map(m => m.eventId + '-milestone');
    const allClosingIds = announcements.filter(a => isClosingSoon(a.date)).map(a => a.id);
    
    const seen = {
      events: allEventIds,
      milestones: allMilestoneIds,
      closingSoon: allClosingIds
    };
    localStorage.setItem('seenAnnouncements', JSON.stringify(seen));
    calculateUnreadCount();
  };

  const markAllAsUnread = () => {
    localStorage.setItem('seenAnnouncements', JSON.stringify({ events: [], milestones: [], closingSoon: [] }));
    calculateUnreadCount();
  };

  const calculateUnreadCount = () => {
    const seen = getSeenAnnouncements();
    let count = 0;

    // Count unseen event announcements
    announcements.forEach(event => {
      if (!seen.events.includes(event.id)) {
        count++;
      }
      // Count unseen closing soon announcements
      if (isClosingSoon(event.date) && !seen.closingSoon.includes(event.id)) {
        count++;
      }
    });

    // Count unseen milestones
    milestones.forEach(milestone => {
      const milestoneId = milestone.eventId + '-milestone';
      if (!seen.milestones.includes(milestoneId)) {
        count++;
      }
    });

    setUnreadCount(count);
  };

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

  // Recalculate unread count when announcements or milestones change
  useEffect(() => {
    calculateUnreadCount();
  }, [announcements, milestones]);


  // Helper: get registration closing date (2 days before event)
  const getClosingDate = (eventDate) => {
    if (!eventDate) return null;
    const eventTime = eventDate?.toDate ? eventDate.toDate() : new Date(eventDate);
    const closingTime = new Date(eventTime);
    closingTime.setDate(closingTime.getDate() - 2);
    return closingTime;
  };

  // Helper: is event closing soon (within 2 days before the event, but not after)
  const isClosingSoon = (dateAt) => {
    if (!dateAt) return false;
    const closingDate = getClosingDate(dateAt);
    if (!closingDate) return false;
    const now = new Date();
    const diffDays = (closingDate - now) / (1000 * 60 * 60 * 24);
    // Show closing soon if we're within 2 days of the closing date and haven't passed it
    return diffDays > 0 && diffDays <= 2;
  };

  const getIconAndClass = (event) => {
    return { icon: '🆕', className: 'new' };
  };

  const openModal = (event, type = 'event') => {
    setSelectedEvent(event);
    setModalType(type);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
  };

  const seen = getSeenAnnouncements();

  // Combine all announcements and sort by timestamp
  const getAllAnnouncements = () => {
    const allItems = [];

    // Add milestones
    milestones.forEach(milestone => {
      allItems.push({
        type: 'milestone',
        id: milestone.eventId + '-milestone',
        timestamp: milestone.milestoneTime || new Date(0),
        data: milestone
      });
    });

    // Add regular announcements and closing soon
    announcements.forEach(event => {
      const eventTimestamp = event.createdAt?.toDate ? event.createdAt.toDate() : (event.createdAt ? new Date(event.createdAt) : new Date(0));
      
      // Add regular event announcement
      allItems.push({
        type: 'event',
        id: event.id,
        timestamp: eventTimestamp,
        data: event
      });

      // Add closing soon if applicable
      if (isClosingSoon(event.date)) {
        allItems.push({
          type: 'closing',
          id: event.id + '-closing',
          timestamp: eventTimestamp, // Use same timestamp as event
          data: event
        });
      }
    });

    // Sort by timestamp, newest first
    return allItems.sort((a, b) => b.timestamp - a.timestamp);
  };

  const sortedAnnouncements = getAllAnnouncements();

  // Expose functions and unreadCount to parent component
  React.useEffect(() => {
    if (window) {
      window.announcementActions = {
        markAllAsRead,
        markAllAsUnread,
        getUnreadCount: () => unreadCount
      };
    }
  }, [announcements, milestones, unreadCount]);

  return (
    <div className="global-announcements-container">
      {/* Header with title and buttons */}
      <div className="global-feed-header">
        <h3 className="global-feed-title">Community Updates</h3>
        <p className="global-feed-subtitle">Whats happening this week</p>
        <div className="mark-all-buttons">
          <button className="mark-all-btn" onClick={markAllAsRead}>
            ✓ Read
          </button>
          <button className="mark-all-btn" onClick={markAllAsUnread}>
            ↻ Unread
          </button>
        </div>
      </div>
      
      {/* Display unread count badge if there are unseen announcements */}
      {unreadCount > 0 && (
        <div className="unread-badge">
          {unreadCount} unread announcement{unreadCount !== 1 ? 's' : ''}
        </div>
      )}
      
      {/* All announcements sorted by timestamp */}
      {sortedAnnouncements.length === 0 ? (
        <div className="no-announcements">No new announcements.</div>
      ) : (
        sortedAnnouncements.map(item => {
          if (item.type === 'milestone') {
            const milestone = item.data;
            const isUnseen = !seen.milestones.includes(item.id);
            return (
              <div
                key={item.id}
                className={`global-feed-item milestone ${isUnseen ? 'unseen' : 'seen'}`}
                onClick={() => {
                  markAsSeen(item.id, 'milestone');
                  openModal({ ...milestone, id: milestone.eventId }, 'milestone');
                }}
              >
                <span className="feed-icon">🏆</span>
                <div className="feed-content">
                  {isUnseen && <span className="unread-dot"></span>}
                  <p className="feed-title">Milestone Reached!</p>
                  <p className="feed-desc">3+ volunteers have joined <b>{milestone.title}</b>!</p>
                  <span className="feed-time">
                    {milestone.milestoneTime ? milestone.milestoneTime.toLocaleString() : ''}
                  </span>
                </div>
              </div>
            );
          } else if (item.type === 'closing') {
            const event = item.data;
            const isClosingUnseen = !seen.closingSoon.includes(event.id);
            return (
              <div
                key={item.id}
                className={`global-feed-item closing-soon ${isClosingUnseen ? 'unseen' : 'seen'}`}
                onClick={() => {
                  markAsSeen(event.id, 'closing');
                  openModal(event, 'closing');
                }}
              >
                <span className="feed-icon">⌛</span>
                <div className="feed-content">
                  {isClosingUnseen && <span className="unread-dot"></span>}
                  <p className="feed-title">Mission Closing Soon</p>
                  <p className="feed-desc">
                    {(() => {
                      const closingDate = getClosingDate(event.date);
                      if (!closingDate || isNaN(closingDate.getTime())) return '';
                      const now = new Date();
                      const diffMs = closingDate - now;
                      const diffSec = Math.floor(diffMs / 1000);
                      const diffMin = Math.floor(diffSec / 60);
                      const diffHour = Math.floor(diffMin / 60);
                      const diffDay = Math.floor(diffHour / 24);
                      if (diffDay > 0) return `Registration closes in ${diffDay === 1 ? '1 day' : diffDay + ' days'}`;
                      if (diffHour > 0) return `Registration closes in ${diffHour === 1 ? '1 hour' : diffHour + ' hours'}`;
                      if (diffMin > 0) return `Registration closes in ${diffMin === 1 ? '1 minute' : diffMin + ' minutes'}`;
                      return 'Registration closing very soon!';
                    })()}
                  </p>
                  <span className="feed-event-title">
                    {event.title || 'Untitled Event'}
                    {event.date && (
                      <span className="event-date-badge">
                        Registration Closes: {getClosingDate(event.date)?.toLocaleDateString()} at {getClosingDate(event.date)?.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          } else {
            // Regular event announcement
            const event = item.data;
            const { icon, className } = getIconAndClass(event);
            const isEventUnseen = !seen.events.includes(event.id);
            return (
              <div
                key={item.id}
                className={`global-feed-item ${className} ${isEventUnseen ? 'unseen' : 'seen'}`}
                onClick={() => {
                  markAsSeen(event.id, 'event');
                  openModal(event, 'event');
                }}
              >
                <span className="feed-icon">{icon}</span>
                <div className="feed-content">
                  {isEventUnseen && <span className="unread-dot"></span>}
                  <p className="feed-title">New Event Proposal</p>
                  <div className="title-container">
                    <p className="feed-desc bold ellipsis">{event.title || 'Untitled Event'}</p>
                  </div>
                  <span className="feed-time">{
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
                    })()}
                  </span>
                </div>
              </div>
            );
          }
        })
      )}

      {/* Modal */}
      {modalOpen && selectedEvent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="modal-close-btn" onClick={closeModal}>
              ×
            </button>

            {/* Modal content based on type */}
            {modalType === 'milestone' ? (
              <>
                <div className="modal-icon">🏆</div>
                <h2 className="modal-title">
                  Milestone Reached!
                </h2>
                <p className="modal-milestone-text">
                  <strong>{selectedEvent.title}</strong> has reached {selectedEvent.count} volunteers!
                </p>
                {selectedEvent.milestoneTime && (
                  <p className="modal-posted">
                    Milestone achieved on {selectedEvent.milestoneTime.toLocaleString()}
                  </p>
                )}
                <div className="modal-footer">
                  <a href={`/event/${selectedEvent.id}`} className="modal-cta-btn">
                    View Event Details
                  </a>
                </div>
              </>
            ) : modalType === 'closing' ? (
              <>
                <div className="modal-icon">⌛</div>
                <h2 className="modal-title">
                  Mission Closing Soon!
                </h2>
                <h3 className="modal-subtitle">
                  {selectedEvent.title || 'Untitled Event'}
                </h3>
                {selectedEvent.date && (
                  <p className="modal-date">
                    Event Date: {new Date(selectedEvent.date).toLocaleDateString()} at {new Date(selectedEvent.date).toLocaleTimeString()}
                  </p>
                )}
                {selectedEvent.description && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">Description</h4>
                    <p className="modal-section-content">{selectedEvent.description}</p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">Location</h4>
                    <p className="modal-section-content">{selectedEvent.location}</p>
                  </div>
                )}
                <div className="modal-footer">
                  <a href={`/event/${selectedEvent.id}`} className="modal-cta-btn">
                    Join This Mission
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="modal-icon">🆕</div>
                <h2 className="modal-title">
                  {selectedEvent.title || 'New Event Proposal'}
                </h2>
                {selectedEvent.createdAt && (
                  <p className="modal-posted">
                    Posted {(() => {
                      let created = selectedEvent.createdAt?.toDate ? selectedEvent.createdAt.toDate() : new Date(selectedEvent.createdAt);
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
                    })()}
                  </p>
                )}
                {selectedEvent.date && (
                  <div className="modal-date-badge">
                    <strong>Event Date:</strong>{' '}
                    <span>
                      {new Date(selectedEvent.date).toLocaleDateString()} at {new Date(selectedEvent.date).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {selectedEvent.description && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">Description</h4>
                    <p className="modal-section-content">{selectedEvent.description}</p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">Location</h4>
                    <p className="modal-section-content">{selectedEvent.location}</p>
                  </div>
                )}
                {selectedEvent.organizer && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">Organizer</h4>
                    <p className="modal-section-content">{selectedEvent.organizer}</p>
                  </div>
                )}
                <div className="modal-footer">
                  <a href={`/event/${selectedEvent.id}`} className="modal-cta-btn">
                    View Full Details
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalAnnouncements;
