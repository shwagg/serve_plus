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
 * useLevelUpPopup
 *
 * Subscribes to the current user's notifications for unshown level_up events.
 * Returns:
 *   levelQueue   – array of newLevel numbers pending display (oldest first)
 *   dismissLevel – removes the level from the local display queue
 */
export function useLevelUpPopup(userId) {
  const [displayQueue, setDisplayQueue] = useState([]);
  const seenIds = useRef(new Set());

  useEffect(() => {
    if (!userId) {
      setDisplayQueue([]);
      seenIds.current = new Set();
      return;
    }

    const q = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "level_up"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs
        .map((d) => ({ id: d.id, newLevel: d.data().newLevel, createdAt: d.data().createdAt }))
        .filter((n) => n.newLevel && !seenIds.current.has(n.id))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

      if (fresh.length === 0) return;

      fresh.forEach((n) => {
        seenIds.current.add(n.id);
        updateDoc(doc(db, "users", userId, "notifications", n.id), {
          popupShown: true,
        }).catch(() => {});
      });

      setDisplayQueue((prev) => [...prev, ...fresh]);
    });

    return () => unsub();
  }, [userId]);

  const levelQueue = displayQueue.map((n) => n.newLevel);

  const dismissLevel = (level) => {
    setDisplayQueue((prev) => prev.filter((n) => n.newLevel !== level));
  };

  return { levelQueue, dismissLevel };
}
