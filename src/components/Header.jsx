import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import './Header.css';
import chatIcon from '../assets/headassets/Chat Icon.svg';
import notificationIcon from '../assets/headassets/Notification Icon.svg';
import menuIcon from '../assets/headassets/Menu Icon.svg';
import serveIcon from '../assets/serve_plus_logo.svg';
import StudentMenu from './menu/StudentMenu';
import FacultyMenu from './menu/FacultyMenu';
import AdminMenu from './menu/AdminMenu';
import PartnerMenu from './menu/PartnerMenu';
export default function Header() {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role);
            setUserName(userData.name || user.displayName || 'User');
          }
          setUserEmail(user.email || '');
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserRole();
  }, []);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const handleLogoClick = () => {
    if (!userRole) return;
    switch (userRole) {
      case 'student':
        navigate('/student/home');
        break;
      case 'faculty':
        navigate('/faculty/home');
        break;
      case 'partner':
        navigate('/partner/home');
        break;
      case 'admin':
        navigate('/admin/dashboard');
        break;
      default:
        break;
    }
  };
  const handleLogout = async () => {
    try {
      const user = auth.currentUser;
      if (user?.uid) {
        const logLogout = httpsCallable(functions, "logLogout");
        await logLogout({ uid: user.uid });
      }
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  const renderMenu = () => {
    switch (userRole) {
      case 'student':
        return <StudentMenu userName={userName} userEmail={userEmail} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      case 'faculty':
        return <FacultyMenu userName={userName} userEmail={userEmail} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      case 'admin':
        return <AdminMenu userName={userName} userEmail={userEmail} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      case 'partner':
        return <PartnerMenu userName={userName} userEmail={userEmail} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      default:
        return null;
    }
  };
  return (
    <header className="serve-header">
      <div className="header-container">
        {/* Logo */}
        <button className="header-logo" onClick={handleLogoClick}>
          <div className="logo-icon">
            <img src={serveIcon} alt="Serve Plus Logo" width="32" height="32" />
          </div>
        </button>
        {/* Right Side Icons */}
        <div className="header-actions">
          <button 
            className="icon-button"
            aria-label="Chat">
            <img src={chatIcon} alt="Chat" width="24" height="24" />
          </button>
          <button 
            className="icon-button"
            aria-label="Notification">
            <img src={notificationIcon} alt="Notifications" width="24" height="24" />
          </button>
          <div className="menu-container" ref={menuRef}>
            <button 
              className="icon-button menu-button"
              aria-label="Menu"
              onClick={() => setShowMenu(!showMenu)}>
              <img src={menuIcon} alt="Menu" width="24" height="24" />
            </button>
            {showMenu && renderMenu()}
          </div>
        </div>
      </div>
    </header>
  );
}
