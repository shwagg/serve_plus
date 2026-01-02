import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { Link, useNavigate } from "react-router-dom";
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
      </div>
    </div>
  );
}

