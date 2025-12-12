const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Import logLogin function
const { logLogin } = require("./src/auth/logLogin");

// Export to Firebase
exports.logLogin = logLogin;
