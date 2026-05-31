const {
  MAX_LOGIN_ATTEMPTS,
  getLoginAttemptKey,
  recordLoginFailureForEmail,
} = require("./loginAttempts");

async function recordLoginFailure(request) {
  try {
    const email = getLoginAttemptKey(request.data?.email);

    console.log("Recording login failure for email:", email);

    if (!email) {
      console.log("Invalid email provided");
      return {success: false, error: "Email is required"};
    }

    const result = await recordLoginFailureForEmail(email);

    console.log(
      `Recorded attempt ${result.attempts}/${MAX_LOGIN_ATTEMPTS} for ${email}`,
    );

    return {
      success: true,
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
      isLocked: result.isLocked,
      lockUntil: result.lockUntil,
    };
  } catch (error) {
    console.error("Error in recordLoginFailure:", error);
    return {
      success: false,
      error: error.message || "Internal error recording login failure",
    };
  }
}

module.exports = {recordLoginFailure};
