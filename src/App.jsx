import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
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
import LandingPage from "./pages/LandingPage";
import ForgotPass from "./pages/ForgotPass";
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import MfaSetup from "./pages/MfaSetup";
import MfaVerify from "./pages/MfaVerify";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminLayout from "./pages/admin/AdminLayout";
import SysAdminLayout from "./pages/sysadmin/SysAdminLayout";
import AgreementEditor from "./pages/admin/AgreementEditor";
import AuditLogs from "./pages/admin/AuditLogs";
import BackupRestore from "./pages/admin/BackupRestore";
import CurrentEvent from "./pages/admin/CurrentEvent";
import ProjectTasks from "./pages/admin/ProjectTasks";
import RosterAccountManagement from "./pages/admin/RosterAccountManagement";
import CommunityChairDashboard from "./pages/faculty/CommunityChairDashboard";
import FacultyHome from "./pages/faculty/FacultyHome";
import FacultyCourses from "./pages/faculty/FacultyCourses";
import Chat from "./pages/global/Chat";
import CommunityFeedbackForm from "./pages/global/CommunityFeedbackForm";
import EventActivity from "./pages/student/missions/EventActivity";
import EventDetails from "./pages/student/missions/EventDetails";
import BadgeManage from "./pages/admin/BadgeManage";
import AnnouncementsManager from "./pages/admin/AnnouncementsManager";
import PartnerHub from "./pages/admin/PartnerHub";
import BadgeEarnedModal from "./components/badges/BadgeEarnedModal";
import { useBadgeEarnedPopup } from "./hooks/useBadgeEarnedPopup";
import CertEarnedModal from "./components/CertEarnedModal";
import { useCertEarnedPopup } from "./hooks/useCertEarnedPopup";
import Profile from "./pages/global/Profile";
import ProjectList from "./pages/global/ProjectList";
import ProposeProject from "./pages/global/ProposeProject";
import PublicProfile from "./pages/global/PublicProfile";
import ProjectProposal from "./pages/global/proposal/ProjectProposal";
import ReviewProposal from "./pages/global/proposal/ReviewProposal";
import MyProposals from "./pages/global/MyProposals";
import AdminProjects from "./pages/admin/AdminProjects";
import Support from "./pages/global/menu/Support";
import PartnerHome from "./pages/partner/PartnerHome";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import StudentHome from "./pages/student/StudentHome";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";

/** Renders the badge earned popup; subscribes to Firebase Auth state for the UID */
function BadgePopupManager() {
  const [uid, setUid] = useState(null);
  const location = useLocation();
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);
  const { badgeQueue, dismissBadge } = useBadgeEarnedPopup(uid);

  const shouldShowBadgePopup = location.pathname === "/student/home";
  if (!shouldShowBadgePopup) return null;

  return <BadgeEarnedModal badgeQueue={badgeQueue} onDismiss={dismissBadge} />;
}

function CertPopupManager() {
  const [uid, setUid] = useState(null);
  const location = useLocation();
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
  }, []);
  const { certQueue, dismissCert } = useCertEarnedPopup(uid);

  const shouldShowCertPopup = location.pathname === "/student/home";
  if (!shouldShowCertPopup) return null;

  return <CertEarnedModal certQueue={certQueue} onDismiss={dismissCert} />;
}

function App() {
  // Check for upcoming events and create notifications
  useUpcomingEventNotifications();

  // Check for overdue task photo proofs and create notifications
  useOverdueReflectionNotifications();

  return (
    <SessionProvider>
      <ToastContainer />
      <Router>
        <BadgePopupManager />
        <CertPopupManager />
        <Routes>
          <Route path="/" element={<LandingPage />} />
                    <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/blackboard/complete" element={<OAuthCallback />} />
          <Route path="/auth/mfa/setup" element={<MfaSetup />} />
          <Route path="/auth/mfa/verify" element={<MfaVerify />} />
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
            <Route
              path="events/:eventId"
            />
            <Route path="projects" element={<Navigate to="/admin/review-proposals" replace />} />
            <Route path="projects/proposal" element={<ProposeProject />} />
            <Route
              path="projects/:projectId"
              element={<Navigate to="/admin/projects" replace />}
            />
            <Route
              path="projects/:projectId/tasks"
              element={<ProjectTasks />}
            />
            <Route path="support" element={<AdminSupport />} />
            <Route path="roster" element={<RosterAccountManagement readOnly />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="system/agreements" element={<AgreementEditor />} />
            <Route path="system/badges" element={<BadgeManage />} />
            <Route path="system/announcements" element={<AnnouncementsManager />} />
            <Route path="events/partners" element={<PartnerHub />} />
            <Route path="review-proposals" element={<AdminProjects />} />
          </Route>

          {/* System Admin Routes */}
          <Route
            path="/sysadmin"
            element={
              <ProtectedRoute allowedRoles={["sysadmin"]}>
                <SysAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="roster" element={<RosterAccountManagement />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="system/agreements" element={<AgreementEditor />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="backup-restore" element={<BackupRestore />} />
          </Route>

          <Route
            path="/student/home"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentHome />
              </ProtectedRoute>
            }
          />
          <Route path="/student" element={<Navigate to="/student/home" replace />} />
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
            <Route path="dashboard" element={<CommunityChairDashboard />} />
            <Route path="courses" element={<FacultyCourses />} />
            <Route path="projects" element={<ProjectList mode="faculty" />} />
            <Route path="my-proposals" element={<MyProposals />} />
            <Route path="review-proposals" element={<ReviewProposal />} />
            <Route path="current-event" element={<CurrentEvent />} />
            <Route path="current-event/:missionId" element={<CurrentEvent />} />
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
                <CurrentEvent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/:id"
            element={
              <ProtectedRoute>
                <EventDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/event/:id/activity"
            element={
              <ProtectedRoute>
                <EventActivity />
              </ProtectedRoute>
            }
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
          <Route
            path="/certificate-generator"
            element={
              <ProtectedRoute allowedRoles={["admin", "sysadmin"]}>
                <CertificateGenerator />
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
