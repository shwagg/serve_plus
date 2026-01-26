import { useNavigate } from 'react-router-dom';
import '../styles/Menu.css';
import settingsIcon from '../../assets/menuassets/Settings.svg';
import supportIcon from '../../assets/menuassets/Support.svg';
import infoIcon from '../../assets/menuassets/Info.svg';
export default function PartnerMenu({ userName, userEmail, userUsername, userAvatar, onLogout, onClose, onCreateProposal }) {
  const navigate = useNavigate();
  const handleMenuClick = (path) => {
    navigate(path);
    onClose();
  };

  // Use username if available, otherwise fall back to email prefix
  const displayUsername = userUsername || (userEmail ? userEmail.split('@')[0] : 'User');
  // Get first letter for avatar fallback
  const avatarLetter = displayUsername.charAt(0).toUpperCase();

  return (
    <div className="menu-dropdown">
      <button className="menu-header-btn" onClick={() => handleMenuClick('/profile')}>
        {userAvatar ? (
          <img src={userAvatar} alt="avatar" className="user-avatar-img" />
        ) : (
          <div className="user-avatar">{avatarLetter}</div>
        )}
        <div className="user-info">
          <p className="user-name">{displayUsername}</p>
          <p className="user-email">{userEmail}</p>
        </div>
      </button>
      <div className="menu-divider"></div>
      <div className="menu-items">
        <button className="menu-item" onClick={() => handleMenuClick('/global/menu/settings')}>
          <img src={settingsIcon} alt="Settings" className="menu-icon" />
          Settings
        </button>
        <button className="menu-item" onClick={() => handleMenuClick('/global/menu/support')}>
          <img src={supportIcon} alt="Support" className="menu-icon" />
          Support
        </button>
        <button className="menu-item" onClick={() => handleMenuClick('/global/menu/about')}>
          <img src={infoIcon} alt="About Us" className="menu-icon" />
          About Us
        </button>
      </div>
      <div className="menu-divider"></div>
      <button className="logout-btn" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}
