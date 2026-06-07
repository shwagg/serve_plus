import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth, functions, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { getIdTokenResult, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { showToast } from "../utils/toast";
import { SessionContext } from "./sessionContextCore";

const SESSION_TIMEOUTS = {
  admin:    10 * 60 * 1000,  // 10 minutes
  sysadmin: 10 * 60 * 1000,  // 10 minutes
  faculty:  30 * 60 * 1000,  // 30 minutes
  student:  30 * 60 * 1000,  // 30 minutes
  partner:  30 * 60 * 1000,  // 30 minutes
};
const DEFAULT_TIMEOUT = 10 * 60 * 1000;
const MFA_REQUIRED_ROLES = new Set(["student", "faculty", "admin"]);

export function SessionProvider({ children }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const userDataRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  useEffect(() => {
    isLoggingOutRef.current = isLoggingOut;
  }, [isLoggingOut]);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const handleSessionTimeout = useCallback(async () => {
    if (isLoggingOutRef.current) return;

    setIsLoggingOut(true);
    isLoggingOutRef.current = true;

    try {
      const user = auth.currentUser;

      if (user) {
        try {
          console.log("Attempting to log logout for:", user.uid);
          const logLogout = httpsCallable(functions, "logLogout");
          logLogout({ uid: user.uid }).catch(() => {});
        } catch (error) {
          console.error("Audit log (logout) failed:", error);
        }
      }

      await signOut(auth);
      setIsSessionActive(false);

      try {
        sessionStorage.setItem("autoLoggedOut", "1");
      } catch {
        // Ignore unavailable sessionStorage.
      }

      window.history.pushState(null, null, window.location.href);
      window.location.href = "/";
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();

    const role = userDataRef.current?.role;
    const timeout = SESSION_TIMEOUTS[role] ?? DEFAULT_TIMEOUT;

    inactivityTimerRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, timeout);
  }, [clearInactivityTimer, handleSessionTimeout]);

  const setupActivityListeners = useCallback(() => {
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
  }, [isSessionActive, resetInactivityTimer]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setAuthLoading(true);
      try {
        if (user) {
          try {
            sessionStorage.removeItem("autoLoggedOut");
          } catch {
            // Ignore unavailable sessionStorage.
          }

          window.onpopstate = null;

          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const data = userSnap.data();
              console.log("SessionContext - Fetched user data:", data);

              const isEmulator = import.meta.env.VITE_USE_EMULATORS === "true";
              const tokenResult = await getIdTokenResult(user);
              if (
                !isEmulator &&
                MFA_REQUIRED_ROLES.has(data.role) &&
                tokenResult.claims?.provider !== "blackboard" &&
                tokenResult.claims?.mfa !== true
              ) {
                await signOut(auth);
                setUserData(null);
                setIsSessionActive(false);
                return;
              }

              userDataRef.current = data;
              setUserData(data);

              // Award SERVE Ready badge on login (idempotent — won't duplicate)
              if (data.role === "student") {
                import("../hooks/badgeSystem").then(({ awardServeReadyBadge }) => {
                  awardServeReadyBadge(user.uid).catch(() => {});
                });
              }
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
          clearInactivityTimer();
        }
      } finally {
        setAuthLoading(false);
      }

      if (!user) {
        try {
          const flagged = sessionStorage.getItem("autoLoggedOut");
          if (flagged) {
            window.history.pushState(null, null, window.location.href);
            window.onpopstate = () => {
              showToast("You were automatically logged out. Please sign in again.");
              window.history.pushState(null, null, "/");
              window.location.href = "/";
            };
          }
        } catch {
          // Ignore unavailable sessionStorage.
        }
      }
    });

    return () => {
      unsubscribe();
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, resetInactivityTimer]);

  useEffect(() => {
    return setupActivityListeners();
  }, [setupActivityListeners]);

  const refreshUserData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        userDataRef.current = data;
        setUserData(data);
      }
    } catch (error) {
      console.error("SessionContext - Error refreshing user data:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    await handleSessionTimeout();
  }, [handleSessionTimeout]);

  const value = useMemo(() => ({
    isSessionActive,
    authLoading,
    logout,
    resetInactivityTimer,
    userData,
    refreshUserData,
  }), [authLoading, isSessionActive, logout, refreshUserData, resetInactivityTimer, userData]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
