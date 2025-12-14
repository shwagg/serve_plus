import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentHome from "./pages/student/StudentHome";
import "./App.css";

function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
