import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import { SessionProvider, SessionContext } from "./context/SessionContext";
import { useContext } from "react";
import { useOverdueReflectionNotifications } from "./hooks/useOverdueReflectionNotifications";
import { useUpcomingEventNotifications } from "./hooks/useUpcomingEventNotifications";
import PrivacyPolicy from "./pages/global/agreement/PrivacyPolicy";
import TermsCondition from "./pages/global/agreement/TermsCondition";
import { ProtectedRoute } from "./router/ProtectedRoute";
import CertificateGenerator from "./components/certificateGenerator";

import "./App.css";
import ToastContainer from "./components/Toast";
import "./utils/toast";
import Auth from "./pages/Auth"; //changed login to authorization page
import ForgotPass from "./pages/ForgotPass";
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminLayout from "./pages/admin/AdminLayout";
import AgreementEditor from "./pages/admin/AgreementEditor";
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
import EventActivity from "./pages/student/missions/EventActivity";
import EventDetails from "./pages/student/missions/EventDetails";
import BadgeManage from "./pages/admin/BadgeManage";
import BadgeEarnedModal from "./components/badges/BadgeEarnedModal";
import { useBadgeEarnedPopup } from "./hooks/useBadgeEarnedPopup";
import Profile from "./pages/global/Profile";
import ProjectList from "./pages/global/ProjectList";
import ProposeProject from "./pages/global/ProposeProject";
import PublicProfile from "./pages/global/PublicProfile";
import ProjectProposal from "./pages/global/proposal/ProjectProposal";
import ReviewProposal from "./pages/global/proposal/ReviewProposal";
import Support from "./pages/global/menu/Support";
import PartnerHome from "./pages/partner/PartnerHome";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import StudentHome from "./pages/student/StudentHome";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";

/** Renders the badge earned popup; must live inside SessionProvider to access context */
function BadgePopupManager() {
  const { user } = useContext(SessionContext);
  const { badgeQueue, dismissBadge } = useBadgeEarnedPopup(user?.uid);
  return <BadgeEarnedModal badgeQueue={badgeQueue} onDismiss={dismissBadge} />;
}

function App() {
  // Check for upcoming events and create notifications
  useUpcomingEventNotifications();

  // Check for overdue reflections and create notifications
  useOverdueReflectionNotifications();

  return (
    <SessionProvider>
      <ToastContainer />
      <BadgePopupManager />
      <Router>
        <Routes>
                    <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
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
                                    <Route path="current-event" element={<CurrentEvent />} />
                                    <Route path="current-event/:missionId" element={<CurrentEvent />} />
                        <Route path="current-event/:missionId" element={<CurrentEvent />} />
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
            <Route path="support" element={<AdminSupport />} />
            <Route path="roster" element={<RosterAccountManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="backup-restore" element={<BackupRestore />} />
            <Route path="system/agreements" element={<AgreementEditor />} />
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
            <Route path="dashboard" element={<PartnerDashboard />} />
            <Route path="projects" element={<ProjectList mode="partner" />} />
          </Route>
          {/* Partner and Admin: Event Monitoring (Current Event) */}
          <Route
            path="/current-event/:missionId"
            element={
              <ProtectedRoute allowedRoles={["partner", "admin"]}>
                <CurrentEventMonitoring />
              </ProtectedRoute>
            }
          />
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
          <Route path="/global/menu/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/global/terms-condition" element={<TermsCondition />} />
          <Route path="/global/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/certificate-generator" element={<CertificateGenerator />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
