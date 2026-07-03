export function normalizeRosterText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getPositionList(userData = {}) {
  const positionField = userData?.position || userData?.positions || "";
  if (Array.isArray(positionField)) return positionField;
  return positionField ? [positionField] : [];
}

export function isCommunityChair(userData = {}) {
  if (normalizeRosterText(userData?.role) !== "faculty") return false;
  return getPositionList(userData).some(
    (position) => normalizeRosterText(position) === "community chair",
  );
}

export function getFacultyLandingPath(userData = {}) {
  return isCommunityChair(userData) ? "/faculty/dashboard" : "/faculty/current-event";
}
