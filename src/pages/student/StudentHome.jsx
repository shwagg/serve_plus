import { Link, useNavigate } from "react-router-dom";
import { auth, functions } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";

import React, { useState, useEffect } from "react";
import servePlusLogo from "../../assets/serve_plus_logo.svg";
import chatIcon from "../../assets/headassets/Chat Icon.svg";
import notificationIcon from "../../assets/headassets/Notification Icon.svg";
import menuIcon from "../../assets/headassets/Menu Icon.svg";
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
  const [missionCards, setMissionCards] = useState([
    {
      id: "laguna-lake-cleanup",
      img: "/assets/mission1.jpg",
      alt: "Laguna Lake",
      title: "Laguna Lake Watershed Reforestation & River Cleanup Drive"
    },
    {
      id: "bayan-ko-titser-ko",
      img: "/assets/mission2.jpg",
      alt: "Bayan Ko",
      title: '"Bayan Ko, Titser Ko" Literacy & Tutorial Program'
    },
    {
      id: "hydroponics-hope",
      img: "/assets/mission3.jpg",
      alt: "Hydroponics",
      title: "Hydroponics & Sustainable Livelihood Workshop (HOPE)"
    }
  ]);
  const [globalNotifications, setGlobalNotifications] = useState([
    { text: "New Event Added: The Disaster Risk Reduction Training in Los Baños is now open! Sign up and secure your slot today." },
    { text: "2 New Volunteers Joined the Hydroponics Workshop! You are now 80% full. Get your tasks before they run out" },
    { text: "Leaderboard Alert! You have surpassed Alyzza Ocoma and are now ranked #2. Keep earning those points!" },
    { text: "Opportunity Alert: The 'Bayan Ko, Titser Ko' team needs one (1) more volunteer skilled in Literacy Coaching. Are you ready to serve?" },
    { text: "Certificate Ready: Your official Certificate of Participation for the Laguna Lake Cleanup is now available in your Profile!" }
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
      if (user?.uid) {
        const logLogout = httpsCallable(functions, "logLogout");
        await logLogout({ uid: user.uid });
      }
    } catch (e) {
      // Ignore audit failures when logging out
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
    <div className="student-dashboard" style={{ background: '#f6f6f6', minHeight: '100vh', minWidth: '100vw', width: '100vw', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
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
      <header style={{ display: 'flex', alignItems: 'center', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e0e0e0', height: 72, margin: '16px 16px 0 16px', borderRadius: 16 }}>
        <img src={servePlusLogo} alt="Serve+ Logo" style={{ height: 70, marginRight: 16, maxHeight: '100%' }} />
        <span style={{ fontWeight: 600, fontSize: 22, color: '#2e5d3b' }}>{`Level ${level}`}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 120, background: '#e9e9e9', borderRadius: 8, overflow: 'hidden', marginRight: 8 }}>
            <div style={{ width: `${(currentPoints/nextLevelPoints)*100}%`, background: '#ffa726', height: 24, textAlign: 'center', color: '#fff', fontWeight: 600 }}>{currentPoints}</div>
          </div>
          <span style={{ color: '#888', fontWeight: 500 }}>{nextLevelPoints}</span>
          {/* Button Row */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 16, position: 'relative' }}>
            <button ref={button2Ref} style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: '#7bb661', color: '#fff', fontWeight: 600, cursor: 'pointer', position: 'relative', zIndex: 1010, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleChatOverlayToggle}>
              <img src={chatIcon} alt="Chat" style={{ height: 22, width: 22 }} />
            </button>
            <button style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: '#234e7b', color: '#fff', fontWeight: 600, cursor: 'pointer', position: 'relative', zIndex: 1010, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleNotificationOverlayToggle}>
              <img src={notificationIcon} alt="Notification" style={{ height: 22, width: 22 }} />
            </button>
            <button ref={button3Ref} style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: '#ffa726', color: '#fff', fontWeight: 600, cursor: 'pointer', position: 'relative', zIndex: 1010, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleMenuOverlayToggle}>
              <img src={menuIcon} alt="Menu" style={{ height: 22, width: 22 }} />
            </button>
            {/* Chat Overlay (now on Button 1) */}
            {chatOverlayOpen && (
              <div style={{ position: 'absolute', top: 40, right: 120, width: 300, background: '#555', color: '#fff', borderRadius: 16, boxShadow: '0 4px 16px #0003', zIndex: 1000, padding: '20px 16px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>Chats</span>
                  <a href="#" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 500, fontSize: 14 }}>View all Chats</a>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <input type="text" placeholder="Search" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', fontSize: 15, background: '#eee', color: '#333' }} />
                </div>
                {/* Chat List */}
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {chatList.map((chat, idx) => (
                    <div key={chat.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < 3 ? '1px solid #8882' : 'none', cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="icon-user" style={{ fontSize: 22, color: '#2ec4b6' }}></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{chat.name}</div>
                        <div style={{ fontSize: 13, color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.msg}</div>
                      </div>
                      {chat.unread && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ec4b6', display: 'inline-block' }}></span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Notification Overlay (Button 2) */}
            {notificationOverlayOpen && (
              <div style={{ position: 'absolute', top: 40, right: 60, width: 340, background: '#555', color: '#fff', borderRadius: 16, boxShadow: '0 4px 16px #0003', zIndex: 1000, padding: '20px 22px', marginTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 10 }}>Notification</div>
                {notificationContent.map((section, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{section.title}</div>
                    {section.items && (
                      <ul style={{ marginLeft: 18, marginBottom: 10 }}>
                        {section.items.map((item, i) => (
                          <li key={i} style={{ fontSize: 15, marginBottom: 4 }}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {section.text && (
                      <div style={{ fontSize: 15, marginBottom: 10 }}>{section.text}</div>
                    )}
                    {idx < notificationContent.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid #aaa', margin: '12px 0' }} />}
                  </React.Fragment>
                ))}
              </div>
            )}
            {menuOverlayOpen && (
              <div style={{ position: 'absolute', top: 40, right: 0, width: 230, background: '#555', color: '#fff', borderRadius: 16, boxShadow: '0 4px 16px #0003', zIndex: 1000, padding: '20px 16px', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="icon-user" style={{ fontSize: 24, color: '#7bb661' }}></i>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{menuProfileName}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #aaa', margin: '10px 0 14px 0' }} />
                <nav style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <span style={{ fontSize: 16 }}>☆</span>
                    <span style={{ fontWeight: 500 }}>Leaderboard</span>
                  </div>
                  <Link to="/student/propose-project" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                      <span style={{ fontSize: 16 }}>⊞</span>
                      <span style={{ fontWeight: 500 }}>Create Proposal</span>
                    </div>
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <span style={{ fontSize: 16 }}>⚙️</span>
                    <span style={{ fontWeight: 500 }}>Settings</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <span style={{ fontSize: 16 }}>🛠️</span>
                    <span style={{ fontWeight: 500 }}>Support</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                    <span style={{ fontSize: 16 }}>ℹ️</span>
                    <span style={{ fontWeight: 500 }}>About Us</span>
                  </div>
                </nav>
                <button style={{ background: '#2ec4b6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, fontSize: 15, marginTop: 14, cursor: 'pointer', width: '100%' }} onClick={handleLogout}>Log Out</button>
              </div>
            )}
          </div>
          {/* Removed old icon placeholders, now using SVGs in buttons above */}
        </div>
      </header>


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
              {missionCards.map((mission, idx) => (
                <div
                  key={mission.alt}
                  style={{ background: '#fff', borderRadius: 16, minWidth: 250, maxWidth: 300, flex: '0 0 auto', padding: 0, boxShadow: '0 2px 8px #0001', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/event/${mission.id}`}
                >
                  <img src={mission.img} alt={mission.alt} style={{ width: '100%', height: 100, objectFit: 'cover', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                  <div style={{ padding: 16, textAlign: 'center', fontWeight: 600, color: '#2e5d3b' }}>
                    {mission.title}
                  </div>
                </div>
              ))}
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

        {/* Global Notification */}
        <aside style={{ flex: 1, background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 2px 8px #0001', minWidth: 320, maxWidth: 360, marginLeft: 8, marginRight: 32
         }}>
          <h3 style={{ color: '#234e7b', fontWeight: 700, marginBottom: 16 }}>Global Notification</h3>
          <div style={{ color: '#234e7b', fontWeight: 500, lineHeight: '1.7' }}>
            {globalNotifications.map((notif, idx) => (
              <div key={idx} style={{ marginTop: idx === 0 ? 0 : 12 }}>{notif.text}</div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StudentHome;
