import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";

const SessionContext = createContext();

const SESSION_TIMEOUT = 10 * 1000; // 1 minute in milliseconds

export function SessionProvider({ children }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const timeoutIdRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // Reset the inactivity timer
  const resetInactivityTimer = () => {
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set new timer
    inactivityTimerRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, SESSION_TIMEOUT);
  };

  // Handle session timeout
  const handleSessionTimeout = async () => {
    if (isLoggingOut) return; // Prevent multiple logout attempts

    setIsLoggingOut(true);
    try {
      await signOut(auth);
      setIsSessionActive(false);
      // Mark that logout was automatic so the login page can show a popup
      try {
        sessionStorage.setItem("autoLoggedOut", "1");
      } catch (e) {
        /* ignore storage errors */
      }
      // Push a history entry so Back presses stay on the same page, and redirect to login
      window.history.pushState(null, null, window.location.href);
      window.location.href = "/";
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Listen for user activity
  const setupActivityListeners = () => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];

    const handleActivity = () => {
      if (isSessionActive) {
        resetInactivityTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // On successful login clear auto-logout marker and any popstate handler
        try {
          sessionStorage.removeItem("autoLoggedOut");
        } catch (e) {
          /* ignore */
        }
        try {
          window.onpopstate = null;
        } catch (e) {
          /* ignore */
        }
        setIsSessionActive(true);
        resetInactivityTimer();
      } else {
        setIsSessionActive(false);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }

        // If we were auto-logged-out, install a popstate handler on the login page
        try {
          const flagged = sessionStorage.getItem("autoLoggedOut");
          if (flagged) {
            // ensure there's a history entry to stay on
            window.history.pushState(null, null, window.location.href);
            window.onpopstate = () => {
              alert("You were automatically logged out. Please sign in again.");
              // keep user on login page
              window.history.pushState(null, null, "/");
              window.location.href = "/";
            };
          }
        } catch (e) {
          /* ignore storage or window errors */
        }
      }
    });

    return unsubscribe;
  }, []);

  // Setup activity listeners
  useEffect(() => {
    return setupActivityListeners();
  }, [isSessionActive]);

  const logout = async () => {
    await handleSessionTimeout();
  };

  const value = {
    isSessionActive,
    logout,
    resetInactivityTimer,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
