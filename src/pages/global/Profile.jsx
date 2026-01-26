import React, { useContext, useEffect, useState } from "react";
// Simple modal component
function EditProfileModal({ open, onClose, profile, onConfirm }) {
  const softSkills = [
    "Teamwork", "Communication", "Problem Solving", "Leadership", "Time Management", 
    "Adaptability", "Conflict Resolution", "Empathy", "Critical Thinking", "Responsibility"
  ];
  const technicalSkills = [
    "Data Analysis", "Coding/Programming", "Web Design", "Social Media Management", 
    "Digital Literacy", "Spreadsheet Skills", "Presentation Software", "Video Editing", 
    "IT Troubleshooting", "Database Management"
  ];
  const specializedSkills = [
    "Project Planning", "Grant Writing", "Event Coordination", "Research Methods", 
    "Survey Design", "Workshop Facilitation", "Community Assessment", "Policy Analysis", 
    "Report Writing", "Monitoring & Evaluation"
  ];
  const presetInterests = ["Design", "Coding", "Music", "Art", "Sports", "Reading", "Travel", "Gaming", "Science", "Technology"];
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [username, setUsername] = useState(profile.username || "");
  const [skills, setSkills] = useState(profile.skills || []);
  const [interests, setInterests] = useState(profile.interests || []);

  // Reset state when modal opens or profile changes
  useEffect(() => {
    if (open) {
      setAvatar(profile.avatar || "");
      setName(profile.name || "");
      setEmail(profile.email || "");
      setUsername(profile.username || "");
      setSkills(profile.skills || []);
      setInterests(profile.interests || []);
    }
  }, [open, profile]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!open) return null;
  return (
    <div className="profile-modal-bg">
      <div className="profile-modal-card">
        <h2 className="profile-modal-title">Edit Profile</h2>
        <div className="profile-modal-fields">
          <div className="profile-modal-avatar-box">
            <div className="profile-modal-avatar-wrapper">
              <img src={avatar} alt="avatar" className="profile-modal-avatar" />
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="avatar-upload"
              />
              <label htmlFor="avatar-upload" className="profile-modal-upload-btn">
                📷 Change Picture
              </label>
            </div>
          </div>
          <div>
            <label className="profile-modal-label">Username</label><br />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="profile-modal-input" placeholder="Choose a username" />
          </div>
          <div>
            <label className="profile-modal-label">Name</label><br />
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="profile-modal-input" />
          </div>
          <div>
            <label className="profile-modal-label">Email</label><br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="profile-modal-input" />
          </div>
          <div>
            <label className="profile-modal-label">Skills</label><br />
            <div className="profile-modal-skill-section">
              <div className="profile-modal-skill-section-title">Soft Skills</div>
              <div className="profile-modal-badge-list">
                {softSkills.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills(skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill])}
                    className={`profile-modal-badge-btn${skills.includes(skill) ? ' selected' : ''}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
            <div className="profile-modal-skill-section">
              <div className="profile-modal-skill-section-title">Technical Skills</div>
              <div className="profile-modal-badge-list">
                {technicalSkills.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills(skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill])}
                    className={`profile-modal-badge-btn${skills.includes(skill) ? ' selected' : ''}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
            <div className="profile-modal-skill-section">
              <div className="profile-modal-skill-section-title">Specialized Skills</div>
              <div className="profile-modal-badge-list">
                {specializedSkills.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills(skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill])}
                    className={`profile-modal-badge-btn${skills.includes(skill) ? ' selected' : ''}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="profile-modal-label">Interests</label><br />
            <div className="profile-modal-badge-list">
              {presetInterests.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => setInterests(interests.includes(interest) ? interests.filter(i => i !== interest) : [...interests, interest])}
                  className={`profile-modal-badge-btn${interests.includes(interest) ? ' selected' : ''}`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="profile-modal-btn-row">
          <button onClick={onClose} className="profile-modal-cancel-btn">Cancel</button>
          <button onClick={() => onConfirm({ avatar, name, email, username, skills, interests })} className="profile-modal-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  );
}
import { SessionContext } from "../../context/SessionContext.jsx";
import Header from "../../components/Header.jsx";
import "../../styles/Profile.css";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const mockProfile = {
  name: "Jane Doe",
  email: "jane.doe@example.com",
  avatar: "https://ui-avatars.com/api/?name=Jane+Doe&background=30bdb7&color=fff&size=120",
  level: 1,
  levelProgress: 0,
  skills: ["Communication", "Project Planning", "Web Design"],
  interests: ["Design", "Coding", "Music"],
  achievements: ["Welcome!"],
  eventHistory: [
    { label: "Registered", date: "2026-01-23" }
  ]
};

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfileAndEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("No user logged in.");
          setProfile(mockProfile);
          setLoading(false);
          return;
        }
        // Fetch profile
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        let profileData = docSnap.exists() ? docSnap.data() : mockProfile;

        // Get all events in Missions
        const missionsRef = collection(db, "Missions");
        const missionsSnap = await getDocs(missionsRef);
        let registeredEvents = [];
        for (const eventDoc of missionsSnap.docs) {
          const eventId = eventDoc.id;
          const eventData = eventDoc.data();
          const eventTitle = eventData.title || eventId;
          const volunteerRef = collection(db, "Missions", eventId, "volunteer");
          const volunteerSnap = await getDocs(volunteerRef);
          if (volunteerSnap.docs.some(doc => doc.id === user.uid)) {
            registeredEvents.push({ id: eventId, title: eventTitle });
          }
        }
        profileData.registeredEvents = registeredEvents;

        setProfile(profileData);
      } catch (err) {
        setError("Failed to load profile.");
        setProfile(mockProfile);
      } finally {
        setLoading(false);
      }
    };
    fetchProfileAndEvents();
  }, []);

  if (loading) return <div className="profile-page-bg"><Header /><div>Loading profile...</div></div>;
  if (error) return <div className="profile-page-bg"><Header /><div>Error: {error}</div></div>;

  return (
    <div className="profile-page-bg">
      <Header />
      <div className="profile-main-flex" style={{ display: 'flex', gap: '32px' }}>
        <div className="profile-card">
          <div className="profile-avatar">
            <img src={profile.avatar} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
          </div>
          {/* Username above name */}
          {profile.username && (
            <h2 style={{ color: "#234e7b", fontWeight: 700, fontSize: 28, marginBottom: 4 }}>{profile.username}</h2>
          )}
          {!profile.username && profile.email && (
            <h2 style={{ color: "#234e7b", fontWeight: 700, fontSize: 28, marginBottom: 4 }}>{profile.email.split('@')[0]}</h2>
          )}
          <div style={{ color: '#30bdb7', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>{profile.name}</div>
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
              {profile.skills && profile.skills.map(skill => (
                <span className="profile-skill-badge" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-interests-label" style={{ fontWeight: 600, marginBottom: 6 }}>Interests</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.interests && profile.interests.map(interest => (
                <span className="profile-interest-badge" key={interest}>{interest}</span>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-achievements-label" style={{ fontWeight: 600, marginBottom: 6 }}>Achievements</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.achievements && profile.achievements.map(ach => (
                <span className="profile-badge" key={ach} title={ach}>
                  <span style={{ color: "#234e7b", fontWeight: 700, fontSize: 18 }}>{ach[0]}</span>
                </span>
              ))}
            </div>
          </div>
          <button className="profile-edit-btn" onClick={() => setEditOpen(true)}>Edit Profile</button>
          <EditProfileModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            profile={profile || {}}
            onConfirm={async updated => {
              try {
                const user = auth.currentUser;
                if (!user) throw new Error("No user logged in");
                // Update Firestore user profile
                const userRef = doc(db, "users", user.uid);
                await import("firebase/firestore").then(({ updateDoc, setDoc }) =>
                  updateDoc(userRef, updated).catch(async err => {
                    // If doc doesn't exist, create it
                    if (err.code === "not-found") {
                      await setDoc(userRef, updated);
                    } else {
                      throw err;
                    }
                  })
                );
                setProfile(prev => ({ ...prev, ...updated }));
              } catch (err) {
                alert("Failed to update profile: " + (err.message || err));
              } finally {
                setEditOpen(false);
              }
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="profile-event-history-card">
            <div className="profile-event-history-title">Event History</div>
            {profile.eventHistory && profile.eventHistory.map((event, idx) => (
              <div className="profile-event-item" key={idx}>
                <span className="profile-event-item-label">{event.label}</span>
                <span style={{ color: "#555", fontSize: 14 }}>{event.date}</span>
                <span className="profile-event-item-dots">•••</span>
              </div>
            ))}
          </div>
          {/* Registered Events Section BELOW Event History */}
          {profile.registeredEvents && profile.registeredEvents.length > 0 && (
            <div className="profile-registered-events-card" style={{ background: '#f7f7f7', borderRadius: 12, padding: 16 }}>
              <div className="profile-registered-events-title" style={{ fontWeight: 700, color: '#234e7b', fontSize: 18, marginBottom: 10 }}>
                Events You're Registered In
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {profile.registeredEvents.map(event => (
                  <span key={event.id} style={{ background: '#30bdb7', color: '#fff', padding: '6px 14px', borderRadius: 8, fontWeight: 600 }}>{event.title}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
