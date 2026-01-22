import React from "react";
import Header from "../../components/Header";
import "../../styles/ui.css";
import "../../App.css";
import "../../index.css";
import "../../styles/Profile.css";

const dummyProfile = {
  name: "Joshua Garcia",
  role: "Volunteer",
  skills: [
    "Photo/Video Editing",
    "Graphic Design",
    "Event Coordination",
    "Seedling Propagation",
    "Coastal/River Cleanup"
  ],
  interests: [
    "Public Speaking/Facilitation",
    "Report Writing",
    "Curriculum Planning",
    "Livelihood Programs"
  ],
  achievements: [
    {
      name: "Education Hero",
      img: "/eventassets/badge-education-hero.png"
    }
  ],
  level: 5,
  points: 150,
  nextLevelPoints: 500,
  currentEvents: [
    "Laguna Lake Watershed Reforestation & River Cleanup Drive"
  ],
  completedEvents: [
    '"Bayan Ko, Titser Ko" Literacy & Tutorial Program'
  ]
};

export default function Profile() {
  return (
    <div className="profile-page-bg">
      <Header />
      <div className="profile-main-flex">
        {/* Left Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="28" r="20" fill="#38b2ac"/><ellipse cx="40" cy="62" rx="28" ry="16" fill="#38b2ac"/></svg>
          </div>
          <h2 style={{ margin: 0 }}>{dummyProfile.name}</h2>
          <div style={{ fontWeight: 500, opacity: 0.9, marginBottom: 16 }}>{dummyProfile.role}</div>
          <div className="profile-skills">
            <div className="profile-skills-label">Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dummyProfile.skills.map(skill => (
                <span key={skill} className="profile-skill-badge">{skill}</span>
              ))}
            </div>
          </div>
          <div className="profile-interests">
            <div className="profile-interests-label">Interest</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dummyProfile.interests.map(interest => (
                <span key={interest} className="profile-interest-badge">{interest}</span>
              ))}
            </div>
          </div>
          <div className="profile-achievements">
            <div className="profile-achievements-label">Achievements</div>
            <div className="profile-achievements-list">
              {dummyProfile.achievements.map(a => (
                <div key={a.name} className="profile-badge">
                  <img src={a.img} alt={a.name} style={{ width: 48, height: 48 }} />
                </div>
              ))}
              <a href="#" style={{ color: "#fff", textDecoration: "underline", fontSize: 14 }}>View Badges</a>
            </div>
          </div>
          <button className="profile-edit-btn">Edit Profile</button>
        </div>
        {/* Right Event History Card */}
        <div className="profile-event-history-card">
          <div style={{ marginBottom: 16 }}>
            <div className="profile-level-label">Level {dummyProfile.level}</div>
            <div className="profile-level-bar-container">
              <div className="profile-level-bar-bg">
                <div className="profile-level-bar-fill" style={{ width: `${(dummyProfile.points / dummyProfile.nextLevelPoints) * 100}%` }}></div>
                <div className="profile-level-bar-label">
                  {dummyProfile.points} / {dummyProfile.nextLevelPoints}
                </div>
              </div>
              <button className="profile-earn-btn">Earn more points!</button>
            </div>
          </div>
          <div className="profile-event-history-box">
            <div className="profile-event-history-title">Event History</div>
            <div className="profile-event-section-label">Current Events</div>
            {dummyProfile.currentEvents.length === 0 ? (
              <div style={{ color: "#888", marginBottom: 16 }}>No current events.</div>
            ) : (
              dummyProfile.currentEvents.map(ev => (
                <div key={ev} className="profile-event-item">
                  <span className="profile-event-item-label">
                    <span style={{ marginRight: 8, verticalAlign: "middle" }}>
                      <svg width="18" height="18" fill="none"><rect width="18" height="18" rx="4" fill="#6bbf3c"/><path d="M6 9.5l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {ev}
                  </span>
                  <span className="profile-event-item-dots">•••</span>
                </div>
              ))
            )}
            <div className="profile-event-section-label" style={{ margin: "16px 0 8px" }}>Completed Events</div>
            {dummyProfile.completedEvents.length === 0 ? (
              <div style={{ color: "#888" }}>No completed events.</div>
            ) : (
              dummyProfile.completedEvents.map(ev => (
                <div key={ev} className="profile-event-item">
                  <span className="profile-event-item-label">
                    <span style={{ marginRight: 8, verticalAlign: "middle" }}>
                      <svg width="18" height="18" fill="none"><rect width="18" height="18" rx="4" fill="#6bbf3c"/><path d="M6 9.5l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    {ev}
                  </span>
                  <span className="profile-event-item-dots">•••</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
