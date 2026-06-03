import React from "react";
import BadgeIcon from "./BadgeIcon";
import { BADGE_DEFINITIONS, BADGE_CATEGORIES } from "../../constants/badgeDefinitions";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNewBadge(earnedAt) {
  if (!earnedAt) return false;
  const earned = earnedAt?.toDate ? earnedAt.toDate() : new Date(earnedAt);
  return Date.now() - earned.getTime() < SEVEN_DAYS_MS;
}

/**
 * BadgeShelf — displays all badge slots grouped by category.
 *
 * Props:
 *   earnedBadges  – array of { badgeId, earnedAt, ... } from Firestore
 *   customBadges  – array of non-archived custom badge defs from Firestore (optional)
 *   onBadgeClick  – optional function(badgeDef, isEarned, earnedRecord)
 */
export default function BadgeShelf({ earnedBadges = [], customBadges = [], onBadgeClick }) {
  const earnedMap = Object.fromEntries(
    earnedBadges.map((b) => [b.badgeId ?? b.id, b])
  );

  const allDefs = [...BADGE_DEFINITIONS, ...customBadges];
  const totalEarned = allDefs.filter((b) => earnedMap[b.id]).length;

  return (
    <div className="badge-shelf">
      <div className="badge-shelf-header">
        <span className="badge-shelf-progress">
          {totalEarned} of {allDefs.length} collected
        </span>
      </div>

      {BADGE_CATEGORIES.map((cat) => {
        const staticBadges = BADGE_DEFINITIONS.filter((b) => b.category === cat.key);
        const dynamicBadges = customBadges.filter((b) => b.category === cat.key);
        const categoryBadges = [...staticBadges, ...dynamicBadges];
        if (categoryBadges.length === 0) return null;
        return (
          <div key={cat.key} className="badge-shelf-group">
            <div className="badge-shelf-group-label" style={{ color: cat.color }}>
              {cat.label}
            </div>
            <div className="badge-shelf-row">
              {categoryBadges.map((def) => {
                const earnedRecord = earnedMap[def.id];
                const earned = Boolean(earnedRecord);
                const newBadge = earned && isNewBadge(earnedRecord?.earnedAt);
                return (
                  <div key={def.id} className="badge-shelf-slot">
                    <div className="badge-tooltip-wrapper">
                      <BadgeIcon
                        badgeId={def.id}
                        imageUrl={def.imageUrl || undefined}
                        earned={earned}
                        isNew={newBadge}
                        size="md"
                        onClick={onBadgeClick ? () => onBadgeClick(def, earned, earnedRecord) : undefined}
                      />
                      <div className="badge-tooltip" role="tooltip">
                        <div className="badge-tooltip-name">{def.name}</div>
                        {def.description && (
                          <div className="badge-tooltip-desc">{def.description}</div>
                        )}
                        {def.criteria && (
                          <div className="badge-tooltip-criteria">
                            <span className="badge-tooltip-how">How to earn: </span>
                            {def.criteria}
                          </div>
                        )}
                        {earned && (
                          <div className="badge-tooltip-earned">✓ Earned</div>
                        )}
                      </div>
                    </div>
                    <span className={`badge-shelf-name${earned ? " earned" : " locked"}`}>
                      {def.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
