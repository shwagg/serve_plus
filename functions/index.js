process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// Import functions
const { logLogin } = require("./src/auth/logLogin");
const { logLogout } = require("./src/auth/logLogout");
const { recordLoginFailure } = require("./src/auth/recordLoginFailure");
const { resetLoginAttempts } = require("./src/auth/resetLoginAttempts");
const { checkLoginAttempts } = require("./src/auth/checkLoginAttempts");
const { sendMfaCode, verifyMfaCode } = require("./src/auth/mfa");

// Export as callable Cloud Functions with region
exports.logLogin = onCall({ region: "asia-southeast1" }, logLogin);
exports.logLogout = onCall({ region: "asia-southeast1" }, logLogout);
exports.recordLoginFailure = onCall(
  { region: "asia-southeast1" },
  recordLoginFailure,
);
exports.resetLoginAttempts = onCall(
  { region: "asia-southeast1" },
  resetLoginAttempts,
);
exports.checkLoginAttempts = onCall(
  { region: "asia-southeast1" },
  checkLoginAttempts,
);

// mfa functions are defined in their module
exports.sendMfaCode = sendMfaCode;
exports.verifyMfaCode = verifyMfaCode;
