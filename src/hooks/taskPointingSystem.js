const WEIGHTS_BY_POSITION = [
  1.8, 1.7, 1.6, 1.45, 1.35, 1.25, 1.18, 1.12, 1.07, 1.03,
];

const DEFAULT_WEIGHT = 1.0;

export function getEnrollmentWeight(position) {
  if (!Number.isFinite(position) || position <= 0) {
    return DEFAULT_WEIGHT;
  }

  if (position <= WEIGHTS_BY_POSITION.length) {
    return WEIGHTS_BY_POSITION[position - 1];
  }

  return DEFAULT_WEIGHT;
}

export function getTotalEnrollmentWeight(participantCount) {
  if (!Number.isFinite(participantCount) || participantCount <= 0) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i <= participantCount; i += 1) {
    total += getEnrollmentWeight(i);
  }

  return total;
}

export function calculateWeightedTaskPoints(
  taskPoints,
  position,
  participantCount,
) {
  const basePoints = Number(taskPoints) || 0;
  const totalWeight = getTotalEnrollmentWeight(participantCount);
  const userWeight = getEnrollmentWeight(position);

  if (basePoints <= 0 || totalWeight <= 0) {
    return 0;
  }

  return Number((basePoints * (userWeight / totalWeight)).toFixed(2));
}
