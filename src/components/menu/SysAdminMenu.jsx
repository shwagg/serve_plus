import { useNavigate } from "react-router-dom";
import infoIcon from "../../assets/menuassets/Info.svg";
import privacyPol from "../../assets/menuassets/PrivacyPolicy.svg";
import settingsIcon from "../../assets/menuassets/Settings.svg";
import supportIcon from "../../assets/menuassets/Support.svg";
import viewIcon from "../../assets/menuassets/View.svg";
import { CloudSyncOutlinedIcon } from "../icons";
import "../styles/Menu.css";

export default function SysAdminMenu({
  userName,
  userEmail,
  userUsername,
  userAvatar,
  onLogout,
  onClose,
  onOpenSettings,
}) {
  const navigate = useNavigate();
  const handleMenuClick = (path) => {
    navigate(path);
    onClose();
  };

  const displayName = userName || userUsername || (userEmail ? userEmail.split("@")[0] : "User");
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="menu-dropdown">
      <button
        className="menu-header-btn"
        onClick={() => handleMenuClick("/profile")}
      >
        {userAvatar ? (
          <img src={userAvatar} alt="avatar" className="user-avatar-img" />
        ) : (
          <div className="user-avatar">{avatarLetter}</div>
        )}
        <div className="user-info">
          <p className="user-name">{displayName}</p>
          <p className="user-email">{userEmail}</p>
        </div>
      </button>
      <div className="menu-divider"></div>
      <div className="menu-items">
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/sysadmin/roster")}
        >
          <img src={viewIcon} alt="Account Management" className="menu-icon" />
          Account Management
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/sysadmin/support")}
        >
          <img src={supportIcon} alt="Support Inbox" className="menu-icon" />
          Support Inbox
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/sysadmin/system/agreements")}
        >
          <img src={privacyPol} alt="Privacy & Terms" className="menu-icon" />
          Privacy & Terms
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/sysadmin/audit-logs")}
        >
          <img src={settingsIcon} alt="Activity Log" className="menu-icon" />
          Activity Log
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/sysadmin/backup-restore")}
        >
          <CloudSyncOutlinedIcon className="menu-icon" style={{ fontSize: 20 }} />
          Backup & Restore
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/verify-certificate")}
        >
          <img src={viewIcon} alt="Verify Certificate" className="menu-icon" />
          Verify Certificate
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/")}
        >
          <img src={infoIcon} alt="About Us" className="menu-icon" />
          About Us
        </button>
        <button
          className="menu-item"
          onClick={() => { onClose(); onOpenSettings(); }}
        >
          <img src={settingsIcon} alt="Settings" className="menu-icon" />
          Settings
        </button>
      </div>
      <div className="menu-divider"></div>
      <button className="logout-btn" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}
