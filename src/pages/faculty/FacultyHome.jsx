import { useNavigate } from "react-router-dom";

export default function FacultyHome() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    navigate("/auth");
  };

  return (
    <div>
      <h1>Faculty Dashboard</h1>
      <p>Welcome, Faculty.</p>

      {/*TEST LOGOUT BUTTON*/}
      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
