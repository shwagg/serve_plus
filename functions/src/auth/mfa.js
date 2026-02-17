//This file allows to email or for now in the emulator send the MFA code in the terminal.

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

//Callable: send MFA code
exports.sendMfaCode = onCall({ region: "asia-southeast1" }, async (request) => {
  const email = (request.data?.email ?? "").toLowerCase().trim();
  if (!email) {
    throw new HttpsError("invalid-argument", "Email required.");
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); //6 digits
  const codeHash = hashCode(code);
  const expiresAt = Date.now() + 5 * 60 * 1000; //5 mins

  await admin.firestore().collection("mfaCodes").doc(email).set({
    codeHash,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  //This one will display or show code in terminal logs; remove this if uses firebase backend (only temporary)
  console.log(`[MFA CODE for ${email}] ${code}`);

  return { ok: true };
});

//Callable: verify MFA code
exports.verifyMfaCode = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const email = (request.data?.email ?? "").toLowerCase().trim();
    const code = (request.data?.code ?? "").trim();

    if (!email || !code) return { ok: false };

    const docRef = admin.firestore().collection("mfaCodes").doc(email);
    const snap = await docRef.get();
    if (!snap.exists) return { ok: false };

    const { codeHash, expiresAt } = snap.data();
    if (!expiresAt || Date.now() > expiresAt) return { ok: false };

    if (hashCode(code) !== codeHash) return { ok: false };

    //one-time use
    await docRef.delete();
    return { ok: true };
  },
);
