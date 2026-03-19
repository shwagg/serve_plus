import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, functions, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

export const SessionContext = createContext();

const SESSION_TIMEOUTS = {
  admin:   10 * 60 * 1000,  // 10 minutes
  faculty: 10 * 60 * 1000,  // 10 minutes
  student: 30 * 60 * 1000,  // 30 minutes
  partner: 30 * 60 * 1000,  // 30 minutes
};
const DEFAULT_TIMEOUT = 10 * 60 * 1000;

export function SessionProvider({ children }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const timeoutIdRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const userDataRef = useRef(null);

  // Keep a ref in sync so resetInactivityTimer always reads the latest role
  useEffect(() => { userDataRef.current = userData; }, [userData]);

  // Reset the inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    const role = userDataRef.current?.role;
    const timeout = SESSION_TIMEOUTS[role] ?? DEFAULT_TIMEOUT;

    inactivityTimerRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, timeout);
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
          logLogout({ uid: user.uid }).catch(() => { });
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

  // Monitor auth state changes and fetch user data
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          // On successful login clear auto-logout marker and any popstate handler
          try { sessionStorage.removeItem("autoLoggedOut"); } catch (e) { /* ignore */ }
          try { window.onpopstate = null; } catch (e) { /* ignore */ }

          // Fetch user data from Firestore
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const data = userSnap.data();
              console.log("SessionContext - Fetched user data:", data);
              setUserData(data);
            } else {
              console.warn("SessionContext - User document not found for uid:", user.uid);
              setUserData(null);
            }
          } catch (error) {
            console.error("SessionContext - Error fetching user data:", error);
            setUserData(null);
          }

          setIsSessionActive(true);
          resetInactivityTimer();
        } else {
          setIsSessionActive(false);
          setUserData(null);
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        }
      } finally {
        // Always resolve authLoading regardless of success or error
        setAuthLoading(false);
      }

      if (!user) {

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
    authLoading,
    logout,
    resetInactivityTimer,
    userData,
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