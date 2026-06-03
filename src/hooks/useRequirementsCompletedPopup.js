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
 * reqReady becomes true once the first Firestore snapshot has resolved,
 * allowing PopupSequenceManager to gate display until all three hooks are ready.
 */
export function useRequirementsCompletedPopup(userId) {
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

    const q = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "requirements_completed"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setReady(true);

      const fresh = snap.docs
        .map((d) => ({
          id: d.id,
          missionId: d.data().missionId,
          isOrganizer: d.data().isOrganizer ?? false,
          createdAt: d.data().createdAt,
        }))
        .filter((n) => n.missionId && !seenIds.current.has(n.id))
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

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

  const dismissReq = (notifId) => {
    setDisplayQueue((prev) => prev.filter((n) => n.id !== notifId));
  };

  return { reqQueue: displayQueue, dismissReq, reqReady: ready };
}
