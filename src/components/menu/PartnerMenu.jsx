import { useNavigate } from "react-router-dom";
import dashboardIcon from "../../assets/menuassets/Dashboard.svg";
import feedbackFormIcon from "../../assets/menuassets/FeedbackForm.svg";
import infoIcon from "../../assets/menuassets/Info.svg";
import projectListIcon from "../../assets/menuassets/List.svg";
import privacyPol from "../../assets/menuassets/PrivacyPolicy.svg";
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
  onCreateProposal,
}) {
  const navigate = useNavigate();
  const handleMenuClick = (path) => {
    navigate(path);
    onClose();
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
          onClick={() => handleMenuClick("/partner/dashboard")}
        >
          <img src={dashboardIcon} alt="Dashboard" className="menu-icon" />
          Dashboard
        </button>
        <button
          className="menu-item"
          onClick={() => handleMenuClick("/partner/projects")}
        >
          <img src={projectListIcon} alt="Project List" className="menu-icon" />
          Project List
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
          onClick={() => handleMenuClick(`/global/feedback/${missionId}`)}
        >
          <img
            src={feedbackFormIcon}
            alt="Feedback Form"
            className="menu-icon"
          />
          Feedback Form
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
      <button
        className="menu-item"
        onClick={() => {
          onClose();
          navigate("/verify-certificate");
        }}
      >
        <img src={viewIcon} alt="Verify Certificate" className="menu-icon" />
        Verify Certificate
      </button>
      <button className="logout-btn" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}
