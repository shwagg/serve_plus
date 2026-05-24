const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 10;

function getLoginAttemptKey(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

async function recordLoginFailure(request) {
  try {
    // In firebase-functions v7, data is accessed via request.data
    const email = getLoginAttemptKey(request.data?.email);
    
    console.log("Recording login failure for email:", email);

    if (!email || typeof email !== 'string') {
      console.log("Invalid email provided");
      return { success: false, error: "Email is required" };
    }

    // Reference to the login attempts collection
    const attemptsRef = admin.firestore().collection("loginAttempts").doc(email);
    const doc = await attemptsRef.get();

    let attempts = 1;
    let lockUntil = null;

    if (doc.exists) {
      const docData = doc.data();
      const existingLockUntil = docData.lockUntil;

      // Check if currently locked
      if (existingLockUntil) {
        const lockDate = existingLockUntil.toDate ? existingLockUntil.toDate() : existingLockUntil;
        if (lockDate > new Date()) {
          console.log("Account is locked:", email);
          return {
            success: true,
            attempts: docData.attempts || 0,
            maxAttempts: MAX_LOGIN_ATTEMPTS,
            isLocked: true,
            lockUntil: lockDate.toISOString(),
          };
        }
      }

      attempts = (docData.attempts || 0) + 1;
    }

    // Lock if max attempts reached
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockDate = new Date();
      lockDate.setMinutes(lockDate.getMinutes() + LOCK_TIME_MINUTES);
      lockUntil = Timestamp.fromDate(lockDate);
    }

    // Write to Firestore
    await attemptsRef.set({
      email: email,
      attempts: attempts,
      lockUntil: lockUntil,
      lastAttempt: FieldValue.serverTimestamp(),
    });

    console.log(`Recorded attempt ${attempts}/${MAX_LOGIN_ATTEMPTS} for ${email}`);

    return {
      success: true,
      attempts: attempts,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      isLocked: lockUntil !== null,
      lockUntil: lockUntil ? lockUntil.toDate().toISOString() : null,
    };
  } catch (error) {
    console.error("Error in recordLoginFailure:", error);
    return {
      success: false,
      error: error.message || "Internal error recording login failure",
    };
  }
}

module.exports = { recordLoginFailure };
