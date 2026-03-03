import "../../styles/partnerDashboard.css";
import { FaCalendarAlt, FaUserFriends, FaFileAlt, FaMapMarkerAlt, FaUsers } from "react-icons/fa";

const events = [
  {
    category: "Environmental",
    title: "Community Clean-Up Drive",
    date: "March 15, 2026 • 9:00 AM",
    location: "Central Park, Downtown",
    registered: 45,
    capacity: 60,
    percent: 75,
  },
  {
    category: "Education",
    title: "Youth Mentorship Workshop",
    date: "March 18, 2026 • 2:00 PM",
    location: "Community Center Hall",
    registered: 32,
    capacity: 40,
    percent: 80,
  },
  {
    category: "Social Services",
    title: "Food Distribution Event",
    date: "March 22, 2026 • 10:00 AM",
    location: "West Side Community Hub",
    registered: 58,
    capacity: 50,
    percent: 116,
  },
  {
    category: "Healthcare",
    title: "Senior Care & Wellness Fair",
    date: "March 25, 2026 • 1:00 PM",
    location: "Riverside Senior Center",
    registered: 28,
    capacity: 50,
    percent: 56,
  },
];

export default function PartnerDashboard() {
  return (
    <div className="partner-dashboard">
      <div className="dashboard-cards-row">
        <div className="dashboard-card">
          <FaCalendarAlt className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Upcoming Events</div>
            <div className="dashboard-card-value">4</div>
          </div>
        </div>
        <div className="dashboard-card">
          <FaUserFriends className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Active Volunteers</div>
            <div className="dashboard-card-value">5</div>
          </div>
        </div>
        <div className="dashboard-card">
          <FaFileAlt className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Pending Proposals</div>
            <div className="dashboard-card-value">1</div>
          </div>
        </div>
      </div>
      <h2 className="dashboard-section-title">Upcoming Community Engagement Events</h2>
      <div className="dashboard-events-grid">
        {events.map((event, idx) => (
          <div className="dashboard-event-card" key={idx}>
            <span className="dashboard-event-category">{event.category}</span>
            <div className="dashboard-event-title">{event.title}</div>
            <div className="dashboard-event-info">
              <div><FaCalendarAlt className="dashboard-event-icon" /> {event.date}</div>
              <div><FaMapMarkerAlt className="dashboard-event-icon" /> {event.location}</div>
              <div><FaUsers className="dashboard-event-icon" /> {event.registered} / {event.capacity} registered</div>
            </div>
            <div className="dashboard-event-progress-label">Registration</div>
            <div className="dashboard-event-progress-bar">
              <div
                className="dashboard-event-progress-bar-fill"
                style={{ width: `${event.percent}%`, background: event.percent > 100 ? '#f87171' : '#2563eb' }}
              ></div>
              <span className="dashboard-event-progress-bar-text">{event.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
