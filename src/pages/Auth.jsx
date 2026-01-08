//Changed Login to Authorization page since it covers MFA as well.
//After logging in, MFA are placed for admin since it has sensitive role such
//as approving, publishing, issuing certificates, and other high impact actions. 

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import bbl_icon from "../assets/bbl_icon.svg";
import "../styles/ui.css";

function Auth() {
  const [email, setEmail] = useState("");
  const [mfaEmail, setMfaEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isDev = import.meta.env.DEV; //(Dev-only switch)
  //only developers can see detailed debug info while developing.

  const [step, setStep] = useState("login"); //"login" or "mfa"
  const [mfaCode, setMfaCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // ✅ 1. Firebase Authentication
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      console.log("Login successful, uid:", uid);

      // ✅ 2. Fetch user profile from Firestore
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User profile not found in database.");
        return;
      }

      const { role, status } = userSnap.data();

      if (status !== "active") {
        setError("Your account is blocked.");
        return;
      }

      // ✅ 3. CALL BACKEND TO CREATE AUDIT LOG
      try {
        console.log("Sending to logLogin:", { uid });
        const logLogin = httpsCallable(functions, "logLogin");
        const result = await logLogin({ uid });   // <-- THIS is what writes to auditLogs
        console.log("Audit log result:", result);
      } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
        // Don't block login if audit log fails
      }

      // ✅ 4. RBAC REDIRECTION using useNavigate to avoid reloading of the full app; redirecting only react router to certain page.
      if (role === "admin") {
        try {
          const signedInEmail = userCred.user.email;
          setMfaEmail(signedInEmail);
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
        //navigate("/admin/dashboard", { replace: true });
      } else if (role === "faculty") {
        navigate("/faculty/home", { replace: true });
      } else if (role === "partner") {
        navigate("/partner/home", { replace: true });
      } else {
        navigate("/student/home", { replace: true });
      }

    } catch (err) {
      if (isDev) console.error("Login error:", err);

      const code = err?.code || "";
      let userMsg = "Login failed. Please try again.";

      if (code === "auth/invalid-email") {
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

      //MFA success → now redirect admin
      navigate("/admin/dashboard", { replace: true });
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



  return (
    <>
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
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                className="ui-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button className="ui-btn" type="submit">
                SIGN IN
              </button>

              {error && <p className="ui-error">{error}</p>}


              <p className="ui-smallText">
                <Link to="/reset-password">Forgot Password?</Link>
              </p>

              <div className="divider">
                <span>Sign in with</span>
              </div>

              <button className="icon-btn" type="button" aria-label="Sign in with Blackboard">
                <img src={bbl_icon} alt="Blackboard" />
              </button>

              {error && (
                <p
                  className="ui-smallText"
                  style={{ marginTop: 6, textAlign: "center", color: "#64748b", fontWeight: 400, fontSize: 10 }}
                >
                  Need help? Contact the SERVE+ administrator or try again in a few minutes.
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
                style={{ textAlign: "center", color: "#475569", fontWeight: 400 }}
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
                  if (cooldown === 0) e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend code"}
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
                  style={{ marginTop: 6, textAlign: "center", color: "#64748b", fontWeight: 400, fontSize: 10 }}
                >
                  Need help? Contact the SERVE+ administrator or try again in a few minutes.
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
