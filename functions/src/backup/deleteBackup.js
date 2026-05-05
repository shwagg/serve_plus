const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { deleteArchivedStorageFiles } = require("./storageArchive");

//Deletes a specific backup (both metadata and storage file).
const deleteBackup = async (request) => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  // Only admins can delete backups
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;
  if (!callerDoc.exists || callerRole !== "sysadmin") {
    throw new HttpsError(
      "permission-denied",
      "Only system administrators can delete backups.",
    );
  }

  const { backupId } = request.data || {};
  if (!backupId) {
    throw new HttpsError("invalid-argument", "Backup ID is required.");
  }

  const backupDoc = await db.collection("backups").doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }

  const backupMeta = backupDoc.data();

  // Delete from Cloud Storage
  try {
    const file = bucket.file(backupMeta.storagePath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }

    if (backupMeta.storageArchivePrefix) {
      await deleteArchivedStorageFiles(bucket, backupMeta.storageArchivePrefix);
    }
  } catch (err) {
    // Continue even if storage deletion fails
    console.warn("Could not delete backup file from storage:", err.message);
  }

  // Delete metadata from Firestore
  await db.collection("backups").doc(backupId).delete();

  // Log the deletion
  await db.collection("auditLogs").add({
    action: "BACKUP_DELETE",
    uid: callerUid,
    email: callerDoc.data().email || "",
    role: callerRole,
    backupId,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: `Backup ${backupId} deleted successfully.`,
  };
};

module.exports = { deleteBackup };
