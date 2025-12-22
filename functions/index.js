process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const functions = require("firebase-functions");
const admin = require("firebase-admin");


admin.initializeApp();

// Import functions
const { logLogin } = require("./src/auth/logLogin");
const { logLogout } = require("./src/auth/logLogout");
const { recordLoginFailure } = require("./src/auth/recordLoginFailure");
const { resetLoginAttempts } = require("./src/auth/resetLoginAttempts");
const { checkLoginAttempts } = require("./src/auth/checkLoginAttempts");



// Export as callable Cloud Functions
exports.logLogin = functions.https.onCall(logLogin);
exports.logLogout = functions.https.onCall(logLogout);
exports.recordLoginFailure = functions.https.onCall(recordLoginFailure);
exports.resetLoginAttempts = functions.https.onCall(resetLoginAttempts);
exports.checkLoginAttempts = functions.https.onCall(checkLoginAttempts);


