import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import "./styles/NotificationBell.css";

export default function NotificationBell() {
  const { userData } = useSession();
  const notifEnabled = userData?.globalNotificationsEnabled !== false;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const bellButtonRef = useRef(null);
  const prevPointsRef = useRef(null);

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
      setUnreadCount(items.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [userId]);

  // Watch totalPoints for admin-released mission points
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const pts = snap.data().totalPoints || 0;
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
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  }, [userId, navigate]);

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
    </div>
  );
}
