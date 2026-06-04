import React, { useContext, useEffect, useRef, useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, getDocs, onSnapshot, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { getLevelInfo, getNextUnlock, LEVEL_UNLOCKS } from "../../hooks/rewardSystem";
// Simple modal component
function EditProfileModal({ open, onClose, profile, onConfirm, role, level = 1, activeFrame: initialFrame = 'default', bio: initialBio = '', profileBgColor: initialBgColor = '', profileTitle: initialTitle = '', profileGlow: initialGlow = '', pinnedBadges: initialPinned = [], earnedBadges = [] }) {
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
  const [organizationName, setOrganizationName] = useState(profile.organizationName || "");
  const [department, setDepartment] = useState(profile.department || "");
  const [program, setProgram] = useState(profile.program || "");
  const departmentPrograms = {
    'College of Arts and Science (CAS)': ['COMM', 'BMMA'],
    'College of Computer and Information Science (CCIS)': ['IT', 'CS'],
    'College of Health Sciences (CHS)': ['BIO', 'MDT', 'PH', 'PT', 'PSY'],
    'College of Nursing (CN)': ['Nursing'],
    'College of Maritime Education and Training (CMET)': ['MARE', 'MT', 'MSSB'],
    'E.T. Yuchengco College of Business (ETYCB)': ['ACT', 'AIS', 'BA OM', 'BA FM', 'BA MM', 'BIA', 'GM', 'HM', 'MKT', 'TM'],
    'Mapua-Laguna Institute of Aviation (MIA)': ['AEE', 'AM', 'AMT'],
    'Mapua Institute of Technology at Laguna (MITL)': ['AR', 'CHE', 'CE', 'CPE', 'EE', 'ECE', 'IE', 'ME'],
    'Mapua MCL Senior High School (SHS)': ['ABM', 'STEM', 'HUMSS', 'ICT'],
    'Non-Academic Organization': [],
  };
  const [skills, setSkills] = useState(profile.skills || []);
  const [interests, setInterests] = useState(profile.interests || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFrame, setSelectedFrame] = useState(initialFrame);
  const [bio, setBio] = useState(initialBio);
  const [profileBgColor, setProfileBgColor] = useState(initialBgColor);
  const [profileTitle, setProfileTitle] = useState(initialTitle);
  const [profileGlow, setProfileGlow] = useState(initialGlow);
  const [pinnedBadges, setPinnedBadges] = useState(initialPinned);

  // Reset state when modal opens or profile changes
  useEffect(() => {
    if (open) {
      setAvatar(profile.avatar || "");
      setName(profile.name || "");
      setEmail(profile.email || "");
      setUsername(profile.username || "");
      setOrganizationName(profile.organizationName || "");
      setDepartment(profile.department || "");
      setProgram(profile.program || "");
      setSkills(profile.skills || []);
      setInterests(profile.interests || []);
      setSelectedFrame(initialFrame);
      setBio(initialBio);
      setProfileBgColor(initialBgColor);
      setProfileTitle(initialTitle);
      setProfileGlow(initialGlow);
      setPinnedBadges(initialPinned);
    }
  }, [open, profile]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image size must be less than 5MB.');
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
                  setUploadError('You must be logged in to upload an image.');
                  setUploading(false);
                  return;
                }

                const storageRef = ref(storage, `profile-pictures/${user.uid}/profile.jpg`);
                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                setAvatar(downloadURL);
                setUploadError('');
                setUploading(false);
              } catch (err) {
                console.error("Upload error:", err);
                setUploadError('Failed to upload image. Please try again.');
                setUploading(false);
              }
            }, 'image/jpeg', 0.7);
          };
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Error processing image:", err);
        setUploadError('Failed to process image. Please try a different file.');
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
              <AvatarWithFrame
                src={avatar}
                displayName={username || name || 'User'}
                alt="avatar preview"
                frameId={selectedFrame}
                size={100}
              />
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
              {uploadError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: 6, textAlign: 'center' }}>{uploadError}</div>
              )}
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
          {role === 'partner' && (
            <div>
              <label className="profile-modal-label">Organization Name</label><br />
              <input
                type="text"
                value={organizationName}
                onChange={e => setOrganizationName(e.target.value)}
                className="profile-modal-input"
                placeholder="e.g., Barangay San Jose, Mapua MCL"
              />
              <small style={{ color: '#64748b', fontSize: '0.8rem' }}>
                This is the name shown to faculty when selecting a partner for a project proposal.
              </small>
            </div>
          )}
          <div>
            <label className="profile-modal-label">Email</label><br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="profile-modal-input" />
          </div>
          <div>
            <label className="profile-modal-label">Department</label><br />
            <select value={department} onChange={e => { setDepartment(e.target.value); setProgram(""); }} className="profile-modal-input">
              <option value="">Select department</option>
              <option value="College of Arts and Science (CAS)">College of Arts and Science (CAS)</option>
              <option value="College of Computer and Information Science (CCIS)">College of Computer and Information Science (CCIS)</option>
              <option value="College of Health Sciences (CHS)">College of Health Sciences (CHS)</option>
              <option value="College of Nursing (CN)">College of Nursing (CN)</option>
              <option value="College of Maritime Education and Training (CMET)">College of Maritime Education and Training (CMET)</option>
              <option value="E.T. Yuchengco College of Business (ETYCB)">E.T. Yuchengco College of Business (ETYCB)</option>
              <option value="Mapua-Laguna Institute of Aviation (MIA)">Mapua-Laguna Institute of Aviation (MIA)</option>
              <option value="Mapua Institute of Technology at Laguna (MITL)">Mapua Institute of Technology at Laguna (MITL)</option>
              <option value="Mapua MCL Senior High School (SHS)">Mapua MCL Senior High School (SHS)</option>
              <option value="Non-Academic Organization">Non-Academic Organization</option>
            </select>
          </div>
          {department && departmentPrograms[department] && departmentPrograms[department].length > 0 && (
            <div>
              <label className="profile-modal-label">Program</label><br />
              <select value={program} onChange={e => setProgram(e.target.value)} className="profile-modal-input">
                <option value="">Select program</option>
                {departmentPrograms[department].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
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

          {/* ── About Me bio (level 2+) ── */}
          {level >= 2 && (
            <div>
              <label className="profile-modal-label">About Me</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 200))}
                className="profile-modal-input"
                rows={3}
                placeholder="Tell others a bit about yourself… (max 200 chars)"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{bio.length}/200</span>
            </div>
          )}

          {/* ── Profile card background color (level 4+) ── */}
          {level >= 4 && (() => {
            const BG_OPTIONS = [
              { value: '',        label: 'Default',      swatch: '#ffffff', border: '#e2e8f0' },
              { value: '#f0fdf4', label: 'Mint',         swatch: '#f0fdf4', border: '#86efac' },
              { value: '#eff6ff', label: 'Sky',          swatch: '#eff6ff', border: '#93c5fd' },
              { value: '#fdf4ff', label: 'Lavender',     swatch: '#fdf4ff', border: '#d8b4fe' },
              { value: '#fff7ed', label: 'Peach',        swatch: '#fff7ed', border: '#fed7aa' },
              { value: '#f0f9ff', label: 'Ice',          swatch: '#f0f9ff', border: '#7dd3fc' },
              { value: '#1e293b', label: 'Dark Slate',   swatch: '#1e293b', border: '#475569' },
            ];
            return (
              <div>
                <label className="profile-modal-label">Card Background</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {BG_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => setProfileBgColor(opt.value)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: opt.swatch,
                        border: `3px solid ${profileBgColor === opt.value ? '#30bdb7' : opt.border}`,
                        cursor: 'pointer', outline: 'none',
                        boxShadow: profileBgColor === opt.value ? '0 0 0 2px #30bdb7' : 'none',
                      }}
                      aria-label={opt.label}
                      aria-pressed={profileBgColor === opt.value}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Custom title / flair (level 6+) ── */}
          {level >= 6 && (() => {
            const TITLES = [
              '', 'Community Hero', 'Service Champion', 'Dedicated Volunteer',
              'Event Leader', 'SDG Champion', 'Philanthropy Star', 'Mission Expert',
              'Campus Changemaker', 'Passionate Advocate',
            ];
            return (
              <div>
                <label className="profile-modal-label">Profile Title</label>
                <select
                  value={profileTitle}
                  onChange={e => setProfileTitle(e.target.value)}
                  className="profile-modal-input"
                >
                  {TITLES.map(t => (
                    <option key={t} value={t}>{t || '— None —'}</option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* ── Profile card glow (level 8+) ── */}
          {level >= 8 && (() => {
            const GLOWS = [
              { value: '',                                    label: 'None',    color: '#e2e8f0' },
              { value: '0 0 18px 4px rgba(13,148,136,0.55)', label: 'Teal',   color: '#0d9488' },
              { value: '0 0 18px 4px rgba(168,85,247,0.55)', label: 'Purple', color: '#a855f7' },
              { value: '0 0 18px 4px rgba(234,179,8,0.55)',  label: 'Gold',   color: '#eab308' },
              { value: '0 0 18px 4px rgba(239,68,68,0.55)',  label: 'Red',    color: '#ef4444' },
              { value: '0 0 18px 4px rgba(59,130,246,0.55)', label: 'Blue',   color: '#3b82f6' },
            ];
            return (
              <div>
                <label className="profile-modal-label">Profile Glow</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  {GLOWS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      title={g.label}
                      onClick={() => setProfileGlow(g.value)}
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: g.color,
                        border: `3px solid ${profileGlow === g.value ? '#30bdb7' : 'transparent'}`,
                        boxShadow: profileGlow === g.value ? `0 0 0 2px #30bdb7, ${g.value || 'none'}` : (g.value || 'none'),
                        cursor: 'pointer', outline: 'none',
                      }}
                      aria-label={g.label}
                      aria-pressed={profileGlow === g.value}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Pin up to 3 badges (level 9+) ── */}
          {level >= 9 && earnedBadges.length > 0 && (() => {
            const togglePin = (badgeId) => {
              setPinnedBadges(prev =>
                prev.includes(badgeId)
                  ? prev.filter(id => id !== badgeId)
                  : prev.length < 3 ? [...prev, badgeId] : prev
              );
            };
            return (
              <div>
                <label className="profile-modal-label">Pinned Badges <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>({pinnedBadges.length}/3 selected)</span></label>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>Pin your favorite badges to show on your profile card.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {earnedBadges.map(b => {
                    const bid = b.badgeId ?? b.id;
                    const isPinned = pinnedBadges.includes(bid);
                    const canPin = isPinned || pinnedBadges.length < 3;
                    return (
                      <button
                        key={bid}
                        type="button"
                        onClick={() => canPin && togglePin(bid)}
                        title={isPinned ? 'Unpin' : (canPin ? 'Pin this badge' : 'Max 3 badges')}
                        style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem',
                          border: `2px solid ${isPinned ? '#30bdb7' : '#e2e8f0'}`,
                          background: isPinned ? '#f0fdfa' : '#f8fafc',
                          color: isPinned ? '#0f766e' : '#475569',
                          cursor: canPin ? 'pointer' : 'not-allowed',
                          opacity: canPin ? 1 : 0.5,
                          fontWeight: isPinned ? 700 : 400,
                        }}
                      >
                        {isPinned ? '📌 ' : ''}{b.name || bid}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Profile Frame Picker (level 3+) ── */}
          {level >= 3 && (() => {
            const unlockedIds = new Set(getUnlockedFrames(level).map(f => f.id));
            return (
              <div>
                <label className="profile-modal-label">Profile Frame</label>
                <div className="frame-picker-subtitle" style={{ marginTop: 4, marginBottom: 10 }}>
                  Choose a frame for your profile picture.
                </div>
                <div className="frame-picker-grid">
                  {PROFILE_FRAMES.map(frame => {
                    const isUnlocked = unlockedIds.has(frame.id);
                    const isActive = selectedFrame === frame.id;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        title={isUnlocked ? frame.description : `Unlocks at Level ${frame.minLevel}`}
                        aria-label={`${isUnlocked ? 'Select' : 'Locked'} frame: ${frame.name}`}
                        aria-pressed={isActive}
                        disabled={!isUnlocked}
                        onClick={() => { if (isUnlocked) setSelectedFrame(frame.id); }}
                        className={[
                          'frame-picker-item',
                          isActive ? 'frame-picker-active' : '',
                          !isUnlocked ? 'frame-picker-locked' : '',
                        ].join(' ')}
                      >
                        {!isUnlocked && (
                          <span className="frame-picker-lock-badge" aria-hidden="true">🔒</span>
                        )}
                        <AvatarWithFrame
                          src={avatar}
                          displayName={username || name || 'User'}
                          alt={frame.name}
                          frameId={frame.id}
                          size={52}
                          className="frame-picker-preview"
                        />
                        <span className="frame-picker-label">{frame.name}</span>
                        {!isUnlocked && (
                          <span className="frame-picker-level-hint">Lv. {frame.minLevel}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
        <div className="profile-modal-btn-row">
          <button onClick={onClose} className="profile-modal-cancel-btn">Cancel</button>
          <button onClick={() => onConfirm({ avatar, name, email, username, organizationName, department, program, skills, interests, activeFrame: selectedFrame, bio, profileBgColor, profileTitle, profileGlow, pinnedBadges })} className="profile-modal-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  );
}
import { useSession } from "../../context/SessionContext.jsx";
import Header from "../../components/Header.jsx";
import BadgeShelf from "../../components/badges/BadgeShelf";
import BadgeIcon from "../../components/badges/BadgeIcon";
import AvatarWithFrame from "../../components/AvatarWithFrame";
import "../../styles/Profile.css";
import "../../styles/Badge.css";
import "../../styles/ProfileFrames.css";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { BADGE_BY_ID } from "../../constants/badgeDefinitions";
import { PROFILE_FRAMES, getUnlockedFrames } from "../../constants/profileFrames";
const PROFILE_TABS = ["Overview", "Badges", "Portfolio"];

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

function normalizeMissionRoles(data = {}) {
  const rawRoles = Array.isArray(data.roles) && data.roles.length > 0
    ? data.roles
    : (data.role ? [data.role] : []);
  return rawRoles.map(r => String(r || "").trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
}

function getPrimaryDisplayRole(roles = []) {
  return roles.find(r => r === "lead_organizer") ||
    roles.find(r => r === "organizer") ||
    roles.find(r => r === "donor") ||
    roles[0] ||
    "participant";
}

function computeAchievements(events, totalPoints, level) {
  const roles = [...new Set(events.flatMap(e => e.roles?.length > 0 ? e.roles : [e.role]).filter(Boolean))];
  return [
    { id: "first_step", icon: "🌱", name: "First Step", desc: "Joined your first event", unlocked: events.length >= 1 },
    { id: "active", icon: "⭐", name: "Active Volunteer", desc: "Joined 3+ events", unlocked: events.length >= 3 },
    { id: "dedicated", icon: "🌟", name: "Dedicated", desc: "Joined 5+ events", unlocked: events.length >= 5 },
    { id: "super", icon: "🏆", name: "Super Volunteer", desc: "Joined 10+ events", unlocked: events.length >= 10 },
    { id: "pts50", icon: "💫", name: "Point Starter", desc: "Earned 50+ points", unlocked: totalPoints >= 50 },
    { id: "pts100", icon: "💎", name: "Point Collector", desc: "Earned 100+ points", unlocked: totalPoints >= 100 },
    { id: "pts500", icon: "👑", name: "Point Master", desc: "Earned 500+ points", unlocked: totalPoints >= 500 },
    { id: "organizer", icon: "📋", name: "Event Organizer", desc: "Served as an organizer", unlocked: events.some(e => (e.roles || []).includes("organizer")) },
    { id: "lead_org", icon: "🎯", name: "Lead Organizer", desc: "Served as lead organizer", unlocked: events.some(e => (e.roles || []).includes("lead_organizer")) },
    { id: "donor", icon: "💝", name: "Generous Donor", desc: "Donated to a cause", unlocked: events.some(e => (e.roles || []).includes("donor")) },
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

// Gallery Image Modal Component
function GalleryImageModal({ image, onClose }) {
  const [isZoomed, setIsZoomed] = useState(false);
  if (!image) return null;

  return (
    <div className="gallery-modal-overlay" onClick={onClose}>
      <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="gallery-modal-close" onClick={onClose}>×</button>
        <img 
          src={image.url} 
          alt={image.caption || 'Gallery image'} 
          className={`gallery-modal-image ${isZoomed ? 'zoomed' : ''}`}
          onClick={() => setIsZoomed(!isZoomed)}
        />
        {image.caption && <div className="gallery-modal-caption">{image.caption}</div>}
        {image.eventTitle && <div className="gallery-modal-event">📅 {image.eventTitle}</div>}
        <div className="gallery-modal-date">
          📍 Added on {new Date(image.createdAt?.toDate?.() || image.createdAt).toLocaleDateString()}
        </div>
        {isZoomed && <div className="gallery-modal-zoom-hint">Click image to zoom out</div>}
      </div>
    </div>
  );
}

// Gallery Upload Modal Component
function GalleryUploadModal({ isOpen, onClose, onUpload, events }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select an image');
      return;
    }

    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      const storage = getStorage();
      const timestamp = Date.now();
      const filename = `gallery/${user.uid}/${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      const galleryData = {
        url: downloadURL,
        caption: caption.trim(),
        eventId: selectedEvent || null,
        eventTitle: events.find(e => e.id === selectedEvent)?.title || null,
        createdAt: new Date(),
        userId: user.uid
      };

      await onUpload(galleryData);
      onClose();
      setSelectedFile(null);
      setCaption('');
      setSelectedEvent('');
      setPreviewUrl(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="gallery-upload-modal-overlay" onClick={onClose}>
      <div className="gallery-upload-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add to Gallery</h3>
        {previewUrl && (
          <div className="gallery-upload-preview">
            <img src={previewUrl} alt="Preview" />
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFileSelect} />
        <input type="text" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
          <option value="">Select related event (optional)</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.title}</option>
          ))}
        </select>
        <div className="gallery-upload-buttons">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleUpload} disabled={uploading || !selectedFile}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default function Profile() {
  const { refreshUserData } = useSession();
  const [profile, setProfile] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [certsLoaded, setCertsLoaded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySort, setHistorySort] = useState("date_desc");
  const [activeFrame, setActiveFrame] = useState("default");
  const [bio, setBio] = useState('');
  const [profileBgColor, setProfileBgColor] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileGlow, setProfileGlow] = useState('');
  const [pinnedBadges, setPinnedBadges] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);
  const [customBadges, setCustomBadges] = useState([]);
  const portfolioPdfRef = useRef(null);
  const serveReadyAwardedRef = useRef(false);
  const certBlobRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [certShareCopied, setCertShareCopied] = useState(false);
  const [certBlobUrl, setCertBlobUrl] = useState(null);
  const [certBlobLoading, setCertBlobLoading] = useState(false);

  const [scrollToCerts, setScrollToCerts] = useState(false);
  const [highlightFirstCert, setHighlightFirstCert] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("profileScrollTo") !== "certificates") return;
    sessionStorage.removeItem("profileScrollTo");
    setActiveTab("Portfolio");
    setScrollToCerts(true);
  }, []);

  useEffect(() => {
    if (!scrollToCerts || activeTab !== "Portfolio" || !certsLoaded) return;
    const t = setTimeout(() => {
      document.getElementById("certificates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToCerts(false);
      setHighlightFirstCert(true);
      setTimeout(() => setHighlightFirstCert(false), 2000);
    }, 100);
    return () => clearTimeout(t);
  }, [scrollToCerts, activeTab, certsLoaded]);

  const handleGalleryUpload = async (galleryData) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in");

    await addDoc(collection(db, "users", user.uid, "gallery"), galleryData);
  };

  const handleDeleteGalleryImage = async (imageId) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "gallery", imageId));
    } catch (error) {
      console.error("Gallery delete error:", error);
    }
  };

  // Load gallery images
useEffect(() => {
  const user = auth.currentUser;
  if (!user) {
    setGalleryLoading(false);
    return;
  }

  const galleryRef = collection(db, "users", user.uid, "gallery");
  const q = query(galleryRef, orderBy("createdAt", "desc"));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const images = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setGalleryImages(images);
    setGalleryLoading(false);
  }, (error) => {
    console.error("Gallery load error:", error);
    setGalleryLoading(false);
  });

  return () => unsubscribe();
}, []);


  // Load cert PDF for the iframe viewer.
  // Strategy: (1) fetch as blob for a same-origin blob URL; (2) if CORS blocks it, fall back to
  // the direct Firebase Storage URL (iframes can load cross-origin PDFs without CORS); (3) if
  // there is no downloadURL at all, rebuild the PDF locally from the stored cert fields.
  useEffect(() => {
    if (certBlobRef.current) {
      URL.revokeObjectURL(certBlobRef.current);
      certBlobRef.current = null;
    }
    if (!selectedCert) {
      setCertBlobUrl(null);
      setCertBlobLoading(false);
      return;
    }
    let cancelled = false;
    setCertBlobUrl(null);
    setCertBlobLoading(true);

    (async () => {
      try {
        let viewUrl = null;

        // Step 1: resolve a storage URL — use saved one, or look it up from Storage by fileName
        let storageUrl = selectedCert.downloadURL || null;
        if (!storageUrl && selectedCert.fileName) {
          try {
            const user = auth.currentUser;
            if (user) {
              const storage = getStorage();
              const storageRef = ref(storage, `event-certificates/${user.uid}/${selectedCert.fileName}`);
              storageUrl = await getDownloadURL(storageRef);
            }
          } catch { /* file may not exist in Storage — continue to local rebuild */ }
        }

        // Step 2: convert storage URL to blob (CORS-safe); fall back to direct URL for iframe
        if (storageUrl) {
          try {
            const r = await fetch(storageUrl);
            if (!r.ok) throw new Error("fetch failed");
            const blob = await r.blob();
        if (cancelled) return;
            viewUrl = URL.createObjectURL(blob);
            certBlobRef.current = viewUrl;
          } catch {
            // CORS blocked — iframes can load Firebase Storage URLs directly without CORS
            if (!cancelled) viewUrl = storageUrl;
          }
        }

        // Step 3: last resort — rebuild PDF locally from the stored cert fields
        if (!viewUrl) {
          const { buildCertificateBlob } = await import("../../utils/certificateUtils");
          const blob = await buildCertificateBlob({
            recipient: selectedCert.recipient || "",
            course:    selectedCert.course    || "",
            date:      selectedCert.date      || "",
            loc:       selectedCert.loc       || "",
            day:       selectedCert.day       || "",
            month:     selectedCert.month     || "",
            year:      selectedCert.year      || "",
            certId:    selectedCert.certificateId || "",
          });
          if (cancelled) return;
          viewUrl = URL.createObjectURL(blob);
          certBlobRef.current = viewUrl;
        }

        if (!cancelled && viewUrl) setCertBlobUrl(viewUrl);
      } catch {
        // keep null — show "PDF not available"
      } finally {
        if (!cancelled) setCertBlobLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedCert]);

  const exportToPDF = async () => {
    if (!portfolioPdfRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const el = portfolioPdfRef.current;
      const displayName = profile?.username || (profile?.email ? profile.email.split("@")[0] : "Portfolio");

      // ── Prepare an off-DOM clone for capture so original UI doesn't jump ──
      const clone = el.cloneNode(true);
      clone.id = 'portfolio-pdf-clone';
      // ensure images are allowed for cross-origin capture where possible
      clone.querySelectorAll && clone.querySelectorAll('img').forEach(img => img.setAttribute('crossOrigin', 'anonymous'));
      // place the clone far off-screen using transform so it doesn't visibly appear
      clone.style.cssText = `
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
        width: 794px !important;
        z-index: -1 !important;
        background: #fff !important;
        pointer-events: none !important;
      `;
      document.body.appendChild(clone);

      // Two frames: layout + paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: clone.offsetWidth,
        height: clone.offsetHeight,
        windowWidth: 794,
        x: 0,
        y: 0,
      });
      // remove helper clone
      document.body.removeChild(clone);

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
      setExportError('Failed to export portfolio. Please try again.');
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

        // Phase 1: Fetch profile only — show the page immediately
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        let profileData = docSnap.exists() ? docSnap.data() : mockProfile;

        // Load active frame + level unlock customizations from Firestore
        if (profileData.activeFrame) setActiveFrame(profileData.activeFrame);
        if (profileData.bio) setBio(profileData.bio);
        if (profileData.profileBgColor) setProfileBgColor(profileData.profileBgColor);
        if (profileData.profileTitle) setProfileTitle(profileData.profileTitle);
        if (profileData.profileGlow) setProfileGlow(profileData.profileGlow);
        if (Array.isArray(profileData.pinnedBadges)) setPinnedBadges(profileData.pinnedBadges);

        const totalPoints = profileData.totalPoints || 0;
        profileData.totalPoints = totalPoints;
        const _li = getLevelInfo(totalPoints);
        profileData.level = _li.level;
        profileData.levelProgress = _li.progress;
        profileData.levelPointsInLevel = _li.pointsInLevel;
        profileData.levelPointsForLevel = _li.pointsForLevel;
        profileData.registeredEvents = [];

        setProfile(profileData);
        setLoading(false); // Show the page now — events load in background

        // Phase 2: Fetch missions + custom badges in parallel
        const [missionsSnap, customBadgesSnap] = await Promise.all([
          getDocs(collection(db, "missions")),
          getDocs(collection(db, "customBadges")),
        ]);
        setCustomBadges(
          customBadgesSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => !b.archived)
        );

        // Real-time badge listener — updates whenever a badge is awarded
        const badgesRef = collection(db, "users", user.uid, "badges");
        onSnapshot(badgesRef, async (snapshot) => {
          const badgeList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          const hasServeReady = badgeList.some(b => (b.badgeId ?? b.id) === "serve-ready");
          if (profileData.role === "student" && !hasServeReady && !serveReadyAwardedRef.current) {
            serveReadyAwardedRef.current = true;
            try {
              const { awardServeReadyBadge } = await import("../../hooks/badgeSystem");
              await awardServeReadyBadge(user.uid);
              // onSnapshot fires again with serve-ready included
            } catch {
              setEarnedBadges(badgeList);
            }
          } else {
            setEarnedBadges(badgeList);
          }
        });

        // Certificates — real-time listener
        const certsRef = collection(db, "users", user.uid, "certificates");
        onSnapshot(certsRef, (snapshot) => {
          setCertificates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setCertsLoaded(true);
        });

        // Check all volunteer docs in parallel (instead of sequential for-loop)
        const volunteerSnaps = await Promise.all(
          missionsSnap.docs.map(eventDoc =>
            getDoc(doc(db, "missions", eventDoc.id, "volunteer", user.uid))
          )
        );

        // Only process missions the user is enrolled in
        const enrolledEntries = missionsSnap.docs
          .map((eventDoc, i) => ({ eventDoc, volunteerSnap: volunteerSnaps[i] }))
          .filter(({ volunteerSnap }) => volunteerSnap.exists());

        // For each enrolled mission, fetch tasks and participant docs in parallel
        const registeredEvents = await Promise.all(
          enrolledEntries.map(async ({ eventDoc, volunteerSnap }) => {
            const eventId = eventDoc.id;
            const eventData = eventDoc.data();
            const vData = volunteerSnap.data();

            let tasksDone = [];
            try {
              const tasksSnap = await getDocs(collection(db, "missions", eventId, "task"));
              const participantSnaps = await Promise.all(
                tasksSnap.docs.map(taskDoc =>
                  getDoc(doc(db, "missions", eventId, "task", taskDoc.id, "participants", user.uid))
                )
              );
              tasksDone = tasksSnap.docs
                .map((taskDoc, i) => ({ taskDoc, participantSnap: participantSnaps[i] }))
                .filter(({ participantSnap }) => participantSnap.exists())
                .map(({ taskDoc, participantSnap }) => {
                  const pdata = participantSnap.data();
                  return {
                    id: taskDoc.id,
                    title: taskDoc.data().title || taskDoc.id,
                    status: pdata.status || "todo",
                    pointsEarned: pdata.pointsEarned || 0,
                    completedAt: pdata.completedAt || pdata.lastUpdated || pdata.joinedAt || null,
                    reflection: pdata.reflection || "",
                  };
                });
            } catch (e) {
              console.warn(`Failed to load tasks for event ${eventId}:`, e);
            }

            let targetDate = null;
            if (eventData.targetDate?.toDate) {
              targetDate = eventData.targetDate.toDate();
            } else if (typeof eventData.targetDate === "string" && eventData.targetDate) {
              targetDate = new Date(eventData.targetDate);
            }

            const reqBonus = vData.requirementBonus || {};
            const requirementPoints = Object.values(reqBonus).reduce((s, val) => s + (Number(val) || 0), 0);
            const roles = normalizeMissionRoles(vData);

            return {
              id: eventId,
              title: eventData.title || eventId,
              roles,
              role: getPrimaryDisplayRole(roles),
              pointsEarned: vData.pointsEarned || 0,
              requirementPoints,
              sdgs: eventData.sdgs || [],
              tasksDone,
              status: eventData.status || "unknown",
              targetDate,
              attendanceStatus: vData.attendanceStatus || null,
            };
          })
        );

        setProfile(prev => ({ ...prev, registeredEvents }));

        const proposedEvents = missionsSnap.docs
          .filter(d => d.data().createdBy === user.uid)
          .map(d => ({
            id: d.id,
            title: d.data().title || d.id,
            status: d.data().status || "unknown",
            targetDate: (() => {
              const td = d.data().targetDate;
              if (td?.toDate) return td.toDate();
              if (typeof td === "string" && td) return new Date(td);
              return null;
            })(),
            proponents: d.data().proponents || [],
            preparedBy: d.data().preparedBy || "",
            projectType: d.data().projectType || "",
            sdgs: d.data().sdgs || [],
          }));
        setProfile(prev => ({ ...prev, proposedEvents }));

      } catch (err) {
        setError("Failed to load profile.");
        setProfile(mockProfile);
        setLoading(false);
      }
    };

    fetchProfileAndEvents();
  }, []);

  if (loading) return (
    <div className="profile-page-bg">
      <Header />
      <div className="profile-loading-state" role="status" aria-live="polite">
        <span className="profile-spinner" aria-hidden="true"></span>
        <p>Loading your profile…</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="profile-page-bg">
      <Header />
      <div className="profile-error-state" role="alert">
        <span className="profile-error-icon">⚠️</span>
        <p>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="profile-page-bg">
      {exporting && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, border: '5px solid rgba(255,255,255,0.25)',
            borderTopColor: '#30bdb7', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', letterSpacing: 0.2 }}>
            Please wait, generating your PDF…
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
            This may take a few seconds
          </div>
        </div>
      )}
      <Header />

      {/* ── Certificate fullscreen modal ── */}
      {selectedCert && (
        <div
          className="cert-modal-overlay"
          onClick={() => { setSelectedCert(null); setCertShareCopied(false); }}
        >
          <div className="cert-modal-box" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="cert-modal-header">
              <div className="cert-modal-header-info">
                <div className="cert-modal-label">SerVe+ · Mission</div>
                <div className="cert-modal-course">{selectedCert.course}</div>
                {(selectedCert.month || selectedCert.date) && (
                  <div className="cert-modal-date">
                    Completed {selectedCert.month} {selectedCert.year || selectedCert.date}
                  </div>
                )}
              </div>
              <button
                className="cert-modal-close"
                onClick={() => { setSelectedCert(null); setCertShareCopied(false); }}
                aria-label="Close"
              >×</button>
            </div>

            {/* PDF body */}
            <div className="cert-modal-body">
              {certBlobLoading ? (
                <div className="cert-modal-loading">
                  <div className="cert-modal-spinner" />
                  Loading certificate…
                </div>
              ) : certBlobUrl ? (
                <iframe
                  src={certBlobUrl}
                  title="Certificate"
                  className="cert-modal-iframe"
                />
              ) : (
                <div className="cert-modal-unavailable">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>PDF not available</span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="cert-modal-footer">
              {selectedCert.downloadURL && (
              <button
                  className={`cert-modal-share-btn${certShareCopied ? " copied" : ""}`}
                onClick={async () => {
                  if (navigator.share) {
                    try { await navigator.share({ title: `SerVe+ Certificate — ${selectedCert.course}`, url: selectedCert.downloadURL }); } catch {}
                  } else {
                    try { await navigator.clipboard.writeText(selectedCert.downloadURL); } catch {}
                    setCertShareCopied(true);
                    setTimeout(() => setCertShareCopied(false), 2200);
                  }
                }}
              >
                {certShareCopied ? "✓ Link copied!" : "↗ Share"}
              </button>
              )}
              {(selectedCert.downloadURL || certBlobUrl) && (
                <a
                  href={selectedCert.downloadURL || certBlobUrl}
                  download={`SerVe+_Certificate_${(selectedCert.course || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cert-modal-download-btn"
                >
                  ↓ Download PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Gallery Image Modal */}
      {selectedGalleryImage && (
        <GalleryImageModal 
          image={selectedGalleryImage} 
          onClose={() => setSelectedGalleryImage(null)} 
        />
      )}

      {/* Gallery Upload Modal */}
      <GalleryUploadModal
        isOpen={showGalleryUpload}
        onClose={() => setShowGalleryUpload(false)}
        onUpload={handleGalleryUpload}
        events={profile?.registeredEvents || []}
      />

      <div className="profile-main-flex">
        <div
          className="profile-card"
          style={{
            ...(profileBgColor ? { background: profileBgColor } : {}),
            ...(profileGlow    ? { boxShadow: profileGlow }       : {}),
          }}
        >
          <div className="profile-avatar">
            <AvatarWithFrame
              src={profile.avatar}
              displayName={profile.username || profile.name || profile.email || 'User'}
              alt={`${profile.username || profile.name || 'User'}'s avatar`}
              frameId={activeFrame}
              size={120}
            />
          </div>
          {/* Username above name */}
          {profile.username && (
            <h2 className="profile-username">{profile.username}</h2>
          )}
          {!profile.username && profile.email && (
            <h2 className="profile-username">{profile.email.split('@')[0]}</h2>
          )}
          {/* Custom title (level 6+) */}
          {profileTitle && (
            <div className="profile-custom-title">{profileTitle}</div>
          )}
          <div className="profile-name">{profile.name}</div>
          <div className="profile-email">{profile.email}</div>
          <div className="profile-level-label">Level {profile.level}</div>
          <div className="profile-level-section">
            <div className="profile-level-bar-bg">
              <div className="profile-level-bar-fill" style={{ width: `${profile.levelProgress}%` }}></div>
              <div className="profile-level-bar-label">
                {profile.totalPoints || 0} pts ({profile.levelPointsInLevel || 0}/{profile.levelPointsForLevel || 0} to next level)
              </div>
            </div>
          </div>
          {/* Next unlock hint */}
          {profile.level < 10 && (() => {
            const next = getNextUnlock(profile.level, profile.totalPoints);
            if (!next) return null;
            return (
              <div className="profile-next-unlock">
                <span className="profile-next-unlock-icon">{next.unlock.icon}</span>
                <span className="profile-next-unlock-text">
                  {next.ptsToUnlock === 0
                    ? `${next.unlock.name} ready to unlock!`
                    : `${next.ptsToUnlock} pts → unlock ${next.unlock.name}`
                  } <span className="profile-next-unlock-level">(Lv. {next.level})</span>
                </span>
              </div>
            );
          })()}
          {(profile.department || profile.program) && (
            <div style={{ width: "100%", marginTop: 18 }}>
              <div className="profile-skills-label">Department & Program</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {profile.department && (
                  <span style={{ fontSize: "0.85rem", color: "#475569", background: "#f1f5f9", borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                    {profile.department}
                  </span>
                )}
                {profile.program && (
                  <span style={{ fontSize: "0.85rem", color: "#000", background: "#e0f2fe", borderRadius: 8, padding: "4px 10px", display: "inline-block", fontWeight: 600 }}>
                    {profile.program}
                  </span>
                )}
              </div>
            </div>
          )}
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-skills-label">Skills</div>
            <div className="profile-skills-list">
              {profile.skills && profile.skills.map(skill => (
                <span className="profile-skill-badge" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", marginTop: 18 }}>
            <div className="profile-interests-label">Interests</div>
            <div className="profile-interests-list">
              {profile.interests && profile.interests.map(interest => (
                <span className="profile-interest-badge" key={interest}>{interest}</span>
              ))}
            </div>
          </div>
          {/* Bio (level 2+) */}
          {bio && (
            <div style={{ width: '100%', marginTop: 14 }}>
              <div className="profile-skills-label">About Me</div>
              <div className="profile-bio-text">{bio}</div>
            </div>
          )}

          {/* Pinned badges (level 9+) */}
          {pinnedBadges.length > 0 && (() => {
            const pinnedDefs = pinnedBadges
              .map(id => earnedBadges.find(b => (b.badgeId ?? b.id) === id))
              .filter(Boolean);
            if (pinnedDefs.length === 0) return null;
            return (
              <div style={{ width: '100%', marginTop: 14 }}>
                <div className="profile-skills-label">📌 Pinned Badges</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                  {pinnedDefs.map(b => {
                    const bid = b.badgeId ?? b.id;
                    return (
                      <div key={bid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <BadgeIcon badgeId={bid} earned size="sm" />
                        <span style={{ fontSize: '0.7rem', color: '#475569', textAlign: 'center', maxWidth: 56 }}>{b.name || bid}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <button
            className="profile-edit-btn"
            onClick={() => { setEditOpen(true); setProfileMsg({ type: '', text: '' }); }}
            aria-label="Edit your profile"
          >
            ✏️ Edit Profile
          </button>
          {profileMsg.text && (
            <div style={{ color: profileMsg.type === 'error' ? '#ef4444' : '#10b981', fontWeight: 500, fontSize: '0.9rem', marginTop: 8, textAlign: 'center' }}>
              {profileMsg.text}
            </div>
          )}


          <EditProfileModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            profile={profile || {}}
            role={profile?.role}
            level={profile?.level || 1}
            activeFrame={activeFrame}
            bio={bio}
            profileBgColor={profileBgColor}
            profileTitle={profileTitle}
            profileGlow={profileGlow}
            pinnedBadges={pinnedBadges}
            earnedBadges={earnedBadges}
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
                if (updated.activeFrame) setActiveFrame(updated.activeFrame);
                if ('bio'            in updated) setBio(updated.bio ?? '');
                if ('profileBgColor' in updated) setProfileBgColor(updated.profileBgColor ?? '');
                if ('profileTitle'   in updated) setProfileTitle(updated.profileTitle ?? '');
                if ('profileGlow'    in updated) setProfileGlow(updated.profileGlow ?? '');
                if (Array.isArray(updated.pinnedBadges)) setPinnedBadges(updated.pinnedBadges);
                refreshUserData();
                setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
              } catch (err) {
                setProfileMsg({ type: 'error', text: 'Failed to update profile. Please try again.' });
              } finally {
                setEditOpen(false);
              }
            }}
          />
        </div>
        <div className="profile-right-column">
          {/* Tab Navigation */}
          <div className="profile-tab-row" role="tablist" aria-label="Profile sections">
            {PROFILE_TABS.map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`profile-tabpanel-${tab}`}
                id={`profile-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`profile-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onKeyDown={e => {
                  const idx = PROFILE_TABS.indexOf(tab);
                  if (e.key === 'ArrowRight') { e.preventDefault(); setActiveTab(PROFILE_TABS[(idx + 1) % PROFILE_TABS.length]); }
                  if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveTab(PROFILE_TABS[(idx - 1 + PROFILE_TABS.length) % PROFILE_TABS.length]); }
                }}
              >
                {tab === 'Overview' ? '📋 Overview' : tab === 'Badges' ? '🏅 Badges' : '🗂️ Portfolio'}
              </button>
            ))}
          </div>

          {activeTab === "Overview" && (
            <div role="tabpanel" id="profile-tabpanel-Overview" aria-labelledby="profile-tab-Overview" className="profile-tab-panel">
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

              {/* ── Registered Events ─────────────────────────────── */}
              {(() => {
                const allEvents = profile.registeredEvents || [];

                // Filter
                const filtered = historyFilter === "all"
                  ? allEvents
                  : allEvents.filter(e => {
                      if (historyFilter === "attended") return e.attendanceStatus === "present";
                      if (historyFilter === "absent") return e.attendanceStatus !== "present";
                      return e.status === historyFilter;
                    });

                // Sort
                const sorted = [...filtered].sort((a, b) => {
                  if (historySort === "points") return ((b.pointsEarned || 0) + (b.requirementPoints || 0)) - ((a.pointsEarned || 0) + (a.requirementPoints || 0));
                  const da = a.targetDate ? new Date(a.targetDate) : new Date(0);
                  const db2 = b.targetDate ? new Date(b.targetDate) : new Date(0);
                  return historySort === "date_asc" ? da - db2 : db2 - da;
                });

                const statusMeta = {
                  active:    { label: "Active",    bg: "#d1fae5", color: "#065f46" },
                  published: { label: "Active",    bg: "#d1fae5", color: "#065f46" },
                  completed: { label: "Completed", bg: "#dbeafe", color: "#1e40af" },
                  cancelled: { label: "Cancelled", bg: "#fee2e2", color: "#991b1b" },
                  unknown:   { label: "Unknown",   bg: "#f3f4f6", color: "#6b7280" },
                };
                const roleMeta = {
                  participant:    { label: "Participant",     bg: "#f0fdf4", color: "#166534" },
                  organizer:      { label: "Organizer",       bg: "#eff6ff", color: "#1d4ed8" },
                  lead_organizer: { label: "Lead Organizer",  bg: "#faf5ff", color: "#6b21a8" },
                  donor:          { label: "Donor",           bg: "#fff7ed", color: "#9a3412" },
                };

                return (
                  <div className="peh-section">
                    <div className="peh-header">
                      <div className="peh-title">Events You've Joined <span className="peh-count">({allEvents.length})</span></div>
                      <div className="peh-controls">
                        <select className="peh-select" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
                          <option value="all">All</option>
                          <option value="active">Active</option>
                          <option value="published">Published</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="attended">Attended ✓</option>
                          <option value="absent">Absent</option>
                        </select>
                        <select className="peh-select" value={historySort} onChange={e => setHistorySort(e.target.value)}>
                          <option value="date_desc">Newest first</option>
                          <option value="date_asc">Oldest first</option>
                          <option value="points">Most points</option>
                        </select>
                      </div>
                    </div>

                    {sorted.length === 0 ? (
                      <div className="peh-empty">
                        {allEvents.length === 0
                          ? "You haven't joined any events yet. Explore missions to get started!"
                          : "No events match the current filter."}
                      </div>
                    ) : (
                      <div className="peh-grid">
                        {sorted.map(ev => {
                          const sm = statusMeta[ev.status] || statusMeta.unknown;
                          const rm = roleMeta[ev.role] || { label: ev.role, bg: "#f3f4f6", color: "#374151" };
                          const hasCert = certificates.some(c => c.eventId === ev.id || c.missionId === ev.id);
                          const tasksTotal = ev.tasksDone?.length || 0;
                          const tasksDone = ev.tasksDone?.filter(t => t.status === "done" || t.status === "completed").length || 0;
                          return (
                            <div className="peh-card" key={ev.id}>
                              <div className="peh-card-top">
                                <div className="peh-card-title">{ev.title}</div>
                                <span className="peh-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                              </div>
                              <div className="peh-card-row">
                                <span className="peh-badge" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                                {ev.attendanceStatus === "present"
                                  ? <span className="peh-badge" style={{ background: "#d1fae5", color: "#065f46" }}>✓ Attended</span>
                                  : ev.attendanceStatus === "absent"
                                    ? <span className="peh-badge" style={{ background: "#fee2e2", color: "#991b1b" }}>✗ Absent</span>
                                    : <span className="peh-badge" style={{ background: "#f3f4f6", color: "#9ca3af" }}>— Attendance pending</span>}
                                {hasCert && <span className="peh-badge" style={{ background: "#fef9c3", color: "#854d0e" }}>🎓 Certificate</span>}
                              </div>
                              <div className="peh-card-stats">
                                <span className="peh-stat">⭐ {(ev.pointsEarned || 0) + (ev.requirementPoints || 0)} pts</span>
                                {tasksTotal > 0 && <span className="peh-stat">✅ {tasksDone}/{tasksTotal} tasks</span>}
                                {ev.targetDate && <span className="peh-stat">📅 {ev.targetDate instanceof Date ? ev.targetDate.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : ev.targetDate}</span>}
                              </div>
                              {ev.sdgs && ev.sdgs.length > 0 && (
                                <div className="peh-sdgs">
                                  {ev.sdgs.slice(0, 5).map(sdg => (
                                    <span key={sdg} className="peh-sdg-dot" style={{ background: SDG_COLORS[sdg] || "#234e7b" }} title={`SDG ${sdg}`}>#{sdg}</span>
                                  ))}
                                  {ev.sdgs.length > 5 && <span className="peh-sdg-dot" style={{ background: "#94a3b8" }}>+{ev.sdgs.length - 5}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Events I Proposed ───────────────────────────── */}
              {(() => {
                const proposed = profile.proposedEvents || [];
                const statusMeta = {
                  active:    { label: "Active",    bg: "#d1fae5", color: "#065f46" },
                  published: { label: "Active",    bg: "#d1fae5", color: "#065f46" },
                  completed: { label: "Completed", bg: "#dbeafe", color: "#1e40af" },
                  cancelled: { label: "Cancelled", bg: "#fee2e2", color: "#991b1b" },
                  pending:   { label: "Pending",   bg: "#fef9c3", color: "#854d0e" },
                  unknown:   { label: "Unknown",   bg: "#f3f4f6", color: "#6b7280" },
                };
                const typeLabel = t =>
                  t === "sl" ? "Service Learning"
                  : t === "ce" ? "Community Engagement"
                  : "Event";
                return (
                  <div className="peh-section" style={{ marginTop: 20 }}>
                    <div className="peh-header">
                      <div className="peh-title">
                        📋 Events I Proposed{" "}
                        <span className="peh-count">({proposed.length})</span>
                      </div>
                    </div>

                    {proposed.length === 0 ? (
                      <div className="peh-empty">
                        You haven&apos;t proposed any events yet.
                      </div>
                    ) : (
                      <div className="peh-grid">
                        {proposed.map(ev => {
                          const sm = statusMeta[ev.status] || statusMeta.unknown;
                          return (
                            <div className="peh-card" key={ev.id} style={{ borderLeft: "3px solid #30bdb7" }}>
                              <div className="peh-card-top">
                                <div className="peh-card-title">{ev.title}</div>
                                <span className="peh-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                              </div>
                              <div className="peh-card-row">
                                <span className="peh-badge" style={{ background: "#f0fdf4", color: "#166534" }}>
                                  🖊 Proponent
                                </span>
                                {ev.projectType && (
                                  <span className="peh-badge" style={{ background: "#e8edf7", color: "#000" }}>
                                    {typeLabel(ev.projectType)}
                                  </span>
                                )}
                              </div>
                              <div className="peh-card-stats">
                                {ev.targetDate && (
                                  <span className="peh-stat">
                                    📅 {ev.targetDate instanceof Date
                                      ? ev.targetDate.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
                                      : ev.targetDate}
                                  </span>
                                )}
                                {ev.proponents && ev.proponents.length > 1 && (
                                  <span className="peh-stat">👥 {ev.proponents.length} proponents</span>
                                )}
                              </div>
                              {ev.sdgs && ev.sdgs.length > 0 && (
                                <div className="peh-sdgs">
                                  {ev.sdgs.slice(0, 5).map(sdg => (
                                    <span key={sdg} className="peh-sdg-dot" style={{ background: SDG_COLORS[sdg] || "#234e7b" }} title={`SDG ${sdg}`}>#{sdg}</span>
                                  ))}
                                  {ev.sdgs.length > 5 && <span className="peh-sdg-dot" style={{ background: "#94a3b8" }}>+{ev.sdgs.length - 5}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === "Badges" && (
            <div role="tabpanel" id="profile-tabpanel-Badges" aria-labelledby="profile-tab-Badges" className="profile-tab-panel">
              <BadgeShelf earnedBadges={earnedBadges} customBadges={customBadges} />
            </div>
          )}

          {activeTab === "Portfolio" && (() => {
            const events = profile.registeredEvents || [];
            const sdgCounts = events.flatMap(e => e.sdgs || []).reduce((acc, sdg) => {
              acc[sdg] = (acc[sdg] || 0) + 1;
              return acc;
            }, {});
            const allSdgs = Object.keys(sdgCounts).map(k => Number(k));
            return (
              <div className="portfolio-tab">

                {/* Export button */}
                <div className="export-row">
                  <button onClick={exportToPDF} disabled={exporting} className={`profile-export-btn ${exporting ? 'disabled' : ''}`}>
                    ⬇ Export PDF
                  </button>
                  {exportError && <div className="export-error">{exportError}</div>}
                </div>

                {/* Achievements */}
                <div className="portfolio-section">
                  <div className="card-title">🏅 Achievements <span className="muted-count">({earnedBadges.length})</span></div>
                  {earnedBadges.length === 0
                    ? <p className="muted-text">No achievements yet.</p>
                    : (
                      <div className="achievements-grid">
                        {earnedBadges.map(b => {
                          const bid = b.badgeId ?? b.id;
                          const def = BADGE_BY_ID[bid];
                          return (
                            <div key={bid} title={def?.criteria || def?.description || bid} className="achievement-card">
                              <div className="achievement-icon">
                                <BadgeIcon badgeId={bid} earned={true} size="md" />
                              </div>
                              <div className="achievement-name">{def?.name || b.name || bid}</div>
                              {def?.criteria && <div className="achievement-desc">{def.criteria}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* SDG Contributions */}
                <div className="portfolio-section">
                  <div className="card-title">🌍 SDG Contributions</div>
                  {allSdgs.length === 0
                    ? <p className="muted-text">No SDG contributions yet.</p>
                    : (
                      <div className="sdg-list">
                        {allSdgs.sort((a, b) => a - b).map(sdg => (
                          <div key={sdg} className="sdg-badge" style={{ background: SDG_COLORS[sdg] || '#234e7b' }}>
                            <span className="sdg-index">#{sdg}</span>
                            <span className="sdg-label">{SDG_LABELS[sdg] || `Goal ${sdg}`}</span>
                            <span className="sdg-count">{sdgCounts[sdg]}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Events by Role */}
                <div className="portfolio-section">
                  <div className="card-title">📋 Events by Role</div>
                  {events.length === 0
                    ? <p className="muted-text">No events joined yet.</p>
                    : (
                      <div className="events-list">
                        {events.map(event => (
                          <div key={event.id} className="event-card">
                            <div className="event-card-row">
                              <span className="event-title">{event.title}</span>
                              <div className="event-meta">
                                <span className="event-role">{event.role}</span>
                                <span className="event-points">+{(event.pointsEarned || 0) + (event.requirementPoints || 0)} pts</span>
                              </div>
                            </div>
                            {event.tasksDone && event.tasksDone.length > 0 && (
                              <div className="event-tasks">
                                {event.tasksDone.map(t => (
                                  <div key={t.id} className="event-task-row">
                                    <div className="task-left">
                                      <span className="task-dot" style={{
                                        background: t.status === 'done' || t.status === 'completed' ? '#10b981' : '#d1d5db'
                                      }} />
                                      <span className="task-title">{t.title}</span>
                                    </div>
                                    <div className="task-right">
                                      <span className={`task-status-badge task-status-${t.status}`}>{t.status}</span>
                                      {t.pointsEarned > 0 && <span className="task-points">+{t.pointsEarned} pts</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Certificates */}
                <div id="certificates" className="portfolio-section">
                  <div className="card-title">🎓 Certificates <span className="muted-count">({certificates.length})</span></div>
                  {certificates.length === 0
                    ? <p className="muted-text">No certificates yet.</p>
                    : (
                      <div className="cert-list">
                        {certificates.map((cert, idx) => (
                          <div
                            key={cert.id}
                            onClick={() => setSelectedCert(cert)}
                            className={`cert-list-item${idx === 0 && highlightFirstCert ? " cert-list-item--highlight" : ""}`}
                            style={{ borderBottom: idx < certificates.length - 1 ? "1px solid #e2e8f0" : "none" }}
                          >
                            {/* Scaled-down PDF template preview */}
                            <div className="cert-thumb">
                              <iframe
                                src="/assets/SERVE+ Certificate.pdf#toolbar=0&navpanes=0&scrollbar=0"
                                title="Certificate preview"
                                className="cert-thumb-iframe"
                                tabIndex={-1}
                                scrolling="no"
                              />
                            </div>

                            {/* Details */}
                            <div className="cert-list-details">
                              <div className="cert-list-label">SerVe+ · Mission</div>
                              <div className="cert-list-course">{cert.course}</div>
                              <div className="cert-list-cta">View certificate ↗</div>
                              {(cert.month || cert.date) && (
                                <div className="cert-list-date">
                                  Completed {cert.month} {cert.year || cert.date}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            );
          })()}

                    {/* Gallery Tab */}
          {activeTab === "Gallery" && (
            <div role="tabpanel" id="profile-tabpanel-Gallery" aria-labelledby="profile-tab-Gallery" className="profile-tab-panel">
              <div className="gallery-container">
                <div className="gallery-header">
                  <div className="gallery-title">📸 My Participation Gallery</div>
                  <button 
                    className="gallery-upload-btn"
                    onClick={() => setShowGalleryUpload(true)}
                  >
                    + Add Photo
                  </button>
                </div>
                
                {galleryLoading ? (
                  <div className="gallery-loading">Loading your photos...</div>
                ) : galleryImages.length === 0 ? (
                  <div className="gallery-empty">
                    <div className="gallery-empty-icon">📷</div>
                    <p>No photos yet</p>
                    <p className="gallery-empty-subtext">Share your volunteer moments by uploading photos!</p>
                  </div>
                ) : (
                  <div className="gallery-grid">
                    {galleryImages.map((image) => (
                      <div key={image.id} className="gallery-item">
                        <div className="gallery-image-wrapper">
                          <img 
                            src={image.url} 
                            alt={image.caption || 'Gallery image'} 
                            className="gallery-image"
                            onClick={() => setSelectedGalleryImage(image)}
                          />
                          <button 
                            className="gallery-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGalleryImage(image.id);
                            }}
                            title="Delete photo"
                          >
                            ×
                          </button>
                        </div>
                        {image.caption && <div className="gallery-caption">{image.caption}</div>}
                        {image.eventTitle && <div className="gallery-event-tag">📍 {image.eventTitle}</div>}
                        <div className="gallery-date">
                          {new Date(image.createdAt?.toDate?.() || image.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Hidden PDF layout ── */}
          {profile && (() => {
            const events = profile.registeredEvents || [];
            const sdgCounts = events.flatMap(e => e.sdgs || []).reduce((acc, sdg) => {
              acc[sdg] = (acc[sdg] || 0) + 1;
              return acc;
            }, {});
            const allSdgs = Object.keys(sdgCounts).map(k => Number(k));
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
                      <div style={{ fontWeight: 700, color: '#000', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Skills</div>
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

                  {/* Achievements — students only */}
                  {profile?.role === "student" && (
                  <div>
                    <div style={{ fontWeight: 700, color: '#000', fontSize: 15, marginBottom: 12 }}>Achievements <span style={{ color: '#30bdb7', fontWeight: 500, fontSize: 13 }}>({earnedBadges.length})</span></div>
                    {earnedBadges.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No achievements yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {earnedBadges.map(b => {
                          const bid = b.badgeId ?? b.id;
                          const def = BADGE_BY_ID[bid];
                          return (
                            <div key={bid} style={{ background: 'linear-gradient(135deg, #e8f5e9, #f0fdf4)', border: '1.5px solid #4caf50', borderRadius: 8, padding: '10px 14px', minWidth: 110, textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <BadgeIcon badgeId={bid} earned={true} size="sm" />
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 11, color: '#000', marginTop: 4 }}>{def?.name || b.name || bid}</div>
                              {def?.criteria && <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>{def.criteria}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e0e7ef' }} />

                  {/* SDG Contributions */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#000', fontSize: 15, marginBottom: 12 }}>SDG Contributions</div>
                    {allSdgs.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No SDG contributions yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {allSdgs.sort((a, b) => a - b).map(sdg => (
                          <div key={sdg} style={{ background: SDG_COLORS[sdg] || '#234e7b', color: '#fff', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, color: '#fff' }}>#{sdg}</span>
                            <span style={{ flex: '1 1 auto', color: '#fff' }}>{SDG_LABELS[sdg] || `Goal ${sdg}`}</span>
                            <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>{sdgCounts[sdg]}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e0e7ef' }} />

                  {/* Events by Role */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#000', fontSize: 15, marginBottom: 12 }}>Events by Role</div>
                    {events.length === 0 ? (
                      <p style={{ color: '#bbb', fontSize: 12 }}>No events joined yet.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f0f4f8' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#000', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Event</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', color: '#000', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Role</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#000', fontWeight: 700, borderBottom: '2px solid #e0e7ef' }}>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {events.map((event, idx) => (
                            <React.Fragment key={event.id}>
                              <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f7fafd' }}>
                                <td style={{ padding: '8px 12px', color: '#333', borderBottom: '1px solid #f0f4f8' }}>{event.title}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f0f4f8' }}>
                                  <span style={{ background: '#30bdb7', color: '#fff', borderRadius: 4, padding: '2px 9px', fontWeight: 600 }}>{event.role}</span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#000', borderBottom: '1px solid #f0f4f8' }}>+{(event.pointsEarned || 0) + (event.requirementPoints || 0)}</td>
                              </tr>

                              {event.tasksDone && event.tasksDone.length > 0 && (
                                <tr>
                                  <td colSpan={3} style={{ padding: '8px 12px', borderBottom: '1px solid #f0f4f8', background: idx % 2 === 0 ? '#fafcfd' : '#fefefe' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {event.tasksDone.map(t => (
                                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 11, paddingLeft: 20 }}>
                                          <div style={{ color: '#000', fontWeight: 600, fontSize: 11 }}>{t.title} <span style={{ color: '#666', fontWeight: 500, fontSize: 11 }}>· {t.status}</span></div>
                                          <div style={{ color: '#000', fontWeight: 600, fontSize: 11 }}>+{t.pointsEarned} pts</div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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
