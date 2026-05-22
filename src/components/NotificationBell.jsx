import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useSession } from "../context/SessionContext";
import notificationIcon from "../assets/headassets/Notification Icon.svg";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from "../utils/notificationUtils";
import { playNotificationSound } from "../utils/soundUtils";
import BadgeEarnedModal from "./badges/BadgeEarnedModal";
import CertEarnedModal from "./CertEarnedModal";
import "./styles/NotificationBell.css";

export default function NotificationBell() {
  const { userData } = useSession();
  const [notifEnabled, setNotifEnabled] = useState(
    () => userData?.globalNotificationsEnabled !== false
  );
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [replayBadgeId, setReplayBadgeId] = useState(null);
  const [replayCert, setReplayCert] = useState(null);
  const [eventAnnouncementModal, setEventAnnouncementModal] = useState(null);
  const dropdownRef = useRef(null);
  const bellButtonRef = useRef(null);
  const prevPointsRef = useRef(null);
  const prevNotifCountRef = useRef(0);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToNotifications(userId, (items) => {
      setNotifications(items);
      const unread = items.filter((n) => !n.read).length;
      
      // Play sound if new unread notifications arrived
      if (unread > prevNotifCountRef.current) {
        playNotificationSound();
      }
      
      prevNotifCountRef.current = unread;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [userId]);

  // Watch user doc for real-time updates (totalPoints + globalNotificationsEnabled)
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setNotifEnabled(data.globalNotificationsEnabled !== false);

      const pts = data.totalPoints || 0;
      if (prevPointsRef.current !== null && pts > prevPointsRef.current) {
        const gained = pts - prevPointsRef.current;
        createNotification(userId, {
          type: "points_earned",
          title: "Points Awarded!",
          message: `You received ${gained} point${gained !== 1 ? "s" : ""} from a completed mission.`,
          link: "/student",
        });
      }
      prevPointsRef.current = pts;
    });
    return () => unsubscribe();
  }, [userId]);

  // Focus first item when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const firstItem = dropdownRef.current.querySelector(".notification-item");
      firstItem?.focus();
    }
  }, [isOpen]);

  const handleNotificationClick = useCallback(async (notification) => {
    if (!userId) return;
    if (!notification.read) {
      await markNotificationAsRead(userId, notification.id);
    }
    if (notification.type === "badge_earned" && notification.badgeId) {
      setIsOpen(false);
      setReplayBadgeId(notification.badgeId);
    }
    if ((notification.type === "certificate_obtained" || notification.type === "certificate_ready") &&
        (notification.event || notification.course)) {
      setIsOpen(false);
      setReplayCert({ notifId: notification.id, course: notification.event || notification.course });
    }
    if (notification.type === "event_announcement") {
      setEventAnnouncementModal(notification);
    }
  }, [userId]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
  }, [userId]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case "event_registration": return "✅";
      case "event_approved":     return "✅";
      case "consent_approved":   return "✅";
      case "consent_rejected":   return "❌";
      case "event_upcoming":     return "⏰";
      case "event_cancelled":    return "❌";
      case "level_up":           return "🎉";
      case "badge_earned":       return "🏆";
      case "points_earned":      return "⭐";
      case "reflection_submitted":      return "✍️";
      case "reflection_overdue":        return "⏰";
      case "reflection_approved":       return "✔️";
      case "reflection_needs_revision": return "📝";
      case "proposal_submitted": return "📨";
      case "proposal_status":    return "📌";
      case "deadline_approaching": return "⚠️";
      case "certificate_ready":  return "📜";
      case "attendance_flag":       return "🚩";
      case "attendance_flag_admin": return "🚩";
      case "event_full":            return "🔒";
      case "event_announcement":    return "📢";
      default:                   return "🔔";
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container">
      <button
        ref={bellButtonRef}
        className="notification-bell-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <img src={notificationIcon} alt="" width="24" height="24" aria-hidden="true" />
        {notifEnabled && unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="notification-dropdown"
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
        >
          <div className="notification-header">
            <h3 id="notification-heading">Notifications</h3>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  className="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  aria-label="Mark all notifications as read"
                >
                  Mark all as read
                </button>
              )}
              <button
                className="notification-close-btn"
                onClick={() => {
                  setIsOpen(false);
                  bellButtonRef.current?.focus();
                }}
                aria-label="Close notifications"
              >
                ×
              </button>
            </div>
          </div>

          <div
            className="notification-list"
            role="list"
            aria-live="polite"
            aria-label="Notification items"
          >
            {!notifEnabled ? (
              <div className="no-notifications" role="status">
                <span className="no-notifications-icon">🔕</span>
                <p>Notifications are disabled</p>
                <p className="no-notifications-sub">
                  Enable them in Settings → Notifications
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="no-notifications" role="status">
                <span className="no-notifications-icon">🔔</span>
                <p>You're all caught up!</p>
                <p className="no-notifications-sub">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? "unread" : ""}`}
                  role="listitem button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                  aria-label={`${!notification.read ? "Unread: " : ""}${notification.title}. ${notification.message}. ${formatTimeAgo(notification.createdAt)}`}
                >
                  <div className="notification-icon" aria-hidden="true">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatTimeAgo(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="notification-unread-dot" aria-hidden="true" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="notification-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {replayBadgeId && (
        <BadgeEarnedModal
          badgeQueue={[replayBadgeId]}
          onDismiss={() => setReplayBadgeId(null)}
        />
      )}

      {replayCert && (
        <CertEarnedModal
          certQueue={[replayCert]}
          onDismiss={() => setReplayCert(null)}
        />
      )}

      {eventAnnouncementModal && ReactDOM.createPortal(
        <div
          className="event-announcement-modal-overlay"
          onClick={() => setEventAnnouncementModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-announcement-title"
        >
          <div className="event-announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="event-announcement-modal-close"
              onClick={() => setEventAnnouncementModal(null)}
              aria-label="Close announcement"
            >
              ×
            </button>
            <div className="event-announcement-modal-icon">📢</div>
            <h2 id="event-announcement-title" className="event-announcement-modal-title">
              {eventAnnouncementModal.title}
            </h2>
            {eventAnnouncementModal.message && (
              <p className="event-announcement-modal-message">
                {eventAnnouncementModal.message}
              </p>
            )}
            <div className="event-announcement-modal-footer">
              {eventAnnouncementModal.link && (
                <a 
                  href={eventAnnouncementModal.link} 
                  className="event-announcement-modal-cta"
                  onClick={() => setEventAnnouncementModal(null)}
                >
                  Go to Event
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
