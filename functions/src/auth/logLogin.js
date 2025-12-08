const admin = require("firebase-admin");
const functions = require("firebase-functions");

exports.logLogin = functions.https.onCall(async (data, context) => {
  const uid = context.auth.uid;

  const userRecord = await admin.firestore().collection("users").doc(uid).get();

  if (!userRecord.exists) {
    throw new functions.https.HttpsError("not-found", "User record missing.");
  }

  const role = userRecord.data().role;

  // Store login audit log
  await admin.firestore().collection("auditLogs").add({
    uid,
    action: "LOGIN",
    role,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { role };
});
