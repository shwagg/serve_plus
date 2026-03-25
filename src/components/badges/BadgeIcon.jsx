import React from "react";

// Static map: badgeId → SVG URL via Vite asset handling
const SVG_URLS = {
  "serve-ready":            new URL("../../assets/badges/00-serve-ready.svg", import.meta.url).href,
  "first-step":             new URL("../../assets/badges/01-first-step.svg", import.meta.url).href,
  "active-volunteer":       new URL("../../assets/badges/02-active-volunteer.svg", import.meta.url).href,
  "community-advocate":     new URL("../../assets/badges/03-community-advocate.svg", import.meta.url).href,
  "service-champion":       new URL("../../assets/badges/04-service-champion.svg", import.meta.url).href,
  "consistent-contributor": new URL("../../assets/badges/05-consistent-contributor.svg", import.meta.url).href,
  "excellence-in-service":  new URL("../../assets/badges/06-excellence-in-service.svg", import.meta.url).href,
  "organizer":              new URL("../../assets/badges/07-organizer.svg", import.meta.url).href,
  "lead-organizer":         new URL("../../assets/badges/08-lead-organizer.svg", import.meta.url).href,
  "program-builder":        new URL("../../assets/badges/09-program-builder.svg", import.meta.url).href,
  "csce-recognition-award": new URL("../../assets/badges/10-csce-recognition-award.svg", import.meta.url).href,
  "outstanding-volunteer":  new URL("../../assets/badges/11-outstanding-volunteer.svg", import.meta.url).href,
  "locked":                 new URL("../../assets/badges/locked-badge.svg", import.meta.url).href,
};

const SIZE_MAP = { sm: 40, md: 80, lg: 120 };

/**
 * Renders a single badge icon.
 *
 * Props:
 *   badgeId  – string (one of the 12 badge IDs)
 *   earned   – boolean (false → shows locked-badge)
 *   isNew    – boolean (shows pulsing "NEW" pill, optional)
 *   size     – "sm" | "md" | "lg"  (default "md")
 *   onClick  – function (optional)
 */
export default function BadgeIcon({ badgeId, earned, isNew = false, size = "md", onClick }) {
  const px = SIZE_MAP[size] ?? 80;
  // Always use the actual badge SVG — grayscale filter is applied when not earned
  const src = SVG_URLS[badgeId] ?? SVG_URLS["locked"];

  return (
    <div
      className={`badge-icon-wrapper badge-icon-${size}${onClick ? " badge-icon-clickable" : ""}`}
      style={{ width: px, height: px * (132 / 120), position: "relative", display: "inline-block" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <img
        src={src}
        alt={earned ? badgeId : "locked badge"}
        width={px}
        height={px * (132 / 120)}
        style={{
          display: "block",
          filter: earned ? "none" : "grayscale(1) brightness(1.1) opacity(0.38)",
          transition: "transform 0.18s ease",
        }}
        draggable={false}
      />
      {isNew && earned && (
        <span className="badge-new-pill">NEW</span>
      )}
    </div>
  );
}
