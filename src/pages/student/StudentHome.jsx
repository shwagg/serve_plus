import { useNavigate } from "react-router-dom";
import { auth, functions, db } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "firebase/firestore";
import Header from "../../components/Header";
import GlobalAnnouncements from "../../components/GlobalAnnouncements";
import "../../styles/student.css";
import "../../styles/ui.css";
import { WestIcon, EastIcon } from "../../components/icons";
import { GlobalNotificationButton } from "../../components/GlobalAnnouncements";

import mission1 from '../../assets/mission1.jpg';
import podium2 from '../../assets/user2.png';
import banner from '../../assets/banner.jpg';

const landingPromos = [
  {
    id: 1,
    title: "Youth Leadership Program",
    description: "A hands-on journey to build confidence, strengthen teamwork, and practice real-world leadership skills.",
    image: mission1,
    buttonText: "Learn More",
    buttonLink: "/student",
  },
  {
    id: 2,
    title: "Volunteer Outreach",
    image: banner,
    description: "An opportunity to serve communities, connect with people, and create meaningful social impact.",
    buttonText: "Join Now",
    buttonLink: "/student",
  },
  {
    id: 3,
    title: "Entrepreneurship Bootcamp",
    description: "A practical training ground to turn ideas into ventures, with guidance on innovation, business planning, and pitching.",
    image: mission1,
    buttonText: "Register",
    buttonLink: "/student",
  },
];

const StudentHome = () => {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("all");

  // Update unread count from GlobalAnnouncements
  useEffect(() => {
    const checkCount = () => {
      if (window.announcementActions?.getUnreadCount) {
        setAnnouncementUnreadCount(window.announcementActions.getUnreadCount());
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 2000);
    return () => clearInterval(interval);
  }, []);

  const [level, setLevel] = useState(1);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [nextLevelPoints, setNextLevelPoints] = useState(100);
  const [studentName, setStudentName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const [studentAvatar, setStudentAvatar] = useState("");
  const currentUserRef = useRef(null);
  const leaderboardListRef = useRef(null);
  const [missionCards, setMissionCards] = useState([]);
  const [enrolledMissions, setEnrolledMissions] = useState({});
  const [completedMissions, setCompletedMissions] = useState(0);

  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = landingPromos.length;
  const currentPromo = landingPromos[currentPage];

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  }, [totalPages]);

  // Auto-rotate promo carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(nextPage, 6000);
    return () => clearInterval(timer);
  }, [nextPage]);

  // Fetch missions from Firestore
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const user = auth.currentUser;

        const querySnapshot = await getDocs(collection(db, "missions"));
        const missions = querySnapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .filter(m => m.status === "published");

        setMissionCards(missions);

        const enrollmentMap = {};
        let completed = 0;

        if (user) {
          const enrollmentSnaps = await Promise.all(
            missions.map((mission) =>
              getDoc(doc(db, "missions", mission.id, "volunteer", user.uid))
            )
          );
          missions.forEach((mission, i) => {
            const snap = enrollmentSnaps[i];
            enrollmentMap[mission.id] = snap.exists();
            if (snap.exists() && snap.data().completionStatus === "completed") {
              completed++;
            }
          });
        }

        setEnrolledMissions(enrollmentMap);
        setCompletedMissions(completed);
      } catch (error) {
        console.error("Error fetching missions:", error);
      }
    };

    fetchMissions();
  }, []);

  const navigate = useNavigate();

  useEffect(() => {
    // use firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setShowLogoutPopup(false);
        const resolvedName = user.displayName || user.email || "Student";
        setStudentName(resolvedName);

        // Fetch user profile data from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setStudentUsername(userData.username || "");
            setStudentAvatar(userData.avatar || "");
            setStudentName(userData.name || resolvedName);
            if (userData.level !== undefined) setLevel(userData.level);
            if (userData.levelProgress !== undefined) {
              const progress = userData.levelProgress;
              setCurrentPoints(progress);
              setNextLevelPoints(100);
            }

            const totalPoints = userData.totalPoints || 0;
            setCurrentPoints(totalPoints);
            const calculatedLevel = Math.floor(totalPoints / 100) + 1;
            setLevel(calculatedLevel);
            setNextLevelPoints(100);
          }

        } catch (error) {
          console.error("Error fetching user profile:", error);
        } finally {
          // cleanup
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

  //leaderboard with actual data from Firestore
  const [leaderboard, setLeaderboard] = useState([]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const usersQuery = query(
          collection(db, "users"),
          orderBy("totalPoints", "desc"),
          limit(50)
        );
        const usersSnap = await getDocs(usersQuery);

        const leaderboardData = usersSnap.docs.map(userDoc => {
          const userData = userDoc.data();

          return {
            uid: userDoc.id,
            name:
              userData.username ||
              userData.name ||
              userData.email?.split("@")[0] ||
              "User",
            points: userData.totalPoints || 0,
            avatar:
              userData.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                userData.username || userData.name || "User"
              )}&background=30bdb7&color=fff&size=120`,
          };
        });

        leaderboardData.sort((a, b) => b.points - a.points);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }
    };

    fetchLeaderboard();
  }, []);

  // leaderboard is already sorted by fetchLeaderboard
  const sortedLeaderboard = leaderboard;

  const top1 = sortedLeaderboard[0];
  const top2 = sortedLeaderboard[1];
  const top3 = sortedLeaderboard[2];
  const podium = useMemo(() => [top2, top1, top3].filter(Boolean), [top1, top2, top3]);

  const currentUserId = currentUser?.uid;
  const currentUserIndex = sortedLeaderboard.findIndex(
    (user) => user.uid === currentUserId
  );
  const currentUserRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;

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

  // Filtered missions based on active tab
  const filteredMissions = useMemo(() => {
    if (activeTab === "your") {
      return missionCards.filter(m => enrolledMissions[m.id]);
    }
    return missionCards;
  }, [activeTab, missionCards, enrolledMissions]);

  return (
    <div className="full-page">
      {/* Logout Popup */}
      {showLogoutPopup && (
        <div className="logout-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="logout-popup">
            <div className="logout-popup-title" id="logout-title">You have been logged out</div>
            <div className="logout-popup-desc">Your session has ended. Please log in again to continue.</div>
            <button className="logout-popup-btn" onClick={() => { setShowLogoutPopup(false); navigate('/auth', { replace: true }); }}>OK</button>
          </div>
        </div>
      )}
      {/* HEADER */}
      <Header />

      <div className="header-spacer"></div>
      <div className="content-page">

        {/* LANDING or PROMO POSTER PAGE */}
        <section className="landing-section" aria-label="Featured programs">
          <div className="landing-promo-page">
            <img
              src={currentPromo.image}
              alt={currentPromo.title}
              className="promo-image"
              loading="lazy"
            />
            <div className="promo-overlay">
              <h2>{currentPromo.title}</h2>
              <p className="promo-description">{currentPromo.description}</p>
              <button
                className="ui-btn promo-cta"
                onClick={() => navigate(currentPromo.buttonLink)}
              >
                {currentPromo.buttonText}
              </button>
            </div>
          </div>

          <div className="landing-page-control" role="navigation" aria-label="Promo pagination">
            <button
              className="ui-btn-page"
              onClick={prevPage}
              aria-label="Previous promo"
            >
              <WestIcon />
            </button>

            <div className="promo-dots">
              {landingPromos.map((_, idx) => (
                <button
                  key={idx}
                  className={`promo-dot ${idx === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(idx)}
                  aria-label={`Go to promo ${idx + 1}`}
                  aria-current={idx === currentPage ? 'true' : undefined}
                />
              ))}
            </div>

            <button
              className="ui-btn-page"
              onClick={nextPage}
              aria-label="Next promo"
            >
              <EastIcon />
            </button>
          </div>
        </section>

        {/* PROFILE LEVEL RANK */}
        <section className="player-strip" aria-label="Player stats">
          <div className="player-strip-inner">
            <div className="player-level">
              <span className="level-label">Level {level}</span>
              <div className="level-bar" role="progressbar" aria-valuenow={currentPoints % 100} aria-valuemin={0} aria-valuemax={100}>
                <div className="level-bar-fill" style={{ width: `${currentPoints % 100}%` }}></div>
              </div>
              <span className="level-points">{currentPoints} pts ({currentPoints % 100}/100 to next level)</span>
            </div>

            <div className="player-missions">
              <span className="missions-label">Missions Completed</span>
              <span className="missions-count">{completedMissions}</span>
            </div>

            <div className="player-profile">
              <img
                src={studentAvatar || podium2}
                alt="Profile"
                className="player-avatar"
                loading="lazy"
              />
              <span className="player-greeting">
                Hi, {studentUsername || (currentUser?.email ? currentUser.email.split('@')[0] : studentName)}!
              </span>
            </div>
          </div>
        </section>
        {/* MISSION */}
        <section className="mission-section" aria-label="Missions">
          <div className="mission-section-header">
            <h2 className="mission-section-title">Find Your Next Mission</h2>
            <div className="mission-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === "all"}
                className={`mission-tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Missions
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "your"}
                className={`mission-tab ${activeTab === "your" ? "active" : ""}`}
                onClick={() => setActiveTab("your")}
              >
                Your Missions
              </button>
            </div>
          </div>
          <div className="mission-list" role="tabpanel">
            {filteredMissions.length === 0 ? (
              <div className="mission-empty-state">
                <span className="mission-empty-icon">🔍</span>
                <p>{activeTab === "your" ? "You haven't joined any missions yet." : "No missions available right now."}</p>
              </div>
            ) : (
              filteredMissions.map((mission) => (
                <div
                  key={mission.id}
                  className={`mission-card ${enrolledMissions[mission.id] ? 'enrolled' : ''}`}
                  onClick={() => {
                    if (enrolledMissions[mission.id]) {
                      navigate(`/event/${mission.id}/activity?mode=preview`);
                    } else {
                      navigate(`/event/${mission.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (enrolledMissions[mission.id]) {
                        navigate(`/event/${mission.id}/activity?mode=preview`);
                      } else {
                        navigate(`/event/${mission.id}`);
                      }
                    }
                  }}
                >
                  {enrolledMissions[mission.id] && (
                    <span className="mission-enrolled-badge">Enrolled</span>
                  )}
                  <div className="mission-card-image">
                    <img src={mission.img || mission1} alt={mission.alt || mission.title} loading="lazy" />
                  </div>
                  <div className="mission-card-body">
                    <h3 className="mission-card-title">{mission.title}</h3>
                    <div className="mission-card-meta">
                      <span className="mission-card-date">
                        📅 {mission.targetDate || mission.date || "Date TBA"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        {/* LEADERBOARD */}
        <section className="leaderboard-section" aria-label="Leaderboard">
          <div className="mission-section-header">
            <h2 className="mission-section-title">Leaderboard</h2>
            <p className="leaderboard-rank-text">
              {currentUserRank ? `You are in ${getOrdinal(currentUserRank)} place.` : "Join a mission to get ranked!"}
            </p>
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
                          navigate(`/profile/${user.uid}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            navigate(`/profile/${user.uid}`);
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
                    onClick={() => navigate(`/profile/${user.uid}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        navigate(`/profile/${user.uid}`);
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

      </div>
      {/* TOGGLE BUTTON */}
      <GlobalNotificationButton
        unreadCount={announcementUnreadCount}
        onClick={() => setOpen(!open)}
      />
      {/* SLIDE-IN PANEL */}
      <aside className={`global-feed ${open ? 'open' : ''}`}>
        <GlobalAnnouncements />
      </aside>
    </div>
  );
}

export default StudentHome;
