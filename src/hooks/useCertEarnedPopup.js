import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * certReady becomes true once the first Firestore snapshot has resolved,
 * allowing PopupSequenceManager to gate display until all three hooks are ready.
 */
export function useCertEarnedPopup(userId) {
  const [pendingNotifs, setPendingNotifs] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPendingNotifs([]);
      setReady(true); // nothing to wait for when logged out
      return;
    }

    setReady(false);

    const q = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "certificate_obtained"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setReady(true);
      const items = snap.docs
        .map(d => ({
          id: d.id,
          course: d.data().event || d.data().course,
          missionPoints: d.data().missionPoints ?? null,
          createdAt: d.data().createdAt,
        }))
        .filter(n => n.course)
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
      setPendingNotifs(items);
    });

    return () => unsub();
  }, [userId]);

  const certQueue = pendingNotifs.map(n => ({ notifId: n.id, course: n.course, missionPoints: n.missionPoints }));

  const dismissCert = async (notifId) => {
    try {
      await updateDoc(doc(db, "users", userId, "notifications", notifId), { popupShown: true });
    } catch (e) {
      console.error("dismissCert error:", e);
    }
  };

  return { certQueue, dismissCert, certReady: ready };
}
