import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import './Header.css';
import menuIcon from '../assets/headassets/Menu Icon.svg';
import NotificationBell from './NotificationBell';
import serveIcon from '../assets/serve_plus_logo.svg';
import StudentMenu from './menu/StudentMenu';
import FacultyMenu from './menu/FacultyMenu';
import AdminMenu from './menu/AdminMenu';
import PartnerMenu from './menu/PartnerMenu';
import CertificateQRScannerModal from './CertificateQRScannerModal';
import ProjectProposal from '../pages/global/proposal/ProjectProposal';
import { VolunteerActivismOutlinedIcon, LocalLibraryOutlinedIcon, CloseIcon } from './icons';
import ChatModal from './ChatModal';
import GlobalAnnouncements, { GlobalNotificationButton } from './GlobalAnnouncements';
import OnboardingTutorial from './OnboardingTutorial';


const CreateProposalModal = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  const handleSelection = (type) => {
    onSelectType(type);
    onClose();
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <h3>📝 Create Project Proposal</h3>
          <button className="cp-close-btn" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </button>
        </div>
        <div className="cp-body">
        <p>Select the type of project you want to propose:</p>

        <div className="proposal-type-buttons">
          <button
            className="proposal-type-btn service-learning"
            onClick={() => handleSelection('service-learning')}
          >
            <VolunteerActivismOutlinedIcon className="proposal-type-icon" />
            <h3>Service Learning</h3>
            <p>Academic-based community service projects</p>
          </button>

          <button
            className="proposal-type-btn community-engagement"
            onClick={() => handleSelection('community-engagement')}
          >
            <LocalLibraryOutlinedIcon className="proposal-type-icon" />
            <h3>Community Engagement</h3>
            <p>Direct community partnership initiatives</p>
          </button>
        </div>
        </div>
      </div>
    </div>

  );
};

export default function Header() {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [showCertificateQRModal, setShowCertificateQRModal] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
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
            setUserUsername(userData.username || '');
            setUserAvatar(userData.avatar || '');
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
  useEffect(() => {
    const checkCount = () => {
      if (window.announcementActions?.getUnreadCount) {
        setAnnouncementUnreadCount(window.announcementActions.getUnreadCount());
      }
    };
    checkCount();
    const interval = setInterval(checkCount, 500);
    return () => clearInterval(interval);
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
        navigate('/partner/dashboard');
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
        logLogout({ uid: user.uid }).catch(() => { });
      }
      await signOut(auth);
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleOpenProposalModal = () => {
    setShowProposalModal(true);
  };

  const handleSelectProjectType = (type) => {
    setSelectedProjectType(type);
    setShowProposalForm(true);
  };

  const handleCloseProposalForm = () => {
    setShowProposalForm(false);
    setSelectedProjectType('');
  };

  const renderMenu = () => {
    switch (userRole) {
      case 'student':
        return <StudentMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} onOpenCertificateQR={() => setShowCertificateQRModal(true)} />;
      case 'faculty':
        return <FacultyMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} onOpenCertificateQR={() => setShowCertificateQRModal(true)} />;
      case 'admin':
        return <AdminMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} onOpenCertificateQR={() => setShowCertificateQRModal(true)} />;
      case 'partner':
        return <PartnerMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      default:
        return null;
    }
  };
  return (
    <>
      <OnboardingTutorial />
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
            <ChatModal />
            <NotificationBell />
            {userRole && (
              <button
                className="icon-button profile-btn"
                onClick={() => navigate('/profile')}
                aria-label="My Profile"
                title={userName || 'Profile'}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="Profile" className="header-avatar" />
                ) : (
                  <div className="header-avatar-initials">
                    {(userName?.charAt(0) || '?').toUpperCase()}
                  </div>
                )}
              </button>
            )}
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
      <GlobalNotificationButton
        unreadCount={announcementUnreadCount}
        onClick={() => setAnnouncementsOpen(!announcementsOpen)}
      />
      <aside
        className={`global-feed ${announcementsOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 80,
          right: 0,
          height: 'calc(100vh - 80px)',
          width: 380,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '2px solid #30bdb7',
          zIndex: 2100,
          transition: 'transform 0.3s',
          transform: announcementsOpen ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: announcementsOpen ? 'auto' : 'none'
        }}
      >
        <GlobalAnnouncements />
      </aside>

      <CreateProposalModal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        onSelectType={handleSelectProjectType}
      />

      {showProposalForm && (
        <div className="ea-modal-overlay" onClick={handleCloseProposalForm}>
          <div className="ea-modal-card" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">
                {selectedProjectType === 'service-learning' ? '📝 Service Learning Proposal' : '📝 Community Engagement Proposal'}
              </h3>
              <button className="ea-modal-close" onClick={handleCloseProposalForm}>✕</button>
            </div>
            <div className="modal-scrollable">
              <ProjectProposal
                projectType={selectedProjectType}
                onClose={handleCloseProposalForm}
              />
            </div>
          </div>
        </div>
      )}
      <CertificateQRScannerModal
        isOpen={showCertificateQRModal}
        onClose={() => setShowCertificateQRModal(false)}
      />
    </>
  );
}


