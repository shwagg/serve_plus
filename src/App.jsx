import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { useOverdueReflectionNotifications } from "./hooks/useOverdueReflectionNotifications";
import { useUpcomingEventNotifications } from "./hooks/useUpcomingEventNotifications";
import PrivacyPolicy from "./pages/global/agreement/PrivacyPolicy";
import TermsCondition from "./pages/global/agreement/TermsCondition";
import { ProtectedRoute } from "./router/ProtectedRoute";

import "./App.css";
import Auth from "./pages/Auth"; //changed login to authorization page
import ForgotPass from "./pages/ForgotPass";
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLayout from "./pages/admin/AdminLayout";
import AuditLogs from "./pages/admin/AuditLogs";
import BackupRestore from "./pages/admin/BackupRestore";
import CurrentEvent from "./pages/admin/CurrentEvent";
import CurrentEventMonitoring from "./pages/admin/CurrentEventMonitoring";
import DocumentLibrary from "./pages/admin/DocumentLibrary";
import ProjectDetails from "./pages/admin/ProjectDetails";
import ProjectTasks from "./pages/admin/ProjectTasks";
import RosterAccountManagement from "./pages/admin/RosterAccountManagement";
import FacultyHome from "./pages/faculty/FacultyHome";
import Chat from "./pages/global/Chat";
import CommunityFeedbackForm from "./pages/global/CommunityFeedbackForm";
import EventDetails from "./pages/student/missions/EventDetails";
import EventActivity from "./pages/student/missions/EventActivity";
import BadgeManage from "./pages/admin/BadgeManage";
import Profile from "./pages/global/Profile";
import ProjectList from "./pages/global/ProjectList";
import ProposeProject from "./pages/global/ProposeProject";
import PublicProfile from "./pages/global/PublicProfile";
import ProjectProposal from "./pages/global/proposal/ProjectProposal";
import ReviewProposal from "./pages/global/proposal/ReviewProposal";
import PartnerHome from "./pages/partner/PartnerHome";
import StudentHome from "./pages/student/StudentHome";
import EventActivity from "./pages/student/missions/EventActivity";
import EventDetails from "./pages/student/missions/EventDetails";

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
            <Route
              path="events/:eventId"
              element={<CurrentEventMonitoring />}
            />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/proposal" element={<ProposeProject />} />
            <Route
              path="projects/:projectId"
              element={<ProjectDetails mode="admin" />}
            />
            <Route
              path="projects/:projectId/tasks"
              element={<ProjectTasks />}
            />
            <Route path="roster" element={<RosterAccountManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="current-event/:missionId?" element={<CurrentEvent />} />
            <Route path="system/badges" element={<BadgeManage />} />
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
          <Route
            path="global/feedback/:missionId"
            element={<CommunityFeedbackForm />}
          />
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

          {/* Partner Routes */}
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
          <Route path="/event/:id" element={<EventDetails />} />
          <Route path="/event/:id/activity" element={<EventActivity />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:uid"
            element={
              <ProtectedRoute>
                <PublicProfile />
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
          <Route path="/global/terms-condition" element={<TermsCondition />} />
          <Route path="/global/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
