import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";


function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // check if account is locked before login attempt
    if (email) {
      try {
        const checkAttempts = httpsCallable(functions, "checkLoginAttempts");
        const checkResult = await checkAttempts({ email });
        
        if (!checkResult.data.allowed) {
          const lockTime = new Date(checkResult.data.lockUntil).toLocaleTimeString();
          setError(`Account is locked until ${lockTime} due to too many failed login attempts.`);
          return;
        }
      } catch (checkErr) {
        console.warn("Could not check login attempts:", checkErr);
      }
    }

    try {
      //  Firebase Authentication
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      console.log("Login successful, uid:", uid);

      // Fetch user profile from Firestore
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

      // CALL BACKEND TO CREATE AUDIT LOG
      try {
        console.log("Calling logLogin with uid:", uid);
        const logLogin = httpsCallable(functions, "logLogin");
        const result = await logLogin({ uid });   // <-- THIS is what writes to auditLogs
        console.log("Audit log result:", result);
      } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
        // Don't block login if audit log fails
      }

      // Reset login attempts on successful login
      try {
        const resetAttempts = httpsCallable(functions, "resetLoginAttempts");
        await resetAttempts({ email });
      } catch (resetErr) {
        console.warn("Reset login attempts failed:", resetErr);
      }

      // RBAC REDIRECTION using useNavigate to avoid reloading of the full app; redirecting only react router to certain page.
      if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (role === "faculty") {
        navigate("/faculty/home", { replace: true });
      } else if (role === "partner") {
        navigate("/partner/home", { replace: true });
      } else {
        navigate("/student/home", { replace: true });
      }

    } catch (err) {
      console.error("Login error:", err);
      console.log("Email value when recording failure:", email);
      
      // Record failed login attempt
      if (email) {
        try {
          const recordFailure = httpsCallable(functions, "recordLoginFailure");
          console.log("Calling recordLoginFailure with:", { email });
          const result = await recordFailure({ email });
          console.log("Failure recorded:", result.data);
          
          if (result.data.error) {
            setError(result.data.error);
          } else if (result.data.isLocked) {
            const lockTime = new Date(result.data.lockUntil).toLocaleTimeString();
            setError(`Too many failed attempts. Account locked until ${lockTime}.`);
          } else {
            setError(`Invalid email or password. (${result.data.attempts}/${result.data.maxAttempts} attempts)`);
          }
        } catch (recordErr) {
          console.error("Failed to record login failure:", recordErr);
          setError(recordErr.message || "Invalid email or password.");
        }
      } else {
        setError("Invalid email or password.");
      }
    }
  };


  return (
    <div className="ui-container">
      <div className="ui-card">
        <form className="ui-form" onSubmit={handleLogin}>
          <h2 className="ui-title">
            LOGIN <span className="ui-title-to">to</span> SERVE<span className="ui-title-plus">+</span>
          </h2>

          {/*Sign up option*/}
          <p className="ui-link">
            New to SERVE+?{" "}
            <Link to="/register">Sign up here</Link>
          </p>

          <input
            className="ui-input"
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="ui-input"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="ui-btn" type="submit">SIGN IN</button>

          {error && <p className="ui-error">{error}</p>}

          <p className="ui-smallText" ><Link to="/reset-password">Forgot Password?</Link></p>
        </form>
      </div>
    </div>
  );
}

export default Login;
