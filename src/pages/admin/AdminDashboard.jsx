//first page for admin after login
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import "../../styles/AdminDashboard.css"

export default function AdminDashboard() {
  const navigate = useNavigate();
  const engagement = [
    { label: "Senior Citizen Care Day", value: 95 },
    { label: "Laguna Lake Cleanup", value: 90 },
    { label: "Disaster Prep Workshop", value: 78 },
    { label: "Community Youth Seminar", value: 65 },
    { label: "Financial Literacy Clinic", value: 55 },
  ];

  // Later: fill these from Firestore (filter by date/status)
  const eventsToday = [];
  const upcomingEvents = [];

  return (
    <div className="admin-dashboard">
      <h1 className="page-title">Dashboard</h1>
      <div className="dashboard-grid">
        {/* LEFT column cards */}
        <section className="left-col">
          <div className="panel">
            <div className="panel-header panel-header-analytics">
              <span>Students Engagement</span>
            </div>

            <div className="panel-body">
              <div className="bar-list">
                {engagement.map((x) => (
                  <div className="bar-row" key={x.label}>
                    <div className="bar-label">{x.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${x.value}%` }} />
                      <div className="bar-value">{x.value}%</div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="card-note">*Sample only for demo. Replace with real metrics later.</p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header panel-header-analytics">
              <span>Satisfaction Ratings</span>
            </div>

            <div className="panel-body">
              <div className="ratings">
                <div className="rating-row">
                  <span>Volunteer Satisfaction</span>
                  <strong>—</strong>
                </div>
                <div className="rating-row">
                  <span>Faculty/SI Satisfaction</span>
                  <strong>—</strong>
                </div>
                <div className="rating-row">
                  <span>Community Partner Feedback</span>
                  <strong>—</strong>
                </div>
              </div>

              <p className="card-note">*Leave blank for now. You can compute later from surveys.</p>
            </div>
          </div>
        </section>

        {/* RIGHT column panels */}
        <section className="right-col">
          {/* Events Today */}
          <div className="panel">
            <div className="panel-header">
              <span>Events Today</span>
              <button className="panel-link" type="button"
                onClick={() => navigate("/admin/projects")}
              >
                View all Events
              </button>
            </div>

            <div className="panel-body">
              {eventsToday.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No events today yet</p>
                  <p className="empty-desc">
                    Once you create projects/events (with today’s date + active status),
                    they will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="event-grid">
                  {eventsToday.map((e) => (
                    <div className="event-card" key={e.id}>
                      <div className="event-title">{e.title}</div>
                      <div className="event-footer">
                        <span className="event-date">{e.date}</span>
                        <button className="event-details" type="button">
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="panel">
            <div className="panel-header panel-header-accent">
              <span>Upcoming Events</span>
            </div>

            <div className="panel-body">
              {upcomingEvents.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No upcoming events yet</p>
                  <p className="empty-desc">
                    Future-dated projects will be listed here once added.
                  </p>
                </div>
              ) : (
                <div className="event-grid">
                  {upcomingEvents.map((e) => (
                    <div className="event-card" key={e.id}>
                      <div className="event-title">{e.title}</div>
                      <div className="event-footer">
                        <span className="event-date">{e.date}</span>
                        <button className="event-details" type="button">
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}



