import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig"; // adjust path if needed
import { useNavigate } from "react-router-dom";


import { Link } from "react-router-dom";
import { useSession } from "../../context/SessionContext";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const { logout } = useSession();
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, Admin.</p>

      {/*TEST LOGOUT BUTTON*/}
      <button onClick={handleLogout}>
        Logout
      </button>
      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <Link to="/admin/audit-logs" className="ui-link">View Audit Logs</Link>
        <button onClick={logout} className="ui-link" style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "5px", padding: "0.5rem 1.2rem", cursor: "pointer" }}>Logout</button>
      </div>
    </div>
  );
}

