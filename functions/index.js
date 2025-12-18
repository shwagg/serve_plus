const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Import logLogin and logLogout functions
const { logLogin } = require("./src/auth/logLogin");
const { logLogout } = require("./src/auth/logLogout");

// Export to Firebase
exports.logLogin = logLogin;
exports.logLogout = logLogout;
