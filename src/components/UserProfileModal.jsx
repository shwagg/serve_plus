import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import '../styles/UserProfileModal.css';

const DEFAULT_LOCAL = '/assets/headassets/default-avatar.png';

const UserProfileModal = ({ user, onClose }) => {
  if (!user) return null;

  const displayName = user.displayName || user.name || user.username || (user.email ? user.email.split('@')[0] : '') || 'User';

  const avatarSrc = useMemo(() => {
    if (user.photoURL) return user.photoURL;
    if (user.avatar) return user.avatar;
    if (user.photo) return user.photo;
    // fallback to generated avatar
    const encoded = encodeURIComponent(displayName);
    return `https://ui-avatars.com/api/?name=${encoded}&background=30bdb7&color=fff&size=256`;
  }, [user, displayName]);

  const handleImgError = (e) => {
    if (e?.target) {
      e.target.onerror = null;
      e.target.src = DEFAULT_LOCAL;
    }
  };

  return ReactDOM.createPortal(
    <div className="upm-overlay" onClick={onClose}>
      <div className="upm-content" onClick={(e) => e.stopPropagation()}>
        <button className="upm-close" onClick={onClose}>×</button>
        <div className="upm-header">
          <img className="upm-avatar" src={avatarSrc} alt={`${displayName}'s avatar`} onError={handleImgError} />
          <div className="upm-meta">
            <h3 className="upm-name">{displayName}</h3>
            {user.email && <p className="upm-email">{user.email}</p>}
          </div>
        </div>

        {user.bio && (
          <div className="upm-section">
            <h4>About</h4>
            <p>{user.bio}</p>
          </div>
        )}

        <div className="upm-stats">
          {typeof user.totalPoints !== 'undefined' && (
            <div className="upm-stat">Points: <strong>{user.totalPoints}</strong></div>
          )}
          {typeof user.events !== 'undefined' && (
            <div className="upm-stat">Events: <strong>{user.events}</strong></div>
          )}
        </div>

        <div className="upm-actions">
          <a className="upm-btn" href={`/profile/${user.uid || user.id || ''}`}>View full profile</a>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserProfileModal;
