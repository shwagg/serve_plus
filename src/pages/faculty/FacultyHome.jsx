import { useNavigate } from "react-router-dom";
import Header from "../../components/Header.jsx";

export default function FacultyHome() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    navigate("/auth");
  };

  return (
    <>
    <Header />
    <div>
      <h1>Faculty Dashboard</h1>
      <p>Welcome, Faculty.</p>

      {/*TEST LOGOUT BUTTON*/}
      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
    </>
  );
}
