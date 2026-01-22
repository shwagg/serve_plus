import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminLayout from "../pages/admin/AdminLayout";
import AuditLogs from "../pages/admin/AuditLogs";
import ProjectDetails from "../pages/admin/ProjectDetails";
import ProjectTasks from "../pages/admin/ProjectTasks";
import CreateProject from "../pages/global/CreateProject";
import ProjectList from "../pages/global/ProjectList";
import ProjectProposal from "../pages/global/proposal/ProjectProposal";
import StudentHome from "../pages/student/StudentHome";
import EventActivity from "../pages/student/missions/EventActivity";
import EventDetails from "../pages/student/missions/EventDetails";
import Profile from "../pages/global/Profile";
import { ProtectedRoute } from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* Student and event routes */}
        <Route path="/student" element={<StudentHome />} />
        <Route path="/event/:id" element={<EventDetails />} />
        <Route path="/event/:id/activity" element={<EventActivity />} />
        <Route path="/profile" element={<Profile />} />

        {/* Global routes */}
        <Route path="/global/project-proposal" element={<ProjectProposal />} />

        {/* Admin routes with sidebar layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<CreateProject />} />
          <Route path="projects/:projectId" element={<ProjectDetails />} />
          <Route path="projects/:projectId/tasks" element={<ProjectTasks />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </Router>
  );
}