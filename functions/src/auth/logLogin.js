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

  // Capture IP and User-Agent from the raw request
  const rawReq = request?.rawRequest;
  console.log("[IP DEBUG] socket.remoteAddress:", rawReq?.socket?.remoteAddress);
  console.log("[IP DEBUG] connection.remoteAddress:", rawReq?.connection?.remoteAddress);
  console.log("[IP DEBUG] req.ip:", rawReq?.ip);
  console.log("[IP DEBUG] x-forwarded-for:", rawReq?.headers?.["x-forwarded-for"]);
  const ipAddress = extractIp(rawReq);
  console.log("[IP DEBUG] resolved ipAddress:", ipAddress);
  const uaString = rawReq?.headers?.["user-agent"] || null;
  const deviceInfo = parseDeviceInfo(uaString);

  // Store audit log
  await admin
    .firestore()
    .collection("auditLogs")
    .add({
      uid,
      email: email || null,
      action: "LOGIN",
      role,
      ipAddress,
      deviceInfo,
      timestamp: FieldValue.serverTimestamp(),
    });

  console.log("Login logged for:", email);

  return { role };
}

module.exports = { logLogin };
