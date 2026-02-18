
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
export function computeFinalPoints(role, avgRating, participationStatus) {
    const base = ROLE_POINTS[role];
    const multiplier = getProgramMultiplier(avgRating);
    const factor = PARTICIPATION_FACTOR[participationStatus];

    if (!base || !factor) return 0;

    return Number((base * multiplier * factor).toFixed(2));
}