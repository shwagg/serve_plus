import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, functions } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

export const SessionContext = createContext();

const SESSION_TIMEOUT = 10 * 60 * 1000; // currently 10 seconds, to make it 10 minutes = 10 * 60 * 1000

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
    //Note: Commment this to avoid loggin out while designing
    //i'll uncomment after designing some pages
    
    //inactivityTimerRef.current = setTimeout(() => {
    //  handleSessionTimeout();
    //}, SESSION_TIMEOUT);
  };

  // Handle session timeout
  const handleSessionTimeout = async () => {
    if (isLoggingOut) return; // Prevent multiple logout attempts

    setIsLoggingOut(true);
    try {
      // Log logout to backend if user is present
      const user = auth.currentUser;
      if (user) {
        try {
          console.log("Attempting to log logout for:", user?.uid);
          const logLogout = httpsCallable(functions, "logLogout");
          await logLogout({ uid: user.uid });
        } catch (e) {
          // Don't block logout if audit log fails
          console.error("Audit log (logout) failed:", e);
        }
      }
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
            // ensure there's a history entry to stay on a
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



// what is happeningg