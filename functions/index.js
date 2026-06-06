if (process.env.FUNCTIONS_EMULATOR) {
  // Only set emulator host when running locally
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  } process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
}

const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall, onRequest, } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "asia-southeast1";
const DEFAULT_MAX_INSTANCES = 2;
const HEAVY_JOB_MAX_INSTANCES = 1;

setGlobalOptions({
  region: REGION,
  cpu: "gcf_gen1",
  maxInstances: DEFAULT_MAX_INSTANCES,
});

const defaultFunctionOptions = {
  region: REGION,
  cors: true,
  invoker: "public",
};
const heavyJobOptions = {
  ...defaultFunctionOptions,
  timeoutSeconds: 540,
  memory: "1GiB",
  maxInstances: HEAVY_JOB_MAX_INSTANCES,
};

function callableHttpAdapter(handler) {
  return async (req, res) => {
    if (req.method !== "POST" || typeof req.body?.data === "undefined") {
      const error = new HttpsError("invalid-argument", "Bad request.");
      res.status(error.httpErrorCode.status).json({error: error.toJSON()});
      return;
    }

    try {
      const callableRequest = {
        data: req.body.data,
        rawRequest: req,
      };
      const authHeader = req.get("Authorization") || "";
      const [, idToken] = authHeader.match(/^Bearer (.+)$/i) || [];

      if (idToken) {
        const token = await admin.auth().verifyIdToken(idToken);
        callableRequest.auth = {
          uid: token.uid,
          token,
        };
      }

      const result = await handler(callableRequest);
      res.status(200).json({result});
    } catch (err) {
      const error = err instanceof HttpsError ?
        err :
        new HttpsError("internal", "Internal error.");
      res.status(error.httpErrorCode.status).json({error: error.toJSON()});
    }
  };
}

// Import functions
const { logLogin } = require("./src/auth/logLogin");
const { logLogout } = require("./src/auth/logLogout");
const { recordLoginFailure } = require("./src/auth/recordLoginFailure");
const { resetLoginAttempts } = require("./src/auth/resetLoginAttempts");
const { checkLoginAttempts } = require("./src/auth/checkLoginAttempts");
const {
  backfillBlackboardPasswordStatus,
} = require("./src/auth/backfillBlackboardPasswordStatus");
const {
  startPasswordLogin,
  sendEmailVerificationForLogin,
  beginTotpEnrollment,
  verifyTotpEnrollment,
  verifyTotpLogin,
  requestTotpReset,
  listTotpResetRequests,
  resetUserTotp,
} = require("./src/auth/mfa");
const { requestPasswordReset } = require("./src/auth/passwordReset");
const { validateRegistrationEmail, cleanupUnverifiedRegistrations, } = require("./src/auth/registrationEmail");

// Export as callable Cloud Functions with region
// Export using v2
exports.logLogin = onCall(defaultFunctionOptions, logLogin);
exports.logLogout = onCall(defaultFunctionOptions, logLogout);
exports.recordLoginFailure = onCall(
  defaultFunctionOptions,
  recordLoginFailure
);
exports.resetLoginAttempts = onCall(
  defaultFunctionOptions,
  resetLoginAttempts
);
exports.checkLoginAttempts = onCall(
  defaultFunctionOptions,
  checkLoginAttempts
);
exports.backfillBlackboardPasswordStatus = onCall(
  heavyJobOptions,
  backfillBlackboardPasswordStatus
);
exports.startPasswordLogin = onCall(
  defaultFunctionOptions,
  startPasswordLogin
);
exports.sendEmailVerificationForLogin = onCall(
  defaultFunctionOptions,
  sendEmailVerificationForLogin
);
exports.requestPasswordReset = onCall(
  defaultFunctionOptions,
  requestPasswordReset
);
exports.beginTotpEnrollment = onCall(
  defaultFunctionOptions,
  beginTotpEnrollment
);
exports.verifyTotpEnrollment = onCall(
  defaultFunctionOptions,
  verifyTotpEnrollment
);
exports.verifyTotpLogin = onCall(
  defaultFunctionOptions,
  verifyTotpLogin
);
exports.requestTotpReset = onCall(
  defaultFunctionOptions,
  requestTotpReset
);
exports.requestTotpResetHttp = onRequest(
  defaultFunctionOptions,
  callableHttpAdapter(requestTotpReset)
);
exports.listTotpResetRequests = onCall(
  defaultFunctionOptions,
  listTotpResetRequests
);
exports.listTotpResetRequestsHttp = onRequest(
  defaultFunctionOptions,
  callableHttpAdapter(listTotpResetRequests)
);
exports.resetUserTotp = onCall(
  defaultFunctionOptions,
  resetUserTotp
);
exports.resetUserTotpHttp = onRequest(
  defaultFunctionOptions,
  callableHttpAdapter(resetUserTotp)
);
exports.validateRegistrationEmail = onCall(
  defaultFunctionOptions,
  validateRegistrationEmail
);
exports.cleanupUnverifiedRegistrations = cleanupUnverifiedRegistrations;

// Blackboard OAuth bridge (HTTP request handler, not callable)
const {
  blackboardAuth,
  blackboardCallback,
} = require("./src/auth/blackboardCallback");
exports.blackboardAuth = blackboardAuth;
exports.blackboardCallback = blackboardCallback;

// Backup & Restore functions
const { createBackup } = require("./src/backup/createBackup");
const { restoreBackup } = require("./src/backup/restoreBackup");
const { listBackups } = require("./src/backup/listBackups");
const { deleteBackup } = require("./src/backup/deleteBackup");
const { scheduledBackup } = require("./src/backup/scheduledBackup");

exports.createBackup = onCall(
  heavyJobOptions,
  createBackup,
);
exports.restoreBackup = onCall(
  heavyJobOptions,
  restoreBackup,
);
exports.listBackups = onCall(defaultFunctionOptions, listBackups);
exports.deleteBackup = onCall(defaultFunctionOptions, deleteBackup);
exports.scheduledBackup = scheduledBackup;

// Attendance flagging
const { scheduledFlagAbsentVolunteers, manualFlagAbsentVolunteers } = require("./src/attendance/flagAbsentVolunteers");
exports.scheduledFlagAbsentVolunteers = scheduledFlagAbsentVolunteers;
exports.manualFlagAbsentVolunteers = onCall(
  defaultFunctionOptions,
  manualFlagAbsentVolunteers
);

// Mission reminder emails
const { scheduledMissionReminderEmails } = require("./src/missions/missionReminderEmails");
exports.scheduledMissionReminderEmails = scheduledMissionReminderEmails;
