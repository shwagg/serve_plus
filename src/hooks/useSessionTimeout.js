import { useEffect } from "react";
import { useSession } from "../context/useSession";

export function useSessionTimeout() {
  const { resetInactivityTimer } = useSession();

  useEffect(() => {
    // Show warning 10 seconds before timeout (optional)
    const warningTime = 9 * 60 * 1000; // 50 seconds for 1 minute timeout

    const showWarning = setTimeout(() => {
      // You can dispatch a notification here if you have a notification system
      console.warn("Session expiring soon...");
    }, warningTime);

    return () => {
      clearTimeout(showWarning);
    };
  }, []);

  return { resetInactivityTimer };
}
