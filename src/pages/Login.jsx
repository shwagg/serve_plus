import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Login.css";


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
      const logLogin = httpsCallable(functions, "logLogin");
      await logLogin();   // <-- THIS is what writes to auditLogs

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
    <div className="login-container">
      <div className="login-card">
        <form className="login-form" onSubmit={handleLogin}>
          <h2 className="login-title">LOGIN to SERVE+</h2>

          {/*Sign up option*/}
          <p className="login-signup">
            New to SERVE+?{" "}
            <Link to="/register">Sign up here</Link>
          </p>

          <input
            className="login-input"
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="login-input"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="login-btn" type="submit">SIGN IN</button>

          {error && <p className="login-error" style={{ color: "red" }}>{error}</p>}

          <p className="login-smallText" >Forgot Password?</p>
        </form>
      </div>
    </div>
  );
}

export default Login;
