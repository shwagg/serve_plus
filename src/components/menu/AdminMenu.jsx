import { useNavigate } from 'react-router-dom';
import '../styles/Menu.css';
import settingsIcon from '../../assets/menuassets/Settings.svg';
import supportIcon from '../../assets/menuassets/Support.svg';
import infoIcon from '../../assets/menuassets/Info.svg';
export default function AdminMenu({ userName, userEmail, onLogout, onClose }) {
  const navigate = useNavigate();
  const handleMenuClick = (path) => {
    navigate(path);
    onClose();
  };
  return (
    <div className="menu-dropdown">
      <button className="menu-header-btn" onClick={() => handleMenuClick('/global/menu/profile')}>
        <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
        <div className="user-info">
          <p className="user-name">{userName}</p>
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
