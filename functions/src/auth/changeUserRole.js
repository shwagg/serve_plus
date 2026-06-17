const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

const ROLE_OPTIONS = new Set([
  "student",
  "faculty",
  "partner",
  "admin",
  "sysadmin",
]);
const BLACKBOARD_ALLOWED_ROLES = new Set(["student", "faculty"]);
const NON_BLACKBOARD_ALLOWED_ROLES = new Set(["partner", "admin", "sysadmin"]);
const FACULTY_POSITIONS = new Set([
  "regular",
  "program chair",
  "cluster head",
  "college engagement head",
  "student organization adviser",
  "college dean",
  "shs principal",
  "sao director",
  "department head",
]);
const ADMIN_POSITIONS = new Set(["director", "regular"]);
const MFA_SESSION_COLLECTION = "mfaSessions";

function getDb() {
  return admin.firestore();
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isBlackboardAccount(userData) {
  return (
    userData?.authProvider === "blackboard" ||
    Boolean(userData?.blackboardId || userData?.blackboardAuthUid)
  );
}

function getAllowedRoleSet(userData) {
  return isBlackboardAccount(userData) ?
    BLACKBOARD_ALLOWED_ROLES :
    NON_BLACKBOARD_ALLOWED_ROLES;
}

async function assertSysadminCaller(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerSnap = await getDb().collection("users").doc(callerUid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;

  if (callerData?.role !== "sysadmin") {
    throw new HttpsError(
      "permission-denied",
      "Only system administrators can change account levels.",
    );
  }

  return {uid: callerUid, data: callerData};
}

function validateRoleUpdate({targetData, role, position, department}) {
  if (!ROLE_OPTIONS.has(role)) {
    throw new HttpsError("invalid-argument", "Select a valid account level.");
  }

  const allowedRoles = getAllowedRoleSet(targetData);
  if (!allowedRoles.has(role)) {
    const accountType = isBlackboardAccount(targetData) ?
      "Blackboard" :
      "Non-Blackboard";
    throw new HttpsError(
      "failed-precondition",
      `${accountType} accounts cannot be assigned to that account level.`,
    );
  }

  if (role === "faculty") {
    if (!position || !FACULTY_POSITIONS.has(position)) {
      throw new HttpsError(
        "invalid-argument",
        "Please select a valid faculty position.",
      );
    }

    if (!department) {
      throw new HttpsError(
        "invalid-argument",
        "Please select a department for the faculty account level.",
      );
    }
  }

  if (role === "admin" && (!position || !ADMIN_POSITIONS.has(position))) {
    throw new HttpsError(
      "invalid-argument",
      "Please select a valid admin position.",
    );
  }
}

function buildRoleUpdateData({targetData, role, position, department}) {
  const studentProgress =
    targetData.levelProgress ?? targetData.levelprogress ?? 0;

  if (role === "student") {
    return {
      role,
      position: FieldValue.delete(),
      department: FieldValue.delete(),
      skills: targetData.skills || [],
      eventHistory: targetData.eventHistory || [],
      interests: targetData.interests || [],
      level: targetData.level || 1,
      levelProgress: studentProgress,
      levelprogress: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  const sharedNonStudentFields = {
    role,
    skills: FieldValue.delete(),
    eventHistory: FieldValue.delete(),
    interests: FieldValue.delete(),
    level: FieldValue.delete(),
    levelProgress: FieldValue.delete(),
    levelprogress: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (role === "faculty") {
    return {
      ...sharedNonStudentFields,
      position,
      department,
    };
  }

  if (role === "admin") {
    return {
      ...sharedNonStudentFields,
      position,
      department: FieldValue.delete(),
    };
  }

  return {
    ...sharedNonStudentFields,
    position: FieldValue.delete(),
    department: FieldValue.delete(),
  };
}

async function clearMfaSessionsForUser(uid) {
  let clearedSessions = 0;

  while (true) {
    const sessionSnap = await getDb()
      .collection(MFA_SESSION_COLLECTION)
      .where("uid", "==", uid)
      .limit(400)
      .get();

    if (sessionSnap.empty) return clearedSessions;

    const batch = getDb().batch();
    sessionSnap.docs.forEach((sessionDoc) => {
      batch.delete(sessionDoc.ref);
    });
    await batch.commit();

    clearedSessions += sessionSnap.size;
    if (sessionSnap.size < 400) return clearedSessions;
  }
}

async function writeRoleChangeAudit({
  actor,
  targetUid,
  targetData,
  previousRole,
  role,
  position,
  department,
  clearedMfaSessions,
  refreshTokensRevoked,
}) {
  await getDb().collection("auditLogs").add({
    action: "ROLE_CHANGED",
    category: "account",
    actorUid: actor.uid,
    actorEmail: actor.data?.email || null,
    actorName: actor.data?.name || actor.data?.displayName || null,
    details: {
      targetUserId: targetUid,
      targetUserName: targetData.name || targetData.displayName || "",
      targetUserEmail: targetData.email || "",
      previousRole: previousRole || "",
      newRole: role,
      newPosition: position || "",
      newDepartment: department || "",
      clearedMfaSessions,
      refreshTokensRevoked,
    },
    timestamp: FieldValue.serverTimestamp(),
  });
}

async function changeUserRole(request) {
  const actor = await assertSysadminCaller(request);
  const targetUid = normalizeText(request.data?.targetUid);
  const role = normalizeRole(request.data?.role);
  const position = normalizeText(request.data?.position).toLowerCase();
  const department = normalizeText(request.data?.department);

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Target user is required.");
  }

  if (targetUid === actor.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot change your own account level.",
    );
  }

  const targetRef = getDb().collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();

  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Target user was not found.");
  }

  const targetData = targetSnap.data();
  const previousRole = targetData.role || "";
  const roleChanged = previousRole !== role;

  validateRoleUpdate({targetData, role, position, department});

  const updateData = buildRoleUpdateData({
    targetData,
    role,
    position,
    department,
  });

  await targetRef.update(updateData);
  const clearedMfaSessions = roleChanged ?
    await clearMfaSessionsForUser(targetUid) :
    0;

  if (roleChanged) {
    await admin.auth().revokeRefreshTokens(targetUid);
  }

  await writeRoleChangeAudit({
    actor,
    targetUid,
    targetData,
    previousRole,
    role,
    position,
    department,
    clearedMfaSessions,
    refreshTokensRevoked: roleChanged,
  });

  return {
    status: "ROLE_CHANGED",
    targetUid,
    previousRole,
    role,
    roleChanged,
    position,
    department,
    clearedMfaSessions,
  };
}

module.exports = {changeUserRole};
