import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export function useCertEarnedPopup(userId) {
  const [pendingNotifs, setPendingNotifs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "users", userId, "notifications"),
      where("type", "==", "certificate_obtained"),
      where("popupShown", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, course: d.data().event || d.data().course, createdAt: d.data().createdAt }))
        .filter(n => n.course)
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
      setPendingNotifs(items);
    });
    return () => unsub();
  }, [userId]);

  const certQueue = pendingNotifs.map(n => ({ notifId: n.id, course: n.course }));

  const dismissCert = async (notifId) => {
    try {
      await updateDoc(doc(db, "users", userId, "notifications", notifId), { popupShown: true });
    } catch (e) {
      console.error("dismissCert error:", e);
    }
  };

  return { certQueue, dismissCert };
}
