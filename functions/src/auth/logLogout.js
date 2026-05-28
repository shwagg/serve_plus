const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { UAParser } = require("ua-parser-js");

function parseDeviceInfo(uaString) {
  if (!uaString) return null;
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  const browser = [result.browser.name, result.browser.major]
    .filter(Boolean)
    .join(" ");
  const os = [result.os.name, result.os.version].filter(Boolean).join(" ");
  const device =
    result.device.type === "mobile"
      ? "Mobile"
      : result.device.type === "tablet"
      ? "Tablet"
      : "Desktop";
  return { browser: browser || null, os: os || null, device };
}

async function logLogout(request) {
  try {
    const data = request?.data;
    console.log("logLogout called with data:", data);
    let uid = undefined;
    if (typeof data === "object" && data !== null) {
      if (typeof data.uid === "string" && data.uid) {
        uid = data.uid;
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

    // Capture User-Agent from the raw request
    const uaString = request?.rawRequest?.headers?.["user-agent"] || null;
    const deviceInfo = parseDeviceInfo(uaString);

    // Store audit log
    console.log("Writing audit log for logout...");
    await admin
      .firestore()
      .collection("auditLogs")
      .add({
        uid,
        email: email || null,
        action: "LOGOUT",
        role,
        deviceInfo,
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
