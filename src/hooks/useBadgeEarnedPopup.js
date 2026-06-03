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

const SEEN_KEY = "sp_badge_notif_seen";

function getSeenFromStorage() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); }
  catch { return new Set(); }
}
function addSeenToStorage(id) {
  try {
    const arr = [...getSeenFromStorage(), id];
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr.slice(-500)));
  } catch {}
}

/**
 * useBadgeEarnedPopup
 *
 * Subscribes to the current user's notifications for unshown badge_earned events.
 * Returns:
 *   badgeQueue  – array of badgeId strings pending display (oldest first)
 *   dismissBadge(badgeId) – removes the badge from the local display queue
 *   badgeReady  – true once the first Firestore snapshot has resolved
 *
 * Notifications are marked popupShown:true in Firestore immediately on load so
 * they never re-appear on subsequent logins regardless of whether the user
 * dismisses the modal. localStorage is used as a durable backup in case the
 * Firestore write is rejected by security rules.
 */
export function useBadgeEarnedPopup(userId) {
  const [displayQueue, setDisplayQueue] = useState([]);
  const [ready, setReady] = useState(false);
  const seenIds = useRef(new Set());

  useEffect(() => {
    if (!userId) {
      setDisplayQueue([]);
      setReady(true); // nothing to wait for when logged out
      seenIds.current = new Set();
      return;
    }

    setReady(false);

    const notificationsRef = collection(db, "users", userId, "notifications");
    const q = query(
      notificationsRef,
      where("type", "==", "badge_earned"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setReady(true);

      const storageSeen = getSeenFromStorage();

      const fresh = snap.docs
        .map((d) => ({ id: d.id, badgeId: d.data().badgeId, createdAt: d.data().createdAt }))
        .filter((n) => n.badgeId && !seenIds.current.has(n.id) && !storageSeen.has(n.id))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

      if (fresh.length === 0) return;

      fresh.forEach((n) => {
        seenIds.current.add(n.id);
        addSeenToStorage(n.id);
        updateDoc(doc(db, "users", userId, "notifications", n.id), {
          popupShown: true,
        }).catch(() => {});
      });

      setDisplayQueue((prev) => [...prev, ...fresh]);
    });

    return () => unsub();
  }, [userId]);

  const badgeQueue = displayQueue.map((n) => n.badgeId);

  const dismissBadge = (badgeId) => {
    setDisplayQueue((prev) => prev.filter((n) => n.badgeId !== badgeId));
  };

  return { badgeQueue, dismissBadge, badgeReady: ready };
}
