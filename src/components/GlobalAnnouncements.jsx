import React, { useEffect, useMemo, useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import "../styles/GlobalAnnouncements.css";
import UserProfileModal from './UserProfileModal';
import '../styles/UserProfileModal.css';

const GlobalAnnouncements = () => {
  const sdgLabelMap = {
    1: 'No Poverty',
    2: 'Zero Hunger',
    3: 'Good Health and Well-Being',
    4: 'Quality Education',
    5: 'Gender Equality',
    6: 'Clean Water and Sanitation',
    7: 'Affordable and Clean Energy',
    8: 'Decent Work and Economic Growth',
    9: 'Industry, Innovation, and Infrastructure',
    10: 'Reduced Inequalities',
    11: 'Sustainable Cities and Communities',
    12: 'Responsible Consumption and Production',
    13: 'Climate Action',
    14: 'Life Below Water',
    15: 'Life on Land',
    16: 'Peace, Justice, and Strong Institutions',
    17: 'Partnership for the Goals',
  };

  const normalizeSdgLabel = (sdg) => {
    if (sdg === null || sdg === undefined) return '';
    const raw = String(sdg).trim();
    if (!raw) return '';
    const num = Number(raw);
    if (!Number.isNaN(num) && sdgLabelMap[num]) return sdgLabelMap[num];
    return raw;
  };
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); // count of unseen announcements
  const [userId, setUserId] = useState(null);
  const [seenKeys, setSeenKeys] = useState(new Set());

  const [milestones, setMilestones] = useState([]); // [{eventId, title, count}]
  const [extraAnnouncements, setExtraAnnouncements] = useState([]); // SDG impact announcements
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalType, setModalType] = useState('event'); // 'event', 'closing', 'milestone', 'info', or 'full'
  const [profileUser, setProfileUser] = useState(null);

  const toKey = (type, id) => `${type}:${id}`;

  const markAsSeen = async (id, type = 'event') => {
    const key = toKey(type, id);
    if (seenKeys.has(key)) return;

    const next = new Set(seenKeys);
    next.add(key);
    setSeenKeys(next);

    if (!userId) {
      calculateUnreadCount(next);
      return;
    }
    try {
      const readRef = doc(db, 'users', userId, 'globalAnnouncementReads', key);
      await setDoc(readRef, {
        type,
        announcementId: id,
        readAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const keys = [];

    announcements.forEach((event) => {
      keys.push(toKey('event', event.id));
      if (isClosingSoon(event.targetDates)) {
        keys.push(toKey('closing', event.id));
      }
    });

    milestones.forEach((milestone) => {
      keys.push(toKey('milestone', milestone.eventId + '-milestone'));
    });

    announcements.forEach((event) => {
      if (isFullyBooked(event)) {
        keys.push(toKey('full', event.id));
      }
    });

    extraAnnouncements.forEach((info) => {
      keys.push(toKey('info', info.id));
    });

    const next = new Set(keys);
    setSeenKeys(next);

    if (!userId) {
      calculateUnreadCount(next);
      return;
    }

    try {
      const batch = writeBatch(db);
      keys.forEach((key) => {
        const [type, announcementId] = key.split(':');
        const readRef = doc(db, 'users', userId, 'globalAnnouncementReads', key);
        batch.set(readRef, {
          type,
          announcementId,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all announcements as read:', err);
    }
  };

  const markAllAsUnread = async () => {
    setSeenKeys(new Set());

    if (!userId) {
      calculateUnreadCount(new Set());
      return;
    }

    try {
      const readSnap = await getDocs(collection(db, 'users', userId, 'globalAnnouncementReads'));
      const batch = writeBatch(db);
      readSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all announcements as unread:', err);
    }
  };

  const calculateUnreadCount = (overrideSeen = null) => {
    const currentSeen = overrideSeen || seenKeys;
    let count = 0;

    // Count unseen event announcements
    announcements.forEach(event => {
      if (!currentSeen.has(toKey('event', event.id))) {
        count++;
      }
      // Count unseen closing soon announcements
      if (isClosingSoon(event.targetDates) && !currentSeen.has(toKey('closing', event.id))) {
        count++;
      }
      // Count unseen fully booked announcements
      if (isFullyBooked(event) && !currentSeen.has(toKey('full', event.id))) {
        count++;
      }
    });

    // Count unseen milestones
    milestones.forEach(milestone => {
      const milestoneId = milestone.eventId + '-milestone';
      if (!currentSeen.has(toKey('milestone', milestoneId))) {
        count++;
      }
    });

    // Count unseen SDG announcements
    extraAnnouncements.forEach(info => {
      if (!currentSeen.has(toKey('info', info.id))) {
        count++;
      }
    });

    setUnreadCount(count);
  };

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Fetch the latest event proposals from Firestore (from 'Missions' collection)
        const q = query(collection(db, "missions"), where("status", "==", "published"));
        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched event IDs:', events.map(e => e.id));
        setAnnouncements(events);


        // For each event, check volunteer count in subcollection 'volunteer'
        const milestoneArr = [];
        const extraArr = [];
        const sdgCounts = new Map();
        for (const event of events) {
          try {
            const volunteerCol = collection(db, `missions/${event.id}/volunteer`);
            const volunteerSnap = await getDocs(volunteerCol);
            const count = volunteerSnap.size;
            event.volunteerCount = count;
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
            event.fullBookedTime = milestoneTime;
            // Track SDG usage across missions
            if (Array.isArray(event.sdgs)) {
              event.sdgs.forEach((sdg) => {
                const key = normalizeSdgLabel(sdg);
                if (!key) return;
                sdgCounts.set(key, (sdgCounts.get(key) || 0) + 1);
              });
            }

            console.log(`Event: ${event.title || event.id}, ID: ${event.id}, Volunteers: ${count}`);
          } catch (err) {
            console.warn(`Error checking volunteers for event ${event.id}:`, err);
          }
        }
        // SDG impact announcement: most common SDG across all missions
        if (sdgCounts.size > 0) {
          const maxCount = Math.max(...sdgCounts.values());
          const mostCommon = Array.from(sdgCounts.entries())
            .filter(([, count]) => count === maxCount)
            .map(([sdg]) => sdg);
          const sdgLabel = mostCommon.length === 1 ? mostCommon[0] : mostCommon.join(', ');
          extraArr.push({
            id: 'sdg-most-common',
            type: 'info',
            title: 'SDG Impact',
            message: `Most common SDG across missions: ${sdgLabel} — used in ${maxCount} mission${maxCount !== 1 ? 's' : ''}.`,
            link: '/student/home',
            createdAt: new Date(),
          });
        }

        // Leaderboard announcement: Calculate top volunteers by total points
        const userPointsMap = new Map(); // userId -> {name, totalPoints, events}
        for (const event of events) {
          try {
            const volunteerCol = collection(db, `missions/${event.id}/volunteer`);
            const volunteerSnap = await getDocs(volunteerCol);

            volunteerSnap.forEach(volunteerDoc => {
              const data = volunteerDoc.data();
              const points = data.pointsEarned || 0;
              const userId = volunteerDoc.id;

              if (points > 0) {
                if (userPointsMap.has(userId)) {
                  const existing = userPointsMap.get(userId);
                  existing.totalPoints += points;
                  existing.events++;
                } else {
                  userPointsMap.set(userId, {
                    name: data.name || 'Anonymous',
                    totalPoints: points,
                    events: 1
                  });
                }
              }
            });
          } catch (err) {
            console.warn(`Error calculating leaderboard for event ${event.id}:`, err);
          }
        }

        // Get top 3 volunteers and include their ids for clickable profiles
        if (userPointsMap.size > 0) {
          const topVolunteers = Array.from(userPointsMap.entries())
            .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
            .slice(0, 3)
            .map(([id, meta]) => ({ id, name: meta.name, totalPoints: meta.totalPoints, events: meta.events }));

          const leaderboardText = topVolunteers.map((entry, idx) => {
            const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            return `${emoji} ${entry.name} - ${entry.totalPoints} pts`;
          }).join(' • ');

          extraArr.push({
            id: 'leaderboard-top',
            type: 'info',
            title: '🏆 Top Volunteers',
            message: `Leading our community impact: ${leaderboardText}`,
            link: '/student/home',
            createdAt: new Date(),
            topVolunteers
          });
        }

        setMilestones(milestoneArr);
        setExtraAnnouncements(extraArr);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Expose a global helper to open a user profile by id
  useEffect(() => {
    window.showUserProfile = async (userId) => {
      if (!userId) return;
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap && userSnap.exists && userSnap.data()) {
          setProfileUser({ id: userSnap.id, ...userSnap.data() });
          return;
        }
        setProfileUser({ id: userId, name: 'Unknown user', uid: userId });
      } catch (err) {
        console.error('showUserProfile error', err);
        setProfileUser({ id: userId, name: 'Unknown user', uid: userId });
      }
    };
    return () => { window.showUserProfile = undefined; };
  }, []);

  useEffect(() => {
    const loadReads = async () => {
      if (!userId) {
        setSeenKeys(new Set());
        return;
      }
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 200);

        const readsRef = collection(db, 'users', userId, 'globalAnnouncementReads');
        const recentSnap = await getDocs(query(readsRef, where('readAt', '>=', cutoff)));
        const next = new Set(recentSnap.docs.map((docSnap) => docSnap.id));
        setSeenKeys(next);

        const oldSnap = await getDocs(query(readsRef, where('readAt', '<', cutoff)));
        if (!oldSnap.empty) {
          const batch = writeBatch(db);
          oldSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      } catch (err) {
        console.error('Failed to load announcement reads:', err);
      }
    };

    loadReads();
  }, [userId]);

  // Recalculate unread count when announcements or milestones change
  useEffect(() => {
    calculateUnreadCount();
  }, [announcements, milestones, extraAnnouncements, seenKeys]);


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

  // Helper: is event fully booked (default threshold 3 volunteers)
  const isFullyBooked = (event) => {
    const count = Number(event?.volunteerCount || 0);
    return count >= 3;
  };

  const getIconAndClass = (event) => {
    return { icon: '🆕', className: 'new' };
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    if (diffHour > 0) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    if (diffMin > 0) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    return 'just now';
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

  const seen = useMemo(() => seenKeys, [seenKeys]);

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

    // Add regular announcements, closing soon, and fully booked
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
      if (isClosingSoon(event.targetDates)) {
        allItems.push({
          type: 'closing',
          id: event.id + '-closing',
          timestamp: eventTimestamp,
          data: event
        });
      }

      // Add fully booked if applicable
      if (isFullyBooked(event)) {
        allItems.push({
          type: 'full',
          id: event.id + '-full',
          timestamp: event.fullBookedTime || eventTimestamp,
          data: event
        });
      }
    });

    // Add SDG impact announcements
    extraAnnouncements.forEach(info => {
      allItems.push({
        type: 'info',
        id: info.id,
        timestamp: info.createdAt || new Date(0),
        data: info
      });
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
        <div className="global-feed-header-top">
          <div>
            <h3 className="global-feed-title">Community Updates</h3>
            <p className="global-feed-subtitle">What&rsquo;s happening this week</p>
          </div>
          {unreadCount > 0 && (
            <span className="unread-badge" role="status" aria-live="polite">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="mark-all-buttons">
          <button
            className="mark-all-btn"
            onClick={markAllAsRead}
            aria-label="Mark all announcements as read"
          >
            ✓ Mark all read
          </button>
        </div>
      </div>

      {/* All announcements sorted by timestamp */}
      {sortedAnnouncements.length === 0 ? (
        <div className="no-announcements" role="status">
          <span className="no-announcements-icon">📢</span>
          <p>No new announcements.</p>
          <p className="no-announcements-sub">Check back soon!</p>
        </div>
      ) : (
        <div role="feed" aria-label="Community announcements">
          {sortedAnnouncements.map(item => {
            if (item.type === 'milestone') {
              const milestone = item.data;
              const isUnseen = !seen.has(toKey('milestone', item.id));
              return (
                <div
                  key={item.id}
                  className={`global-feed-item milestone ${isUnseen ? 'unseen' : 'seen'}`}
                  role="article"
                  tabIndex={0}
                  onClick={() => {
                    markAsSeen(item.id, 'milestone');
                    openModal({ ...milestone, id: milestone.eventId }, 'milestone');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsSeen(item.id, 'milestone');
                      openModal({ ...milestone, id: milestone.eventId }, 'milestone');
                    }
                  }}
                  aria-label={`Milestone: ${milestone.title} reached ${milestone.count} volunteers${isUnseen ? ' - unread' : ''}`}
                >
                  <span className="feed-icon">🏆</span>
                  <div className="feed-content">
                    {isUnseen && <span className="unread-dot"></span>}
                    <p className="feed-title">Milestone Reached!</p>
                    <p className="feed-desc">3+ volunteers have joined <b>{milestone.title}</b>!</p>
                    <span className="feed-time">
                      {formatTimeAgo(milestone.milestoneTime)}
                    </span>
                  </div>
                </div>
              );
            } else if (item.type === 'closing') {
              const event = item.data;
              const isClosingUnseen = !seen.has(toKey('closing', event.id));
              return (
                <div
                  key={item.id}
                  className={`global-feed-item closing-soon ${isClosingUnseen ? 'unseen' : 'seen'}`}
                  role="article"
                  tabIndex={0}
                  onClick={() => {
                    markAsSeen(event.id, 'closing');
                    openModal(event, 'closing');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsSeen(event.id, 'closing');
                      openModal(event, 'closing');
                    }
                  }}
                  aria-label={`Closing soon: ${event.title || 'Untitled Event'}${isClosingUnseen ? ' - unread' : ''}`}
                >
                  <span className="feed-icon">⌛</span>
                  <div className="feed-content">
                    {isClosingUnseen && <span className="unread-dot"></span>}
                    <p className="feed-title">Mission Closing Soon</p>
                    <p className="feed-desc">
                      {(() => {
                        const closingDate = getClosingDate(event.targetDates);
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
                      {event.targetDates && (
                        <span className="event-date-badge">
                          Registration Closes: {getClosingDate(event.targetDates)?.toLocaleDateString()} at {getClosingDate(event.targetDates)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            } else if (item.type === 'info') {
              const info = item.data;
              const isInfoUnseen = !seen.has(toKey('info', item.id));
              return (
                <div
                  key={item.id}
                  className={`global-feed-item info ${isInfoUnseen ? 'unseen' : 'seen'}`}
                  role="article"
                  tabIndex={0}
                  onClick={() => {
                    markAsSeen(item.id, 'info');
                    openModal(info, 'info');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsSeen(item.id, 'info');
                      openModal(info, 'info');
                    }
                  }}
                  aria-label={`${info.title || 'SDG Impact'}: ${info.message}${isInfoUnseen ? ' - unread' : ''}`}
                >
                  <span className="feed-icon">🌍</span>
                  <div className="feed-content">
                    {isInfoUnseen && <span className="unread-dot"></span>}
                    <p className="feed-title">{info.title || 'SDG Impact'}</p>
                    <p className="feed-desc">{info.message}</p>
                    <span className="feed-time">
                      {formatTimeAgo(info.createdAt)}
                    </span>
                  </div>
                </div>
              );
            } else if (item.type === 'full') {
              const event = item.data;
              const isFullUnseen = !seen.has(toKey('full', event.id));
              return (
                <div
                  key={item.id}
                  className={`global-feed-item full ${isFullUnseen ? 'unseen' : 'seen'}`}
                  role="article"
                  tabIndex={0}
                  onClick={() => {
                    markAsSeen(event.id, 'full');
                    openModal(event, 'full');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsSeen(event.id, 'full');
                      openModal(event, 'full');
                    }
                  }}
                  aria-label={`Fully booked: ${event.title || 'Untitled Event'}${isFullUnseen ? ' - unread' : ''}`}
                >
                  <span className="feed-icon">🚫</span>
                  <div className="feed-content">
                    {isFullUnseen && <span className="unread-dot"></span>}
                    <p className="feed-title">Event Fully Booked</p>
                    <p className="feed-desc">
                      {event.title || 'Untitled Event'} is now fully booked.
                    </p>
                    <span className="feed-time">
                      {formatTimeAgo(event.fullBookedTime || (event.createdAt?.toDate ? event.createdAt.toDate() : event.createdAt))}
                    </span>
                  </div>
                </div>
              );
            } else {
              // Regular event announcement
              const event = item.data;
              const { icon, className } = getIconAndClass(event);
              const isEventUnseen = !seen.has(toKey('event', event.id));
              return (
                <div
                  key={item.id}
                  className={`global-feed-item ${className} ${isEventUnseen ? 'unseen' : 'seen'}`}
                  role="article"
                  tabIndex={0}
                  onClick={() => {
                    markAsSeen(event.id, 'event');
                    openModal(event, 'event');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markAsSeen(event.id, 'event');
                      openModal(event, 'event');
                    }
                  }}
                  aria-label={`New event: ${event.title || 'Untitled Event'}${isEventUnseen ? ' - unread' : ''}`}
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
          })}
        </div>
      )}

      {/* Modal - rendered at document body level using portal */}
      {modalOpen && selectedEvent && ReactDOM.createPortal(
        <div
          className="modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-modal-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              className="modal-close-btn"
              onClick={closeModal}
              aria-label="Close announcement"
            >
              ×
            </button>

            {/* Modal content based on type */}
            {modalType === 'milestone' ? (
              <>
                <div className="modal-icon">🏆</div>
                <h2 id="announcement-modal-title" className="modal-title">
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
            ) : modalType === 'info' ? (
              <>
                <div className="modal-icon">🌍</div>
                <h2 id="announcement-modal-title" className="modal-title">
                  {selectedEvent.title || 'SDG Impact'}
                </h2>
                {selectedEvent.message && (
                  <p className="modal-section-content">{selectedEvent.message}</p>
                )}
                <div className="modal-footer">
                  {selectedEvent.link && (
                    <a href={selectedEvent.link} className="modal-cta-btn">
                      View Event Details
                    </a>
                  )}
                </div>
              </>
            ) : modalType === 'closing' ? (
              <>
                <div className="modal-icon">⌛</div>
                <h2 id="announcement-modal-title" className="modal-title">
                  Mission Closing Soon!
                </h2>
                <h3 className="modal-subtitle">
                  {selectedEvent.title || 'Untitled Event'}
                </h3>
                {selectedEvent.targetDates && (
                  <p className="modal-date">
                    Event Date: {new Date(selectedEvent.targetDates).toLocaleDateString()} at {new Date(selectedEvent.targetDates).toLocaleTimeString()}
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
            ) : modalType === 'full' ? (
              <>
                <div className="modal-icon">🚫</div>
                <h2 id="announcement-modal-title" className="modal-title">
                  Event Fully Booked
                </h2>
                <h3 className="modal-subtitle">
                  {selectedEvent.title || 'Untitled Event'}
                </h3>
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
                    View Event Details
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="modal-icon">🆕</div>
                <h2 id="announcement-modal-title" className="modal-title">
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
                {selectedEvent.targetDates && (
                  <div className="modal-date-badge">
                    <strong>Event Date:</strong>{' '}
                    <span>
                      {new Date(selectedEvent.targetDates).toLocaleDateString()} at {new Date(selectedEvent.targetDates).toLocaleTimeString()}
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
        </div>,
        document.body
      )}

      {profileUser && (
        <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      )}
    </div>
  );
};

export default GlobalAnnouncements;

export const GlobalNotificationButton = ({ unreadCount, onClick, isOpen }) => {
  const [top, setTop] = useState(140);
  const didDragRef = useRef(false);
  const ignoreClickRef = useRef(false);

  const handleMouseDown = (e) => {
    const startY = e.clientY;
    const startTop = top;
    didDragRef.current = false;

    const onMouseMove = (ev) => {
      const delta = ev.clientY - startY;
      if (Math.abs(delta) > 4) didDragRef.current = true;
      setTop(Math.min(Math.max(60, startTop + delta), window.innerHeight - 48));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTouchStart = (e) => {
    const startY = e.touches[0].clientY;
    const startTop = top;
    didDragRef.current = false;

    const onTouchMove = (ev) => {
      const delta = ev.touches[0].clientY - startY;
      if (Math.abs(delta) > 4) didDragRef.current = true;
      setTop(Math.min(Math.max(60, startTop + delta), window.innerHeight - 48));
    };
    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      ignoreClickRef.current = true;
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 350);
      if (!didDragRef.current) onClick?.();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleClick = () => {
    if (ignoreClickRef.current) return;
    if (!didDragRef.current) onClick?.();
  };

  return (
    <button
      className="global-feed-toggle"
      style={{
        top,
        right: isOpen ? 'min(320px, calc(100vw - 48px))' : 0,
        cursor: 'grab',
        transition: 'right 0.3s ease'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      aria-label={isOpen ? 'Close announcements' : 'Open announcements'}
    >
      <span className="global-feed-toggle-emoji">📢</span>
      {unreadCount > 0 && (
        <span className="global-feed-badge">{unreadCount}</span>
      )}
    </button>
  );
};
