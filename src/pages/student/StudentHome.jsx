import { Link, useNavigate } from "react-router-dom";
import { auth, functions, db } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";

import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import Header from "../../components/Header";
import "../../styles/ui.css";

const defaultLeaderboard = [
  { name: "JC", level: 15, points: 2030 },
  { name: "Alyzza", level: 12, points: 1580 },
  { name: "Austine", level: 11, points: 1010 },
  { name: "Jiengrey", level: 8, points: 730 },
  { name: "Vaughn", level: 7, points: 690 },
];

const StudentHome = () => {
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [notificationOverlayOpen, setNotificationOverlayOpen] = useState(false);
  const button2Ref = React.useRef(null);
  const button3Ref = React.useRef(null);

  // Dynamic placeholders
  const [level, setLevel] = useState(5);
  const [currentPoints, setCurrentPoints] = useState(350);
  const [nextLevelPoints, setNextLevelPoints] = useState(500);
  const [studentName, setStudentName] = useState("Joshua");
  const [studentRank, setStudentRank] = useState(8);
  const [leaderboard, setLeaderboard] = useState(defaultLeaderboard);
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
  const [globalNotifications, setGlobalNotifications] = useState([
    { title: "New Event Added:", bold: "The Disaster Risk Reduction Training in Los Baños is now open!", text: "Sign up and secure your slot today." },
    { title: "2 New Volunteers Joined the Hydroponics Workshop!", text: "You are now 80% full. Get your tasks before they run out" },
    { title: "Leaderboard Alert!", bold: "You have surpassed Alyzza Ocoma and are now ranked #2.", text: "Keep earning those points!" },
    { title: "Opportunity Alert:", bold: "The 'Bayan Ko, Titser Ko' team needs one (1) more volunteer skilled in Literacy Coaching.", text: "Are you ready to serve?" },
    { title: "Certificate Ready:", bold: "Your official Certificate of Participation for the Laguna Lake Cleanup is now available in your Profile!" }
  ]);
  const [menuProfileName, setMenuProfileName] = useState("Joshua Garcia");
  const [chatList, setChatList] = useState([
    { name: "The Literacy Lighthouse Foundation", msg: "Request to expedite the reflection journal r..." },
    { name: "Barangay Masikap Development Council", msg: "Just sent over the attendance sheet and GP...", unread: true },
    { name: "Project Green Lungs Alliance", msg: "Need Admin approval for the revised Task L..." },
    { name: "Alaga Kabataan Outreach Group", msg: "Please confirm if all certificates are ready fo..." },
  ]);
  // Notification overlay content
  const [notificationContent, setNotificationContent] = useState([
    {
      title: "Action Required: Riverbank Cleanup Evidence",
      items: [
        "Your Task 1 documentation for the Laguna Lake Cleanup is overdue. Please submit your photos and reflection to get your points!"
      ]
    },
    {
      title: "Hooray! You're In!",
      text: "You have successfully joined the Hydroponics & Sustainable Livelihood Workshop. Check the event page for your assigned group and pre-event materials."
    },
    {
      title: "You Reached Level 5!",
      text: "Congratulations! You've earned the 'Service Coordinator' title and unlocked new profile customizations. Keep serving to achieve Level 6!"
    }
  ]);

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

  return (
    <div className="main-page" >
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
      {/* ...existing code... */}


      {/* Main Dashboard */}
      <div style={{ display: 'flex', gap: 24, padding: '32px 0 32px 0', width: '100%', boxSizing: 'border-box', justifyContent: 'center', margin: '0 16px 16px 16px' }}>
        {/* Missions & Leaderboard */}
        <div style={{ flex: 2 }}>
          {/* Find Your Next Mission */}
          <section style={{ background: '#7bb661', borderRadius: 20, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#fff', fontWeight: 700 }}>Find Your Next Mission</h2>
              <a href="#" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 500 }}>View All Events</a>
            </div>
            <div style={{ display: 'flex', gap: 24, overflowX: 'auto', width: '100%', paddingBottom: 8 }}>
              {/* Mission Cards */}
              {missionCards.length === 0 ? (
                <div style={{ color: '#fff', fontWeight: 500 }}>No missions available.</div>
              ) : (
                missionCards.map((mission, idx) => (
                  <div
                    key={mission.id}
                    style={{ background: '#fff', borderRadius: 16, minWidth: 250, maxWidth: 300, flex: '0 0 auto', padding: 0, boxShadow: '0 2px 8px #0001', cursor: 'pointer' }}
                    onClick={() => window.location.href = `/event/${mission.id}`}
                  >
                    <img src={mission.img || "/assets/mission1.jpg"} alt={mission.alt || mission.title} style={{ width: '100%', height: 100, objectFit: 'cover', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                    <div style={{ padding: 16, textAlign: 'center', fontWeight: 600, color: '#2e5d3b' }}>
                      {mission.title}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Leaderboard */}
          <section style={{ background: '#7bb661', borderRadius: 20, padding: 24, display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ background: '#234e7b', borderRadius: 16, padding: 24, color: '#fff', textAlign: 'center', minWidth: 180 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="icon-user" style={{ fontSize: 36, color: '#234e7b' }}></i>
              </div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>{studentName}</div>
              <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>{`Rank ${studentRank}`}</div>
              <div style={{ background: '#ffa726', borderRadius: 8, height: 24, width: '100%', margin: '0 auto', color: '#fff', fontWeight: 600, lineHeight: '24px' }}>{currentPoints}</div>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 16 }}>Leaderboard</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {leaderboard.map((user, idx) => (
                  <li key={user.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, background: idx === 0 ? '#fff8e1' : '#e3f2fd', borderRadius: 8, padding: '8px 16px', fontWeight: idx === 0 ? 700 : 500 }}>
                    <span style={{ width: 32, textAlign: 'center', color: idx === 0 ? '#ffa726' : '#234e7b', fontWeight: 700 }}>{idx + 1}</span>
                    <span style={{ flex: 1, color: '#234e7b' }}>{user.name}</span>
                    <span style={{ width: 80, color: '#7bb661', fontWeight: 600 }}>{`Level ${user.level}`}</span>
                    <span style={{ width: 90, background: '#ffa726', color: '#fff', borderRadius: 6, textAlign: 'center', fontWeight: 700 }}>{user.points} PTS</span>
                  </li>
                ))}
                <li style={{ marginTop: 8, color: '#fff', fontWeight: 600 }}>{`#${studentRank} ${studentName}`} <span style={{ background: '#ffa726', borderRadius: 6, padding: '2px 8px', marginLeft: 8 }}>{currentPoints} PTS</span></li>
              </ul>
            </div>
          </section>
        </div>

        {/* Global Notification (copied from EventDetails.jsx) */}
        <aside style={{ flex: 1, background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 2px 8px #0001', minWidth: 320, maxWidth: 360, marginLeft: 8, marginRight: 32, border: '2px solid #30bdb7' }}>
          <h3 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16 }}>Global Notification</h3>
          <div style={{ color: '#234e7b', fontWeight: 500, lineHeight: '1.7', fontSize: 15 }}>
            {globalNotifications.map((notif, idx) => (
              <div key={idx} style={{ marginTop: idx === 0 ? 0 : 16 }}>
                {notif.title && <span style={{ fontWeight: 700 }}>{notif.title} </span>}
                {notif.bold && <span style={{ fontWeight: 700 }}>{notif.bold} </span>}
                {notif.text && <span>{notif.text}</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default StudentHome;
