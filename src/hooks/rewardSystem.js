
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
const ROLE_POINTS = {
    donor: 8,
    participant: 15,
    organizer: 30,
    lead_organizer: 40,
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

// Progressive level thresholds — cumulative points required to reach each level.
// Index 0 = Level 1 (0 pts), Index 1 = Level 2 (20 pts), etc.
const LEVEL_THRESHOLDS = [
    0,    // Level 1
    20,   // Level 2  (+20)
    50,   // Level 3  (+30)
    90,   // Level 4  (+40)
    145,  // Level 5  (+55)
    215,  // Level 6  (+70)
    305,  // Level 7  (+90)
    415,  // Level 8  (+110)
    550,  // Level 9  (+135)
    715,  // Level 10 (+165)
    915,  // Level 11 (+200)
    1155, // Level 12 (+240)
    1440, // Level 13 (+285)
    1775, // Level 14 (+335)
    2165, // Level 15 (+390)
];

/**
 * Returns level info derived from cumulative totalPoints.
 * @param {number} totalPoints
 * @returns {{ level: number, progress: number, pointsInLevel: number, pointsForLevel: number, pointsToNextLevel: number }}
 *   progress is 0-100 (percentage through the current level).
 */
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
    const currentThreshold = LEVEL_THRESHOLDS[levelIndex];

    // If beyond defined thresholds, keep growing the gap by 50 per extra level
    let nextThreshold;
    if (levelIndex + 1 < LEVEL_THRESHOLDS.length) {
        nextThreshold = LEVEL_THRESHOLDS[levelIndex + 1];
    } else {
        const lastGap = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 2];
        nextThreshold = currentThreshold + lastGap + 50;
    }

    const pointsInLevel = pts - currentThreshold;
    const pointsForLevel = nextThreshold - currentThreshold;
    const progress = Math.min(100, Math.round((pointsInLevel / pointsForLevel) * 100));
    const pointsToNextLevel = Math.max(0, nextThreshold - pts);

    return { level, progress, pointsInLevel, pointsForLevel, pointsToNextLevel };
}