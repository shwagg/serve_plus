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
  const normalizedParticipantCount = Number(participantCount);
  const normalizedPosition = Number(position);

  if (
    !Number.isFinite(normalizedParticipantCount) ||
    normalizedParticipantCount <= 0 ||
    !Number.isFinite(normalizedPosition) ||
    normalizedPosition <= 0
  ) {
    return 0;
  }

  const participantTotal = Math.trunc(normalizedParticipantCount);
  const participantPosition = Math.trunc(normalizedPosition);

  if (participantPosition > participantTotal) {
    return 0;
  }

  const distribution = getWeightedTaskPointDistribution(
    taskPoints,
    participantTotal,
  );

  return distribution[participantPosition - 1] || 0;
}

export function getWeightedTaskPointDistribution(taskPoints, participantCount) {
  const basePoints = Number(taskPoints) || 0;
  const normalizedParticipantCount = Number(participantCount);

  if (
    !Number.isFinite(normalizedParticipantCount) ||
    normalizedParticipantCount <= 0
  ) {
    return [];
  }

  const participantTotal = Math.trunc(normalizedParticipantCount);
  const distribution = Array(participantTotal).fill(0);
  const totalWeight = getTotalEnrollmentWeight(participantTotal);

  if (basePoints <= 0 || totalWeight <= 0) {
    return distribution;
  }

  const totalCents = Math.round(basePoints * 100);
  if (totalCents <= 0) {
    return distribution;
  }

  let allocatedCents = 0;

  for (let currentPosition = 1; currentPosition <= participantTotal; currentPosition += 1) {
    const weight = getEnrollmentWeight(currentPosition);
    const rawShareCents = (totalCents * weight) / totalWeight;
    const flooredShareCents = Math.floor(rawShareCents);
    distribution[currentPosition - 1] = flooredShareCents;
    allocatedCents += flooredShareCents;
  }

  const remainingCents = totalCents - allocatedCents;
  if (remainingCents > 0) {
    distribution[0] += remainingCents;
  }

  return distribution.map((valueInCents) => valueInCents / 100);
}
