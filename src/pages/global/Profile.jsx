import React, { useContext, useEffect, useState } from "react";
// Simple modal component
function EditProfileModal({ open, onClose, profile, onConfirm }) {
  const [avatar, setAvatar] = useState(profile.avatar || "");
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [skills, setSkills] = useState(profile.skills ? profile.skills.join(", ") : "");
  const [interests, setInterests] = useState(profile.interests ? profile.interests.join(", ") : "");

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
        <h2 style={{ marginBottom: 18, color: '#234e7b' }}>Edit Profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <img src={avatar} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
            <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="Profile Picture URL" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Name</label><br />
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Email</label><br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Skills (comma separated)</label><br />
            <input type="text" value={skills} onChange={e => setSkills(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Interests (comma separated)</label><br />
            <input type="text" value={interests} onChange={e => setInterests(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#ccc', color: '#234e7b', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600 }}>Cancel</button>
          <button onClick={() => onConfirm({ avatar, name, email, skills: skills.split(",").map(s => s.trim()).filter(Boolean), interests: interests.split(",").map(i => i.trim()).filter(Boolean) })} style={{ background: '#30bdb7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600 }}>Confirm</button>
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
  skills: ["React", "Firebase", "UI/UX"],
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
            onConfirm={updated => {
              // You can add Firestore update logic here
              setProfile(prev => ({ ...prev, ...updated }));
              setEditOpen(false);
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
