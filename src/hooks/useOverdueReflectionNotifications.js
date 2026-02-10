import { useEffect } from "react";
import { auth } from "../firebaseConfig";
import { checkOverdueReflections } from "../utils/notificationUtils";

export function useOverdueReflectionNotifications() {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      // Check when the last reflection check was performed
      const lastCheck = localStorage.getItem(`lastReflectionCheck_${user.uid}`);
      const now = Date.now();

      // Only check once per day (86400000 ms = 24 hours)
      if (lastCheck && now - parseInt(lastCheck) < 86400000) {
        return;
      }

      // Perform the check
      await checkOverdueReflections(user.uid);

      // Update last check time
      localStorage.setItem(`lastReflectionCheck_${user.uid}`, now.toString());
    });

    return () => unsubscribe();
  }, []);
}
