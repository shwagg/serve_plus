import { useNavigate } from "react-router-dom";

export default function PartnerHome() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    navigate("/auth");
  };

  return (
    <div>
      <h1>Partner Dashboard</h1>
      <p>Welcome, Partner.</p>

      {/*TEST LOGOUT BUTTON*/}
      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
