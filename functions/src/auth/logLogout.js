const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

async function logLogout(data, context) {
  try {
    console.log("logLogout called with data:", data);
      let uid = undefined;
      if (typeof data === 'object' && data !== null) {
        if (typeof data.uid === 'string' && data.uid) {
          uid = data.uid;
        } else if (data.data && typeof data.data.uid === 'string' && data.data.uid) {
          uid = data.data.uid;
        }
      }
    if (!uid) {
      console.error("No UID provided");
      throw new Error("User ID is required");
    }
    console.log("Fetching userDoc for UID:", uid);
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists) {
      console.error("User record missing for UID:", uid);
      throw new Error("User record missing");
    }
    const { role, status, email } = userDoc.data();
    console.log("User data:", { role, status, email });
    if (status !== "active") {
      console.error("Account is blocked for UID:", uid);
      throw new Error("Account is blocked");
    }
    // Store audit log
    console.log("Writing audit log for logout...");
    await admin.firestore().collection("auditLogs").add({
      uid,
      email: email || null,
      action: "LOGOUT",
      role,
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log("Logout logged for:", email);
    return { role };
  } catch (error) {
    console.error("logLogout error:", error);
    throw error;
  }
}

module.exports = { logLogout };
