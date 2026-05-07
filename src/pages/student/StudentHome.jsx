import { useNavigate, useLocation } from "react-router-dom";
import EventDetails from "./missions/EventDetails";
import ProjectProposal from "../global/proposal/ProjectProposal";
import ReviewModal from "../global/proposal/ReviewModal";
import { auth, db } from "../../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, limit, where, getCountFromServer, onSnapshot } from "firebase/firestore";
import Header from "../../components/Header";
import "../../styles/student.css";
import "../../styles/ui.css";
import { WestIcon, EastIcon } from "../../components/icons";
import mission1 from '../../assets/mission1.jpg';
import ProposalTimeline from '../../components/ProposalTimeline';
import banner from '../../assets/banner.jpg';
import cloudsBg from '../../assets/clouds-bg.jpg';
import mountainBg from '../../assets/mountain-bg.jpg';

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
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const [level, setLevel] = useState(1);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [studentName, setStudentName] = useState("");
  const [studentUsername, setStudentUsername] = useState("");
  const currentUserRef = useRef(null);
  const leaderboardListRef = useRef(null);
  const [missionCards, setMissionCards] = useState([]);
  const [enrolledMissions, setEnrolledMissions] = useState({});
  const [completedMissions, setCompletedMissions] = useState(0);

  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [enrollmentRefreshKey, setEnrollmentRefreshKey] = useState(0);
  const [selectedProposalForView, setSelectedProposalForView] = useState(null);
  const [proposalRefreshKey, setProposalRefreshKey] = useState(0);
  const [proposalCards, setProposalCards] = useState([]);
  const [volunteerInfo, setVolunteerInfo] = useState({});
  const [studentAvatar, setStudentAvatar] = useState('');
  const [enrollmentDetails, setEnrollmentDetails] = useState({});

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

        // Fetch total count, preview volunteers (first 4), and current user enrollment — all in parallel
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
              if (data.completionStatus === "completed") completed++;
            } else {
              enrollmentMap[m.id] = null;
            }
          });
        }

        setEnrolledMissions(enrollmentMap);
        setEnrollmentDetails(enrollmentDetailsMap);
        setCompletedMissions(completed);
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

  // Fetch proposals created by the current user
  useEffect(() => {
    const fetchProposals = async () => {
      const user = auth.currentUser;
      if (!user) {
        setProposalCards([]);
        return;
      }
      try {
        const q = query(
          collection(db, "missions"),
          where("createdBy", "==", user.uid)
        );
        const snap = await getDocs(q);
        const proposals = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.status !== "published");
        setProposalCards(proposals);
      } catch (error) {
        console.error("Error fetching proposals:", error);
      }
    };
    fetchProposals();
  }, [currentUser, proposalRefreshKey]);

  const navigate = useNavigate();
  const location = useLocation();
  const missionsSectionRef = useRef(null);
  const leaderboardSectionRef = useRef(null);

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
            const totalPoints = userData.totalPoints || 0;
            setCurrentPoints(totalPoints);
            const calculatedLevel = Math.floor(totalPoints / 100) + 1;
            setLevel(calculatedLevel);
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

  //leaderboard with actual data from Firestore
  const [leaderboard, setLeaderboard] = useState([]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Fetch all users, then filter for students (Firestore does not support compound queries with orderBy and where on different fields unless indexed)
        const usersQuery = query(
          collection(db, "users"),
          orderBy("totalPoints", "desc"),
          limit(50)
        );
        const usersSnap = await getDocs(usersQuery);

        // Only include users with role === 'student'
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
              role: userData.role || ""
            };
          })
          .filter(user => user.role === "student");

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
  }, [leaderboard]);

  const getProposalStatusLine = (proposal) => {
    const { reviewedBy, recommendedBy, endorsedBy, approvedBy, status, rejectedBy, rejectedByUser } = proposal;
    if (rejectedBy && status === 'for_approval' && !reviewedBy) {
      return `Returned for revision${rejectedByUser ? ` by ${rejectedByUser}` : ''}`;
    }
    if (approvedBy && recommendedBy && endorsedBy && reviewedBy) {
      return 'All approvals complete · Ready to publish';
    }
    if (endorsedBy) return `Endorsed by Admin · Awaiting Director approval`;
    if (recommendedBy) return `Recommended by ${recommendedBy} · Awaiting Admin (CSCE) endorsement`;
    if (reviewedBy) return `Reviewed by ${reviewedBy} · Awaiting College Dean recommendation`;
    return 'Submitted · Awaiting Program Chair review';
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

  // Filtered missions based on active tab
  const filteredMissions = useMemo(() => {
    if (activeTab === "your") {
      return missionCards.filter(m => enrolledMissions[m.id]);
    }
    return missionCards;
  }, [activeTab, missionCards, enrolledMissions]);

  // Active (approved) missions shown in the CURRENT section
  const activeMissions = useMemo(() =>
    missionCards.filter(m => enrolledMissions[m.id] === 'approved'),
    [missionCards, enrolledMissions]
  );

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
            <div className="strip-compact-row">
              <span className="strip-level-text">Lv. {level}</span>
              <div className="strip-xp-chip">{currentPoints}</div>
              <div
                className="level-bar strip-progress-bar"
                role="progressbar"
                aria-valuenow={currentPoints % 100}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="level-bar-fill" style={{ width: `${currentPoints % 100}%` }} />
              </div>
              <span className="strip-divider">|</span>
              <span className="strip-missions-text">Missions <span className="strip-pipe">|</span> {completedMissions}</span>
            </div>
          </div>
        </section>
        {/* CURRENT ACTIVE MISSIONS */}
        {activeMissions.length > 0 && (
          <section className="current-section" aria-label="Current missions">
            <h2 className="current-section-title">Current</h2>
            <div className="current-mission-list">
              {activeMissions.map((mission) => {
                const progressPct = getMissionProgress(mission.id);
                const info = volunteerInfo[mission.id];
                const count = info?.count ?? 0;
                const preview = info?.preview ?? [];
                const extra = count - preview.length;
                return (
                  <div
                    key={mission.id}
                    className="current-mission-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/event/${mission.id}/activity`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/event/${mission.id}/activity`); } }}
                  >
                    <div className="current-card-image">
                      <img src={mission.img || mission1} alt={mission.title} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = mission1; }} />
                    </div>
                    <div className="current-card-body">
                      <h3 className="current-card-title">{mission.title}</h3>
                      <span className="current-card-date">{formatDate(mission.targetDate || mission.targetDates) || 'Date TBA'}</span>
                      {count > 0 && (
                        <div className="vol-preview">
                          {preview.map((vol, i) => (
                            <div key={i} className="vol-bubble" style={{ zIndex: preview.length - i, background: vol.avatar ? undefined : '#30bdb7' }}>
                              {vol.avatar ? <img src={vol.avatar} alt="" /> : <span>{getInitials(vol.name)}</span>}
                            </div>
                          ))}
                          {extra > 0 && <div className="vol-bubble vol-bubble-extra">+{extra}</div>}
                          <span className="vol-joined-text">joined</span>
                        </div>
                      )}
                      <span className="current-card-status">Status: {mission.status === 'published' ? 'Open' : mission.status}</span>
                    </div>
                    <div className="current-card-progress">
                      <ProgressRing percent={progressPct} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* MISSION */}
        <section ref={missionsSectionRef} className="mission-section" aria-label="Missions" style={{ backgroundImage: `url(${cloudsBg})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat' }}>
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
              <button
                role="tab"
                aria-selected={activeTab === "proposals"}
                className={`mission-tab ${activeTab === "proposals" ? "active" : ""}`}
                onClick={() => setActiveTab("proposals")}
              >
                Your Proposals
              </button>
            </div>
          </div>
          <div className="mission-list" role="tabpanel">
            {activeTab === "proposals" ? (
              proposalCards.length === 0 ? (
                <div className="mission-empty-state">
                  <span className="mission-empty-icon">📝</span>
                  <p>You haven't created any proposals yet.</p>
                </div>
              ) : (
                proposalCards.map((proposal) => {
                  const statusLabels = {
                    for_approval: { label: '📋 For Approval', color: '#d97706' },
                    draft: { label: '📝 For Publishing', color: '#64748b' },
                    rejected: { label: '❌ Rejected', color: '#dc2626' },
                    approved: { label: '✅ Approved', color: '#16a34a' },
                  };
                  const statusInfo = statusLabels[proposal.status] || { label: proposal.status, color: '#64748b' };
                  const typeLabel = proposal.projectType === 'sl' ? 'Service Learning' : proposal.projectType === 'ce' ? 'Community Engagement' : '';
                  return (
                    <div
                      key={proposal.id}
                      className="mission-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedProposalForView(proposal)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProposalForView(proposal); } }}
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
                            <span className="mission-card-date">🗂️ {typeLabel}</span>
                          )}
                          <span className="mission-card-date">
                            📅 {formatDate(proposal.targetDate) || "Date TBA"}
                          </span>
                        </div>
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
                <span className="mission-empty-icon">🔍</span>
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
                    <span className="mission-enrolled-badge pending">⏳ Requesting</span>
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
                        📅 {formatDate(mission.targetDate || mission.targetDates) || "Date TBA"}
                      </span>
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
                            <span className="vol-joined-text">joined</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        {/* LEADERBOARD */}
        <section id="leaderboard-section" ref={leaderboardSectionRef} className="leaderboard-section" aria-label="Leaderboard" style={{ backgroundImage: `linear-gradient(to bottom, #d1efff 10%, transparent 10%), url(${cloudsBg})`, backgroundSize: '100% 100%, 100% auto', backgroundPosition: '0 0, center top', backgroundRepeat: 'no-repeat, no-repeat', backgroundColor: '#d1efff' }}>
          <div className="leaderboard-body">
            <div className="leaderboard-podium-col">
              <h2 className="mission-section-title">Leaderboard</h2>
              <p className="leaderboard-rank-text">
                {currentUserRank ? `You are in ${getOrdinal(currentUserRank)} place.` : "Join a mission to get ranked!"}
              </p>
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
                          {user.avatar ? <img src={user.avatar} alt={user.name} /> : (
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#30bdb7', color: '#fff', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
                              {getInitials(user.name)}
                            </div>
                          )}
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
                    {user.avatar
                      ? <img src={user.avatar} alt={`${user.name}'s avatar`} className="leaderboard-avatar" />
                      : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#30bdb7', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', flexShrink: 0 }}>{getInitials(user.name)}</div>
                    }
                    <span className="rank-name">{user.name}</span>
                    <span className="rank-points">{user.points} pts</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOUNTAIN - no content overlapping, sits at the very bottom */}
          <img src={mountainBg} alt="" className="mountain-bg-div" />
        </section>

      </div>
    </div>

    {/* Proposal View/Edit Modal */}
    {selectedProposalForView && (
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedProposalForView(null); }}
      >
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
          width: '90vw',
          maxWidth: 700,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {selectedProposalForView.status === 'for_approval' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f3b73' }}>
                  {selectedProposalForView.projectType === 'sl' ? '📝 Service Learning Proposal' : '📝 Community Engagement Proposal'}
                </h3>
                <button
                  onClick={() => setSelectedProposalForView(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
                >✕</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <ProjectProposal
                  projectType={selectedProposalForView.projectType === 'sl' ? 'service-learning' : 'community-engagement'}
                  editProposal={selectedProposalForView}
                  onClose={() => { setSelectedProposalForView(null); setProposalRefreshKey(k => k + 1); }}
                  timelineNode={<ProposalTimeline proposal={selectedProposalForView} compact />}
                />
              </div>
            </>
          ) : (
            <ReviewModal
              proposal={selectedProposalForView}
              onClose={() => setSelectedProposalForView(null)}
              isPartner={true}
            />
          )}
        </div>
      </div>
    )}

    {/* Event Details Modal */}
    {selectedMissionId && (
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedMissionId(null); }}
      >
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
          width: '90vw',
          maxWidth: 900,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <EventDetails
            key={selectedMissionId}
            missionId={selectedMissionId}
            onClose={() => { setSelectedMissionId(null); setEnrollmentRefreshKey(k => k + 1); }}
          />
        </div>
      </div>
    )}
    </>
  );
}

export default StudentHome;
