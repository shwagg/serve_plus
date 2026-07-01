import { useNavigate, useLocation } from "react-router-dom";
import EventDetails from "./missions/EventDetails";
import ProjectProposal from "../global/proposal/ProjectProposal";
import { auth, db } from "../../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, limit, where, getCountFromServer, onSnapshot } from "firebase/firestore";
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { getLevelInfo } from "../../hooks/rewardSystem";
import Header from "../../components/Header";
import "../../styles/student.css";
import "../../styles/ui.css";
import "../../styles/ticker.css";
import { WestIcon, EastIcon, SearchRoundedIcon, CalendarTodayOutlinedIcon, PlaceOutlinedIcon, PeopleOutlinedIcon } from "../../components/icons";
import mission1 from '../../assets/mission1.jpg';
import ProposalTimeline from '../../components/ProposalTimeline';
import banner from '../../assets/banner.jpg';
import emptyFile from '../../assets/empty_file.svg';
import servePlusIcon from '../../assets/serve_plus_icon.svg';
import { hasSignatoryApproval, PROPOSAL_LOCKED_NOTICE } from "../../utils/proposalApproval";

const ProgressRing = ({ percent, size = 68, stroke = 7 }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={radius}
        fill="none"
        stroke="#30bdb7"
        strokeWidth={stroke}
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2937">
        {percent}%
      </text>
    </svg>
  );
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => location.state?.activeTab || "all");


  const [level, setLevel] = useState(1);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [studentName, setStudentName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const currentUserRef = useRef(null);
  const leaderboardListRef = useRef(null);
  const [missionCards, setMissionCards] = useState([]);
  const [enrolledMissions, setEnrolledMissions] = useState({});

  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [enrollmentRefreshKey, setEnrollmentRefreshKey] = useState(0);
  const [selectedProposalForView, setSelectedProposalForView] = useState(null);
  const [selectedProposalEditMode, setSelectedProposalEditMode] = useState(false);
  const [proposalRefreshKey, setProposalRefreshKey] = useState(0);
  const [proposalCards, setProposalCards] = useState([]);
  const [volunteerInfo, setVolunteerInfo] = useState({});
  const [studentAvatar, setStudentAvatar] = useState('');
  const [currentUserAuthProvider, setCurrentUserAuthProvider] = useState('');
  const [enrollmentDetails, setEnrollmentDetails] = useState({});
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [missionSearch, setMissionSearch] = useState('');
  const [tickerAnnouncements, setTickerAnnouncements] = useState([]);

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
        const user = currentUser;

        const querySnapshot = await getDocs(collection(db, "missions"));
        const allPublished = querySnapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .filter(m => m.status === "published");

        // ── SL visibility filter ──────────────────────────────────────────────
        // SL missions with a courseId are restricted to enrolled students.
        // CE missions and legacy SL missions (no courseId) are visible to all.
        let missions = allPublished;
        const slCourseIds = [
          ...new Set(
            allPublished
              .filter(m => m.projectType === 'sl' && m.slFields?.courseId)
              .map(m => m.slFields.courseId)
          ),
        ];
        if (slCourseIds.length > 0) {
          const courseSnaps = await Promise.all(
            slCourseIds.map(id => getDoc(doc(db, 'courses', id)))
          );
          const courseEnrollment = {};
          slCourseIds.forEach((id, i) => {
            if (courseSnaps[i].exists()) {
              courseEnrollment[id] = courseSnaps[i].data().students || [];
            }
          });
          missions = allPublished.filter(m => {
            if (m.projectType !== 'sl') return true;        // CE: always visible
            const cid = m.slFields?.courseId;
            if (!cid) return true;                           // legacy SL: no restriction
            return user ? (courseEnrollment[cid] || []).includes(user.uid) : false;
          });
        }

        setMissionCards(missions);

        // Fetch total count, preview volunteers, and current user enrollment in parallel.
        const [countSnaps, previewSnaps, enrollmentSnaps] = await Promise.all([
          Promise.all(missions.map((m) =>
            getCountFromServer(collection(db, "missions", m.id, "volunteer"))
          )),
          Promise.all(missions.map((m) =>
            getDocs(query(collection(db, "missions", m.id, "volunteer"), limit(4)))
          )),
          user
            ? Promise.all(missions.map((m) =>
                getDoc(doc(db, "missions", m.id, "volunteer", user.uid))
              ))
            : Promise.resolve([]),
        ]);

        // Collect unique volunteer UIDs needed for profile lookup
        const allUids = new Set();
        previewSnaps.forEach((snap) => snap.docs.forEach((d) => allUids.add(d.id)));
        const uidArr = [...allUids];

        // Batch-fetch user profiles for preview bubbles
        const profileMap = {};
        if (uidArr.length > 0) {
          const profileSnaps = await Promise.all(uidArr.map((uid) => getDoc(doc(db, "users", uid))));
          uidArr.forEach((uid, i) => {
            if (profileSnaps[i].exists()) {
              const d = profileSnaps[i].data();
              profileMap[uid] = {
                name: d.name || d.username || d.email?.split('@')[0] || '?',
                avatar: d.avatar && !d.avatar.includes('ui-avatars.com') ? d.avatar : null,
              };
            }
          });
        }

        // Build volunteerInfo map
        const infoMap = {};
        missions.forEach((m, i) => {
          const previewUids = previewSnaps[i].docs.map((d) => d.id);
          infoMap[m.id] = {
            count: countSnaps[i].data().count,
            preview: previewUids.map((uid) => profileMap[uid] || { name: '?', avatar: null }),
          };
        });
        setVolunteerInfo(infoMap);

        const enrollmentMap = {};
        const enrollmentDetailsMap = {};
        let completed = 0;
        if (user) {
          missions.forEach((m, i) => {
            const snap = enrollmentSnaps[i];
            if (snap.exists()) {
              const data = snap.data();
              enrollmentMap[m.id] = data.registrationStatus || "pending";
              enrollmentDetailsMap[m.id] = data;
              if (data.completionStatus === "complete" || data.completionStatus === "graded") completed++;
            } else {
              enrollmentMap[m.id] = null;
            }
          });
        }

        setEnrolledMissions(enrollmentMap);
        setEnrollmentDetails(enrollmentDetailsMap);
      } catch (error) {
        console.error("Error fetching missions:", error);
      }
    };

    fetchMissions();
  }, [enrollmentRefreshKey, currentUser]);

  // Real-time listener: patch missionCards when any mission document changes (e.g. cover photo)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "missions"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const updated = { id: change.doc.id, ...change.doc.data() };
          setMissionCards((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, img: updated.img, title: updated.title, status: updated.status }
                : m
            )
          );
        }
      });
    });
    return () => unsub();
  }, []);

  // Keep proposals created by the current user in sync.
  useEffect(() => {
    const user = currentUser;
    if (!user) {
      setProposalCards([]);
      return;
    }

    const q = query(
      collection(db, "missions"),
      where("createdBy", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const proposals = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.status !== "published");
        setProposalCards(proposals);
      },
      (error) => {
        console.error("Error fetching proposals:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser, proposalRefreshKey]);

  // Fetch admin announcements for the ticker strip
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const q = query(collection(db, "adminAnnouncements"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setTickerAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        // collection may not exist yet
      }
    };
    fetchTicker();
  }, []);

  // Add/remove body class so header shifts down below the ticker
  useEffect(() => {
    if (tickerAnnouncements.length > 0) {
      document.body.classList.add('ticker-active');
    } else {
      document.body.classList.remove('ticker-active');
    }
    return () => document.body.classList.remove('ticker-active');
  }, [tickerAnnouncements]);

  const missionsSectionRef = useRef(null);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.activeTab === "proposals") {
      setProposalRefreshKey(k => k + 1);
    }
  }, [location.key, location.state?.activeTab]);

  useLayoutEffect(() => {
    if (location.state?.scrollTo === 'missions' && missionsSectionRef.current) {
      const scrollContainer = missionsSectionRef.current.closest('.content-page');
      if (!scrollContainer) return;

      const playerStrip = scrollContainer.querySelector('.player-strip');
      const playerStripHeight = playerStrip ? playerStrip.getBoundingClientRect().height : 0;
      const missionRect = missionsSectionRef.current.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Scroll so the mission section top sits right below the sticky player-strip
      scrollContainer.scrollTop = (missionRect.top - containerRect.top) - playerStripHeight;

      window.history.replaceState({}, '');
    }
  }, [location.state?.scrollTo]);


  useEffect(() => {
    // use firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setShowLogoutPopup(false);
        setCurrentUserAuthProvider('');
        const resolvedName = user.displayName || user.email || "Student";
        setStudentName(resolvedName);

        // Fetch user profile data from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setStudentUsername(userData.username || "");
            setStudentName(userData.name || resolvedName);
            setStudentAvatar(userData.avatar || '');
            setCurrentUserAuthProvider(userData.authProvider || '');
            const totalPoints = userData.totalPoints || 0;
            setCurrentPoints(totalPoints);
            const calculatedLevel = getLevelInfo(totalPoints).level;
            setLevel(calculatedLevel);
          } else {
            setCurrentUserAuthProvider('');
          }

        } catch (error) {
          console.error("Error fetching user profile:", error);
        } finally {
          // cleanup
        }
      } else {
        setCurrentUserAuthProvider('');
        setShowLogoutPopup(true);
      }
    });

    return unsubscribe;
  }, []);

  //leaderboard with actual data from Firestore
  const [leaderboard, setLeaderboard] = useState([]);

  // Fetch leaderboard data
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (usersSnap) => {
      try {
        const leaderboardData = usersSnap.docs
          .map(userDoc => {
            const userData = userDoc.data();
            return {
              uid: userDoc.id,
              name:
                userData.username ||
                userData.name ||
                userData.email?.split("@")[0] ||
                "User",
              points: userData.totalPoints || 0,
              avatar: userData.avatar && !userData.avatar.includes('ui-avatars.com') ? userData.avatar : "",
              role: userData.role || "",
              authProvider: userData.authProvider || ""
            };
          })
          .filter(user => user.role === "student" && user.authProvider === "blackboard");

        leaderboardData.sort((a, b) => b.points - a.points);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
    });

    return () => unsubscribe();
  }, []);

  // leaderboard is already sorted by fetchLeaderboard
  const sortedLeaderboard = leaderboard;

  const currentUserId = currentUser?.uid;
  const isBlackboardStudent = currentUserAuthProvider === "blackboard";
  const currentUserIndex = isBlackboardStudent ? sortedLeaderboard.findIndex(
    (user) => user.uid === currentUserId
  ) : -1;
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
  }, [leaderboard]);

  const getProposalStatusLine = (proposal) => {
    const { reviewedBy, recommendedBy, endorsedBy, approvedBy, status, rejectedBy, rejectedByUser } = proposal;
    if (rejectedBy && status === 'rejected' && !reviewedBy) {
      return `Returned for revision${rejectedByUser ? ` by ${rejectedByUser}` : ''}`;
    }
    if (approvedBy && recommendedBy && endorsedBy && reviewedBy) {
      return 'All approvals complete - Ready to publish';
    }
    if (endorsedBy) return `Endorsed by Admin - Awaiting Director approval`;
    if (recommendedBy) return `Recommended by ${recommendedBy} - Awaiting Admin (CSCE) endorsement`;
    if (reviewedBy) return `Reviewed by ${reviewedBy} - Awaiting College Dean recommendation`;
    return 'Submitted - Awaiting Program Chair review';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };


  const getInitials = (name) => {
    const parts = (name || '?').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

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

  const openProposalModal = (proposal) => {
    setSelectedProposalEditMode(false);
    setSelectedProposalForView(proposal);
  };

  const closeProposalModal = () => {
    setSelectedProposalEditMode(false);
    setSelectedProposalForView(null);
  };

  const renderProposalList = (items) => {
    if (!Array.isArray(items) || items.length === 0) return <p>N/A</p>;
    return (
      <ul className="student-proposal-detail-list">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    );
  };

  // Unique departments from published missions for filter tabs
  const uniqueDepts = useMemo(() => {
    const depts = new Set(missionCards.map(m => m.department).filter(Boolean));
    return [...depts].sort();
  }, [missionCards]);

  // Filtered missions based on active tab + search
  const filteredMissions = useMemo(() => {
    let result = missionCards;
    const q = missionSearch.trim().toLowerCase();
    if (q) result = result.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.location?.toLowerCase().includes(q) ||
      (Array.isArray(m.stakeholders) && m.stakeholders.some(s => s.toLowerCase().includes(q)))
    );
    if (activeTab === "your") return result.filter(m => enrolledMissions[m.id]);
    if (activeTab.startsWith("dept:")) {
      const dept = activeTab.slice(5);
      return result.filter(m => m.department === dept);
    }
    return result;
  }, [activeTab, missionCards, enrolledMissions, missionSearch]);

  // Active (approved) missions shown in the CURRENT section
  const activeMissions = useMemo(() =>
    missionCards.filter(m => enrolledMissions[m.id] === 'approved'),
    [missionCards, enrolledMissions]
  );

  const renderTickerItems = (items, keyPrefix = '') =>
    items.map((a, i) => (
      <Fragment key={keyPrefix + (a.id || i)}>
        {i > 0 && <img src={servePlusIcon} className="ticker-sep" alt="" aria-hidden="true" />}
        {a.title}{a.body ? ` — ${a.body}` : ''}
      </Fragment>
    ));

  const getMissionProgress = useCallback((missionId) => {
    const detail = enrollmentDetails[missionId];
    if (!detail?.progress) return 0;
    const p = detail.progress;
    const steps = [
      p.consent !== 'locked',
      p.preSurvey !== 'locked',
      p.attendance === 'checked_in',
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [enrollmentDetails]);

  return (
    <>
    {tickerAnnouncements.length > 0 && (
      <div className="announcement-ticker" role="marquee" aria-label="Announcements">
        <span className="ticker-label">📢 News</span>
        <div className="ticker-track">
          <div className="ticker-content">
            <span className="ticker-text">{renderTickerItems(tickerAnnouncements)}</span>
            <span className="ticker-text" aria-hidden="true">{renderTickerItems(tickerAnnouncements, 'd-')}</span>
          </div>
        </div>
      </div>
    )}
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
        {/* Sticky gradient overlay — fades scrolled content into the header */}
        <div className="scroll-fade-top" aria-hidden="true" />

        {/* LANDING or PROMO POSTER PAGE */}
        {/*<section className="landing-section" aria-label="Featured programs">
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
        </section>*/}

        {/* COMPACT LEADERBOARD */}
        <section className="leaderboard-compact-section" aria-label="Leaderboard" id="leaderboard-section">
          <div className="leaderboard-compact-header">
            <div>
              <h2 className="leaderboard-compact-title">Leaderboard</h2>
              <p className="leaderboard-rank-text">
                {!isBlackboardStudent ? "Leaderboard locked" : currentUserRank ? `You are in ${getOrdinal(currentUserRank)} place` : "Join a mission to get ranked!"}
              </p>
            </div>
            {isBlackboardStudent && (
              <button
                className="leaderboard-see-all-btn"
                onClick={() => setShowLeaderboardModal(true)}
              >
                View more
              </button>
            )}
          </div><br />
          <div className={`leaderboard-compact-body${!isBlackboardStudent ? ' is-locked' : ''}`}>
            {!isBlackboardStudent ? (
              <div className="leaderboard-locked-state">
                <div className="leaderboard-locked-icon" aria-hidden="true">
                  <LockOutlinedIcon sx={{ fontSize: 26 }} />
                </div>
                <div className="leaderboard-locked-title">Leaderboard locked</div>
                <p>Sign in with your Blackboard account to view rankings.</p>
              </div>
            ) : (
              <>
            {/* LEFT: compact podium */}
            <div className="leaderboard-compact-podium-wrap">
              <div className="leaderboard-compact-podium">
                {[
                  sortedLeaderboard[1] ? { ...sortedLeaderboard[1], rank: 2 } : null,
                  sortedLeaderboard[0] ? { ...sortedLeaderboard[0], rank: 1 } : null,
                  sortedLeaderboard[2] ? { ...sortedLeaderboard[2], rank: 3 } : null,
                ].filter(Boolean).map((user) => {
                  const avatarSize = user.rank === 1 ? 64 : 52;
                  return (
                    <div
                      key={user.uid}
                      className={`podium-item rank-${user.rank}`}
                      onClick={() => navigate(`/profile/${user.uid}`)}
                    >
                      <div className="podium-top">
                        <div className="podium-avatar-wrap">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} />
                          ) : (
                            <div style={{
                              width: avatarSize, height: avatarSize,
                              borderRadius: '50%', background: '#30bdb7', color: '#fff',
                              fontSize: user.rank === 1 ? 14 : 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              ...(user.rank === 1 ? { boxShadow: '0 0 0 3px #facc15' } : {}),
                            }}>
                              {getInitials(user.name)}
                            </div>
                          )}
                          <span className="podium-rank">{user.rank}</span>
                        </div>
                        <div className="podium-info">
                          <div className="podium-name">{user.name}</div>
                          <div className="podium-points">{user.points} pts</div>
                        </div>
                      </div>
                      <div className={`podium-base rank-${user.rank}`} />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* RIGHT: 3-user window, logged-in user in the middle */}
            <div className="leaderboard-compact-rank-col">
              {(() => {
                if (sortedLeaderboard.length === 0) {
                  return (
                    <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      No rankings yet.
                    </div>
                  );
                }
                let start;
                if (currentUserIndex === -1) {
                  start = 0;
                } else {
                  start = currentUserIndex - 1;
                  if (start < 0) start = 0;
                  if (start + 3 > sortedLeaderboard.length) {
                    start = Math.max(0, sortedLeaderboard.length - 3);
                  }
                }
                const windowUsers = sortedLeaderboard
                  .slice(start, start + 3)
                  .map((u, i) => ({ ...u, rank: start + i + 1 }));
                return windowUsers.map((user) => (
                  <div
                    key={user.uid}
                    className={`leaderboard-row ${user.uid === currentUserId ? 'is-current-user' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/profile/${user.uid}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigate(`/profile/${user.uid}`);
                    }}
                  >
                    <span className="rank-num">{user.rank}</span>
                    {user.avatar ? (
                      <img src={user.avatar} alt={`${user.name}'s avatar`} className="leaderboard-avatar" />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#30bdb7', color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        userSelect: 'none', flexShrink: 0,
                      }}>
                        {getInitials(user.name)}
                      </div>
                    )}
                    <span className="rank-name">{user.name}</span>
                    <span className="rank-points">{user.points} pts</span>
                  </div>
                ));
              })()}
            </div>
              </>
            )}
          </div>
        </section>

        {/* SEARCH BAR — bridges leaderboard and mission section */}
        <div className="missions-search-section">
          <div className="missions-search-bar-wrap">
            <SearchRoundedIcon style={{ fontSize: 22, color: '#9ca3af', flexShrink: 0 }} />
            <input
              type="text"
              className="missions-search-bar-input"
              placeholder="Search missions, tags"
              value={missionSearch}
              onChange={(e) => setMissionSearch(e.target.value)}
              aria-label="Search missions and tags"
            />
          </div>
        </div>

        {/* MISSION */}
        <section ref={missionsSectionRef} className="mission-section" aria-label="Mission/s">
          <div className="mission-section-header">
            <h2 className="mission-section-title">Mission</h2>
            <p className="leaderboard-rank-text" style={{ marginBottom: 12 }}>Find your next activity here</p>
            <div className="mission-filter-bar">
              <div className="mission-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === "all"}
                  className={`mission-tab ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  All
                </button>
                {uniqueDepts.map(dept => (
                  <button
                    key={dept}
                    role="tab"
                    aria-selected={activeTab === ('dept:' + dept)}
                    className={`mission-tab mission-tab-dept ${activeTab === ('dept:' + dept) ? "active" : ""}`}
                    onClick={() => setActiveTab('dept:' + dept)}
                  >
                    {dept}
                  </button>
                ))}
                <button
                  role="tab"
                  aria-selected={activeTab === "your"}
                  className={`mission-tab ${activeTab === "your" ? "active" : ""}`}
                  onClick={() => setActiveTab("your")}
                >
                  Enrolled
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "proposals"}
                  className={`mission-tab ${activeTab === "proposals" ? "active" : ""}`}
                  onClick={() => setActiveTab("proposals")}
                >
                  Proposals
                </button>
              </div>
            </div>
          </div>
          <div className="mission-list" role="tabpanel">
            {activeTab === "proposals" ? (
              proposalCards.length === 0 ? (
                <div className="mission-empty-state">
                  <img className="proposal-empty-image" src={emptyFile} alt="" aria-hidden="true" />
                  <p>You haven't created any proposals yet.</p>
                </div>
              ) : (
                proposalCards.map((proposal) => {
                  const statusLabels = {
                    for_approval: { label: 'For Approval', color: '#d97706' },
                    draft: { label: 'For Publishing', color: '#64748b' },
                    rejected: { label: 'Returned for Revision', color: '#dc2626' },
                    approved: { label: 'Approved', color: '#16a34a' },
                  };
                  const statusInfo = statusLabels[proposal.status] || { label: proposal.status, color: '#64748b' };
                  const typeLabel = proposal.projectType === 'sl' ? 'Service Learning' : proposal.projectType === 'ce' ? 'Community Engagement' : '';
                  return (
                    <div
                      key={proposal.id}
                      className="mission-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => openProposalModal(proposal)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProposalModal(proposal); } }}
                      style={{ cursor: 'pointer' }}
                    >
                      <span
                        className="mission-enrolled-badge"
                        style={{ background: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                      <div className="mission-card-image">
                        <img src={proposal.img || mission1} alt={proposal.alt || proposal.title} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = mission1; }} />
                      </div>
                      <div className="mission-card-body">
                        <h3 className="mission-card-title">{proposal.title}</h3>
                        <div className="mission-card-meta">
                          {typeLabel && (
                            <span className="mission-card-date">{typeLabel}</span>
                          )}
                          <span className="mission-card-date">
                            <CalendarTodayOutlinedIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }} />
                            {formatDate(proposal.targetDate) || "Date TBA"}
                          </span>
                          {proposal.location && (
                            <span className="mission-card-location">
                              <PlaceOutlinedIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }} />
                              {proposal.location}
                            </span>
                          )}
                        </div>
                        {Array.isArray(proposal.stakeholders) && proposal.stakeholders.length > 0 && (
                          <div className="mission-tags-row">
                            {proposal.stakeholders.slice(0, 2).map((s, i) => (
                              <span key={i} className="mission-tag">{s}</span>
                            ))}
                            {proposal.stakeholders.length > 2 && (
                              <span className="mission-tag mission-tag-more">+{proposal.stakeholders.length - 2} more</span>
                            )}
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          {getProposalStatusLine(proposal)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : filteredMissions.length === 0 ? (
              <div className="mission-empty-state">
                <span className="mission-empty-icon">&#128269;</span>
                <p>{activeTab === "your" ? "You haven't joined any missions yet." : "No missions available right now."}</p>
              </div>
            ) : (
              filteredMissions.map((mission) => (
                <div
                  key={mission.id}
                  className={`mission-card ${enrolledMissions[mission.id] === 'approved' ? 'enrolled' : enrolledMissions[mission.id] === 'pending' ? 'requesting' : ''}`}
                  onClick={() => {
                    if (enrolledMissions[mission.id] === "approved") {
                      navigate(`/event/${mission.id}/activity`);
                    } else {
                      setSelectedMissionId(mission.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (enrolledMissions[mission.id] === "approved") {
                        navigate(`/event/${mission.id}/activity`);
                      } else {
                        setSelectedMissionId(mission.id);
                      }
                    }
                  }}
                >
                  {enrolledMissions[mission.id] === "pending" && (
                    <span className="mission-enrolled-badge pending">Requesting</span>
                  )}
                  {enrolledMissions[mission.id] === "approved" && (
                    <span className="mission-enrolled-badge">Enrolled</span>
                  )}
                  <div className="mission-card-image">
                    <img src={mission.img || mission1} alt={mission.alt || mission.title} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = mission1; }} />
                  </div>
                  <div className="mission-card-body">
                    <h3 className="mission-card-title">{mission.title}</h3>
                    <div className="mission-card-meta">
                      <span className="mission-card-date">
                        <CalendarTodayOutlinedIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }} />
                        {formatDate(mission.targetDate || mission.targetDates) || "Date TBA"}
                      </span>
                      {mission.location && (
                        <span className="mission-card-location">
                          <PlaceOutlinedIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }} />
                          {mission.location}
                        </span>
                      )}
                      {(() => {
                        const info = volunteerInfo[mission.id];
                        const count = info?.count ?? 0;
                        const preview = info?.preview ?? [];
                        const extra = count - preview.length;
                        if (count === 0) return null;
                        return (
                          <div className="vol-preview">
                            
                            {preview.map((vol, i) => (
                              <div
                                key={i}
                                className="vol-bubble"
                                style={{ zIndex: preview.length - i, background: vol.avatar ? undefined : '#30bdb7' }}
                              >
                                {vol.avatar
                                  ? <img src={vol.avatar} alt="" />
                                  : <span>{getInitials(vol.name)}</span>
                                }
                              </div>
                            ))}
                            {extra > 0 && (
                              <div className="vol-bubble vol-bubble-extra">+{extra}</div>
                            )}
                            <span className="vol-joined-text">{count} joined</span>
                          </div>
                        );
                      })()}
                    </div>
                    {Array.isArray(mission.stakeholders) && mission.stakeholders.length > 0 && (
                      <div className="mission-tags-row">
                        {mission.stakeholders.slice(0, 2).map((s, i) => (
                          <span key={i} className="mission-tag">{s}</span>
                        ))}
                        {mission.stakeholders.length > 2 && (
                          <span className="mission-tag mission-tag-more">+{mission.stakeholders.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>


      </div>
    </div>

    {/* Proposal View/Edit Modal */}
    {selectedProposalForView && (
      <div
        className="student-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) closeProposalModal(); }}
      >
        <div className="student-modal student-proposal-modal">
          {(() => {
            const proposalLocked = hasSignatoryApproval(selectedProposalForView);
            const normalizedStatus = String(selectedProposalForView.status || '').toLowerCase();
            const isEditableStatus = normalizedStatus === 'rejected' || normalizedStatus === 'for_approval' || normalizedStatus === 'for-approval';
            const canEditProposal = isEditableStatus && !proposalLocked;
            const editUnavailableReason = proposalLocked
              ? PROPOSAL_LOCKED_NOTICE
              : 'Editing is available only before the first signatory approval or when the proposal has been returned for revision.';

            if (selectedProposalEditMode && canEditProposal) {
              return (
                <>
                  <div className="student-proposal-modal-header">
                    <h3>
                      {selectedProposalForView.projectType === 'sl' ? 'Service Learning Proposal' : 'Community Engagement Proposal'}
                    </h3>
                    <button onClick={closeProposalModal} aria-label="Close proposal">x</button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <ProjectProposal
                      projectType={selectedProposalForView.projectType === 'sl' ? 'service-learning' : 'community-engagement'}
                      editProposal={selectedProposalForView}
                      onClose={() => { closeProposalModal(); setProposalRefreshKey(k => k + 1); }}
                      timelineNode={<ProposalTimeline proposal={selectedProposalForView} compact />}
                    />
                  </div>
                </>
              );
            }

            return (
              <>
                <div className="student-proposal-modal-header">
                  <div>
                    <h3>
                      {selectedProposalForView.projectType === 'sl' ? 'Service Learning Proposal' : 'Community Engagement Proposal'}
                    </h3>
                    <p>{selectedProposalForView.title || 'Untitled Proposal'}</p>
                  </div>
                  <button onClick={closeProposalModal} aria-label="Close proposal">x</button>
                </div>

                <div className="student-proposal-details">
                  {proposalLocked && (
                    <div className="student-proposal-lock-notice" role="status">
                      <strong>Proposal locked after first approval</strong>
                      <span>{PROPOSAL_LOCKED_NOTICE}</span>
                    </div>
                  )}

                  {normalizedStatus === 'rejected' && selectedProposalForView.rejectionReason && (
                    <div className="student-proposal-rejection-notice">
                      <strong>Returned for revision{selectedProposalForView.rejectedByUser ? ` by ${selectedProposalForView.rejectedByUser}` : ''}</strong>
                      <span>{selectedProposalForView.rejectionReason}</span>
                    </div>
                  )}

                  <div className="student-proposal-actions">
                    <button
                      type="button"
                      className="student-proposal-edit-btn"
                      disabled={!canEditProposal}
                      title={!canEditProposal ? editUnavailableReason : 'Edit proposal'}
                      aria-describedby={!canEditProposal ? 'proposal-edit-helper' : undefined}
                      onClick={() => setSelectedProposalEditMode(true)}
                    >
                      Edit Proposal
                    </button>
                    {!canEditProposal && (
                      <p id="proposal-edit-helper" className="student-proposal-edit-helper">
                        {editUnavailableReason}
                      </p>
                    )}
                  </div>

                  <div className="student-proposal-detail-grid">
                    <section>
                      <h4>Status</h4>
                      <p>{getProposalStatusLine(selectedProposalForView)}</p>
                    </section>
                    <section>
                      <h4>Target Date</h4>
                      <p>{formatDate(selectedProposalForView.targetDate) || 'Date TBA'}</p>
                    </section>
                    <section>
                      <h4>Location</h4>
                      <p>{selectedProposalForView.location || 'N/A'}</p>
                    </section>
                    <section>
                      <h4>Volunteer Hours</h4>
                      <p>{selectedProposalForView.volunteerHours || 'N/A'}</p>
                    </section>
                  </div>

                  <section className="student-proposal-detail-section">
                    <h4>Description</h4>
                    <p>{selectedProposalForView.description || 'N/A'}</p>
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Objectives</h4>
                    <p>{selectedProposalForView.objectives || 'N/A'}</p>
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Stakeholders</h4>
                    {renderProposalList(selectedProposalForView.stakeholders)}
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Specific Activities</h4>
                    {renderProposalList(selectedProposalForView.specificActivities)}
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Success Indicators</h4>
                    {Array.isArray(selectedProposalForView.successIndicators)
                      ? renderProposalList(selectedProposalForView.successIndicators)
                      : <p>{selectedProposalForView.successIndicators || 'N/A'}</p>}
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Budget</h4>
                    <p>{selectedProposalForView.budget || 'N/A'}</p>
                  </section>
                  <section className="student-proposal-detail-section">
                    <h4>Approval Progress</h4>
                    <ProposalTimeline proposal={selectedProposalForView} compact />
                  </section>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    )}

    {/* Event Details Modal */}
    {selectedMissionId && (
      <div
        className="student-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedMissionId(null); }}
      >
        <div className="student-modal student-event-modal">
          <EventDetails
            key={selectedMissionId}
            missionId={selectedMissionId}
            onClose={() => { setSelectedMissionId(null); setEnrollmentRefreshKey(k => k + 1); }}
          />
        </div>
      </div>
    )}

    {/* Leaderboard See-All Modal */}
    {showLeaderboardModal && isBlackboardStudent && (
      <div
        className="leaderboard-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) { setShowLeaderboardModal(false); setLeaderboardSearch(''); } }}
      >
        <div className="leaderboard-modal">
          <div className="leaderboard-modal-header">
            <h3>Leaderboard</h3>
            <button
              onClick={() => { setShowLeaderboardModal(false); setLeaderboardSearch(''); }}
              aria-label="Close leaderboard"
            >x</button>
          </div>
          <div className="leaderboard-modal-search-wrap">
            <input
              className="leaderboard-search-input"
              type="text"
              placeholder="Search students..."
              value={leaderboardSearch}
              onChange={(e) => setLeaderboardSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="leaderboard-modal-list">
            {(() => {
              const q = leaderboardSearch.toLowerCase().trim();
              const filtered = sortedLeaderboard
                .map((user, i) => ({ ...user, rank: i + 1 }))
                .filter(u => !q || u.name.toLowerCase().includes(q));
              if (filtered.length === 0) {
                return (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                    No students found.
                  </div>
                );
              }
              return filtered.map((user) => (
                <div
                  key={user.uid}
                  className={`leaderboard-row ${user.uid === currentUserId ? "is-current-user" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => { navigate(`/profile/${user.uid}`); setShowLeaderboardModal(false); setLeaderboardSearch(''); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      navigate(`/profile/${user.uid}`);
                      setShowLeaderboardModal(false);
                      setLeaderboardSearch('');
                    }
                  }}
                >
                  <span className="rank-num">{user.rank}</span>
                  {user.avatar ? (
                    <img src={user.avatar} alt={`${user.name}'s avatar`} className="leaderboard-avatar" />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#30bdb7', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', flexShrink: 0 }}>
                      {getInitials(user.name)}
                    </div>
                  )}
                  <span className="rank-name">{user.name}</span>
                  <span className="rank-points">{user.points} pts</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default StudentHome;


