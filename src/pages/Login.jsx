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
        console.log("Calling logLogin with uid:", uid);
        const logLogin = httpsCallable(functions, "logLogin");
        const result = await logLogin({ uid });   // <-- THIS is what writes to auditLogs
        console.log("Audit log result:", result);
      } catch (auditErr) {
        console.warn("Audit log failed:", auditErr);
        // Don't block login if audit log fails
      }

      // ✅ 4. RBAC REDIRECTION using useNavigate to avoid reloading of the full app; redirecting only react router to certain page.
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
      console.error(err);
      setError("Invalid email or password.");
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
