import React, { useContext, useEffect, useRef, useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const [uploading, setUploading] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }

      setUploading(true);

      try {
        // Compress image before uploading
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const reader = new FileReader();
        reader.onload = async (event) => {
          img.src = event.target.result;
          img.onload = async () => {
            // Resize to max 400x400 while maintaining aspect ratio
            const maxSize = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxSize) {
                height *= maxSize / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width *= maxSize / height;
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(async (blob) => {
              try {
                // Upload to Firebase Storage
                const storage = getStorage();
                const user = auth.currentUser;
                if (!user) {
                  alert("You must be logged in to upload an image");
                  setUploading(false);
                  return;
                }

                const storageRef = ref(storage, `profile-pictures/${user.uid}/profile.jpg`);
                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                setAvatar(downloadURL);
                setUploading(false);
              } catch (err) {
                console.error("Upload error:", err);
                alert("Failed to upload image: " + err.message);
                setUploading(false);
              }
            }, 'image/jpeg', 0.7);
          };
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Error processing image:", err);
        alert("Failed to process image");
        setUploading(false);
      }
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
                disabled={uploading}
              />
              <label htmlFor="avatar-upload" className="profile-modal-upload-btn" style={{ opacity: uploading ? 0.6 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? '⏳ Uploading...' : '📷 Change Picture'}
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

const PROFILE_TABS = ["Overview", "Portfolio"];

const SDG_LABELS = {
  1: "No Poverty", 2: "Zero Hunger", 3: "Good Health & Well-being",
  4: "Quality Education", 5: "Gender Equality", 6: "Clean Water & Sanitation",
  7: "Affordable & Clean Energy", 8: "Decent Work & Economic Growth",
  9: "Industry, Innovation & Infrastructure", 10: "Reduced Inequalities",
  11: "Sustainable Cities & Communities", 12: "Responsible Consumption",
  13: "Climate Action", 14: "Life Below Water", 15: "Life on Land",
  16: "Peace, Justice & Strong Institutions", 17: "Partnerships for the Goals",
};

const SDG_COLORS = [
  "", "#e5243b", "#dda63a", "#4c9f38", "#c5192d", "#ff3a21",
  "#26bde2", "#fcc30b", "#a21942", "#fd6925", "#dd1367",
  "#fd9d24", "#bf8b2e", "#3f7e44", "#0a97d9", "#56c02b",
  "#00689d", "#19486a",
];

function computeAchievements(events, totalPoints, level) {
  const roles = [...new Set(events.map(e => e.role).filter(Boolean))];
  return [
    { id: "first_step", icon: "🌱", name: "First Step", desc: "Joined your first event", unlocked: events.length >= 1 },
    { id: "active", icon: "⭐", name: "Active Volunteer", desc: "Joined 3+ events", unlocked: events.length >= 3 },
    { id: "dedicated", icon: "🌟", name: "Dedicated", desc: "Joined 5+ events", unlocked: events.length >= 5 },
    { id: "super", icon: "🏆", name: "Super Volunteer", desc: "Joined 10+ events", unlocked: events.length >= 10 },
    { id: "pts50", icon: "💫", name: "Point Starter", desc: "Earned 50+ points", unlocked: totalPoints >= 50 },
    { id: "pts100", icon: "💎", name: "Point Collector", desc: "Earned 100+ points", unlocked: totalPoints >= 100 },
    { id: "pts500", icon: "👑", name: "Point Master", desc: "Earned 500+ points", unlocked: totalPoints >= 500 },
    { id: "organizer", icon: "📋", name: "Event Organizer", desc: "Served as an organizer", unlocked: events.some(e => e.role === "organizer") },
    { id: "lead_org", icon: "🎯", name: "Lead Organizer", desc: "Served as lead organizer", unlocked: events.some(e => e.role === "lead_organizer") },
    { id: "donor", icon: "💝", name: "Generous Donor", desc: "Donated to a cause", unlocked: events.some(e => e.role === "donor") },
    { id: "all_rounder", icon: "🎨", name: "All-Rounder", desc: "Held 3+ different roles", unlocked: roles.length >= 3 },
    { id: "lv5", icon: "🚀", name: "Rising Star", desc: "Reached Level 5", unlocked: (level || 1) >= 5 },
    { id: "lv10", icon: "🦅", name: "Veteran", desc: "Reached Level 10", unlocked: (level || 1) >= 10 },
    { id: "sdg3", icon: "🌍", name: "SDG Champion", desc: "Contributed to 3+ SDG goals", unlocked: [...new Set(events.flatMap(e => e.sdgs || []))].length >= 3 },
  ];
}

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
  const [rewards, setRewards] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [exporting, setExporting] = useState(false);
  const portfolioPdfRef = useRef(null);

  const exportToPDF = async () => {
    if (!portfolioPdfRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const el = portfolioPdfRef.current;
      const displayName = profile?.username || (profile?.email ? profile.email.split("@")[0] : "Portfolio");

      // ── Place element visibly in document flow for capture ──────────────
      // html2canvas cannot capture elements off-screen or with display:none.
      // We briefly move it to top-left of the page, behind a blocking overlay.
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99998;pointer-events:none;';
      document.body.appendChild(overlay);

      el.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 794px !important;
        z-index: 99999 !important;
        background: #fff !important;
        pointer-events: none !important;
      `;

      // Two frames: layout + paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: el.offsetWidth,
        height: el.offsetHeight,
        windowWidth: 794,
        x: 0,
        y: 0,
      });

      // ── Restore hidden state immediately ────────────────────────────────
      document.body.removeChild(overlay);
      el.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:\'Segoe UI\',Arial,sans-serif;color:#1a1a2e;padding:0;';

      // ── Build multi-page PDF ─────────────────────────────────────────────
      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentW = pageW - margin * 2;
      const contentH = (canvas.height / canvas.width) * contentW;

      if (contentH <= pageH - margin * 2) {
        // Single page
        pdf.addImage(imgData, 'JPEG', margin, margin, contentW, contentH);
      } else {
        // Multi-page: slice canvas into A4 strips
        const stripPx = Math.floor((canvas.width / contentW) * (pageH - margin * 2));
        let yPx = 0;
        let first = true;
        while (yPx < canvas.height) {
          if (!first) pdf.addPage();
          first = false;
          const sliceH = Math.min(stripPx, canvas.height - yPx);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          sliceCanvas.getContext('2d').drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.97);
          const sliceH_mm = (sliceH / canvas.width) * contentW;
          pdf.addImage(sliceImg, 'JPEG', margin, margin, contentW, sliceH_mm);
          yPx += sliceH;
        }
      }

      pdf.save(`${displayName}_portfolio.pdf`);
    } catch (err) {
      alert("Failed to export PDF: " + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

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
        let profileData = docSnap.exists()
          ? docSnap.data()
          : mockProfile;

        // Fetch events (NO POINT CALCULATION HERE)
        const missionsRef = collection(db, "missions");
        const missionsSnap = await getDocs(missionsRef);

        let registeredEvents = [];

        for (const eventDoc of missionsSnap.docs) {
          const eventId = eventDoc.id;
          const eventData = eventDoc.data();

          const volunteerRef = doc(
            db,
            "missions",
            eventId,
            "volunteer",
            user.uid
          );

          const volunteerSnap = await getDoc(volunteerRef);

          if (volunteerSnap.exists()) {
            const vData = volunteerSnap.data();

            registeredEvents.push({
              id: eventId,
              title: eventData.title || eventId,
              role: vData.role || "participant",
              pointsEarned: vData.pointsEarned || 0,
              sdgs: eventData.sdgs || [],
            });
          }
        }

        profileData.registeredEvents = registeredEvents;

        //Reading totalPoints DIRECTLY FROM USER DOC
        const totalPoints = profileData.totalPoints || 0;

        profileData.totalPoints = totalPoints;
        profileData.level = Math.floor(totalPoints / 100) + 1;
        profileData.levelProgress = totalPoints % 100;

        setProfile(profileData);

        // Fetch rewards
        const rewardsSnap = await getDocs(
          collection(db, "users", user.uid, "rewards")
        );

        setRewards(
          rewardsSnap.docs.map(r => ({
            id: r.id,
            ...r.data(),
          }))
        );

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
              <div className="profile-level-bar-label">
                {profile.totalPoints || 0} pts ({profile.levelProgress || 0}/100 to next level)
              </div>
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
            <div className="profile-achievements-label" style={{ fontWeight: 600, marginBottom: 6 }}>Rewards</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {rewards.map(reward => (
                <div
                  key={reward.id}
                  className="profile-reward-container"
                >
                  <span className="profile-reward-icon">{reward.icon || "🏅"}</span>
                  <span className="profile-reward-name">
                    {reward.name || reward.id}
                  </span>
                </div>
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
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e7ef', marginBottom: 4 }}>
            {PROFILE_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 28px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid #234e7b' : '3px solid transparent',
                  color: activeTab === tab ? '#234e7b' : '#888',
                  fontWeight: activeTab === tab ? 700 : 500,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Overview" && (
            <>
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
            </>
          )}

          {activeTab === "Portfolio" && (() => {
            const events = profile.registeredEvents || [];
            const allSdgs = [...new Set(events.flatMap(e => e.sdgs || []))];
            const displayName = profile.username || (profile.email ? profile.email.split('@')[0] : 'Volunteer');
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Export button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={exportToPDF}
                    disabled={exporting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: exporting ? '#aaa' : 'linear-gradient(135deg, #234e7b, #30bdb7)',
                      color: '#fff', border: 'none', borderRadius: 10,
                      padding: '10px 22px', fontWeight: 700, fontSize: 14,
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(35,78,123,0.18)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {exporting ? '⏳ Exporting...' : '⬇ Export PDF'}
                  </button>
                </div>
                {/* Achievements */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 18, marginBottom: 14 }}>
                    Achievements <span style={{ color: '#30bdb7', fontSize: 14, fontWeight: 500 }}>({rewards.length})</span>
                  </div>
                  {rewards.length === 0 ? (
                    <p style={{ color: '#aaa' }}>No achievements yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                      {rewards.map(r => (
                        <div
                          key={r.id}
                          title={r.description || r.name || r.id}
                          style={{
                            background: 'linear-gradient(135deg, #e8f5e9, #f0fdf4)',
                            border: '1.5px solid #4caf50',
                            borderRadius: 10,
                            padding: '12px 10px',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ fontSize: 28 }}>{r.icon || "🏅"}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#234e7b', marginTop: 4 }}>{r.name || r.id}</div>
                          {r.description && <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{r.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SDG Contributions */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 18, marginBottom: 14 }}>SDG Contributions</div>
                  {allSdgs.length === 0 ? (
                    <p style={{ color: '#aaa' }}>No SDG contributions yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {allSdgs.sort((a, b) => a - b).map(sdg => (
                        <div
                          key={sdg}
                          style={{
                            background: SDG_COLORS[sdg] || '#234e7b',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontWeight: 700,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 16, fontWeight: 800 }}>#{sdg}</span>
                          <span>{SDG_LABELS[sdg] || `Goal ${sdg}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Roles Summary */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 18, marginBottom: 14 }}>Events by Role</div>
                  {events.length === 0 ? (
                    <p style={{ color: '#aaa' }}>No events joined yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {events.map(event => (
                        <div key={event.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f7fafd', borderRadius: 8, padding: '10px 14px' }}>
                          <span style={{ fontWeight: 600, color: '#234e7b' }}>{event.title}</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ background: '#30bdb7', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{event.role}</span>
                            <span style={{ color: '#888', fontSize: 13 }}>+{event.pointsEarned} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Hidden PDF layout ── */}
          {profile && (() => {
            const events = profile.registeredEvents || [];
            const allSdgs = [...new Set(events.flatMap(e => e.sdgs || []))];
            const displayName = profile.username || (profile.email ? profile.email.split('@')[0] : 'Volunteer');
            return (
              <div
                ref={portfolioPdfRef}
                style={{
                  position: 'fixed', left: '-9999px', top: 0,
                  width: 794, background: '#fff',
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  color: '#1a1a2e', padding: 0,
                }}
              >
                {/* Header banner */}
                <div style={{ background: 'linear-gradient(135deg, #234e7b 0%, #30bdb7 100%)', padding: '36px 40px 28px', borderRadius: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <img
                      src={profile.avatar}
                      alt="avatar"
                      crossOrigin="anonymous"
                      style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.6)', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>{displayName}</div>
                      <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 15, marginTop: 2 }}>{profile.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{profile.email}</div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 12, fontWeight: 700 }}>Level {profile.level}</span>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{profile.totalPoints || 0} total points</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>SerVe+ Portfolio</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>

                  {/* Skills & Interests row */}
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1, background: '#f7fafd', borderRadius: 10, padding: '16px 18px', border: '1px solid #e0e7ef' }}>
                      <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(profile.skills || []).map(s => (
                          <span key={s} style={{ background: '#234e7b', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600 }}>{s}</span>
                        ))}
                        {(!profile.skills || profile.skills.length === 0) && <span style={{ color: '#aaa', fontSize: 12 }}>None listed</span>}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#f7fafd', borderRadius: 10, padding: '16px 18px', border: '1px solid #e0e7ef' }}>
                      <div style={{ fontWeight: 700, color: '#30bdb7', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Interests</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(profile.interests || []).map(i => (
                          <span key={i} style={{ background: '#30bdb7', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600 }}>{i}</span>
                        ))}
                        {(!profile.interests || profile.interests.length === 0) && <span style={{ color: '#aaa', fontSize: 12 }}>None listed</span>}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e0e7ef' }} />

                  {/* Achievements */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 15, marginBottom: 12 }}>Achievements <span style={{ color: '#30bdb7', fontWeight: 500, fontSize: 13 }}>({rewards.length})</span></div>
                    {rewards.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No achievements yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {rewards.map(r => (
                          <div key={r.id} style={{ background: 'linear-gradient(135deg, #e8f5e9, #f0fdf4)', border: '1.5px solid #4caf50', borderRadius: 8, padding: '10px 14px', minWidth: 110, textAlign: 'center' }}>
                            <div style={{ fontSize: 22 }}>{r.icon || '🏅'}</div>
                            <div style={{ fontWeight: 700, fontSize: 11, color: '#234e7b', marginTop: 4 }}>{r.name || r.id}</div>
                            {r.description && <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>{r.description}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e0e7ef' }} />

                  {/* SDG Contributions */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 15, marginBottom: 12 }}>SDG Contributions</div>
                    {allSdgs.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No SDG contributions yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {allSdgs.sort((a, b) => a - b).map(sdg => (
                          <div key={sdg} style={{ background: SDG_COLORS[sdg] || '#234e7b', color: '#fff', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontWeight: 800 }}>#{sdg}</span>
                            <span>{SDG_LABELS[sdg] || `Goal ${sdg}`}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e0e7ef' }} />

                  {/* Events by Role */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#234e7b', fontSize: 15, marginBottom: 12 }}>Events by Role</div>
                    {events.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No events joined yet.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f0f4f8' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#234e7b', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Event</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', color: '#234e7b', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Role</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#234e7b', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {events.map((event, idx) => (
                            <tr key={event.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f7fafd' }}>
                              <td style={{ padding: '8px 12px', color: '#333', borderBottom: '1px solid #f0f4f8' }}>{event.title}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f0f4f8' }}>
                                <span style={{ background: '#30bdb7', color: '#fff', borderRadius: 4, padding: '2px 9px', fontWeight: 600 }}>{event.role}</span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#234e7b', borderBottom: '1px solid #f0f4f8' }}>+{event.pointsEarned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 10, borderTop: '1px solid #e0e7ef', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#bbb' }}>Generated by SerVe+ · {new Date().toLocaleDateString()}</span>
                    <span style={{ fontSize: 10, color: '#30bdb7', fontWeight: 600 }}>serve-plus.app</span>
                  </div>

                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
