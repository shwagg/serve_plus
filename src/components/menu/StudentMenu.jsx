import { useNavigate } from "react-router-dom";
import { Face6RoundedIcon } from '../icons';
import createIcon from "../../assets/menuassets/Create.svg";
import viewIcon from "../../assets/menuassets/View.svg";
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
  onOpenCertificateQR,
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
        {userAvatar && !userAvatar.includes('ui-avatars.com') ? (
          <img src={userAvatar} alt="avatar" className="user-avatar-img" />
        ) : (
          <Face6RoundedIcon sx={{ width: 40, height: 40, color: '#30bdb7' }} />
        )}
        <div className="user-info">
          <p className="user-name">{displayName}</p>
          <p className="user-email">{userEmail}</p>
        </div>
        <span className="user-role">Volunteer</span>
      </button>
      <div className="menu-divider"></div>
      <div className="menu-items">
        <button
          className="menu-item"
          onClick={() => {
            navigate("/student/home");
            onClose();
            setTimeout(() => {
              const el = document.getElementById("leaderboard-section");
              if (!el) return;
              const scrollContainer = el.closest(".content-page");
              if (!scrollContainer) return;
              const playerStrip = scrollContainer.querySelector(".player-strip");
              const playerStripHeight = playerStrip ? playerStrip.getBoundingClientRect().height : 0;
              const targetScrollTop = el.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - playerStripHeight;
              scrollContainer.scrollTo({ top: targetScrollTop, behavior: "smooth" });
            }, 300);
          }}
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
