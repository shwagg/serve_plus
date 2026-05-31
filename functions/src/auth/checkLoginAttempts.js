const {
  checkLoginAttemptLock,
  getLoginAttemptKey,
} = require("./loginAttempts");

async function checkLoginAttempts(request) {
  try {
    const email = getLoginAttemptKey(request.data?.email);

    if (!email) {
      return {allowed: true, attempts: 0, maxAttempts: 5, isLocked: false};
    }

    console.log("Checking login attempts for:", email);

    return checkLoginAttemptLock(email);
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

module.exports = {checkLoginAttempts};
