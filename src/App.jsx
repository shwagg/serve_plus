import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { useUpcomingEventNotifications } from "./hooks/useUpcomingEventNotifications";
import { useOverdueReflectionNotifications } from "./hooks/useOverdueReflectionNotifications";

import Auth from "./pages/Auth"; //changed login to authorization page
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import ForgotPass from "./pages/ForgotPass";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DocumentLibrary from "./pages/admin/DocumentLibrary";
import CurrentEventMonitoring from "./pages/admin/CurrentEventMonitoring";
import ProjectList from "./pages/global/ProjectList";
import ProjectProposal from "./pages/global/proposal/ProjectProposal";
import ReviewProposal from "./pages/global/proposal/ReviewProposal";
import ProjectDetails from "./pages/admin/ProjectDetails";
import ProjectTasks from "./pages/admin/ProjectTasks";
import CurrentEvent from "./pages/admin/CurrentEvent";
import AuditLogs from "./pages/admin/AuditLogs";
import RosterAccountManagement from "./pages/admin/RosterAccountManagement";
import StudentHome from "./pages/student/StudentHome";
import ProposeProject from "./pages/global/ProposeProject";
import FacultyHome from "./pages/faculty/FacultyHome";
import PartnerHome from "./pages/partner/PartnerHome";
import EventDetails from "./pages/student/missions/EventDetails";
import EventActivity from "./pages/student/missions/EventActivity";
import Profile from "./pages/global/Profile";
import Chat from "./pages/global/Chat";
import "./App.css";

function App() {
  // Check for upcoming events and create notifications
  useUpcomingEventNotifications();

  // Check for overdue reflections and create notifications
  useOverdueReflectionNotifications();

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
            <Route path="documents" element={<DocumentLibrary />} />
            <Route path="events/:eventId" element={<CurrentEventMonitoring />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/proposal" element={<ProposeProject />} />
            <Route path="projects/:projectId" element={<ProjectDetails mode="admin" />} />
            <Route path="projects/:projectId/tasks" element={<ProjectTasks />} />
            <Route path="roster" element={<RosterAccountManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="current-event/:missionId?" element={<CurrentEvent />} />
          </Route>

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
          <Route
            path="/global/review-proposals"
            element={
              <ProtectedRoute allowedRoles={["faculty", "admin", "partner"]}>
                <ReviewProposal />
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
            path="/faculty"
            element={
              <ProtectedRoute allowedRoles={["faculty"]}>
                <FacultyHome />
              </ProtectedRoute>
            }
          >
            <Route path="projects" element={<ProjectList mode="faculty" />} />
          </Route>

          <Route
            path="/partner"
            element={
              <ProtectedRoute allowedRoles={["partner"]}>
                <PartnerHome />
              </ProtectedRoute>
            }
          >
            <Route path="projects" element={<ProjectList mode="partner" />} />
          </Route>
          <Route
            path="/event/:id"
            element={<EventDetails />}
          />
          <Route
            path="/event/:id/activity"
            element={<EventActivity />}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:missionId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </SessionProvider >
  );
}

export default App;
