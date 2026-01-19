import { Link, useNavigate } from "react-router-dom";
import { auth, functions, db } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";

import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../components/Header";
import GlobalAnnouncements from "../../components/GlobalAnnouncements";
import "../../styles/student.css";
import "../../styles/ui.css";
import { WestIcon, EastIcon } from "../../components/icons";

//sample-- to be paltan ng saved profile pic sa firestore
import mission1 from '../../assets/mission1.jpg';
import podium1 from '../../assets/user1.png';
import podium2 from '../../assets/user2.png';
import podium3 from '../../assets/user3.png';

const StudentHome = () => {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [notificationOverlayOpen, setNotificationOverlayOpen] = useState(false);
  const [open, setOpen] = useState(false); // Global feed panel state
  const button2Ref = React.useRef(null);
  const button3Ref = React.useRef(null);

  // Dynamic placeholders
  const [level, setLevel] = useState(5);
  const [currentPoints, setCurrentPoints] = useState(350);
  const [nextLevelPoints, setNextLevelPoints] = useState(500);
  const [studentName, setStudentName] = useState("Joshua");
  const [studentRank, setStudentRank] = useState(8);
  const currentUserRef = useRef(null);
  const leaderboardListRef = useRef(null);
  const [missionCards, setMissionCards] = useState([]);

  // Fetch missions from Firestore
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "Missions"));
        const missions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMissionCards(missions);
      } catch (error) {
        console.error("Error fetching missions:", error);
      }
    };
    fetchMissions();
  }, []);

  const [menuProfileName, setMenuProfileName] = useState("Joshua Garcia");
  const navigate = useNavigate();

  useEffect(() => {
    // use firebase auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setShowLogoutPopup(false);
        const resolvedName = user.displayName || user.email || "Student";
        setStudentName(resolvedName);
        setMenuProfileName(resolvedName);
      } else {
        setShowLogoutPopup(true);
      }
    });

    return unsubscribe;
  }, []);

  async function handleLogout() {
    const user = auth.currentUser;
    try {
      console.log("Attempting to log logout for:", user?.uid);
      if (user?.uid) {
        const logLogout = httpsCallable(functions, "logLogout");
        await logLogout({ uid: user.uid });
      }
    } catch (e) {
      // Log audit failures when logging out
      console.error("Audit log (logout) failed:", e);
    }

    try {
      await signOut(auth);
    } catch (e) {
      // Ignore sign-out failures for now
    }

    navigate("/auth");
  }

  const handleMenuOverlayToggle = () => setMenuOverlayOpen((open) => !open);
  const handleChatOverlayToggle = () => setChatOverlayOpen((open) => !open);
  const handleNotificationOverlayToggle = () => setNotificationOverlayOpen((open) => !open);


  //leaderboard firestore-ready
  //change this when points for user accounts are set
  const [leaderboard, setLeaderboard] = useState([
    { uid: "u1", name: "Juan", points: 1400, avatar: podium1 },
    { uid: "u2", name: "Aly", points: 1300, avatar: podium2 },
    { uid: "u3", name: "Jien", points: 1200, avatar: podium3 },
    { uid: "u4", name: "Vaughn", points: 1100, avatar: podium1 },
  ]);

  //for leaderboards ranking in the podium UI
  //do not delete
  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.points - a.points
  );
  const top1 = sortedLeaderboard[0];
  const top2 = sortedLeaderboard[1];
  const top3 = sortedLeaderboard[2];
  const podium = [top2, top1, top3].filter(Boolean);

  //change this currentUserId to user account when defined
  const currentUserId = "u2";
  const currentUserIndex = leaderboard.findIndex(
    (user) => user.uid === currentUserId
  );
  const currentUserRank =
    currentUserIndex !== -1 ? currentUserIndex + 1 : null;


  const visibleLeaderboard = leaderboard.slice(
    Math.max(0, currentUserIndex - 1),
    currentUserIndex + 2
  );

  //purpose: scroll the leaderboard-list to current rank of user logged in
  useEffect(() => {
    const container = leaderboardListRef.current;
    const item = currentUserRef.current;

    if (!container || !item) return;

    requestAnimationFrame(() => {
      const containerHeight = container.getBoundingClientRect().height;
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const itemCenter =
        itemRect.top - containerRect.top + itemRect.height / 2;

      const scrollTop =
        itemCenter - containerHeight / 2 + container.scrollTop;

      container.scrollTo({
        top: scrollTop,
        behavior: "auto",
      });
    });
  }, []);

  //for the ranking of the user logged in for label
  const getOrdinal = (rank) => {
    if (!rank) return "";

    const j = rank % 10;
    const k = rank % 100;

    if (j === 1 && k !== 11) return `${rank}st`;
    if (j === 2 && k !== 12) return `${rank}nd`;
    if (j === 3 && k !== 13) return `${rank}rd`;
    return `${rank}th`;
  };
  
  return (
    <div className="full-page" >
      {/* Logout Popup */}
      {showLogoutPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '32px 40px', borderRadius: 16, boxShadow: '0 4px 24px #0003', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 12, color: '#234e7b' }}>You have been logged out</div>
            <div style={{ fontSize: 16, color: '#555', marginBottom: 18 }}>Your session has ended. Please log in again to continue.</div>
            <button style={{ background: '#234e7b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => { setShowLogoutPopup(false); navigate('/auth', { replace: true }); }}>OK</button>
          </div>
        </div>
      )}
      {/* Header */}
      <Header />

      <div className="header-spacer"></div>
      <div className="content-page">
        {/* LANDING PAGE */}
        <section className="landing-section" >
          <h2 style={{ color: '#000' }}>Anouncement Image Page Here</h2>
          <div className="landing-page-content">
            <div className="landing-page-num">
              <button className="ui-btn-page"><WestIcon /></button>
              <span className="ui-smallText"> 01 / 05</span>
              <button className="ui-btn-page"><EastIcon /></button>
            </div>
            <button className="ui-btn">Click for more info</button>
          </div>

        </section>
        {/* PROFILE LEVEL RANK */}
        <section className="player-strip">
          <div className="player-strip-inner">
            <div className="player-level">
              <span className="level-label">Level 1</span>
              <div className="level-bar">
                <div className="level-bar-fill" style={{ width: '50%' }}></div>
              </div>
              <span className="level-points">50/ 100 pts</span>
            </div>

            <div className="player-missions">
              <span className="missions-label">Missions Completed</span>
              <span className="missions-count">0</span>
            </div>

            <div className="player-profile">
              <img src={podium2} alt="Profile"
                className="player-avatar" />
              <span className="player-greeting">Hi, Aly!</span>
            </div>
          </div>
        </section>
        {/* MISSION */}
        <section className="mission-section">
          <div className="mission-section-header">
            <h2 style={{ color: '#000' }}>Find Your Next Mission</h2>
            <div className="mission-section-header links">
              <a href="#" onClick={(e) => e.preventDefault()}>
                All Missions
              </a>
              <a href="#" onClick={(e) => e.preventDefault()}>
                Your Missions
              </a>
            </div>
          </div>
          <div className="mission-list">
            {missionCards.length === 0 ? (
              <div className="ui-smallText">No missions available.</div>
            ) : (
              missionCards.map((mission, idx) => (
                <div
                  key={mission.id}
                  className="mission-card"
                  onClick={() => window.location.href = `/event/${mission.id}`}
                >
                  <div className="mission-card-image">
                    <img src={mission.img || mission1} alt={mission.alt || mission.title} />
                  </div>
                  <div className="mission-card-body">
                    <h3 className="mission-card-title">{mission.title}</h3>
                    <div className="mission-card-meta">
                      <span className="mission-card-participants">
                        👥 124 Joined
                      </span>
                      <span className="mission-card-date">{mission.date}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        {/* LEADERBOARD */}
        <section className="leaderboard-section">
          <div className="mission-section-header">
            <h2 style={{ color: '#000' }}>Leaderboard</h2>
            <div style={{ color: '#000' }} >You are in {getOrdinal(currentUserRank)} place.</div>
          </div>
          <div className="leaderboard-body">
            <div className="leaderboard-podium">
              {podium.map((user) => {
                const rank =
                  user.uid === top1?.uid ? 1 :
                    user.uid === top2?.uid ? 2 :
                      3;

                return (
                  <div
                    key={user.uid}
                    className={`podium-item rank-${rank}`}
                  >
                    <div className="podium-top">
                      <div className="podium-avatar-wrap">
                        <img
                          src={user.avatar}
                          alt={user.name}
                        />
                        <span className="podium-rank">{rank}</span>

                      </div>

                      <div className="podium-info">
                        <div className="podium-name">{user.name}</div>
                        <div className="podium-points">{user.points} pts</div>
                      </div>
                    </div>
                    <div className={`podium-base rank-${rank}`}></div>
                  </div>
                );
              })}

            </div>
            <div className="leaderboard-list" ref={leaderboardListRef}>
              {leaderboard.map((user) => {
                const rank = leaderboard.findIndex((u) => u.uid === user.uid) + 1;
                return (
                  <div
                    key={user.uid}
                    ref={user.uid === currentUserId ? currentUserRef : null}
                    className={`leaderboard-row ${user.uid === currentUserId ? "is-current-user" : ""
                      }`}
                  >
                    <span className="rank-num">{rank}</span>
                    <img
                      src={user.avatar}
                      alt={`${user.name}'s avatar`}
                      className="leaderboard-avatar"></img>
                    <span className="rank-name">{user.name}</span>
                    <span className="rank-points">{user.points} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="landing-section" style={{ display: 'none' }}>
        </section>
      </div>
      {/* TOGGLE BUTTON */}
      <button
        className="global-feed-toggle"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle Community Updates"
      >
        📰
        <span className="global-feed-badge">1</span>
      </button>

      {/* SLIDE-IN PANEL */}
      <aside className={`global-feed ${open ? "open" : ""}`}>
        <div className="global-feed-header">
          <h3 className="global-feed-title">Community Updates</h3>
          <p className="global-feed-subtitle">Whats happening this week</p>
        </div>
        {/* Use GlobalAnnouncements component for feed */}
        <div className="global-feed-list">
          <GlobalAnnouncements />
        </div>
      </aside>
    </div>
  );
}

export default StudentHome;
