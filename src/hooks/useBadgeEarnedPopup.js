import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * useBadgeEarnedPopup
 *
 * Subscribes to the current user's notifications for unshown badge_earned events.
 * Returns:
 *   badgeQueue  – array of badgeId strings pending display (oldest first)
 *   dismissBadge(badgeId) – removes the badge from the local display queue
 *
 * Notifications are marked popupShown:true in Firestore immediately on load so
 * they never re-appear on subsequent logins regardless of whether the user
 * dismisses the modal.
 */
export function useBadgeEarnedPopup(userId) {
  const [displayQueue, setDisplayQueue] = useState([]); // [{ id, badgeId }] – local session only
  const seenIds = useRef(new Set()); // prevents adding the same notif twice if snapshot re-fires

  useEffect(() => {
    if (!userId) {
      setDisplayQueue([]);
      seenIds.current = new Set();
      return;
    }

    const notificationsRef = collection(db, "users", userId, "notifications");
    const q = query(
      notificationsRef,
      where("type", "==", "badge_earned"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs
        .map((d) => ({ id: d.id, badgeId: d.data().badgeId, createdAt: d.data().createdAt }))
        .filter((n) => n.badgeId && !seenIds.current.has(n.id))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

      if (fresh.length === 0) return;

      // Mark as shown in Firestore immediately so they don't re-appear next login
      fresh.forEach((n) => {
        seenIds.current.add(n.id);
        updateDoc(doc(db, "users", userId, "notifications", n.id), {
          popupShown: true,
        }).catch(() => {});
      });

      // Append to local display queue for this session
      setDisplayQueue((prev) => [...prev, ...fresh]);
    });

    return () => unsub();
  }, [userId]);

  const badgeQueue = displayQueue.map((n) => n.badgeId);

  const dismissBadge = (badgeId) => {
    setDisplayQueue((prev) => prev.filter((n) => n.badgeId !== badgeId));
  };

  return { badgeQueue, dismissBadge };
}
