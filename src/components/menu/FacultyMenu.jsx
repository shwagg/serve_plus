import { useNavigate } from "react-router-dom";
import createIcon from "../../assets/menuassets/Create.svg";
import infoIcon from "../../assets/menuassets/Info.svg";
import leaderboardIcon from "../../assets/menuassets/Leaderboard.svg";
import settingsIcon from "../../assets/menuassets/Settings.svg";
import supportIcon from "../../assets/menuassets/Support.svg";
import viewIcon from "../../assets/menuassets/View.svg";
import "../styles/Menu.css";
export default function FacultyMenu({
  userName,
  userEmail,
  userUsername,
  userAvatar,
  onLogout,
  onClose,
  onCreateProposal,
  onOpenSettings,
}) {
  const navigate = useNavigate();
  const handleMenuClick = (path) => {
    navigate(path);
    onClose();
  };

  const handleCreateProposal = () => {
    onClose();
    onCreateProposal();
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
        <span className="user-role">Faculty</span>
      </button>
      <div className="menu-divider"></div>
      <div className="menu-items">
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/global/menu/leaderboard")}
        >
          <img src={leaderboardIcon} alt="Leaderboard" className="menu-icon" />
          Leaderboard
        </button>
        <button className="menu-item" onClick={handleCreateProposal}>
          <img src={createIcon} alt="Create" className="menu-icon" />
          Create Proposal
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/global/review-proposals")}
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
          onClick={() => handleMenuClick("/global/menu/about")}
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
