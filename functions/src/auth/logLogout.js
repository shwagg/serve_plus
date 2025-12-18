const admin = require("firebase-admin");
const functions = require("firebase-functions");

const logLogout = functions.https.onCall(async (data, context) => {
  const uid = data?.uid;
  if (!uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "User ID is required."
    );
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User record missing.");
  }

  const { role, status } = userDoc.data();
  if (status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Account is blocked."
    );
  }


  functions.logger.info("Writing audit log", { uid, role, status });
  await admin.firestore().collection("auditLogs").add({
    uid,
    action: "LOGOUT",
    role,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { role };
});

module.exports = { logLogout };
