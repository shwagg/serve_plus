import { useNavigate } from "react-router-dom";
import dashboardIcon from "../../assets/menuassets/Dashboard.svg";
import infoIcon from "../../assets/menuassets/Info.svg";
import projectListIcon from "../../assets/menuassets/List.svg";
import settingsIcon from "../../assets/menuassets/Settings.svg";
import supportIcon from "../../assets/menuassets/Support.svg";
import viewIcon from "../../assets/menuassets/View.svg";
import "../styles/Menu.css";
export default function PartnerMenu({
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
        <span className="user-role">Partner</span>
      </button>
      <div className="menu-divider"></div>

      <div className="menu-items">
        <button
          className="menu-item"
          onClick={() => { navigate("/partner/dashboard", { state: { expandSection: "dashboard" } }); onClose(); }}
        >
          <img src={dashboardIcon} alt="Dashboard" className="menu-icon" />
          Dashboard
        </button>
        <button
          className="menu-item"
          onClick={() => { handleMenuClick("/partner/dashboard"); setTimeout(() => document.getElementById("section-projects")?.scrollIntoView({ behavior: "smooth" }), 300); }}
        >
          <img src={projectListIcon} alt="Project List" className="menu-icon" />
          Project List
        </button>
        <button
          className="menu-item"
          onClick={() => { navigate("/partner/dashboard", { state: { expandSection: "review" } }); onClose(); }}
        >
          <img src={viewIcon} alt="Review Proposals" className="menu-icon" />
          Review Proposals
        </button>
        <button
          className="menu-item"
          onClick={() => { onClose(); onOpenSettings(); }}
        >
          <img src={settingsIcon} alt="Settings" className="menu-icon" />
          Settings
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/global/menu/support")}
        >
          <img src={supportIcon} alt="Support" className="menu-icon" />
          Support
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/")}
        >
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
