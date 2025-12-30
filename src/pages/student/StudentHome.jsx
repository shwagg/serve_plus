import { Link } from "react-router-dom";

export default function StudentHome() {
  return (
    <div>
      <h1>Student Dashboard</h1>
      <p>Welcome, Student.</p>
      <p>
        <Link to="/student/propose-project" style={{ color: "blue", textDecoration: "underline", cursor: "pointer" }}>
          Propose a project
        </Link>
      </p>
    </div>
  );
}
