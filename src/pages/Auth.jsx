// Authorization page for password and Blackboard sign-in.

import { getRedirectResult, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import bbl_icon from "../assets/bbl_icon.svg";
import servePlusIcon from "../assets/serve_plus_icon.svg";
// import loginPosterGif from "../assets/login_poster_loop.gif"; // temporarily removed
// import loginPosterFallback from "../assets/login_poster_img.svg"; // temporarily removed
import AgreementModal, {
  fetchCurrentAgreementVersion,
} from "../components/AgreementModal";
import { VisibilityIcon, VisibilityOffIcon } from "../components/icons";
import { auth, db, functions } from "../firebaseConfig";
import useBlackboardAuth from "../hooks/useBlackboardAuth";
import "../styles/ui.css";

function getBlackboardRedirectPath(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "sysadmin") return "/sysadmin/roster";
  if (role === "faculty") return "/faculty/current-event";
  if (role === "partner") return "/partner/dashboard";
  return "/student/home";
}

function getPrivilegedRedirectPath(role) {
  return role === "sysadmin" ? "/sysadmin/roster" : "/admin/dashboard";
}

const BLACKBOARD_PASSWORD_REQUIRED_MESSAGE =
  'This account is linked to Blackboard. Please select "Sign in with Blackboard" to continue.';

function isBlackboardLinkedAccount(userData) {
  return Boolean(
    userData &&
      (userData.authProvider === "blackboard" ||
        userData.blackboardId ||
        userData.blackboardAuthUid),
  );
}

function requiresBlackboardSignIn(userData) {
  return isBlackboardLinkedAccount(userData) && userData.hasServePassword !== true;
}

function checkDeactivation(data) {
  if (!data.deactivated) return null;
  const raw = data.scheduledDeletionAt;
  const deletionDate = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : null;
  if (deletionDate && deletionDate <= new Date()) return "permanent";
  const daysLeft = deletionDate
    ? Math.max(1, Math.ceil((deletionDate - new Date()) / 86400000))
    : 30;
  return { daysLeft };
}

function Auth() {
  const [loginId, setLoginId] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const initiateBlackboardAuth = useBlackboardAuth();

  const isDev = import.meta.env.DEV; //(Dev-only switch)
  //only developers can see detailed debug info while developing.

  const intendedPath = location.state?.from || null;
  const blackboardComplete = Boolean(location.state?.blackboardComplete);
  const [showPassword, setShowPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | "checking" | "found" | "not-found"

  // Agreement modal state
  const [showAgreement, setShowAgreement] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null); // stores role and uid while agreement acceptance is pending

  // Deactivated account reactivation prompt
  const [showReactivatePrompt, setShowReactivatePrompt] = useState(false);
  const [pendingReactivation, setPendingReactivation] = useState(null); // { uid, role, email, authProvider, daysLeft }

  useEffect(() => {
    const callbackError = new URLSearchParams(location.search).get("error");
    if (callbackError) setError(callbackError);
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    const completeBlackboardSignIn = async (firebaseUser) => {
      const uid = firebaseUser.uid;
      const email = firebaseUser.email || "";
      console.log("Blackboard sign-in successful, uid:", uid);

      const userRef = doc(db, "users", uid);
      let userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid,
          email,
          name: firebaseUser.displayName || email || "Blackboard User",
          role: "student",
          status: "active",
          authProvider: "blackboard",
          hasServePassword: false,
          createdAt: new Date(),
        });

        userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setError("Failed to create user profile.");
          return;
        }
      }

      const deactivationStateBb = checkDeactivation(userSnap.data());
      if (deactivationStateBb === "permanent") {
        await signOut(auth);
        setError("This account has been permanently deleted and cannot be recovered.");
        return;
      }
      if (deactivationStateBb) {
        setPendingReactivation({ uid, role: userSnap.data().role, email, authProvider: "blackboard", daysLeft: deactivationStateBb.daysLeft });
        setShowReactivatePrompt(true);
        return;
      }

      const { role, status } = userSnap.data();
      if (status !== "active") {
        setError("Your account is blocked.");
        return;
      }

      const logLogin = httpsCallable(functions, "logLogin");
      logLogin({ uid }).catch((err) => console.warn("Audit log failed:", err));

      const userAgreementVersion = userSnap.data().agreementVersion || null;
      const currentVersion = await fetchCurrentAgreementVersion();
      if (userAgreementVersion !== currentVersion) {
        setPendingNavigation({
          role,
          uid,
          authProvider: "blackboard",
        });
        setShowAgreement(true);
        return;
      }

      navigate(getBlackboardRedirectPath(role), { replace: true });
    };

    const handleBlackboardAuthResult = async () => {
      try {
        const userCred = await getRedirectResult(auth);

        if (cancelled) return;

        if (userCred?.user) {
          await completeBlackboardSignIn(userCred.user);
          return;
        }

        if (blackboardComplete) {
          if (!auth.currentUser) {
            setError("Blackboard sign-in could not be completed.");
            return;
          }

          await completeBlackboardSignIn(auth.currentUser);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (isDev) console.error("Blackboard login error:", err);
        setError("Blackboard sign-in failed. Please try again.");
      }
    };

    handleBlackboardAuthResult();

    return () => {
      cancelled = true;
    };
  }, [blackboardComplete, isDev, navigate]);

  // if it contains "@" treat as email, otherwise look up username
  const resolveLoginAccount = async (input) => {
    if (input.includes("@")) {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef, where("email", "==", input)));
      return {
        email: snap.empty ? input : snap.docs[0].data().email || input,
        userData: snap.empty ? null : snap.docs[0].data(),
      };
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", input));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("No account found for this username.");
    const userData = snap.docs[0].data();
    return {
      email: userData.email,
      userData,
    };
  };

  const handleEmailBlur = async () => {
    const input = loginId.trim();
    if (!input) { setEmailStatus(null); return; }
    setEmailStatus("checking");
    try {
      const usersRef = collection(db, "users");
      const field = input.includes("@") ? "email" : "username";
      const snap = await getDocs(query(usersRef, where(field, "==", input)));
      setEmailStatus(snap.empty ? "not-found" : "found");
    } catch {
      setEmailStatus(null);
    }
  };

  const handleBlackboardLogin = async () => {
    setError("");
    try {
      await initiateBlackboardAuth();
    } catch (err) {
      if (isDev) console.error("Blackboard redirect error:", err);
      setError("Blackboard sign-in could not start. Please try again.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // ✅ 1. Resolve username to email if needed, then authenticate
      const { email, userData: resolvedUserData } = await resolveLoginAccount(loginId.trim());

      if (requiresBlackboardSignIn(resolvedUserData)) {
        setError(BLACKBOARD_PASSWORD_REQUIRED_MESSAGE);
        return;
      }

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      console.log("Login successfully, uid:", uid);

      // ✅ 2. Fetch user profile from Firestore
      const userRef = doc(db, "users", uid);
      let userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // User document missing, create minimal profile
        try {
          await setDoc(userRef, {
            uid,
            email,
            name: userCred.user.displayName || email,
            role: "student",
            status: "active",
            authProvider: "password",
            hasServePassword: true,
            createdAt: new Date(),
          });

          userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            setError("Failed to create user profile.");
            return;
          }
        } catch {
          setError("User profile not found and could not be created.");
          return;
        }
      }

      const deactivationState = checkDeactivation(userSnap.data());
      if (deactivationState === "permanent") {
        await signOut(auth);
        setError("This account has been permanently deleted and cannot be recovered.");
        return;
      }
      if (deactivationState) {
        setPendingReactivation({ uid, role: userSnap.data().role, email, authProvider: "password", daysLeft: deactivationState.daysLeft });
        setShowReactivatePrompt(true);
        return;
      }

      const { role, status } = userSnap.data();

      if (status !== "active") {
        setError("Your account is blocked.");
        return;
      }

      if (userSnap.data().hasServePassword !== true) {
        setDoc(userRef, {
          hasServePassword: true,
          updatedAt: new Date(),
        }, { merge: true }).catch((err) => {
          console.warn("Failed to mark password sign-in availability:", err);
        });
      }
      // REMOVED 'AWAIT' TO IMPROVE FASTER LOGIN TIME. THEY STILL RUN IN THE BACKGROUND
      // ✅ 3. CALL BACKEND TO CREATE AUDIT LOG
      const logLogin = httpsCallable(functions, "logLogin");
      logLogin({ uid }).catch((err) => {
        // <-- THIS is what writes to auditLogs
        console.warn("Audit log failed:", err);
      });

      // Reset login attempts on successful login
      const resetLoginAttempts = httpsCallable(functions, "resetLoginAttempts");
      resetLoginAttempts({ email }).catch((err) => {
        console.warn("Failed to reset login attempts:", err);
      });

      // ✅ 4. CHECK AGREEMENT VERSION before redirecting
      const userAgreementVersion = userSnap.data().agreementVersion || null;
      const currentVersion = await fetchCurrentAgreementVersion();

      if (userAgreementVersion !== currentVersion) {
        // show modal when user hasn't accepted the latest agreements
        setPendingNavigation({ role, uid });
        setShowAgreement(true);
        return;
      }

      // ✅ 5. RBAC REDIRECTION using useNavigate to avoid reloading of the full app; redirecting only react router to certain page.
      if (role === "admin" || role === "sysadmin") {
        navigate(getPrivilegedRedirectPath(role), { replace: true });
      } else if (role === "faculty") {
        navigate(intendedPath || "/faculty/current-event", { replace: true });
      } else if (role === "partner") {
        navigate(intendedPath || "/partner/dashboard", { replace: true });
      } else {
        navigate(intendedPath || "/student/home", { replace: true });
      }
    } catch (err) {
      if (isDev) console.error("Login error:", err);

      //Record login failure
      try {
        const recordLoginFailure = httpsCallable(
          functions,
          "recordLoginFailure",
        );
        const failureResult = await recordLoginFailure({ email: loginId });

        if (failureResult.data?.isLocked) {
          const lockUntil = new Date(failureResult.data.lockUntil);
          const minutesLeft = Math.ceil((lockUntil - new Date()) / 60000);
          setError(
            `Too many failed attempts. Account locked for ${minutesLeft} minute(s).`,
          );
          return;
        } else if (failureResult.data?.attempts) {
          const attemptsLeft =
            failureResult.data.maxAttempts - failureResult.data.attempts;
          console.log(`${attemptsLeft} attempts remaining before account lock`);
        }
      } catch (recordErr) {
        console.warn("Failed to record login failure:", recordErr);
      }

      const code = err?.code || "";
      let userMsg = err?.message || "Login failed. Please try again.";

      if (err?.message === "No account found for this username.") {
        // Already a friendly message from resolveEmail
      } else if (code === "auth/invalid-email") {
        userMsg = "Please enter a valid email address.";
      } else if (code === "auth/user-not-found") {
        userMsg = "No account found for this email.";
      } else if (code === "auth/wrong-password") {
        userMsg = "Incorrect password. Please try again.";
      } else if (code === "auth/too-many-requests") {
        userMsg = "Too many login attempts. Please wait a bit and try again.";
      } else if (code === "auth/network-request-failed") {
        userMsg = "Network error. Please check your connection and try again.";
      } else if (code === "auth/invalid-credential") {
        userMsg = "Invalid email or password.";
      }

      setError(userMsg);
    }
  };

  const handleReactivate = async () => {
    if (!pendingReactivation) return;
    const { uid, role, authProvider } = pendingReactivation;
    try {
      await updateDoc(doc(db, "users", uid), {
        deactivated: deleteField(),
        deactivatedAt: deleteField(),
        scheduledDeletionAt: deleteField(),
      });
      const logLogin = httpsCallable(functions, "logLogin");
      logLogin({ uid }).catch(() => {});
      const freshSnap = await getDoc(doc(db, "users", uid));
      const userAgreementVersion = freshSnap.data()?.agreementVersion || null;
      const currentVersion = await fetchCurrentAgreementVersion();
      setShowReactivatePrompt(false);
      setPendingReactivation(null);
      if (userAgreementVersion !== currentVersion) {
        setPendingNavigation({ role, uid, authProvider });
        setShowAgreement(true);
        return;
      }
      if (authProvider === "blackboard") {
        navigate(getBlackboardRedirectPath(role), { replace: true });
      } else if (role === "admin" || role === "sysadmin") {
        navigate(getPrivilegedRedirectPath(role), { replace: true });
      } else if (role === "faculty") {
        navigate(intendedPath || "/faculty/current-event", { replace: true });
      } else if (role === "partner") {
        navigate(intendedPath || "/partner/dashboard", { replace: true });
      } else {
        navigate(intendedPath || "/student/home", { replace: true });
      }
    } catch {
      setShowReactivatePrompt(false);
      setPendingReactivation(null);
      setError("Failed to reactivate account. Please try again.");
    }
  };

  const handleDeclineReactivate = async () => {
    await signOut(auth);
    setShowReactivatePrompt(false);
    setPendingReactivation(null);
  };

  // After the user accepts the agreements, proceed auth flow
  const handleAgreementAccepted = async () => {
    setShowAgreement(false);
    if (!pendingNavigation) return;

    if (pendingNavigation.authProvider === "blackboard") {
      navigate(getBlackboardRedirectPath(pendingNavigation.role), { replace: true });
      setPendingNavigation(null);
      return;
    }

    const { role } = pendingNavigation;

    if (role === "admin" || role === "sysadmin") {
      navigate(getPrivilegedRedirectPath(role), { replace: true });
    } else if (role === "faculty") {
      navigate("/faculty/current-event", { replace: true });
    } else if (role === "partner") {
      navigate("/partner/projects", { replace: true });
    } else {
      navigate("/student/home", { replace: true });
    }
    setPendingNavigation(null);
  };

  return (
    <>
      {/* Reactivation Prompt */}
      {showReactivatePrompt && pendingReactivation && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: "1rem",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420,
            padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", gap: 0,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 10px 0" }}>
              Account Deactivated
            </p>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: "0 0 12px 0" }}>
              Do you want to reactivate your account?
            </h2>
            <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, margin: "0 0 8px 0" }}>
              Your account is currently deactivated. You have{" "}
              <strong>{pendingReactivation.daysLeft} day{pendingReactivation.daysLeft !== 1 ? "s" : ""} left</strong>{" "}
              before it is permanently deleted.
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55, margin: "0 0 24px 0" }}>
              If you choose not to reactivate now, you can sign in again before the deadline to recover your account. After that, all your data — including levels, badges, and achievements — will be gone forever.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleReactivate}
                style={{
                  height: 44, borderRadius: 16, background: "#30bdb7", border: "none",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", transition: "filter 0.15s",
                }}
                onMouseOver={e => e.currentTarget.style.filter = "brightness(0.93)"}
                onMouseOut={e => e.currentTarget.style.filter = ""}
              >
                Yes, Reactivate My Account
              </button>
              <button
                onClick={handleDeclineReactivate}
                style={{
                  height: 44, borderRadius: 16, background: "#f1f5f9",
                  border: "1px solid #e2e8f0", color: "#374151", fontSize: 14,
                  fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
                }}
                onMouseOver={e => e.currentTarget.style.background = "#e2e8f0"}
                onMouseOut={e => e.currentTarget.style.background = "#f1f5f9"}
              >
                No, Sign Me Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agreement Modal */}
      {showAgreement && pendingNavigation && (
        <AgreementModal
          uid={pendingNavigation.uid}
          onAccepted={handleAgreementAccepted}
        />
      )}

      <div className="auth-page">
        <div className="auth-split">
          {/* Left: poster — temporarily hidden */}
          {/* <div className="auth-poster-panel">
              <img src={loginPosterFallback} alt="SERVE+ illustration" />
            </div> */}

          {/* Right: form */}
          <div className="auth-form-panel">
            <form className="ui-form auth-login-form" onSubmit={handleLogin}>
              <div className="auth-logo-row">
                <img src={servePlusIcon} alt="SERVE+" className="auth-logo-icon" />
                <span className="auth-logo-text">
                  SERVE<span className="auth-logo-plus">+</span>
                </span>
              </div><br />

              <button className="auth-bbl-btn" type="button" onClick={handleBlackboardLogin}>
                <img src={bbl_icon} alt="" className="auth-sso-icon" />
                Sign in with Blackboard
              </button>

              <div className="divider" style={{ width: "100%", maxWidth: 340 }}>
                <span>or sign in with</span>
              </div>

              {/* Email / Username */}
              <div className="auth-field-wrap">
                <input
                  className={`ui-input${emailStatus === "not-found" ? " ui-input--error" : ""}`}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  type="text"
                  placeholder="Email or Username"
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); setEmailStatus(null); }}
                  onBlur={handleEmailBlur}
                  required
                />
                {emailStatus === "not-found" && (
                  <p className="field-hint error">No account found for this email or username</p>
                )}
              </div>

              {/* Password + Forgot Password */}
              <div className="auth-field-wrap">
                <div className="ui-input-pass-wrap" style={{ maxWidth: "100%" }}>
                  <input
                    className="ui-input pass"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {password.length > 0 && (
                    <button
                      type="button"
                      className="ui-btn eye"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </button>
                  )}
                </div>
                <p className="ui-smallText" style={{ marginTop: 6 }}>
                  <Link to="/reset-password">Forgot Password?</Link>
                </p>
              </div>

              <button className="auth-login-btn" type="submit">
                Login
              </button>

              <p className="ui-link" style={{ margin: "6px 0 0", textAlign: "center" }}>
                New to SERVE+? <Link to="/register">Sign up here</Link>
              </p>

              {error && <p className="ui-error" style={{ textAlign: "center" }}>{error}</p>}

              {error && (
                <p className="ui-smallText" style={{ marginTop: 4, textAlign: "center", color: "#64748b", fontWeight: 400, fontSize: 10 }}>
                  Need help? Contact the SERVE+ administrator or try again in a few minutes.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}


export default Auth;
