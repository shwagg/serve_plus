import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import notificationIcon from "../assets/headassets/Notification Icon.svg";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../utils/notificationUtils";
import "./styles/NotificationBell.css";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

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

  const handleNotificationClick = async (notification) => {
    if (!userId) return;
    if (!notification.read) {
      await markNotificationAsRead(userId, notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "event_registration":
        return "✅";
      case "event_upcoming":
        return "⏰";
      case "event_cancelled":
        return "❌";
      case "level_up":
        return "🎉";
      case "badge_earned":
        return "🏆";
      case "points_earned":
        return "⭐";
      case "reflection_submitted":
        return "✍️";
      case "reflection_overdue":
        return "⏰";
      case "reflection_approved":
        return "✔️";
      case "deadline_approaching":
        return "⚠️";
      case "certificate_ready":
        return "📜";
      default:
        return "🔔";
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
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <img src={notificationIcon} alt="Notifications" width="24" height="24" />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">No notifications yet</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatTimeAgo(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.read && <div className="notification-unread-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="notification-backdrop" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
}
