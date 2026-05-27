import React from "react";
import { FRAME_BY_ID } from "../constants/profileFrames";
import "../styles/ProfileFrames.css";

const DEFAULT_AVATAR = "/assets/headassets/default-avatar.png";

/**
 * Renders a profile picture wrapped in the user's active frame ring.
 *
 * Props:
 *   src         — image URL (falls back to generated avatar)
 *   alt         — img alt text
 *   frameId     — id of the active frame (from profileFrames.js)
 *   size        — diameter in px (default: 120)
 *   ringWidth   — ring thickness in px (default: 4; use 2 for compact/header use)
 *   className   — extra class on the outer container
 *   displayName — used for the generated-avatar fallback URL
 */
export default function AvatarWithFrame({
  src,
  alt,
  frameId,
  size = 120,
  ringWidth,
  className = "",
  displayName = "User",
}) {
  const frame = FRAME_BY_ID[frameId || "default"] || FRAME_BY_ID["default"];

  const resolvedSrc =
    src ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=30bdb7&color=fff&size=256`;

  const handleImgError = (e) => {
    if (e?.target) {
      e.target.onerror = null;
      e.target.src = DEFAULT_AVATAR;
    }
  };

  // Allow callers to override the ring thickness (e.g. header: 2px, profile: 4px)
  const paddingStyle =
    ringWidth !== undefined && frame.id !== "default"
      ? { padding: ringWidth }
      : undefined;

  return (
    <div
      className={`avatar-frame-container ${frame.cssClass} ${className}`}
      style={{ width: size, height: size, ...paddingStyle }}
    >
      <img
        src={resolvedSrc}
        alt={alt || displayName}
        className="avatar-frame-img"
        onError={handleImgError}
      />
    </div>
  );
}
