
//Computing event average rating - from Community Feedback Form
export function computeAverageRating(ratingsObject) {
    const values = Object.values(ratingsObject).filter(
        (val) => typeof val === "number"
    );

    if (values.length === 0) return 0;

    const total = values.reduce((sum, val) => sum + val, 0);
    return Number((total / values.length).toFixed(2));
}

//Multiplier for feedback form
export function getProgramMultiplier(avgRating) {
    if (avgRating >= 4.5) return 1.3;
    if (avgRating >= 3.5) return 1.2;
    if (avgRating >= 2.5) return 1.1;
    return 1.0;
}

//Role points - for students
export const ROLE_POINTS = {
    participant: 0,
    donor: 10,
    organizer: 20,
    lead_organizer: 30,
};

//Participation Factor - to be decided by faculty & verified by admin
const PARTICIPATION_FACTOR = {
    verified: 1.0,
    partial: 0.75,
    minimal: 0.5,
    no_show: 0,
};

//Final Point Computation
export function computeFinalPoints(roles, avgRating, participationStatus) {
    const multiplier = getProgramMultiplier(avgRating);
    const factor = PARTICIPATION_FACTOR[participationStatus] ?? 0;

    if (!factor) return { base: 0, multiplier, factor, finalPoints: 0 };

    // Check what are the roles picked
    const roleArray = Array.isArray(roles) ? roles : [roles];

    let totalBase = 0;

    roleArray.forEach(role => {
        const normalized = role.trim().toLowerCase().replace(/\s+/g, "_");
        totalBase += ROLE_POINTS[normalized] || 0;
    });

    if (!totalBase) {
        return { base: 0, multiplier, factor, finalPoints: 0 };
    }

    const finalPoints = Number((totalBase * multiplier * factor).toFixed(2));

    //Return all variables for computation details information
    return { base: totalBase, multiplier, factor, finalPoints };
}

// Cumulative points required to reach each level. 1000 pts = Level 10 (max).
const LEVEL_THRESHOLDS = [
    0,    // Level 1
    100,  // Level 2  (+100)
    200,  // Level 3  (+100)
    300,  // Level 4  (+100)
    400,  // Level 5  (+100)
    500,  // Level 6  (+100)
    600,  // Level 7  (+100)
    700,  // Level 8  (+100)
    800,  // Level 9  (+100)
    1000, // Level 10 (+200)
];

const MAX_LEVEL = 10;

// Cosmetic unlocks earned at each level
export const LEVEL_UNLOCKS = {
  2:  { name: 'About Me bio',        icon: '📝', description: 'Add a personal bio to your profile' },
  3:  { name: 'Teal Ring frame',     icon: '🔵', description: 'Unlock the Teal Ring profile frame' },
  4:  { name: 'Background color',    icon: '🎨', description: 'Customize your profile card background' },
  5:  { name: 'Gradient Ring frame', icon: '🌈', description: 'Unlock the Gradient Ring frame' },
  6:  { name: 'Custom title',        icon: '✨', description: 'Add a custom flair title to your profile' },
  7:  { name: 'Golden Ring frame',   icon: '🥇', description: 'Unlock the Golden Ring frame' },
  8:  { name: 'Profile glow',        icon: '💫', description: 'Unlock a colored glow for your profile card' },
  9:  { name: 'Badge pinning',       icon: '📌', description: 'Pin up to 3 favorite badges on your profile' },
  10: { name: 'Champion Ring frame', icon: '🏆', description: 'Unlock the animated Champion Ring frame' },
};

/**
 * Returns the next cosmetic unlock above the current level, plus how many
 * points the user still needs to reach it. Returns null at max level.
 */
export function getNextUnlock(level, totalPoints) {
  if (level >= MAX_LEVEL) return null;
  const pts = totalPoints || 0;
  for (let l = level + 1; l <= MAX_LEVEL; l++) {
    if (LEVEL_UNLOCKS[l]) {
      const ptsNeeded = LEVEL_THRESHOLDS[l - 1];
      return { level: l, ptsToUnlock: Math.max(0, ptsNeeded - pts), unlock: LEVEL_UNLOCKS[l] };
    }
  }
  return null;
}

export function getLevelInfo(totalPoints) {
    const pts = Math.max(0, totalPoints || 0);

    // Find the highest threshold the user has reached
    let levelIndex = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (pts >= LEVEL_THRESHOLDS[i]) {
            levelIndex = i;
            break;
        }
    }

    const level = levelIndex + 1;
    const isMaxLevel = level >= MAX_LEVEL;

    if (isMaxLevel) {
        return {
            level: MAX_LEVEL,
            progress: 100,
            pointsInLevel: pts - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1],
            pointsForLevel: null,
            pointsToNextLevel: 0,
        };
    }

    const currentThreshold = LEVEL_THRESHOLDS[levelIndex];
    const nextThreshold = LEVEL_THRESHOLDS[levelIndex + 1];
    const pointsInLevel = pts - currentThreshold;
    const pointsForLevel = nextThreshold - currentThreshold;
    const progress = Math.min(100, Math.round((pointsInLevel / pointsForLevel) * 100));
    const pointsToNextLevel = nextThreshold - pts;

    return { level, progress, pointsInLevel, pointsForLevel, pointsToNextLevel };
}