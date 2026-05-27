const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {
  normalizeEmail,
  isAllowedEmailDomain,
} = require("./emailPolicy");

const RESET_ATTEMPT_COLLECTION = "passwordResetAttempts";
const MAX_RESET_ATTEMPTS = 2;
const RESET_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const GENERIC_OK = {ok: true};
const BLACKBOARD_NO_PASSWORD_MESSAGE =
  "This Blackboard account does not have a SERVE+ password yet. " +
  "Sign in with Blackboard and create one from Settings first.";
const RESET_LIMIT_MESSAGE =
  "You can request only 2 password reset emails per day. " +
  "Please try again later.";

function getDb() {
  return admin.firestore();
}

function hasPasswordProvider(userRecord) {
  return (userRecord.providerData || []).some(
    (provider) => provider.providerId === "password",
  );
}

function isBlackboardLinked(userData) {
  return Boolean(
    userData &&
      (userData.authProvider === "blackboard" ||
        userData.blackboardId ||
        userData.blackboardAuthUid),
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAttemptTime(attempt) {
  if (typeof attempt?.at === "number") return attempt.at;
  if (attempt?.at?.toMillis) return attempt.at.toMillis();
  return 0;
}

function createReservation() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
  };
}

function getApiKey() {
  if (process.env.IDENTITY_TOOLKIT_API_KEY) {
    return process.env.IDENTITY_TOOLKIT_API_KEY;
  }

  if (process.env.FUNCTIONS_EMULATOR) return "emulator-api-key";
  throw new HttpsError(
    "failed-precondition",
    "IDENTITY_TOOLKIT_API_KEY must be configured for password reset.",
  );
}

function getIdentityToolkitUrl(path) {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const baseUrl = authEmulatorHost ?
    `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/` :
    "https://identitytoolkit.googleapis.com/v1/";

  return `${baseUrl}${path}?key=${getApiKey()}`;
}

async function sendPasswordResetEmail(email) {
  const response = await fetch(getIdentityToolkitUrl("accounts:sendOobCode"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || "Password reset email failed.";
    console.warn("Password reset email request failed", {message});
    throw new HttpsError(
      "internal",
      "Unable to send reset link. Please try again.",
    );
  }
}

async function getUserProfile(uid, email) {
  const userRef = getDb().collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    return {ref: userRef, data: userSnap.data()};
  }

  const emailSnap = await getDb()
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (emailSnap.empty) return {ref: null, data: null};
  return {
    ref: emailSnap.docs[0].ref,
    data: emailSnap.docs[0].data(),
  };
}

async function reserveResetAttempt(email) {
  const reservation = createReservation();
  const cutoff = Date.now() - RESET_ATTEMPT_WINDOW_MS;
  const attemptRef = getDb()
    .collection(RESET_ATTEMPT_COLLECTION)
    .doc(email);

  await getDb().runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(attemptRef);
    const attempts = attemptSnap.exists ?
      attemptSnap.data().attempts || [] :
      [];
    const recentAttempts = attempts.filter(
      (attempt) => getAttemptTime(attempt) > cutoff,
    );

    if (recentAttempts.length >= MAX_RESET_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", RESET_LIMIT_MESSAGE);
    }

    transaction.set(attemptRef, {
      email,
      attempts: recentAttempts.concat(reservation),
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  });

  return reservation;
}

async function rollbackResetAttempt(email, reservationId) {
  const attemptRef = getDb()
    .collection(RESET_ATTEMPT_COLLECTION)
    .doc(email);

  try {
    await getDb().runTransaction(async (transaction) => {
      const attemptSnap = await transaction.get(attemptRef);
      if (!attemptSnap.exists) return;

      const attempts = attemptSnap.data().attempts || [];
      transaction.update(attemptRef, {
        attempts: attempts.filter((attempt) => attempt.id !== reservationId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    console.warn("Password reset attempt rollback failed", {
      email,
      reservationId,
      message: error.message,
    });
  }
}

async function requestPasswordReset(request) {
  const email = normalizeEmail(request.data?.email);

  if (!email || !isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "Please enter a valid email address.");
  }

  if (!isAllowedEmailDomain(email)) {
    throw new HttpsError(
      "permission-denied",
      "Please use an accepted email address.",
    );
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") return GENERIC_OK;
    throw error;
  }

  const hasServePassword = hasPasswordProvider(userRecord);
  const profile = await getUserProfile(userRecord.uid, email);
  const blackboardLinked = isBlackboardLinked(profile.data);

  if (!hasServePassword) {
    if (blackboardLinked) {
      throw new HttpsError("failed-precondition", BLACKBOARD_NO_PASSWORD_MESSAGE);
    }
    return GENERIC_OK;
  }

  if (blackboardLinked && profile.data?.hasServePassword !== true) {
    await profile.ref.set({
      hasServePassword: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }

  const reservation = await reserveResetAttempt(email);
  try {
    await sendPasswordResetEmail(email);
  } catch (error) {
    await rollbackResetAttempt(email, reservation.id);
    throw error;
  }

  return GENERIC_OK;
}

module.exports = {
  requestPasswordReset,
};
