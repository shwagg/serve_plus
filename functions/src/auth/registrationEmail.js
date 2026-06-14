const admin = require("firebase-admin");
const dns = require("dns").promises;
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {HttpsError} = require("firebase-functions/v2/https");
const {
  normalizeEmail,
  isAllowedEmailDomain,
  isEmulatorEmailDomain,
} = require("./emailPolicy");

const UNVERIFIED_RETENTION_HOURS = 72;

function getDb() {
  return admin.firestore();
}

function getEmailParts(email) {
  const at = email.lastIndexOf("@");
  return {
    local: at > 0 ? email.slice(0, at) : "",
    domain: at > 0 ? email.slice(at + 1) : "",
  };
}

function hasValidEmailSyntax(email) {
  if (!email || email.length > 254) return false;
  if ((email.match(/@/g) || []).length !== 1) return false;

  const {local, domain} = getEmailParts(email);
  if (!local || !domain || local.length > 64 || domain.length > 253) {
    return false;
  }

  if (
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.includes("..")
  ) {
    return false;
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  return labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  );
}

async function assertEmailIsUnused(email) {
  try {
    await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") return;
    throw new HttpsError(
      "internal",
      "Unable to validate this email address. Please try again.",
    );
  }

  throw new HttpsError(
    "already-exists",
    "An account already exists for this email address.",
  );
}

async function assertDomainHasMx(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (records.some((record) => record.exchange)) return;
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
      throw new HttpsError(
        "failed-precondition",
        "This email domain cannot receive mail.",
      );
    }

    throw new HttpsError(
      "unavailable",
      "Email validation is temporarily unavailable. Please try again.",
    );
  }

  throw new HttpsError(
    "failed-precondition",
    "This email domain cannot receive mail.",
  );
}

async function validateRegistrationEmail(request) {
  const email = normalizeEmail(request.data?.email);

  if (!hasValidEmailSyntax(email)) {
    throw new HttpsError(
      "invalid-argument",
      "Please enter a valid email address.",
    );
  }

  if (!isAllowedEmailDomain(email)) {
    throw new HttpsError(
      "permission-denied",
      "Please use an accepted email address.",
    );
  }

  await assertEmailIsUnused(email);
  if (!isEmulatorEmailDomain(email)) {
    await assertDomainHasMx(getEmailParts(email).domain);
  }

  return {ok: true, email};
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function cleanupUserDoc(userDoc, counters) {
  const user = userDoc.data();

  if (
    user.emailVerificationPending !== true ||
    user.authProvider !== "password"
  ) {
    counters.skipped += 1;
    return;
  }

  const sentAt = toDate(user.emailVerificationSentAt);
  if (!sentAt || sentAt > counters.cutoff) {
    counters.skipped += 1;
    return;
  }

  let authUser = null;
  try {
    authUser = await admin.auth().getUser(userDoc.id);
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      counters.errors += 1;
      console.error("Failed to read pending auth user", userDoc.id, err);
      return;
    }
  }

  if (authUser?.emailVerified) {
    await userDoc.ref.set({
      emailVerified: true,
      emailVerificationPending: admin.firestore.FieldValue.delete(),
      emailVerificationSentAt: admin.firestore.FieldValue.delete(),
      emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    counters.verified += 1;
    return;
  }

  if (authUser) {
    await admin.auth().deleteUser(userDoc.id);
  }
  await userDoc.ref.delete();
  counters.deleted += 1;
}

async function runCleanupUnverifiedRegistrations() {
  const cutoff = new Date(
    Date.now() - UNVERIFIED_RETENTION_HOURS * 60 * 60 * 1000,
  );
  const counters = {
    cutoff,
    scanned: 0,
    deleted: 0,
    verified: 0,
    skipped: 0,
    errors: 0,
  };

  const snap = await getDb()
    .collection("users")
    .where("emailVerificationPending", "==", true)
    .get();

  counters.scanned = snap.size;

  for (const userDoc of snap.docs) {
    await cleanupUserDoc(userDoc, counters);
  }

  console.log("Unverified registration cleanup complete", {
    scanned: counters.scanned,
    deleted: counters.deleted,
    verified: counters.verified,
    skipped: counters.skipped,
    errors: counters.errors,
    cutoff: counters.cutoff.toISOString(),
  });

  return {
    scanned: counters.scanned,
    deleted: counters.deleted,
    verified: counters.verified,
    skipped: counters.skipped,
    errors: counters.errors,
    cutoff: counters.cutoff.toISOString(),
  };
}

const cleanupUnverifiedRegistrations = onSchedule(
  {
    schedule: "0 2 * * *",
    region: "asia-southeast1",
    timeZone: "Asia/Manila",
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 1,
  },
  runCleanupUnverifiedRegistrations,
);

module.exports = {
  validateRegistrationEmail,
  cleanupUnverifiedRegistrations,
  runCleanupUnverifiedRegistrations,
};
