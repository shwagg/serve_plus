//Changed Login to Authorization page since it covers MFA as well.
//After logging in, MFA are placed for admin since it has sensitive role such
//as approving, publishing, issuing certificates, and other high impact actions.

import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import bbl_icon from "../assets/bbl_icon.svg";
import AgreementModal, {
  fetchCurrentAgreementVersion,
} from "../components/AgreementModal";
import { VisibilityIcon, VisibilityOffIcon } from "../components/icons";
import { auth, db, functions } from "../firebaseConfig";
import useBlackboardAuth from "../hooks/useBlackboardAuth";
import "../styles/ui.css";

function Auth() {
  const [loginId, setLoginId] = useState(""); // email or username
  const [mfaEmail, setMfaEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const initiateBlackboardAuth = useBlackboardAuth();

  const isDev = import.meta.env.DEV; //(Dev-only switch)
  //only developers can see detailed debug info while developing.

  const [step, setStep] = useState("login"); //"login" or "mfa"
  const [mfaRole, setMfaRole] = useState("admin"); // tracks which privileged role is doing MFA
  const intendedPath = useLocation().state?.from || null;
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Agreement modal state
  const [showAgreement, setShowAgreement] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null); // stores role, uid, email, userCred

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // if it contains "@" treat as email, otherwise look up username
  const resolveEmail = async (input) => {
    if (input.includes("@")) return input;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", input));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("No account found for this username.");
    return snap.docs[0].data().email;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // ✅ 1. Resolve username to email if needed, then authenticate
      const email = await resolveEmail(loginId.trim());
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      console.log("Login successfully, uid:", uid);

      // ✅ 2. Fetch user profile from Firestore
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // User document missing, create minimal profile
        try {
          await import("firebase/firestore").then(({ setDoc }) =>
            setDoc(userRef, {
              uid,
              email,
              name: userCred.user.displayName || email,
              role: "student",
              status: "active",
              createdAt: new Date(),
            }),
          );
          // Optional, fetch again to update userSnap
          const newSnap = await getDoc(userRef);
          if (newSnap.exists()) {
            // Continue as normal
          } else {
            setError("Failed to create user profile.");
            return;
          }
        } catch (createErr) {
          setError("User profile not found and could not be created.");
          return;
        }
      }

      const { role, status } = userSnap.data();

      if (status !== "active") {
        setError("Your account is blocked.");
        return;
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
        setPendingNavigation({ role, uid, email, userCred });
        setShowAgreement(true);
        return;
      }

      // ✅ 5. RBAC REDIRECTION using useNavigate to avoid reloading of the full app; redirecting only react router to certain page.
      if (role === "admin" || role === "sysadmin") {
        try {
          const signedInEmail = userCred.user.email;
          setMfaEmail(signedInEmail);
          setMfaRole(role);
          const sendMfaCode = httpsCallable(functions, "sendMfaCode");
          await sendMfaCode({ email: signedInEmail });
        } catch (mfaErr) {
          //(Only developers can see these errors)
          if (isDev) {
            console.error("MFA send error full:", mfaErr);
            console.error("MFA send error code:", mfaErr.code);
            console.error("MFA send error message:", mfaErr.message);
            console.error("MFA send error details:", mfaErr.details);
          }

          //(User-friendly error message)
          const code = mfaErr?.code || "";
          let userMsg =
            "We couldn’t send the verification code right now. Please try again.";

          if (code === "functions/unavailable") {
            userMsg =
              "The verification service is temporarily unavailable.\nPlease try again in a moment.";
          } else if (code === "functions/deadline-exceeded") {
            userMsg =
              "The request took too long. Please check your connection and try again.";
          } else if (code === "functions/permission-denied") {
            userMsg =
              "You don’t have permission to do this. Please contact your administrator.";
          }

          setError(userMsg);
          return;
        }
        setStep("mfa");
        setCooldown(30);
        return;
      } else if (role === "faculty") {
        navigate(intendedPath || "/faculty/projects", { replace: true });
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

  //for verifying and resending MFA
  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const verifyMfaCode = httpsCallable(functions, "verifyMfaCode");
      const res = await verifyMfaCode({ email: mfaEmail, code: mfaCode });

      if (!res.data?.ok) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      //MFA success → redirect based on role
      if (mfaRole === "sysadmin") {
        navigate("/sysadmin/roster", { replace: true });
      } else {
        navigate("/admin/dashboard", { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError("Unable to verify the code. Please try again.");
    }
  };

  //chance for user to resend MFA email code to them with Cooldown 30 seconds.
  const handleResendMfa = async () => {
    if (cooldown > 0) return;
    setError("");

    try {
      const sendMfaCode = httpsCallable(functions, "sendMfaCode");
      await sendMfaCode({ email: mfaEmail });

      setCooldown(30);
    } catch (err) {
      console.error(err);
      setError("Unable to resend the code. Please try again.");
    }
  };

  // After the user accepts the agreements, proceed auth flow
  const handleAgreementAccepted = async () => {
    setShowAgreement(false);
    if (!pendingNavigation) return;

    const { role, email: pendingEmail, userCred } = pendingNavigation;

    if (role === "admin" || role === "sysadmin") {
      try {
        const signedInEmail = userCred.user.email;
        setMfaEmail(signedInEmail);
        setMfaRole(role);
        const sendMfaCode = httpsCallable(functions, "sendMfaCode");
        await sendMfaCode({ email: signedInEmail });
      } catch (mfaErr) {
        if (isDev) {
          console.error("MFA send error full:", mfaErr);
        }
        const code = mfaErr?.code || "";
        let userMsg =
          "We couldn't send the verification code right now. Please try again.";
        if (code === "functions/unavailable") {
          userMsg =
            "The verification service is temporarily unavailable.\nPlease try again in a moment.";
        } else if (code === "functions/deadline-exceeded") {
          userMsg =
            "The request took too long. Please check your connection and try again.";
        } else if (code === "functions/permission-denied") {
          userMsg =
            "You don't have permission to do this. Please contact your administrator.";
        }
        setError(userMsg);
        setPendingNavigation(null);
        return;
      }
      setStep("mfa");
      setCooldown(30);
    } else if (role === "faculty") {
      navigate("/faculty/projects", { replace: true });
    } else if (role === "partner") {
      navigate("/partner/projects", { replace: true });
    } else {
      navigate("/student/home", { replace: true });
    }
    setPendingNavigation(null);
  };

  return (
    <>
      {/* Agreement Modal */}
      {showAgreement && pendingNavigation && (
        <AgreementModal
          uid={pendingNavigation.uid}
          onAccepted={handleAgreementAccepted}
        />
      )}

      {step === "login" && (
        <div className="ui-container">
          <div className="ui-card">
            <form className="ui-form" onSubmit={handleLogin}>
              <h2 className="ui-title">
                LOGIN <span className="ui-title-to">to</span> SERVE
                <span className="ui-title-plus">+</span>
              </h2>

              <p className="ui-link">
                New to SERVE+? <Link to="/register">Sign up here</Link>
              </p>

              <input
                className="ui-input"
                type="text"
                placeholder="Email or Username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
              />
              <div className="ui-input-pass-wrap">
                <input
                  className="ui-input pass"
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </button>
                )}
              </div>

              <button className="ui-btn" type="submit">
                Sign in
              </button>

              {error && <p className="ui-error">{error}</p>}

              <p className="ui-smallText">
                <Link to="/reset-password">Forgot Password?</Link>
              </p>

              <div className="divider">
                <span>Sign in with</span>
              </div>

              <button
                className="icon-btn"
                type="button"
                aria-label="Sign in with Blackboard"
                onClick={initiateBlackboardAuth}
              >
                <img src={bbl_icon} alt="Blackboard" />
              </button>

              {error && (
                <p
                  className="ui-smallText"
                  style={{
                    marginTop: 6,
                    textAlign: "center",
                    color: "#64748b",
                    fontWeight: 400,
                    fontSize: 10,
                  }}
                >
                  Need help? Contact the SERVE+ administrator or try again in a
                  few minutes.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {step === "mfa" && (
        <div className="ui-container">
          <div className="ui-card">
            <form className="ui-form" onSubmit={handleVerifyMfa}>
              <div style={{ fontSize: 52, marginBottom: 6 }}>🔐</div>
              <h2 className="ui-title">Admin Verification</h2>

              <p
                className="ui-smallText"
                style={{
                  textAlign: "center",
                  color: "#475569",
                  fontWeight: 400,
                }}
              >
                We sent a 6-digit code to your email. Enter it to continue.
              </p>

              <input
                className="ui-input"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
              />

              <button className="ui-btn" type="submit">
                CONTINUE
              </button>

              {error && <p className="ui-error">{error}</p>}

              <p
                className="ui-smallText"
                style={{
                  marginTop: 10,
                  cursor: cooldown === 0 ? "pointer" : "not-allowed",
                  color: cooldown === 0 ? "#0f766e" : "#94a3b8",
                  fontWeight: 600,
                  textAlign: "center",
                }}
                onClick={cooldown === 0 ? handleResendMfa : undefined}
                onMouseEnter={(e) => {
                  if (cooldown === 0)
                    e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : "Resend code"}
              </p>

              <p
                className="ui-smallText"
                style={{ marginTop: 8, textAlign: "center", cursor: "pointer" }}
                onClick={() => {
                  setStep("login");
                  setMfaCode("");
                  setError("");
                }}
              >
                Back to Login
              </p>

              {error && (
                <p
                  className="ui-smallText"
                  style={{
                    marginTop: 6,
                    textAlign: "center",
                    color: "#64748b",
                    fontWeight: 400,
                    fontSize: 10,
                  }}
                >
                  Need help? Contact the SERVE+ administrator or try again in a
                  few minutes.
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Auth;
