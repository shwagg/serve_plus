const {
  clearLoginAttemptsForEmail,
  getLoginAttemptKey,
} = require("./loginAttempts");

async function resetLoginAttempts(request) {
  const email = getLoginAttemptKey(request.data?.email);

  if (!email) {
    throw new Error("Email is required");
  }

  console.log("Resetting login attempts for:", email);

  await clearLoginAttemptsForEmail(email);

  console.log("Login attempts reset for:", email);

  return {success: true};
}

module.exports = {resetLoginAttempts};
