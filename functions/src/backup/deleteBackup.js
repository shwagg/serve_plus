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
  if (!backupId || typeof backupId !== "string") {
    throw new HttpsError("invalid-argument", "Backup ID is required.");
  }

  const backupDoc = await db.collection("backups").doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }

  const backupMeta = backupDoc.data();

  // Delete from Cloud Storage
  try {
    const storageDeletes = [];
    if (backupMeta.storagePath) {
      storageDeletes.push(
        bucket.file(backupMeta.storagePath).delete({ ignoreNotFound: true }),
      );
    }

    if (backupMeta.storageArchivePrefix) {
      storageDeletes.push(
        deleteArchivedStorageFiles(bucket, backupMeta.storageArchivePrefix),
      );
    }
    await Promise.all(storageDeletes);
  } catch (err) {
    console.error("Could not delete backup file from storage:", err);
    throw new HttpsError(
      "internal",
      "Failed to delete backup files from storage: " + err.message,
    );
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
