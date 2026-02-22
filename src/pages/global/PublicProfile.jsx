import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import Header from "../../components/Header";
import "../../styles/Profile.css";
import "../../styles/PublicProfile.css";

const DEFAULT_AVATAR = "/assets/headassets/default-avatar.png";

const TABS = ["Overview", "Events Joined", "Rewards & Badges"];

export default function PublicProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch user profile
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) {
          setError("User not found.");
          setLoading(false);
          return;
        }
        const profileData = { uid, ...userSnap.data() };

        // Fetch events the user is registered in (volunteer subcollection)
        const missionsSnap = await getDocs(collection(db, "missions"));
        const registeredEvents = [];
        let totalPoints = 0;

        for (const eventDoc of missionsSnap.docs) {
          const eventId = eventDoc.id;
          const eventData = eventDoc.data();
          const volunteerSnap = await getDoc(doc(db, "missions", eventId, "volunteer", uid));
          if (volunteerSnap.exists()) {
            const vData = volunteerSnap.data();
            registeredEvents.push({
              id: eventId,
              title: eventData.title || eventId,
              date: eventData.date || eventData.startDate || null,
              status: eventData.status || "unknown",
              role: vData.role || "participant",
              pointsEarned: vData.pointsEarned || 0,
            });
            totalPoints += vData.pointsEarned || 0;
          }
        }

        profileData.totalPoints = totalPoints;
        profileData.level = Math.floor(totalPoints / 100) + 1;
        profileData.levelProgress = totalPoints % 100;

        setProfile(profileData);
        setEvents(registeredEvents);

        // Fetch rewards from users/{uid}/rewards subcollection
        const rewardsSnap = await getDocs(collection(db, "users", uid, "rewards"));
        const rewardsList = rewardsSnap.docs.map(r => ({ id: r.id, ...r.data() }));
        setRewards(rewardsList);
      } catch (err) {
        console.error("PublicProfile fetch error:", err);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uid]);

  if (loading) {
    return (
      <div className="profile-page-bg">
        <Header />
        <div style={{ textAlign: "center", marginTop: 80, color: "#234e7b" }}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page-bg">
        <Header />
        <div style={{ textAlign: "center", marginTop: 80, color: "#e53e3e" }}>{error || "User not found."}</div>
      </div>
    );
  }

  const displayName =
    profile.displayName || profile.name || profile.username ||
    (profile.email ? profile.email.split("@")[0] : "") || "User";

  const avatarSrc =
    profile.photoURL || profile.avatar || profile.photo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=30bdb7&color=fff&size=256`;

  return (
    <div className="profile-page-bg">
      <Header />
      <div className="pub-profile-container">
        {/* Profile Header Card */}
        <div className="pub-profile-header-card">
          <img
            className="pub-profile-avatar"
            src={avatarSrc}
            alt={`${displayName}'s avatar`}
            onError={e => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
          />
          <div className="pub-profile-info">
            <h1 className="pub-profile-name">{displayName}</h1>
            {profile.email && <p className="pub-profile-email">{profile.email}</p>}
            {profile.bio && <p className="pub-profile-bio">{profile.bio}</p>}
            <div className="pub-profile-stats">
              <div className="pub-stat">
                <span className="pub-stat-value">{profile.totalPoints || 0}</span>
                <span className="pub-stat-label">Points</span>
              </div>
              <div className="pub-stat">
                <span className="pub-stat-value">Lv. {profile.level || 1}</span>
                <span className="pub-stat-label">Level</span>
              </div>
              <div className="pub-stat">
                <span className="pub-stat-value">{events.length}</span>
                <span className="pub-stat-label">Events</span>
              </div>
              <div className="pub-stat">
                <span className="pub-stat-value">{rewards.length}</span>
                <span className="pub-stat-label">Rewards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="pub-profile-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`pub-profile-tab-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pub-profile-tab-content">
          {activeTab === "Overview" && (
            <div className="pub-profile-overview">
              {profile.skills && profile.skills.length > 0 && (
                <div className="pub-profile-section">
                  <h3>Skills</h3>
                  <div className="pub-badge-list">
                    {profile.skills.map(s => <span key={s} className="profile-skill-badge">{s}</span>)}
                  </div>
                </div>
              )}
              {profile.interests && profile.interests.length > 0 && (
                <div className="pub-profile-section">
                  <h3>Interests</h3>
                  <div className="pub-badge-list">
                    {profile.interests.map(i => <span key={i} className="profile-interest-badge">{i}</span>)}
                  </div>
                </div>
              )}
              {/* Level Progress */}
              <div className="pub-profile-section">
                <h3>Level Progress</h3>
                <div className="profile-level-bar-bg">
                  <div className="profile-level-bar-fill" style={{ width: `${profile.levelProgress}%` }}></div>
                  <div className="profile-level-bar-label">
                    {profile.totalPoints || 0} pts ({profile.levelProgress || 0}/100 to next level)
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Events Joined" && (
            <div className="pub-profile-section">
              <h3>Events Joined ({events.length})</h3>
              {events.length === 0 ? (
                <p className="pub-empty-msg">No events joined yet.</p>
              ) : (
                <div className="pub-events-list">
                  {events.map(event => (
                    <div key={event.id} className="pub-event-card">
                      <div className="pub-event-title">{event.title}</div>
                      <div className="pub-event-meta">
                        <span className="pub-event-role">{event.role}</span>
                        {event.date && (
                          <span className="pub-event-date">
                            {typeof event.date === "string"
                              ? event.date
                              : new Date(event.date.seconds * 1000).toLocaleDateString()}
                          </span>
                        )}
                        <span className="pub-event-points">+{event.pointsEarned} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "Rewards & Badges" && (
            <div className="pub-profile-section">
              <h3>Rewards & Badges ({rewards.length})</h3>
              {rewards.length === 0 ? (
                <p className="pub-empty-msg">No rewards or badges earned yet.</p>
              ) : (
                <div className="pub-rewards-grid">
                  {rewards.map((reward, idx) => (
                    <div key={reward.id || idx} className="pub-reward-card">
                      <div className="pub-reward-icon">
                        {reward.icon ? (
                          <img src={reward.icon} alt={reward.name || "reward"} />
                        ) : (
                          <span className="pub-reward-default-icon">🏅</span>
                        )}
                      </div>
                      <div className="pub-reward-name">{reward.name || reward.id}</div>
                      {reward.description && (
                        <div className="pub-reward-desc">{reward.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
