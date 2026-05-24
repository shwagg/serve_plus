const admin = require("firebase-admin");

function getLoginAttemptKey(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

async function checkLoginAttempts(request) {
  try {
    const email = getLoginAttemptKey(request.data?.email);

    if (!email) {
      return { allowed: true, attempts: 0, maxAttempts: 5, isLocked: false };
    }

    console.log("Checking login attempts for:", email);

    // Reference to the login attempts collection
    const attemptsRef = admin.firestore().collection("loginAttempts").doc(email);
    const doc = await attemptsRef.get();

    if (!doc.exists) {
      return {
        allowed: true,
        attempts: 0,
        maxAttempts: 5,
        isLocked: false,
      };
    }

    const docData = doc.data();
    const existingLockUntil = docData.lockUntil;

    // Check if currently locked
    if (existingLockUntil) {
      const lockDate = existingLockUntil.toDate ? existingLockUntil.toDate() : existingLockUntil;
      if (lockDate > new Date()) {
        console.log("Account is locked:", email);
        return {
          allowed: false,
          attempts: docData.attempts || 0,
          maxAttempts: 5,
          isLocked: true,
          lockUntil: lockDate.toISOString(),
        };
      }
    }

    return {
      allowed: true,
      attempts: docData.attempts || 0,
      maxAttempts: 5,
      isLocked: false,
    };
  } catch (error) {
    console.error("Error in checkLoginAttempts:", error);
    // On error, allow login to proceed (fail open)
    return {
      allowed: true,
      attempts: 0,
      maxAttempts: 5,
      isLocked: false,
      error: error.message,
    };
  }
}

module.exports = { checkLoginAttempts };
