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
 * BadgeShelf — displays all 12 badge slots grouped by category.
 *
 * Props:
 *   earnedBadges – array of { badgeId, earnedAt, ... } from Firestore
 *   onBadgeClick – optional function(badgeDef, isEarned, earnedRecord)
 */
export default function BadgeShelf({ earnedBadges = [], onBadgeClick }) {
  const earnedMap = Object.fromEntries(
    earnedBadges.map((b) => [b.badgeId ?? b.id, b])
  );

  const totalEarned = BADGE_DEFINITIONS.filter((b) => earnedMap[b.id]).length;

  return (
    <div className="badge-shelf">
      <div className="badge-shelf-header">
        <span className="badge-shelf-progress">
          {totalEarned} of {BADGE_DEFINITIONS.length} collected
        </span>
      </div>

      {BADGE_CATEGORIES.map((cat) => {
        const categoryBadges = BADGE_DEFINITIONS.filter((b) => b.category === cat.key);
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
                    <BadgeIcon
                      badgeId={def.id}
                      earned={earned}
                      isNew={newBadge}
                      size="md"
                      onClick={onBadgeClick ? () => onBadgeClick(def, earned, earnedRecord) : undefined}
                    />
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
