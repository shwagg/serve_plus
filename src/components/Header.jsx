import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useSession } from '../context/SessionContext';
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
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const menuRef = useRef(null);
  const navigate = useNavigate();
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
        isOpen={announcementsOpen}
      />
      <aside
        className={`global-feed ${announcementsOpen ? 'open' : ''}`}
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


