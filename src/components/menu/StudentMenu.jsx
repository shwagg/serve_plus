import { useNavigate } from "react-router-dom";
import createIcon from "../../assets/menuassets/Create.svg";
import infoIcon from "../../assets/menuassets/Info.svg";
import leaderboardIcon from "../../assets/menuassets/Leaderboard.svg";
import privacyPol from "../../assets/menuassets/PrivacyPolicy.svg";
import settingsIcon from "../../assets/menuassets/Settings.svg";
import supportIcon from "../../assets/menuassets/Support.svg";
import "../styles/Menu.css";
export default function StudentMenu({
  userName,
  userEmail,
  userUsername,
  userAvatar,
  onLogout,
  onClose,
  onCreateProposal,
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

  // Use username if available, otherwise fall back to email prefix
  const displayUsername =
    userUsername || (userEmail ? userEmail.split("@")[0] : "User");
  // Get first letter for avatar fallback
  const avatarLetter = displayUsername.charAt(0).toUpperCase();

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
          <p className="user-name">{displayUsername}</p>
          <p className="user-email">{userEmail}</p>
        </div>
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
          onClick={() => handleMenuClick("/global/menu/settings")}
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
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/global/terms-condition")}
        >
          <img src={privacyPol} alt="Terms and Privacy" className="menu-icon" />
          Terms and Privacy
        </button>
      </div>
      <div className="menu-divider"></div>
      <button className="logout-btn" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}
