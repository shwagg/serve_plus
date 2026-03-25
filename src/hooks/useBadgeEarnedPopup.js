import { useEffect, useState } from "react";
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
 *   dismissBadge(notificationId) – marks popup as shown in Firestore & shifts queue
 */
export function useBadgeEarnedPopup(userId) {
  const [pendingNotifs, setPendingNotifs] = useState([]); // [{ id, badgeId }]

  useEffect(() => {
    if (!userId) return;

    const notificationsRef = collection(db, "users", userId, "notifications");
    const q = query(
      notificationsRef,
      where("type", "==", "badge_earned"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, badgeId: d.data().badgeId, createdAt: d.data().createdAt }))
        .filter((n) => n.badgeId)
        .sort((a, b) => {
          // oldest first
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
      setPendingNotifs(items);
    });

    return () => unsub();
  }, [userId]);

  const badgeQueue = pendingNotifs.map((n) => n.badgeId);

  const dismissBadge = async (badgeId) => {
    // Find the matching notification record
    const notif = pendingNotifs.find((n) => n.badgeId === badgeId);
    if (!notif) return;
    try {
      await updateDoc(doc(db, "users", userId, "notifications", notif.id), {
        popupShown: true,
      });
    } catch (e) {
      console.error("dismissBadge error:", e);
    }
  };

  return { badgeQueue, dismissBadge };
}
