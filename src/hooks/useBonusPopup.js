import { useEffect, useRef, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export function useBonusPopup(userId) {
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
      where("type", "==", "bonus_earned"),
      where("popupShown", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => !seenIds.current.has(n.id))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

      if (fresh.length === 0) return;

      fresh.forEach(n => {
        seenIds.current.add(n.id);
        updateDoc(doc(db, "users", userId, "notifications", n.id), {
          popupShown: true,
        }).catch(() => {});
      });

      setDisplayQueue(prev => [...prev, ...fresh]);
    });

    return () => unsub();
  }, [userId]);

  const dismissBonus = () => {
    setDisplayQueue(prev => prev.slice(1));
  };

  return { bonusQueue: displayQueue, dismissBonus };
}
