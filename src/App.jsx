import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { ProtectedRoute } from "./router/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPass from "./pages/ForgotPass";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentHome from "./pages/student/StudentHome";
import FacultyHome from "./pages/faculty/FacultyHome";
import PartnerHome from "./pages/partner/PartnerHome";
import "./App.css";

function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ForgotPass />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/home"
            element={
              <ProtectedRoute>
                <StudentHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/home"
            element={
              <ProtectedRoute>
                <FacultyHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/home"
            element={
              <ProtectedRoute>
                <PartnerHome />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
