import { Route, BrowserRouter as Router, Routes, Navigate } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import LoadingOverlay from "../components/LoadingOverlay";

// Eagerly loaded (main entry points)
import AdminLayout from "../pages/admin/AdminLayout";

// Lazy-loaded student pages
const StudentHome = lazy(() => import("../pages/student/StudentHome"));
const EventActivity = lazy(() => import("../pages/student/missions/EventActivity"));
const EventDetails = lazy(() => import("../pages/student/missions/EventDetails"));

// Lazy-loaded admin pages
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminProjects = lazy(() => import("../pages/admin/AdminProjects"));
const AgreementEditor = lazy(() => import("../pages/admin/AgreementEditor"));
const AuditLogs = lazy(() => import("../pages/admin/AuditLogs"));
const BackupRestore = lazy(() => import("../pages/admin/BackupRestore"));
const CurrentEvent = lazy(() => import("../pages/admin/CurrentEvent"));
const ProjectTasks = lazy(() => import("../pages/admin/ProjectTasks"));
const RosterAccountManagement = lazy(() => import("../pages/admin/RosterAccountManagement"));

// Lazy-loaded global pages
const CreateProject = lazy(() => import("../pages/global/CreateProject"));
const Profile = lazy(() => import("../pages/global/Profile"));
const ProjectList = lazy(() => import("../pages/global/ProjectList"));
const PublicProfile = lazy(() => import("../pages/global/PublicProfile"));
const ViewProposals = lazy(() => import("../pages/global/ViewProposals"));
const ProjectProposal = lazy(() => import("../pages/global/proposal/ProjectProposal"));


export default function AppRouter() {
  return (
    <Router>
      <Suspense fallback={<LoadingOverlay />}>
        <Routes>
        {/* Student and event routes */}
        <Route path="/student" element={<StudentHome />} />
        <Route path="/event/:id" element={<EventDetails />} />
        <Route path="/event/:id/activity" element={<EventActivity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:uid" element={<PublicProfile />} />

        {/* Global routes */}
        <Route path="/global/project-proposal" element={<ProjectProposal />} />
        <Route path="/global/review-proposals" element={<ViewProposals />} />

        {/* Admin routes with sidebar layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/new" element={<CreateProject />} />
          <Route path="projects/:projectId" element={<Navigate to="/admin/projects" replace />} />
          <Route path="projects/:projectId/tasks" element={<ProjectTasks />} />
          <Route path="current-event" element={<CurrentEvent />} />
          <Route path="current-event/:missionId" element={<CurrentEvent />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="backup-restore" element={<BackupRestore />} />
          <Route path="system/agreements" element={<AgreementEditor />} />
          <Route path="roster" element={<RosterAccountManagement />} />
        </Route>
      </Routes>
      </Suspense>
    </Router>
  );
}
