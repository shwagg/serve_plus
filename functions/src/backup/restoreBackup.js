const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

//Restores Firestore data from a previously created backup.
//Reads the backup JSON from Cloud Storage and writes documents back.
const restoreBackup = async (request) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  // Only admins can restore backups
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only administrators can restore backups.",
    );
  }

  const { backupId, collections } = request.data || {};
  if (!backupId) {
    throw new HttpsError("invalid-argument", "Backup ID is required.");
  }

  // Fetch backup metadata
  const backupDoc = await db.collection("backups").doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }

  const backupMeta = backupDoc.data();
  const filePath = backupMeta.storagePath;

  // Download backup JSON from Cloud Storage
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError("not-found", "Backup file not found in storage.");
  }

  const [contents] = await file.download();
  const backupData = JSON.parse(contents.toString("utf8"));

  // Determine which collections to restore
  const collectionsToRestore =
    collections && collections.length > 0
      ? collections
      : Object.keys(backupData);

  let restoredDocuments = 0;
  const errors = [];

  for (const collectionName of collectionsToRestore) {
    const collectionData = backupData[collectionName];
    if (!collectionData) continue;

    const docEntries = Object.entries(collectionData);

    // Batch writes (max 500 per batch)
    const batchSize = 450;
    for (let i = 0; i < docEntries.length; i += batchSize) {
      const batch = db.batch();
      const slice = docEntries.slice(i, i + batchSize);

      for (const [docId, docData] of slice) {
        // Restore Firestore Timestamps
        const restoredData = restoreTimestamps(docData);
        const ref = db.collection(collectionName).doc(docId);
        batch.set(ref, restoredData, { merge: true });
      }

      try {
        await batch.commit();
        restoredDocuments += slice.length;
      } catch (err) {
        errors.push(`Error restoring ${collectionName}: ${err.message}`);
      }
    }
  }

  // Log the restore action
  await db.collection("backups").doc(backupId).update({
    lastRestoredAt: FieldValue.serverTimestamp(),
    lastRestoredBy: callerUid,
  });

  // Also log in auditLogs
  await db.collection("auditLogs").add({
    action: "BACKUP_RESTORE",
    uid: callerUid,
    email: callerDoc.data().email || "",
    role: "admin",
    backupId,
    collectionsRestored: collectionsToRestore,
    restoredDocuments,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: errors.length === 0,
    restoredDocuments,
    collectionsRestored: collectionsToRestore,
    errors,
    message: `Restored ${restoredDocuments} documents from backup.`,
  };
};

/**
 * Recursively converts serialized timestamp objects back to Firestore Timestamps.
 */
function restoreTimestamps(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (obj._type === "timestamp" && obj._seconds !== undefined) {
    return new Timestamp(obj._seconds, obj._nanoseconds || 0);
  }

  if (Array.isArray(obj)) {
    return obj.map(restoreTimestamps);
  }

  const restored = {};
  for (const [key, value] of Object.entries(obj)) {
    restored[key] = restoreTimestamps(value);
  }
  return restored;
}

module.exports = { restoreBackup };
