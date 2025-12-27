import { useSession } from "../../context/SessionContext";
import { useState } from "react";

export default function StudentHome() {
  const { logout } = useSession();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await logout();
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "2rem" }}>
      <h1>Student Dashboard</h1>
      <p>Welcome, Student.</p>
      <button
        onClick={handleLogout}
        disabled={loading}
        style={{
          marginTop: "2rem",
          padding: "0.75rem 2rem",
          fontSize: "1.1rem",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}
      >
        {loading ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
