import { Link, useNavigate } from "react-router-dom";
import { auth, functions, db } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";

import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
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
import banner from '../../assets/banner.jpg';

const StudentHome = () => {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [open, setOpen] = useState(false); // Global feed panel state
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("all"); // All Missions are selected initially
  const button2Ref = React.useRef(null);
  const button3Ref = React.useRef(null);

  // Update unread count from GlobalAnnouncements
  useEffect(() => {
    // Check immediately
    const checkCount = () => {
      if (window.announcementActions?.getUnreadCount) {
        setAnnouncementUnreadCount(window.announcementActions.getUnreadCount());
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 500);
    return () => clearInterval(interval);
  }, []);

  // Dynamic placeholders
  const [level, setLevel] = useState(1);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [nextLevelPoints, setNextLevelPoints] = useState(100);
  const [studentName, setStudentName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAvatar, setStudentAvatar] = useState("");
  const [studentRank, setStudentRank] = useState(8);
  const currentUserRef = useRef(null);
  const leaderboardListRef = useRef(null);
  const [missionCards, setMissionCards] = useState([]);
  const [enrolledMissions, setEnrolledMissions] = useState({});

  // Landing promos which can be created by admins for
  //students to see
  // Change to real data in firestore
  const landingPromos = [
    {
      id: 1,
      title: "Youth Leadership Program",
      description: "A  hands-on journey to build confidence, strengthen teamwork, and practice real-world leadership skills.",
      image: mission1, //image link from firestore
      buttonText: "Learn More",
      buttonLink: "/programs/leadership",
    },
    {
      id: 2,
      title: "Volunteer Outreach",
      image: banner,
      description: "An opportunity to serve communities, connect with people, and create meaningful social impact.",
      buttonText: "Join Now",
      buttonLink: "/activities/volunteer",
    },
    {
      id: 3,
      title: "Entrepreneurship Bootcamp",
      description: "A practical training ground to turn ideas into ventures, with guidance on innovation, business planning, and pitching",
      image: podium1,
      buttonText: "Register",
      buttonLink: "/programs/bootcamp",
    },
  ];
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = landingPromos.length;
  const currentPromo = landingPromos[currentPage];
  const prevPage = () => {
    setCurrentPage((prev) =>
      prev === 0 ? totalPages - 1 : prev - 1
    );
  };

  const nextPage = () => {
    setCurrentPage((prev) =>
      prev === totalPages - 1 ? 0 : prev + 1
    );
  };

  // Fetch missions from Firestore
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const user = auth.currentUser;

        const querySnapshot = await getDocs(collection(db, "missions"));
        const missions = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(m => m.status === "published");

        setMissionCards(missions);

        // Check if user is enrolled
        const enrollmentMap = {};

        if (user) {
          for (const mission of missions) {
            const volunteerRef = doc(
              db,
              "missions",
              mission.id,
              "volunteer",
              user.uid
            );

            const volunteerSnap = await getDoc(volunteerRef);
            enrollmentMap[mission.id] = volunteerSnap.exists();
          }
        }

        setEnrolledMissions(enrollmentMap);

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setShowLogoutPopup(false);
        const resolvedName = user.displayName || user.email || "Student";
        setStudentName(resolvedName);
        setMenuProfileName(resolvedName);

        // Fetch user profile data from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("Fetched user data:", userData); // Debug log
            setStudentUsername(userData.username || "");
            setStudentAvatar(userData.avatar || "");
            setStudentName(userData.name || resolvedName);
            if (userData.level !== undefined) setLevel(userData.level);
            if (userData.levelProgress !== undefined) {
              // levelProgress is a percentage (0-100)
              const progress = userData.levelProgress;
              setCurrentPoints(progress);
              setNextLevelPoints(100);
            }
          } else {
            console.log("No user document found in Firestore");
          }

          // Calculate total points earned across all events
          const missionsRef = collection(db, "missions");
          const missionsSnap = await getDocs(missionsRef);
          let totalPoints = 0;

          for (const missionDoc of missionsSnap.docs) {
            const volunteerRef = doc(db, "missions", missionDoc.id, "volunteer", user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            if (volunteerSnap.exists()) {
              totalPoints += volunteerSnap.data().pointsEarned || 0;
            }
          }

          // Update current points with actual points earned
          setCurrentPoints(totalPoints);

          // Calculate level based on points (every 100 points = 1 level)
          const calculatedLevel = Math.floor(totalPoints / 100) + 1;
          setLevel(calculatedLevel);

          // Calculate progress to next level
          const pointsInCurrentLevel = totalPoints % 100;
          setNextLevelPoints(100);

        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
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


  //leaderboard with actual data from Firestore
  const [leaderboard, setLeaderboard] = useState([]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Fetch all users first
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);

        // Fetch all missions once
        const missionsRef = collection(db, "missions");
        const missionsSnap = await getDocs(missionsRef);

        // Build a map of userId -> totalPoints by fetching all volunteers
        const userPointsMap = new Map();

        for (const missionDoc of missionsSnap.docs) {
          const volunteersRef = collection(db, "missions", missionDoc.id, "volunteer");
          const volunteersSnap = await getDocs(volunteersRef);

          volunteersSnap.docs.forEach(volunteerDoc => {
            const userId = volunteerDoc.id;
            const points = volunteerDoc.data().pointsEarned || 0;
            userPointsMap.set(userId, (userPointsMap.get(userId) || 0) + points);
          });
        }

        // Build leaderboard data
        const leaderboardData = [];

        usersSnap.docs.forEach(userDoc => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const totalPoints = userPointsMap.get(userId) || 0;

          // Include all users who have at least email/name data
          if (userData.email || userData.name || userData.username) {
            leaderboardData.push({
              uid: userId,
              name: userData.username || userData.name || userData.email?.split('@')[0] || 'User',
              points: totalPoints,
              avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || userData.name || 'User')}&background=30bdb7&color=fff&size=120`
            });
          }
        });

        // Sort by points descending
        leaderboardData.sort((a, b) => b.points - a.points);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }
    };

    fetchLeaderboard();
  }, []);

  //for leaderboards ranking in the podium UI
  //do not delete
  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.points - a.points
  );
  const top1 = sortedLeaderboard[0];
  const top2 = sortedLeaderboard[1];
  const top3 = sortedLeaderboard[2];
  const podium = [top2, top1, top3].filter(Boolean);

  //use current user's actual uid
  const currentUserId = auth.currentUser?.uid;
  const currentUserIndex = sortedLeaderboard.findIndex(
    (user) => user.uid === currentUserId
  );
  const currentUserRank =
    currentUserIndex !== -1 ? currentUserIndex + 1 : null;


  const visibleLeaderboard = sortedLeaderboard.slice(
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
      {/* HEADER */}
      <Header />

      <div className="header-spacer"></div>
      <div className="content-page">

        {/* LANDING or PROMO POSTER PAGE */}
        <section className="landing-section">
          <div className="landing-promo-page">
            <img
              src={currentPromo.image}
              alt={currentPromo.title}
              className="promo-image"
            />
            <div className="promo-overlay">
              <h2>{currentPromo.title}</h2>
              <p className="ui-smallText">{currentPromo.description}</p>

              <button
                className="ui-btn"
                onClick={() => navigate(currentPromo.buttonLink)}
              >
                {currentPromo.buttonText}
              </button>
            </div>
          </div>

          <div className="landing-page-control">
            <button className="ui-btn-page"
              onClick={prevPage}>
              <WestIcon />
            </button>

            <span className="ui-smallText" style={{ color: "black" }}>
              {String(currentPage + 1).padStart(2, "0")} /{" "}
              {String(totalPages).padStart(2, "0")}
            </span>
            <button
              className="ui-btn-page"
              onClick={nextPage}              >
              <EastIcon />
            </button>
          </div>
        </section>

        {/* PROFILE LEVEL RANK */}
        <section className="player-strip">
          <div className="player-strip-inner">
            <div className="player-level">
              <span className="level-label">Level {level}</span>
              <div className="level-bar">
                <div className="level-bar-fill" style={{ width: `${(currentPoints % 100)}%` }}></div>
              </div>
              <span className="level-points">{currentPoints} pts ({currentPoints % 100}/100 to next level)</span>
            </div>

            <div className="player-missions">
              <span className="missions-label">Missions Completed</span>
              <span className="missions-count">0</span>
            </div>

            <div className="player-profile">
              {studentAvatar ? (
                <img src={studentAvatar} alt="Profile" className="player-avatar" />
              ) : (
                <img src={podium2} alt="Profile" className="player-avatar" />
              )}
              <span className="player-greeting">
                Hi, {studentUsername || (currentUser?.email ? currentUser.email.split('@')[0] : studentName)}!
              </span>
            </div>
          </div>
        </section>
        {/* MISSION */}
        <section className="mission-section">
          <div className="mission-section-header">
            <h2 style={{ color: '#000' }}>Find Your Next Mission</h2>
            <div className="mission-section-header links">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("all");
                }}
                className={activeTab === "all" ? "active" : ""}
              >
                All Missions
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("your");
                }}
                className={activeTab === "your" ? "active" : ""}
              >
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
                  onClick={() => {
                    if (enrolledMissions[mission.id]) {
                      navigate(`/event/${mission.id}/activity?mode=preview`);
                    } else {
                      navigate(`/event/${mission.id}`);
                    }
                  }}
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
                      <div
                        className="podium-avatar-wrap"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (window && typeof window.showUserProfile === "function") {
                            window.showUserProfile(user.uid);
                          } else {
                            window.location.href = `/profile/${user.uid}`;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            if (window && typeof window.showUserProfile === "function") {
                              window.showUserProfile(user.uid);
                            } else {
                              window.location.href = `/profile/${user.uid}`;
                            }
                          }
                        }}
                      >
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
              {sortedLeaderboard.map((user, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={user.uid}
                    ref={user.uid === currentUserId ? currentUserRef : null}
                    className={`leaderboard-row ${user.uid === currentUserId ? "is-current-user" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (window && typeof window.showUserProfile === "function") {
                        window.showUserProfile(user.uid);
                      } else {
                        window.location.href = `/profile/${user.uid}`;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (window && typeof window.showUserProfile === "function") {
                          window.showUserProfile(user.uid);
                        } else {
                          window.location.href = `/profile/${user.uid}`;
                        }
                      }
                    }}
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
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          top: 90,
          right: 20,
          background: '#30bdb7',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 16px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}
      >
        📢 Update
        {announcementUnreadCount > 0 && (
          <span className="global-feed-badge">{announcementUnreadCount}</span>
        )}
      </button>

      {/* SLIDE-IN PANEL */}
      <aside className={`global-feed ${open ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 80,
          right: 0,
          height: 'calc(100vh - 80px)',
          width: 380,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '2px solid #30bdb7',
          zIndex: 999,
          transition: 'transform 0.3s',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: open ? 'auto' : 'none'
        }}>
        <GlobalAnnouncements />
      </aside>
    </div>
  );
}

export default StudentHome;
