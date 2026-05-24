// Authorization page for password and Blackboard sign-in.

import { signInWithCustomToken, signOut } from "firebase/auth";
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
import { getMfaRouteForAction, saveMfaSession } from "../utils/mfaSession";

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
  const mfaComplete = Boolean(location.state?.mfaComplete);
  const passwordComplete = Boolean(location.state?.passwordComplete);
  const [showPassword, setShowPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | "checking" | "found" | "not-found"
  const [verificationRequired, setVerificationRequired] = useState(null);
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

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

    const completeAuthenticatedSignIn = async (firebaseUser, fallbackProvider) => {
      const uid = firebaseUser.uid;
      const email = firebaseUser.email || "";
      console.log("Sign-in successful, uid:", uid);

      const userRef = doc(db, "users", uid);
      let userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid,
          email,
          name: firebaseUser.displayName || email || "SERVE+ User",
          role: "student",
          status: "active",
          authProvider: fallbackProvider,
          hasServePassword: fallbackProvider === "password",
          createdAt: new Date(),
        });

        userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setError("Failed to create user profile.");
          return;
        }
      }

      const userData = userSnap.data();
      const authProvider = fallbackProvider || userData.authProvider || "password";
      const deactivationState = checkDeactivation(userData);
      if (deactivationState === "permanent") {
        await signOut(auth);
        setError("This account has been permanently deleted and cannot be recovered.");
        return;
      }
      if (deactivationState) {
        setPendingReactivation({
          uid,
          role: userData.role,
          email,
          authProvider,
          daysLeft: deactivationState.daysLeft,
        });
        setShowReactivatePrompt(true);
        return;
      }

      const { role, status } = userData;
      if (status !== "active") {
        setError("Your account is blocked.");
        return;
      }

      const logLogin = httpsCallable(functions, "logLogin");
      logLogin({ uid }).catch((err) => console.warn("Audit log failed:", err));

      const resetLoginAttempts = httpsCallable(functions, "resetLoginAttempts");
      resetLoginAttempts({ email }).catch((err) => {
        console.warn("Failed to reset login attempts:", err);
      });

      const userAgreementVersion = userData.agreementVersion || null;
      const currentVersion = await fetchCurrentAgreementVersion();
      if (userAgreementVersion !== currentVersion) {
        setPendingNavigation({
          role,
          uid,
          authProvider,
        });
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
    };

    const handleCompletedAuthResult = async () => {
      try {
        if (!blackboardComplete && !mfaComplete && !passwordComplete) return;

        if (!auth.currentUser) {
          setError("Sign-in could not be completed.");
          return;
        }

        const fallbackProvider = blackboardComplete ? "blackboard" : "password";
        if (!cancelled) {
          await completeAuthenticatedSignIn(auth.currentUser, fallbackProvider);
        }
      } catch (err) {
        if (cancelled) return;
        if (isDev) console.error("Completed login error:", err);
        setError("Sign-in failed. Please try again.");
      }
    };

    handleCompletedAuthResult();

    return () => {
      cancelled = true;
    };
  }, [
    blackboardComplete,
    mfaComplete,
    passwordComplete,
    intendedPath,
    isDev,
    navigate,
  ]);

  const handleEmailBlur = async () => {
    const input = loginId.trim();
    if (!input) { setEmailStatus(null); return; }
    setEmailStatus("checking");
    try {
      const usersRef = collection(db, "users");
      const field = input.includes("@") ? "email" : "username";
      const lookupValue = field === "email" ? input.toLowerCase() : input;
      const snap = await getDocs(query(usersRef, where(field, "==", lookupValue)));
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
    setVerificationMessage("");
    setVerificationRequired(null);

    try {
      const startPasswordLogin = httpsCallable(functions, "startPasswordLogin");
      const result = await startPasswordLogin({
        loginId: loginId.trim(),
        password,
      });
      const authStep = result.data;

      if (authStep.status === "EMAIL_VERIFICATION_REQUIRED") {
        setVerificationRequired(authStep.email || loginId.trim());
        setVerificationMessage("Verify your email before continuing.");
        return;
      }

      if (
        authStep.status === "MFA_SETUP_REQUIRED" ||
        authStep.status === "MFA_REQUIRED"
      ) {
        saveMfaSession({
          sessionToken: authStep.sessionToken,
          action: authStep.status,
          from: intendedPath,
        });
        navigate(getMfaRouteForAction(authStep.status), { replace: true });
        return;
      }

      if (authStep.status === "AUTHENTICATED" && authStep.customToken) {
        await signInWithCustomToken(auth, authStep.customToken);
        navigate("/auth", {
          replace: true,
          state: { passwordComplete: true, from: intendedPath },
        });
        return;
      }

      setError("Login failed. Please try again.");
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

  const handleSendVerificationEmail = async () => {
    setError("");
    setVerificationMessage("");
    setVerificationSending(true);

    try {
      const sendVerification = httpsCallable(
        functions,
        "sendEmailVerificationForLogin",
      );
      const result = await sendVerification({
        loginId: loginId.trim(),
        password,
      });
      const email = result.data?.email || verificationRequired || loginId.trim();
      setVerificationRequired(email);
      setVerificationMessage(`Verification email sent to ${email}.`);
    } catch (err) {
      if (isDev) console.error("Verification email error:", err);
      setError(err?.message || "Unable to send verification email.");
    } finally {
      setVerificationSending(false);
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
                  onChange={(e) => {
                    setLoginId(e.target.value);
                    setEmailStatus(null);
                    setVerificationRequired(null);
                    setVerificationMessage("");
                  }}
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setVerificationRequired(null);
                      setVerificationMessage("");
                    }}
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

              {verificationRequired && (
                <p className="ui-smallText" style={{ marginTop: 0 }}>
                  Didn&apos;t receive it?{" "}
                  <a
                    href="#send-verification"
                    onClick={(event) => {
                      event.preventDefault();
                      if (!verificationSending) handleSendVerificationEmail();
                    }}
                  >
                    {verificationSending ? "sending..." : "send verification email"}
                  </a>
                </p>
              )}

              <p className="ui-link" style={{ margin: "6px 0 0", textAlign: "center" }}>
                New to SERVE+? <Link to="/register">Sign up here</Link>
              </p>

              {verificationMessage && (
                <p className="ui-success" style={{ textAlign: "center" }}>
                  {verificationMessage}
                </p>
              )}

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
