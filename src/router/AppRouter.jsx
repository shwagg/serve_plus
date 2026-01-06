
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StudentHome from '../pages/student/StudentHome';
import ProposeProject from '../pages/student/ProposeProject';
import EventDetails from '../pages/student/missions/EventDetails';
import EventActivity from '../pages/student/missions/EventActivity';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import ProjectList from '../pages/global/ProjectList';
import CreateProject from '../pages/global/CreateProject';
import AuditLogs from '../pages/admin/AuditLogs';

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* Student and event routes */}
        <Route path="/student" element={<StudentHome />} />
        <Route path="/event/:id" element={<EventDetails />} />
        <Route path="/event/:id/activity" element={<EventActivity />} />

        {/* Admin routes with sidebar layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<CreateProject />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </Router>
  );
}