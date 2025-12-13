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
      <form onSubmit={handleLogin}>
        <h2>Login</h2>

        <input
          type="email"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Sign In</button>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {/*Sign up option*/}
        <p style={{ marginTop: "10px" }}>
          No account yet?{" "}
          <Link to="/register">Sign up here</Link>
        </p>

      </form>
    </div>
  );
}

export default Login;
