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
const COMMUNITY_CHAIR_POSITION = "community chair";
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
  COMMUNITY_CHAIR_POSITION,
]);
const ADMIN_POSITIONS = new Set(["director", "regular"]);
const MFA_SESSION_COLLECTION = "mfaSessions";
const SHS_DEPARTMENT = "Mapua MCL Senior High School (SHS)";
const COMMUNITY_CHAIR_DEPARTMENTS = new Set([
  "College of Arts and Science (CAS)",
  "College of Computer and Information Science (CCIS)",
  "College of Health Sciences (CHS)",
  "College of Nursing (CN)",
  "College of Maritime Education and Training (CMET)",
  "E.T. Yuchengco College of Business (ETYCB)",
  "Mapua-Laguna Institute of Aviation (MIA)",
  "Mapua Institute of Technology at Laguna (MITL)",
]);
const COMMUNITY_DEPARTMENT_RESTRICTED_POSITIONS = new Set([
  "sao director",
  "shs principal",
  "student organization adviser",
  "cluster head",
]);
const FACULTY_POSITIONS_WITHOUT_DEPARTMENT = new Set([
  "sao director",
  "student organization adviser",
]);

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

    const skipsDepartment = FACULTY_POSITIONS_WITHOUT_DEPARTMENT.has(position);

    if (!skipsDepartment && !department) {
      throw new HttpsError(
        "invalid-argument",
        "Please select a department for the faculty account level.",
      );
    }

    if (position === "shs principal" && department !== SHS_DEPARTMENT) {
      throw new HttpsError(
        "invalid-argument",
        "SHS Principal must be assigned to Mapua MCL Senior High School (SHS).",
      );
    }

    if (
      COMMUNITY_CHAIR_DEPARTMENTS.has(department) &&
      COMMUNITY_DEPARTMENT_RESTRICTED_POSITIONS.has(position)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Please select a valid faculty position for the selected department.",
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
      department: FACULTY_POSITIONS_WITHOUT_DEPARTMENT.has(position) ?
        FieldValue.delete() :
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

async function assertCommunityChairAvailable({targetUid, role, position, department}) {
  if (
    role !== "faculty" ||
    position !== COMMUNITY_CHAIR_POSITION ||
    !COMMUNITY_CHAIR_DEPARTMENTS.has(department)
  ) {
    return;
  }

  const chairSnap = await getDb()
    .collection("users")
    .where("role", "==", "faculty")
    .where("position", "==", COMMUNITY_CHAIR_POSITION)
    .where("department", "==", department)
    .limit(2)
    .get();

  const existingChair = chairSnap.docs.find((doc) => doc.id !== targetUid);
  if (existingChair) {
    throw new HttpsError(
      "failed-precondition",
      "Only one community chair can be assigned to this department.",
    );
  }
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
  sessionPreserved,
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
      sessionPreserved,
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
  await assertCommunityChairAvailable({targetUid, role, position, department});

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

  await writeRoleChangeAudit({
    actor,
    targetUid,
    targetData,
    previousRole,
    role,
    position,
    department,
    clearedMfaSessions,
    sessionPreserved: roleChanged,
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
