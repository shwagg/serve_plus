const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { createBackupSnapshot } = require("./backupCore");

//Creates a backup of specified Firestore collections.
//Stores backup data as JSON in Cloud Storage and metadata in Firestore.
const createBackup = async (request) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  // Only admins can create backups
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  let callerDoc;
  try {
    callerDoc = await db.collection("users").doc(callerUid).get();
  } catch (err) {
    console.error("Error fetching caller doc:", err);
    throw new HttpsError("internal", "Failed to verify user role.");
  }
  const callerRole = callerDoc.data()?.role;
  if (!callerDoc.exists || callerRole !== "sysadmin") {
    throw new HttpsError(
      "permission-denied",
      "Only system administrators can create backups.",
    );
  }

  const { label } = request.data || {};
  const backupLabel = typeof label === "string" ? label.trim() : "";

  const timestamp = new Date();
  const backupId = `backup_${timestamp.getTime()}_${randomUUID().slice(0, 8)}`;

  try {
    const result = await createBackupSnapshot({
      admin,
      db,
      bucket,
      backupId,
      timestamp,
      createdBy: callerUid,
      createdByEmail:
        callerDoc.data().email || callerDoc.data().name || callerUid,
      label: backupLabel || `Backup ${timestamp.toLocaleDateString("en-US")}`,
    });

    return {
      success: true,
      backupId,
      totalDocuments: result.totalDocuments,
      sizeInBytes: result.sizeInBytes,
      totalStorageFiles: result.totalStorageFiles,
      message: `Backup created successfully with ${result.totalDocuments} documents, ${result.totalAuthUsers} auth users, and ${result.totalStorageFiles} storage files.`,
    };
  } catch (err) {
    console.error("Error creating backup:", err);
    throw new HttpsError("internal", "Failed to create backup: " + err.message);
  }
};

module.exports = { createBackup };
