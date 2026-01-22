import React, { useContext } from "react";
import { SessionContext } from "../../context/SessionContext.jsx";
import Header from "../../components/Header.jsx";
import "../../styles/Profile.css";

const mockProfile = {
  name: "Jane Doe",
  email: "jane.doe@example.com",
  avatar: "https://ui-avatars.com/api/?name=Jane+Doe&background=30bdb7&color=fff&size=120",
  level: 7,
  levelProgress: 65,
  skills: ["React", "Firebase", "UI/UX"],
  interests: ["Design", "Coding", "Music"],
  achievements: ["Top Student", "Hackathon Winner"],
};

const mockEvents = [
  { label: "Logged in", date: "2024-06-01" },
  { label: "Joined Event: UI Workshop", date: "2024-05-28" },
  { label: "Completed Mission: Design Sprint", date: "2024-05-20" },
  { label: "Logged out", date: "2024-05-19" },
];

export default function Profile() {
  const { user } = useContext(SessionContext);
  const profile = user ? {
    ...mockProfile,
    name: user.displayName || mockProfile.name,
    email: user.email || mockProfile.email,
    avatar: user.photoURL || mockProfile.avatar,
  } : mockProfile;

  return (
    <div className="profile-page-bg">
      <Header />
      <div className="profile-main-flex">
        <div className="profile-card">
          <div className="profile-avatar">
            <img src={profile.avatar} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
          </div>
          <h2 style={{ color: "#234e7b", fontWeight: 700, fontSize: 28, marginBottom: 8 }}>{profile.name}</h2>
          <div style={{ color: "#555", fontSize: 16, marginBottom: 18 }}>{profile.email}</div>
          <div className="profile-level-label">Level {profile.level}</div>
          <div style={{ width: "100%", margin: "16px 0" }}>
            <div className="profile-level-bar-bg">
              <div className="profile-level-bar-fill" style={{ width: `${profile.levelProgress}%` }}></div>
              <div className="profile-level-bar-label">{profile.levelProgress}%</div>
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-skills-label" style={{ fontWeight: 600, marginBottom: 6 }}>Skills</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.skills.map(skill => (
                <span className="profile-skill-badge" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-interests-label" style={{ fontWeight: 600, marginBottom: 6 }}>Interests</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.interests.map(interest => (
                <span className="profile-interest-badge" key={interest}>{interest}</span>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-achievements-label" style={{ fontWeight: 600, marginBottom: 6 }}>Achievements</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.achievements.map(ach => (
                <span className="profile-badge" key={ach} title={ach}>
                  <span style={{ color: "#234e7b", fontWeight: 700, fontSize: 18 }}>{ach[0]}</span>
                </span>
              ))}
            </div>
          </div>
          <button className="profile-edit-btn">Edit Profile</button>
        </div>
        <div className="profile-event-history-card">
          <div className="profile-event-history-title">Event History</div>
          {mockEvents.map((event, idx) => (
            <div className="profile-event-item" key={idx}>
              <span className="profile-event-item-label">{event.label}</span>
              <span style={{ color: "#555", fontSize: 14 }}>{event.date}</span>
              <span className="profile-event-item-dots">•••</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
