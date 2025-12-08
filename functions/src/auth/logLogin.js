const admin = require("firebase-admin");
const functions = require("firebase-functions");

exports.logLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in."
    );
  }

  const uid = context.auth.uid;

  const userRecord = await admin.firestore().collection("users").doc(uid).get();

  if (!userRecord.exists) {
    throw new functions.https.HttpsError("not-found", "User record missing.");
  }

  const { role, status } = userRecord.data();

  if (status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Account is blocked."
    );
  }

  // Store login audit log
  await admin.firestore().collection("auditLogs").add({
    uid,
    action: "LOGIN",
    role,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { role };
});
