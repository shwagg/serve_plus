// Only set emulator host when running locally
if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
}

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

// Blackboard OAuth callback (HTTP request handler, not callable)
const { blackboardCallback } = require("./src/auth/blackboardCallback");
exports.blackboardCallback = blackboardCallback;

// Backup & Restore functions
const { createBackup } = require("./src/backup/createBackup");
const { restoreBackup } = require("./src/backup/restoreBackup");
const { listBackups } = require("./src/backup/listBackups");
const { deleteBackup } = require("./src/backup/deleteBackup");
const { scheduledBackup } = require("./src/backup/scheduledBackup");

exports.createBackup = onCall(
  { region: "asia-southeast1", timeoutSeconds: 540, memory: "1GiB" },
  createBackup,
);
exports.restoreBackup = onCall(
  { region: "asia-southeast1", timeoutSeconds: 540, memory: "1GiB" },
  restoreBackup,
);
exports.listBackups = onCall({ region: "asia-southeast1" }, listBackups);
exports.deleteBackup = onCall({ region: "asia-southeast1" }, deleteBackup);
exports.scheduledBackup = scheduledBackup;
