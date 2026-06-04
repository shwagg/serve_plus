export const sumPointValues = (values) =>
  Object.values(values || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);

export function getRequirementPoints(volunteerData = {}) {
  return Number(volunteerData.requirementPoints) ||
    Number(volunteerData.pointsBreakdown?.requirementPoints) ||
    sumPointValues(volunteerData.requirementBonus);
}

export function getTaskPoints(volunteerData = {}) {
  return Number(volunteerData.taskPoints) ||
    Number(volunteerData.pointsBreakdown?.taskPoints) ||
    0;
}

export function getRoleRatingPoints(volunteerData = {}) {
  return Number(volunteerData.roleRatingPoints) ||
    Number(volunteerData.pointsBreakdown?.roleRatingPoints) ||
    0;
}

export function getBonusPoints(volunteerData = {}) {
  return Number(volunteerData.bonusPoints) ||
    Number(volunteerData.pointsBreakdown?.bonusPoints) ||
    0;
}

export function getMissionPointsBreakdown(volunteerData = {}, fallbackRoleRatingPoints = 0) {
  const requirementPoints = getRequirementPoints(volunteerData);
  const bonusPoints = getBonusPoints(volunteerData);
  const legacyReleasedPoints = Number(volunteerData.pointsEarned) || 0;
  const roleRatingPoints = getRoleRatingPoints(volunteerData) || Number(fallbackRoleRatingPoints) || 0;
  const taskPoints = getTaskPoints(volunteerData) || Math.max(0, legacyReleasedPoints - roleRatingPoints - bonusPoints);
  const missionPoints =
    Number(volunteerData.missionPoints) ||
    Number(volunteerData.pointsBreakdown?.missionPoints) ||
    requirementPoints + taskPoints + roleRatingPoints + bonusPoints;

  return {
    requirementPoints,
    taskPoints,
    roleRatingPoints,
    bonusPoints,
    missionPoints,
  };
}
