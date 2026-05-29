const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");


async function logLogin(request) {
  const uid = request?.auth?.uid || request?.data?.uid;

  if (!uid) {
    throw new Error("User ID is required");
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new Error("User record missing");
  }

  const { role, status, email } = userDoc.data();

  if (status !== "active") {
    throw new Error("Account is blocked");
  }

  // Store audit log
  await admin
    .firestore()
    .collection("auditLogs")
    .add({
      uid,
      email: email || null,
      action: "LOGIN",
      role,
      timestamp: FieldValue.serverTimestamp(),
    });

  console.log("Login logged for:", email);

  return { role };
}

module.exports = { logLogin };
