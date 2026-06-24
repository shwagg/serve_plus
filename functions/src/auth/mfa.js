const admin = require("firebase-admin");
const crypto = require("crypto");
const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {
  TOTP,
  NobleCryptoPlugin,
  ScureBase32Plugin,
  generateSecret,
  generateURI,
} = require("otplib");
const {
  normalizeEmail,
  isAllowedEmailDomain,
} = require("./emailPolicy");
const {
  LOCK_TIME_MINUTES,
  checkLoginAttemptLock,
  clearLoginAttemptsForEmail,
  recordLoginFailureForEmail,
} = require("./loginAttempts");

const REQUIRED_MFA_ROLES = new Set([
  "student",
  "faculty",
  "admin",
  "partner",
  "sysadmin",
]);
const EXEMPT_MFA_ROLES = new Set();
const MFA_SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_MFA_ATTEMPTS = 5;
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1;
const TOTP_ISSUER = "SERVE+";
const SESSION_COLLECTION = "mfaSessions";
const FACTOR_COLLECTION = "mfaFactors";

const totpOptions = {
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  digits: 6,
  period: TOTP_STEP_SECONDS,
  window: TOTP_WINDOW,
};

function getDb() {
  return admin.firestore();
}

function getRole(userData) {
  return userData?.role || "student";
}

function requiresMfaRole(role) {
  return REQUIRED_MFA_ROLES.has(role);
}

function isMfaExemptRole(role) {
  return EXEMPT_MFA_ROLES.has(role);
}

function isBlackboardLinked(userData) {
  return Boolean(
    userData &&
      (userData.authProvider === "blackboard" ||
        userData.blackboardId ||
        userData.blackboardAuthUid),
  );
}

function requiresBlackboardSignIn(userData) {
  return isBlackboardLinked(userData) && userData.hasServePassword !== true;
}

function getApiKey() {
  if (process.env.IDENTITY_TOOLKIT_API_KEY) {
    return process.env.IDENTITY_TOOLKIT_API_KEY;
  }

  if (process.env.FUNCTIONS_EMULATOR) return "emulator-api-key";
  throw new HttpsError(
    "failed-precondition",
    "IDENTITY_TOOLKIT_API_KEY must be configured for password login.",
  );
}

function getIdentityToolkitUrl(path) {
  const key = getApiKey();
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (authEmulatorHost) {
    return `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/` +
      `${path}?key=${key}`;
  }

  return `https://identitytoolkit.googleapis.com/v1/${path}?key=${key}`;
}

async function identityToolkitRequest(path, body) {
  const response = await fetch(getIdentityToolkitUrl(path), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || "Authentication failed.";
    console.warn("Identity Toolkit request failed", {
      path,
      status: response.status,
      code: message,
    });
    throw new HttpsError(
      mapIdentityToolkitErrorCode(message),
      mapIdentityToolkitErrorMessage(message),
    );
  }

  return data;
}

function mapIdentityToolkitErrorCode(message) {
  if (
    message.includes("API_KEY") ||
    message.includes("KEY_RESTRICTION") ||
    message.includes("CONFIGURATION_NOT_FOUND") ||
    message.includes("OPERATION_NOT_ALLOWED")
  ) {
    return "failed-precondition";
  }

  if (message.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "resource-exhausted";
  }

  return "unauthenticated";
}

function mapIdentityToolkitErrorMessage(message) {
  if (message.includes("INVALID_PASSWORD")) return "Invalid email or password.";
  if (message.includes("EMAIL_NOT_FOUND")) return "Invalid email or password.";
  if (message.includes("INVALID_LOGIN_CREDENTIALS")) {
    return "Invalid email or password.";
  }
  if (message.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "Too many login attempts. Please wait and try again.";
  }
  if (message.includes("API_KEY") || message.includes("KEY_RESTRICTION")) {
    return "Authentication service key is not configured for server use.";
  }
  if (message.includes("CONFIGURATION_NOT_FOUND")) {
    return "Firebase Authentication is not configured for this project.";
  }
  if (message.includes("OPERATION_NOT_ALLOWED")) {
    return "Password authentication is not enabled.";
  }
  return "Authentication failed. Please try again.";
}

function createLoginLockError(lockState) {
  const lockUntil = lockState.lockUntil;
  const minutesLeft = lockUntil ?
    Math.max(1, Math.ceil((new Date(lockUntil) - new Date()) / 60000)) :
    LOCK_TIME_MINUTES;

  return new HttpsError(
    "resource-exhausted",
    `Too many failed attempts. Account locked for ${minutesLeft} minute(s).`,
    {
      attempts: lockState.attempts,
      maxAttempts: lockState.maxAttempts,
      isLocked: lockState.isLocked,
      lockUntil,
    },
  );
}

async function resolveLoginAccount(loginId) {
  const input = String(loginId || "").trim();
  if (!input) {
    throw new HttpsError("invalid-argument", "Email or username is required.");
  }

  if (input.includes("@")) {
    const email = normalizeEmail(input);
    const snap = await getDb()
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      return {
        email,
        uid: doc.id,
        userData: doc.data(),
      };
    }

    return {email, userData: null, uid: null};
  }

  const snap = await getDb()
    .collection("users")
    .where("username", "==", input)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "No account found for this username.");
  }

  const doc = snap.docs[0];
  const userData = doc.data();
  return {
    email: normalizeEmail(userData.email),
    uid: doc.id,
    userData,
  };
}

async function verifyPassword(email, password) {
  return identityToolkitRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

async function sendVerificationEmail(idToken) {
  return identityToolkitRequest("accounts:sendOobCode", {
    requestType: "VERIFY_EMAIL",
    idToken,
  });
}

async function getOrCreateUserProfile(userRecord, resolvedUserData) {
  const userRef = getDb().collection("users").doc(userRecord.uid);
  const existing = await userRef.get();

  if (existing.exists) {
    const userData = existing.data();
    if (
      userData.authProvider !== "blackboard" &&
      userData.hasServePassword !== true
    ) {
      await userRef.set({
        hasServePassword: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      return {...userData, hasServePassword: true};
    }
    return userData;
  }

  const fallbackData = resolvedUserData || {};
  const email = normalizeEmail(userRecord.email || fallbackData.email);
  const userData = {
    uid: userRecord.uid,
    email,
    name: userRecord.displayName || email,
    role: "student",
    status: "active",
    authProvider: "password",
    hasServePassword: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  await userRef.set(userData);
  return userData;
}

async function syncVerifiedEmailProfile(userRecord, userData) {
  if (!userRecord.emailVerified) return userData;
  if (
    userData?.emailVerified === true &&
    userData?.emailVerificationPending !== true
  ) {
    return userData;
  }

  await getDb().collection("users").doc(userRecord.uid).set({
    emailVerified: true,
    emailVerificationPending: FieldValue.delete(),
    emailVerificationSentAt: FieldValue.delete(),
    emailVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  const syncedUserData = {...userData, emailVerified: true};
  delete syncedUserData.emailVerificationPending;
  delete syncedUserData.emailVerificationSentAt;
  return syncedUserData;
}

function getSecurityMaterial(name, fallbackLabel) {
  const configured = process.env[name];

  if (configured) {
    if (/^[0-9a-f]{64}$/i.test(configured)) {
      return Buffer.from(configured, "hex");
    }

    const base64 = Buffer.from(configured, "base64");
    if (base64.length >= 32) return base64.subarray(0, 32);

    return crypto.createHash("sha256").update(configured).digest();
  }

  if (process.env.FUNCTIONS_EMULATOR) {
    return crypto
      .createHash("sha256")
      .update(`serve-plus-local-${fallbackLabel}`)
      .digest();
  }

  throw new HttpsError(
    "failed-precondition",
    `${name} must be configured before MFA can be used.`,
  );
}

function getEncryptionKey() {
  return getSecurityMaterial("MFA_ENCRYPTION_KEY", "mfa-encryption-key");
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptSecret(encrypted) {
  if (!encrypted?.iv || !encrypted?.ciphertext || !encrypted?.tag) {
    throw new HttpsError("failed-precondition", "MFA secret is missing.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(sessionToken) {
  return crypto
    .createHash("sha256")
    .update(String(sessionToken || ""))
    .digest("hex");
}

function normalizeTotpCode(code) {
  return String(code || "").replace(/\s+/g, "");
}

async function validateTotpCode(secret, code, lastAcceptedCounter) {
  const token = normalizeTotpCode(code);
  if (!/^\d{6}$/.test(token)) {
    return {valid: false, reason: "Enter the 6-digit code."};
  }

  const totp = new TOTP({
    ...totpOptions,
    secret,
  });
  const verification = await totp.verify(token);

  if (!verification?.valid) {
    return {valid: false, reason: "Invalid authenticator code."};
  }

  const acceptedCounter = verification.timeStep;

  if (
    typeof lastAcceptedCounter === "number" &&
    acceptedCounter <= lastAcceptedCounter
  ) {
    return {valid: false, reason: "This authenticator code was already used."};
  }

  return {valid: true, acceptedCounter};
}

async function createMfaSession({uid, email, role, provider, purpose}) {
  const sessionToken = createSessionToken();
  const sessionHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + MFA_SESSION_TTL_MS);

  await getDb().collection(SESSION_COLLECTION).doc(sessionHash).set({
    uid,
    email: normalizeEmail(email),
    role,
    provider,
    purpose,
    attempts: 0,
    consumed: false,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return sessionToken;
}

async function readValidSession(sessionToken, expectedPurpose) {
  const sessionHash = hashSessionToken(sessionToken);
  const sessionRef = getDb().collection(SESSION_COLLECTION).doc(sessionHash);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    throw new HttpsError("unauthenticated", "MFA session expired.");
  }

  const session = sessionSnap.data();
  const expiresAt = session.expiresAt?.toDate ?
    session.expiresAt.toDate() :
    new Date(session.expiresAt);

  if (
    session.consumed === true ||
    session.purpose !== expectedPurpose ||
    expiresAt <= new Date()
  ) {
    throw new HttpsError("unauthenticated", "MFA session expired.");
  }

  if ((session.attempts || 0) >= MAX_MFA_ATTEMPTS) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many MFA attempts. Sign in again.",
    );
  }

  return {sessionRef, session};
}

async function rejectMfaAttempt(sessionRef, reason) {
  const nextAttempts = await getDb().runTransaction(async (transaction) => {
    const snap = await transaction.get(sessionRef);
    const attempts = (snap.data()?.attempts || 0) + 1;
    transaction.update(sessionRef, {
      attempts,
      consumed: attempts >= MAX_MFA_ATTEMPTS,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return attempts;
  });

  if (nextAttempts >= MAX_MFA_ATTEMPTS) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many MFA attempts. Sign in again.",
    );
  }

  throw new HttpsError("unauthenticated", reason);
}

async function createCustomToken({
  uid,
  role,
  provider,
  mfaComplete,
  mfaRequired,
}) {
  const requiresTotp = typeof mfaRequired === "boolean" ?
    mfaRequired :
    provider !== "blackboard" && requiresMfaRole(role);

  return admin.auth().createCustomToken(uid, {
    role,
    provider,
    mfa: mfaComplete === true,
    mfaRequired: requiresTotp,
  });
}

async function getMfaFactor(uid) {
  const factorSnap = await getDb().collection(FACTOR_COLLECTION).doc(uid).get();
  return {
    exists: factorSnap.exists,
    data: factorSnap.exists ? factorSnap.data() : null,
  };
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
      "Only system administrators can reset TOTP setup.",
    );
  }

  return {uid: callerUid, data: callerData};
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function writeAccountAudit({action, actor, details}) {
  try {
    await getDb().collection("auditLogs").add({
      action,
      category: "account",
      actorUid: actor?.uid || null,
      actorEmail: actor?.email || null,
      actorName: actor?.name || null,
      details,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("MFA audit log failed", {
      action,
      message: err?.message,
    });
  }
}

async function clearMfaSessionsForUser(uid) {
  let clearedSessions = 0;

  while (true) {
    const sessionSnap = await getDb()
      .collection(SESSION_COLLECTION)
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

async function createAuthStep({uid, email, role, provider}) {
  if (isMfaExemptRole(role) || !requiresMfaRole(role) || process.env.FUNCTIONS_EMULATOR) {
    const customToken = await createCustomToken({
      uid,
      role,
      provider,
      mfaComplete: false,
      mfaRequired: false,
    });

    return {
      status: "AUTHENTICATED",
      customToken,
      role,
      email: normalizeEmail(email),
    };
  }

  const factor = await getMfaFactor(uid);
  const isEnabled = factor.exists && factor.data?.enabled === true;
  const purpose = isEnabled ? "verify" : "setup";
  const sessionToken = await createMfaSession({
    uid,
    email,
    role,
    provider,
    purpose,
  });

  return {
    status: isEnabled ? "MFA_REQUIRED" : "MFA_SETUP_REQUIRED",
    sessionToken,
    role,
    email: normalizeEmail(email),
  };
}

async function requestTotpReset(request) {
  const {sessionToken} = request.data || {};
  const {session} = await readValidSession(sessionToken, "verify");
  const factorRef = getDb().collection(FACTOR_COLLECTION).doc(session.uid);
  const factorSnap = await factorRef.get();

  if (!factorSnap.exists || factorSnap.data()?.enabled !== true) {
    throw new HttpsError("failed-precondition", "TOTP is not enrolled.");
  }

  const userSnap = await getDb().collection("users").doc(session.uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const alreadyRequested = factorSnap.data()?.resetRequested === true;
  const serverTimestamp = FieldValue.serverTimestamp();

  await factorRef.set({
    resetRequested: true,
    resetRequestedAt: serverTimestamp,
    resetRequestedBy: session.uid,
    resetRequestedSessionHash: hashSessionToken(sessionToken),
    updatedAt: serverTimestamp,
  }, {merge: true});

  if (!alreadyRequested) {
    await writeAccountAudit({
      action: "TOTP_RESET_REQUESTED",
      actor: {
        uid: session.uid,
        email: session.email,
        name: userData.name || userData.displayName || null,
      },
      details: {
        targetUserId: session.uid,
        targetUserName: userData.name || userData.displayName || "",
        targetUserEmail: session.email || userData.email || "",
      },
    });
  }

  return {
    status: "TOTP_RESET_REQUESTED",
    alreadyRequested,
  };
}

async function listTotpResetRequests(request) {
  await assertSysadminCaller(request);

  const resetSnap = await getDb()
    .collection(FACTOR_COLLECTION)
    .where("resetRequested", "==", true)
    .get();

  const userSnaps = await Promise.all(
    resetSnap.docs.map((factorDoc) =>
      getDb().collection("users").doc(factorDoc.id).get(),
    ),
  );

  const requests = resetSnap.docs.map((factorDoc, index) => {
    const factorData = factorDoc.data();
    const userSnap = userSnaps[index];
    const userData = userSnap.exists ? userSnap.data() : {};

    return {
      uid: factorDoc.id,
      email: userData.email || null,
      name: userData.name || userData.displayName || null,
      role: getRole(userData),
      requestedAt: serializeTimestamp(factorData.resetRequestedAt),
    };
  });

  requests.sort((a, b) =>
    String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")),
  );

  return {requests};
}

async function resetUserTotp(request) {
  const {uid: callerUid, data: callerData} = await assertSysadminCaller(request);
  const targetUid = String(request.data?.targetUid || "").trim();

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Target user is required.");
  }

  const userSnap = await getDb().collection("users").doc(targetUid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Target user was not found.");
  }

  const targetData = userSnap.data();
  const targetRole = getRole(targetData);

  if (isMfaExemptRole(targetRole) || !requiresMfaRole(targetRole)) {
    throw new HttpsError(
      "failed-precondition",
      "TOTP reset is only available for MFA-required users.",
    );
  }

  const factorRef = getDb().collection(FACTOR_COLLECTION).doc(targetUid);
  const factorSnap = await factorRef.get();
  await factorRef.delete();
  const clearedSessions = await clearMfaSessionsForUser(targetUid);

  await writeAccountAudit({
    action: "TOTP_RESET",
    actor: {
      uid: callerUid,
      email: callerData.email || "",
      name: callerData.name || callerData.displayName || null,
    },
    details: {
      targetUserId: targetUid,
      targetUserName: targetData.name || targetData.displayName || "",
      targetUserEmail: targetData.email || "",
      targetUserRole: targetRole,
      previousFactorExisted: factorSnap.exists,
      clearedSessions,
    },
  });

  return {
    status: "TOTP_RESET",
    targetUid,
    previousFactorExisted: factorSnap.exists,
    clearedSessions,
  };
}

async function startPasswordLogin(request) {
  const {loginId, password} = request.data || {};
  const resolved = await resolveLoginAccount(loginId);
  const email = normalizeEmail(resolved.email);

  if (!isAllowedEmailDomain(email)) {
    throw new HttpsError(
      "permission-denied",
      "Please use an accepted email address.",
    );
  }

  if (requiresBlackboardSignIn(resolved.userData)) {
    throw new HttpsError(
      "permission-denied",
      "This account is linked to Blackboard. Please sign in with Blackboard.",
    );
  }

  const lockState = await checkLoginAttemptLock(email);
  if (lockState.isLocked) {
    throw createLoginLockError(lockState);
  }

  let authResult;
  try {
    authResult = await verifyPassword(email, password);
  } catch (err) {
    if (err.code === "unauthenticated") {
      const failureState = await recordLoginFailureForEmail(email);
      if (failureState.isLocked) {
        throw createLoginLockError(failureState);
      }
    }
    throw err;
  }

  await clearLoginAttemptsForEmail(email);

  const userRecord = await admin.auth().getUser(authResult.localId);
  let userData = await getOrCreateUserProfile(userRecord, resolved.userData);
  const role = getRole(userData);

  if (requiresBlackboardSignIn(userData)) {
    throw new HttpsError(
      "permission-denied",
      "This account is linked to Blackboard. Please sign in with Blackboard.",
    );
  }

  if (userData.status && userData.status !== "active") {
    throw new HttpsError("permission-denied", "Your account is blocked.");
  }

  if (!userRecord.emailVerified && !process.env.FUNCTIONS_EMULATOR) {
    return {
      status: "EMAIL_VERIFICATION_REQUIRED",
      email,
      role,
    };
  }

  await syncVerifiedEmailProfile(userRecord, userData);

  return createAuthStep({
    uid: userRecord.uid,
    email,
    role,
    provider: "password",
  });
}

async function sendEmailVerificationForLogin(request) {
  const {loginId, password} = request.data || {};
  const resolved = await resolveLoginAccount(loginId);
  const email = normalizeEmail(resolved.email);

  if (!isAllowedEmailDomain(email)) {
    throw new HttpsError(
      "permission-denied",
      "Please use an accepted email address.",
    );
  }

  if (requiresBlackboardSignIn(resolved.userData)) {
    throw new HttpsError(
      "permission-denied",
      "This account is linked to Blackboard. Please sign in with Blackboard.",
    );
  }

  const authResult = await verifyPassword(email, password);
  const userRecord = await admin.auth().getUser(authResult.localId);

  if (userRecord.emailVerified) {
    return {status: "ALREADY_VERIFIED", email};
  }

  await sendVerificationEmail(authResult.idToken);
  return {status: "VERIFICATION_SENT", email};
}

async function beginTotpEnrollment(request) {
  const {sessionToken} = request.data || {};
  const sessionHash = hashSessionToken(sessionToken);
  const sessionRef = getDb().collection(SESSION_COLLECTION).doc(sessionHash);
  const candidateSecret = generateSecret(totpOptions);

  const {session, secret} = await getDb().runTransaction(
    async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef);

      if (!sessionSnap.exists) {
        throw new HttpsError("unauthenticated", "MFA session expired.");
      }

      const currentSession = sessionSnap.data();
      const expiresAt = currentSession.expiresAt?.toDate ?
        currentSession.expiresAt.toDate() :
        new Date(currentSession.expiresAt);

      if (
        currentSession.consumed === true ||
        currentSession.purpose !== "setup" ||
        expiresAt <= new Date()
      ) {
        throw new HttpsError("unauthenticated", "MFA session expired.");
      }

      if ((currentSession.attempts || 0) >= MAX_MFA_ATTEMPTS) {
        throw new HttpsError(
          "resource-exhausted",
          "Too many MFA attempts. Sign in again.",
        );
      }

      if (currentSession.pendingSecret) {
        return {
          session: currentSession,
          secret: decryptSecret(currentSession.pendingSecret),
        };
      }

      const pendingSecret = encryptSecret(candidateSecret);
      transaction.update(sessionRef, {
        pendingSecret,
        setupStartedAt: FieldValue.serverTimestamp(),
      });

      return {
        session: {
          ...currentSession,
          pendingSecret,
        },
        secret: candidateSecret,
      };
    },
  );

  return {
    status: "TOTP_ENROLLMENT_STARTED",
    email: session.email,
    issuer: TOTP_ISSUER,
    secret,
    otpauthUrl: generateURI({
      strategy: "totp",
      issuer: TOTP_ISSUER,
      label: session.email,
      secret,
      digits: 6,
      period: TOTP_STEP_SECONDS,
    }),
  };
}

async function verifyTotpEnrollment(request) {
  const {sessionToken, code} = request.data || {};
  const {sessionRef, session} = await readValidSession(sessionToken, "setup");

  if (!session.pendingSecret) {
    throw new HttpsError("failed-precondition", "TOTP setup was not started.");
  }

  const secret = decryptSecret(session.pendingSecret);
  const validation = await validateTotpCode(secret, code, null);

  if (!validation.valid) {
    await rejectMfaAttempt(sessionRef, validation.reason);
  }

  const factorRef = getDb().collection(FACTOR_COLLECTION).doc(session.uid);
  await factorRef.set({
    uid: session.uid,
    enabled: true,
    secret: encryptSecret(secret),
    lastAcceptedCounter: validation.acceptedCounter,
    enrolledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  await sessionRef.update({
    consumed: true,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  const customToken = await createCustomToken({
    uid: session.uid,
    role: session.role,
    provider: session.provider,
    mfaComplete: true,
    mfaRequired: true,
  });

  return {
    status: "AUTHENTICATED",
    customToken,
    role: session.role,
    email: session.email,
  };
}

async function verifyTotpLogin(request) {
  const {sessionToken, code} = request.data || {};
  const {sessionRef, session} = await readValidSession(sessionToken, "verify");
  const factor = await getMfaFactor(session.uid);

  if (!factor.exists || factor.data?.enabled !== true) {
    throw new HttpsError("failed-precondition", "TOTP is not enrolled.");
  }

  const secret = decryptSecret(factor.data.secret);
  const validation = await validateTotpCode(
    secret,
    code,
    factor.data.lastAcceptedCounter,
  );

  if (!validation.valid) {
    await rejectMfaAttempt(sessionRef, validation.reason);
  }

  await getDb().collection(FACTOR_COLLECTION).doc(session.uid).update({
    lastAcceptedCounter: validation.acceptedCounter,
    lastVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    consumed: true,
    verifiedAt: FieldValue.serverTimestamp(),
  });

  const customToken = await createCustomToken({
    uid: session.uid,
    role: session.role,
    provider: session.provider,
    mfaComplete: true,
    mfaRequired: true,
  });

  return {
    status: "AUTHENTICATED",
    customToken,
    role: session.role,
    email: session.email,
  };
}

module.exports = {
  startPasswordLogin,
  sendEmailVerificationForLogin,
  beginTotpEnrollment,
  verifyTotpEnrollment,
  verifyTotpLogin,
  requestTotpReset,
  listTotpResetRequests,
  resetUserTotp,
};
