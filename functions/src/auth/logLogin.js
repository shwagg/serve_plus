const admin = require("firebase-admin");
const functions = require("firebase-functions");

// Define the function correctly
const logLogin = functions.https.onCall(async (data, context) => {
  // Get uid from the data parameter (passed by client)
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

  // Store audit log
  await admin.firestore().collection("auditLogs").add({
    uid,
    action: "LOGIN",
    role,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { role };
});

// EXPORT PROPERLY
module.exports = { logLogin };