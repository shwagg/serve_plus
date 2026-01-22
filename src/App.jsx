import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { ProtectedRoute } from "./router/ProtectedRoute";

import Auth from "./pages/Auth"; //changed login to authorization page
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import ForgotPass from "./pages/ForgotPass";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CurrentEventMonitoring from "./pages/admin/CurrentEventMonitoring";
import ProjectList from "./pages/global/ProjectList";
import CreateProject from "./pages/global/CreateProject";
import ProjectProposal from "./pages/global/proposal/ProjectProposal";
import ProjectDetails from "./pages/admin/ProjectDetails";
import ProjectTasks from "./pages/admin/ProjectTasks";
import AuditLogs from "./pages/admin/AuditLogs";
import StudentHome from "./pages/student/StudentHome";
//import ProposeProject from "./pages/global/ProposeProject";
import FacultyHome from "./pages/faculty/FacultyHome";
import PartnerHome from "./pages/partner/PartnerHome";
import EventDetails from "./pages/student/missions/EventDetails";
import EventActivity from "./pages/student/missions/EventActivity";
import "./App.css";

function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="/reset-password" element={<ForgotPass />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="events/:eventId" element={<CurrentEventMonitoring />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/new" element={<CreateProject />} />
            <Route path="projects/:projectId" element={<ProjectDetails />} />
            <Route path="projects/:projectId/tasks" element={<ProjectTasks />} />
          </Route>

          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/home"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/global/project-proposal"
            element={
              <ProtectedRoute allowedRoles={["student", "faculty", "admin"]}>
                <ProjectProposal />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="/student/propose-project"
            element={
              <ProtectedRoute>
                <ProposeProject />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="/faculty/home"
            element={
              <ProtectedRoute allowedRoles={["faculty"]}>
                <FacultyHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partner/home"
            element={
              <ProtectedRoute allowedRoles={["partner"]}>
                <PartnerHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/:id"
            element={<EventDetails />}
          />
          <Route
            path="/event/:id/activity"
            element={<EventActivity />}
          />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
