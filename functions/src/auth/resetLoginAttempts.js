const admin = require("firebase-admin");

function getLoginAttemptKey(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

async function resetLoginAttempts(request) {
  const email = getLoginAttemptKey(request.data?.email);

  if (!email) {
    throw new Error("Email is required");
  }

  console.log("Resetting login attempts for:", email);

  // Delete the login attempts document
  await admin.firestore().collection("loginAttempts").doc(email).delete();

  console.log("Login attempts reset for:", email);

  return { success: true };
}

module.exports = { resetLoginAttempts };
