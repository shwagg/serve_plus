const DEFAULT_WEIGHT = 1.0;

export function getEnrollmentWeight(position) {
  if (!Number.isFinite(position) || position <= 0) {
    return 0;
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

  return basePoints;
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
  return Array(participantTotal).fill(basePoints);
}
