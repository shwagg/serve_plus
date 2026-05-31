const admin = require("firebase-admin");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {normalizeEmail} = require("./emailPolicy");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 10;

function getLoginAttemptKey(value) {
  const email = normalizeEmail(value);
  return email && email.includes("@") ? email : "";
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return value instanceof Date ? value : new Date(value);
}

function serializeLockUntil(value) {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function getAttemptsRef(email) {
  const key = getLoginAttemptKey(email);
  if (!key) return null;
  return admin.firestore().collection("loginAttempts").doc(key);
}

function createUnlockedState(attempts = 0) {
  return {
    allowed: true,
    attempts,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    isLocked: false,
    lockUntil: null,
  };
}

function createLockedState(attempts, lockUntil) {
  return {
    allowed: false,
    attempts,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    isLocked: true,
    lockUntil: serializeLockUntil(lockUntil),
  };
}

async function checkLoginAttemptLock(email) {
  const attemptsRef = getAttemptsRef(email);
  if (!attemptsRef) return createUnlockedState();

  const doc = await attemptsRef.get();
  if (!doc.exists) return createUnlockedState();

  const data = doc.data();
  const lockUntil = toDate(data.lockUntil);

  if (lockUntil && lockUntil > new Date()) {
    return createLockedState(data.attempts || 0, lockUntil);
  }

  if (lockUntil) return createUnlockedState();
  return createUnlockedState(data.attempts || 0);
}

async function recordLoginFailureForEmail(email) {
  const attemptsRef = getAttemptsRef(email);
  if (!attemptsRef) {
    throw new Error("Email is required");
  }

  return admin.firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(attemptsRef);
    const now = new Date();
    let attempts = 1;

    if (doc.exists) {
      const data = doc.data();
      const existingLockUntil = toDate(data.lockUntil);

      if (existingLockUntil && existingLockUntil > now) {
        return createLockedState(data.attempts || 0, existingLockUntil);
      }

      attempts = existingLockUntil ? 1 : (data.attempts || 0) + 1;
    }

    let lockUntil = null;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      lockUntil = new Date(now.getTime() + LOCK_TIME_MINUTES * 60 * 1000);
    }

    transaction.set(attemptsRef, {
      email: getLoginAttemptKey(email),
      attempts,
      lockUntil: lockUntil ? Timestamp.fromDate(lockUntil) : null,
      lastAttempt: FieldValue.serverTimestamp(),
    });

    return lockUntil ?
      createLockedState(attempts, lockUntil) :
      createUnlockedState(attempts);
  });
}

async function clearLoginAttemptsForEmail(email) {
  const attemptsRef = getAttemptsRef(email);
  if (!attemptsRef) {
    throw new Error("Email is required");
  }

  await attemptsRef.delete();
  return {success: true};
}

module.exports = {
  LOCK_TIME_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  checkLoginAttemptLock,
  clearLoginAttemptsForEmail,
  getLoginAttemptKey,
  recordLoginFailureForEmail,
};
