import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StudentHome from '../pages/student/StudentHome';
import EventDetails from '../pages/student/missions/EventDetails';
import EventActivity from '../pages/student/missions/EventActivity';

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/student" element={<StudentHome />} />
        <Route path="/event/:id" element={<EventDetails />} />
        <Route path="/event/:id/activity" element={<EventActivity />} />
        {/* ...other routes... */}
      </Routes>
    </Router>
  );
}