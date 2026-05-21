import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useSession } from '../context/SessionContext';
import './Header.css';
import NotificationBell from './NotificationBell';
import servePlusIcon from '../assets/serve_plus_icon.svg';
import StudentMenu from './menu/StudentMenu';
import FacultyMenu from './menu/FacultyMenu';
import AdminMenu from './menu/AdminMenu';
import PartnerMenu from './menu/PartnerMenu';
import SysAdminMenu from './menu/SysAdminMenu';
import CertificateQRScannerModal from './CertificateQRScannerModal';
import SettingsModal from './SettingsModal';
import ProjectProposal from '../pages/global/proposal/ProjectProposal';
import { VolunteerActivismOutlinedIcon, LocalLibraryOutlinedIcon, CloseIcon, HelpOutlineRoundedIcon } from './icons';
import ChatModal from './ChatModal';
import GlobalAnnouncements, { GlobalNotificationButton } from './GlobalAnnouncements';
import OnboardingTutorial from './OnboardingTutorial';
import { showToast } from '../utils/toast';


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
          <h3>Create Project Proposal</h3>
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
  const { userData } = useSession();
  const userRole = userData?.role || null;
  const userName = userData?.name || '';
  const userEmail = userData?.email || '';
  const userUsername = userData?.username || '';
  const userAvatar = userData?.avatar || '';
  const [showMenu, setShowMenu] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState('');
  const [isCheckingPendingProposal, setIsCheckingPendingProposal] = useState(false);
  const [showCertificateQRModal, setShowCertificateQRModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) return;
      setAnnouncementsEnabled(snap.data().announcementsEnabled !== false);
    });
    return () => unsubscribe();
  }, [userData]);

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

  const handleOpenProposalModal = async () => {
    if (isCheckingPendingProposal) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      showToast('You must be logged in to create a proposal', 'error');
      return;
    }

    // Admins can always create proposals
    if (userRole === 'admin') {
      setShowProposalModal(true);
      return;
    }

    setIsCheckingPendingProposal(true);
    try {
      const blockedStatuses = new Set(['for_approval', 'for-approval', 'pending']);
      const missionsQuery = query(collection(db, 'missions'), where('createdBy', '==', user.uid));
      const missionsSnap = await getDocs(missionsQuery);
      const hasPendingProposal = missionsSnap.docs.some((docSnap) => {
        const status = String(docSnap.data()?.status || '').toLowerCase();
        return blockedStatuses.has(status);
      });

      if (hasPendingProposal) {
        showToast('You cannot propose an activity if you have a pending proposal.', 'error');
        return;
      }

      setShowProposalModal(true);
    } catch (error) {
      console.error('Error checking pending proposals before opening modal:', error);
      showToast('Unable to verify proposal status. Please try again.', 'error');
    } finally {
      setIsCheckingPendingProposal(false);
    }
  };

  const handleSelectProjectType = (type) => {
    setSelectedProjectType(type);
    setShowProposalForm(true);
  };

  const handleCloseProposalForm = () => {
    setShowProposalForm(false);
    setSelectedProjectType('');
  };

  const handleOpenSettings = () => {
    setShowMenu(false);
    setShowSettings(true);
  };

  const renderMenu = () => {
    const commonProps = {
      userName, userEmail, userUsername, userAvatar,
      onLogout: handleLogout,
      onClose: () => setShowMenu(false),
      onOpenSettings: handleOpenSettings,
    };
    switch (userRole) {
      case 'student':
        return <StudentMenu {...commonProps} onCreateProposal={handleOpenProposalModal} />;
      case 'faculty':
        return <FacultyMenu {...commonProps} onCreateProposal={handleOpenProposalModal} />;
      case 'admin':
        return <AdminMenu {...commonProps} onCreateProposal={handleOpenProposalModal} />;
      case 'partner':
        return <PartnerMenu {...commonProps} />;
      case 'sysadmin':
        return <SysAdminMenu {...commonProps} />;
      default:
        return null;
    }
  };
  return (
    <>
      <OnboardingTutorial forceOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      <header className="serve-header">
        <div className="header-container">
          {/* Logo */}
          <button className="header-logo" onClick={handleLogoClick}>
            <div className="logo-icon">
              <img src={servePlusIcon} alt="SERVE+" width="32" height="32" />
            </div>
            <span className="header-logo-text">SERVE<span className="header-logo-plus">+</span></span>
          </button>
          {/* Center slot — student home portals the player strip here */}
          <div className="header-center-slot" id="header-center-slot" />
          {/* Right Side Icons */}
          <div className="header-actions">
            {userRole === 'student' && (
              <button
                className="notification-bell-button tutorial-header-btn"
                aria-label="Help / Tutorial"
                title="Help"
                onClick={() => setShowTutorial(true)}
              >
                <HelpOutlineRoundedIcon style={{ fontSize: 24, color: '#000' }} />
              </button>
            )}
            <ChatModal />
            <NotificationBell />
            <div className="menu-container" ref={menuRef}>
              {userRole && (
                <button
                  className="icon-button profile-btn"
                  aria-label="Menu"
                  title={userName || 'Profile'}
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <div className="header-profile-wrap">
                    {userAvatar ? (
                      <img src={userAvatar} alt="Profile" className="header-avatar" />
                    ) : (
                      <div className="header-avatar-initials">
                        {(() => {
                          const parts = (userName || '?').trim().split(/\s+/);
                          if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                          return (userName?.slice(0, 2) || '?').toUpperCase();
                        })()}
                      </div>
                    )}
                    {userName && (
                      <span className="header-greeting">Hi, {userName.trim().split(/\s+/)[0]}!</span>
                    )}
                  </div>
                </button>
              )}
              {showMenu && renderMenu()}
            </div>
          </div>
        </div>
      </header>
      <div className="header-fade-gradient" aria-hidden="true" />
      {userRole === 'student' && (
        <button
          className="tutorial-fab"
          aria-label="Help / Tutorial"
          title="Help"
          onClick={() => setShowTutorial(true)}
        >
          <HelpOutlineRoundedIcon style={{ fontSize: 22, color: '#6b7280' }} />
        </button>
      )}
      {userRole !== 'admin' && announcementsEnabled && (
        <>
          <GlobalNotificationButton
            unreadCount={announcementUnreadCount}
            onClick={() => setAnnouncementsOpen(!announcementsOpen)}
            isOpen={announcementsOpen}
          />
          <aside className={`global-feed ${announcementsOpen ? 'open' : ''}`}>
            <GlobalAnnouncements />
          </aside>
        </>
      )}

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
                {selectedProjectType === 'service-learning' ? 'Service Learning Proposal' : 'Community Engagement Proposal'}
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
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}


