import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import './Header.css';
import chatIcon from '../assets/headassets/Chat Icon.svg';
import NotificationBell from './NotificationBell';
import menuIcon from '../assets/headassets/Menu Icon.svg';
import serveIcon from '../assets/serve_plus_logo.svg';
import StudentMenu from './menu/StudentMenu';
import FacultyMenu from './menu/FacultyMenu';
import AdminMenu from './menu/AdminMenu';
import PartnerMenu from './menu/PartnerMenu';
import ProjectProposal from '../pages/global/proposal/ProjectProposal';
import ChatModal from './ChatModal';


const CreateProposalModal = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  const handleSelection = (type) => {
    onSelectType(type);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create Project Proposal</h2>
        <p>Select the type of project you want to propose:</p>

        <div className="proposal-type-buttons">
          <button
            className="proposal-type-btn service-learning"
            onClick={() => handleSelection('service-learning')}
          >
            <h3>Service Learning</h3>
            <p>Academic-based community service projects</p>
          </button>

          <button
            className="proposal-type-btn community-engagement"
            onClick={() => handleSelection('community-engagement')}
          >
            <h3>Community Engagement</h3>
            <p>Direct community partnership initiatives</p>
          </button>
        </div>

        <button className="modal-close-btn" onClick={onClose}>Cancel</button>
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
  const [showChatModal, setShowChatModal] = useState(false);
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
        return <StudentMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} />;
      case 'faculty':
        return <FacultyMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} />;
      case 'admin':
        return <AdminMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} onCreateProposal={handleOpenProposalModal} />;
      case 'partner':
        return <PartnerMenu userName={userName} userEmail={userEmail} userUsername={userUsername} userAvatar={userAvatar} onLogout={handleLogout} onClose={() => setShowMenu(false)} />;
      default:
        return null;
    }
  };
  return (
    <>
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
              aria-label="Chat"
              onClick={() => setShowChatModal(true)}>
              <img src={chatIcon} alt="Chat" width="24" height="24" />
            </button>
            <NotificationBell />
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
      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        onSelectMission={(missionId) => {
          setShowChatModal(false);
          navigate(`/chat/${missionId}`);
        }}
      />

      <CreateProposalModal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        onSelectType={handleSelectProjectType}
      />

      {showProposalForm && (
        <ProjectProposal
          projectType={selectedProjectType}
          onClose={handleCloseProposalForm}
        />
      )}
    </>
  );
}


