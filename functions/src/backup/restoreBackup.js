const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const {
  getBackupCollectionNames,
  restoreCollectionTree,
} = require("./firestoreTree");
const { restoreArchivedStorageFiles } = require("./storageArchive");
const {mapWithConcurrency} = require("./concurrency");

const RESTORE_COLLECTION_CONCURRENCY = 3;
const AUTH_USER_CONCURRENCY = 10;

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
  const callerRole = callerDoc.data()?.role;
  if (!callerDoc.exists || callerRole !== "sysadmin") {
    throw new HttpsError(
      "permission-denied",
      "Only system administrators can restore backups.",
    );
  }

  const { backupId, collections } = request.data || {};
  if (!backupId || typeof backupId !== "string") {
    throw new HttpsError("invalid-argument", "Backup ID is required.");
  }
  if (
    collections !== undefined &&
    (
      !Array.isArray(collections) ||
      collections.some((collection) => typeof collection !== "string")
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Collections must be an array of collection names.",
    );
  }

  // Fetch backup metadata
  const backupDoc = await db.collection("backups").doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError("not-found", "Backup not found.");
  }

  const backupMeta = backupDoc.data();
  const filePath = backupMeta.storagePath;
  if (!filePath) {
    throw new HttpsError(
      "failed-precondition",
      "Backup metadata is missing its storage path.",
    );
  }

  // Download backup JSON from Cloud Storage
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError("not-found", "Backup file not found in storage.");
  }

  const [contents] = await file.download();
  let backupData;
  try {
    backupData = JSON.parse(contents.toString("utf8"));
  } catch {
    throw new HttpsError("data-loss", "Backup file is not valid JSON.");
  }

  // Determine which collections to restore
  const collectionsToRestore =
    Array.isArray(collections) && collections.length > 0
      ? collections
      : getBackupCollectionNames(backupData);

  let restoredDocuments = 0;
  const errors = [];

  const restoreCounts = await mapWithConcurrency(
    collectionsToRestore,
    RESTORE_COLLECTION_CONCURRENCY,
    async (collectionName) => {
      const collectionData = backupData[collectionName];
      if (!collectionData) return 0;

      try {
        const restoreOptions = collectionName === "users" ?
          { preserveDocIds: new Set([callerUid]) } :
          {};

        return restoreCollectionTree(
          db.collection(collectionName),
          collectionData,
          restoreTimestamps,
          restoreOptions,
        );
      } catch (err) {
        errors.push(`Error restoring ${collectionName}: ${err.message}`);
        return 0;
      }
    },
  );
  restoredDocuments = restoreCounts.reduce((sum, count) => sum + count, 0);

  // Restore Firebase Auth users if backup contains them
  let authRestored = 0;
  let authUpdated = 0;
  let authDeleted = 0;
  let storageFilesRestored = 0;
  const backupAuthUsers = backupData._authUsers || [];

  if (Array.isArray(backupData._authUsers)) {
    // Build a set of UIDs that existed at backup time
    const backupUids = new Set(backupAuthUsers.map((u) => u.uid));

    // Get all current Auth users
    const currentUids = new Set();
    let authUsersListed = true;
    try {
      let nextPageToken;
      do {
        const listResult = await admin.auth().listUsers(1000, nextPageToken);
        for (const user of listResult.users) {
          currentUids.add(user.uid);
        }
        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
    } catch (err) {
      authUsersListed = false;
      errors.push("Failed to list current Auth users: " + err.message);
    }

    if (authUsersListed) {
      // Delete Auth users that were created AFTER the backup
      // (exist now but not in backup), except the admin performing the restore
      const uidsToDelete = Array.from(currentUids).filter((uid) => {
        return !backupUids.has(uid) && uid !== callerUid;
      });
      const deleteResults = await mapWithConcurrency(
        uidsToDelete,
        AUTH_USER_CONCURRENCY,
        async (uid) => {
          try {
            await admin.auth().deleteUser(uid);
            return 1;
          } catch (err) {
            errors.push(`Failed to delete Auth user ${uid}: ${err.message}`);
            return 0;
          }
        },
      );
      authDeleted = deleteResults.reduce((sum, count) => sum + count, 0);

      const authRestoreResults = await mapWithConcurrency(
        backupAuthUsers,
        AUTH_USER_CONCURRENCY,
        async (backupUser) => {
          try {
            if (currentUids.has(backupUser.uid)) {
              await admin.auth().updateUser(
                backupUser.uid,
                getAuthUserUpdateProps(backupUser),
              );
              await admin.auth().setCustomUserClaims(
                backupUser.uid,
                backupUser.customClaims || null,
              );
              return {restored: 0, updated: 1};
            } else {
              await admin.auth().createUser(getAuthUserCreateProps(backupUser));
              await admin.auth().setCustomUserClaims(
                backupUser.uid,
                backupUser.customClaims || null,
              );
              return {restored: 1, updated: 0};
            }
          } catch (err) {
            errors.push(
              `Failed to restore Auth user ${backupUser.uid}: ${err.message}`,
            );
            return {restored: 0, updated: 0};
          }
        },
      );
      authRestored = authRestoreResults.reduce((sum, result) => {
        return sum + result.restored;
      }, 0);
      authUpdated = authRestoreResults.reduce((sum, result) => {
        return sum + result.updated;
      }, 0);

      // Also delete Firestore "users" docs for users not in backup
      // (except the current admin). Full user restores already do this
      // recursively; this covers Auth-only cleanup for older backup payloads.
      if (!collectionsToRestore.includes("users")) {
        try {
          const usersSnapshot = await db.collection("users").get();
          const docsToDelete = [];
          usersSnapshot.forEach((doc) => {
            if (!backupUids.has(doc.id) && doc.id !== callerUid) {
              docsToDelete.push(doc.ref);
            }
          });
          for (let i = 0; i < docsToDelete.length; i += 450) {
            const deleteBatch = db.batch();
            for (const docRef of docsToDelete.slice(i, i + 450)) {
              deleteBatch.delete(docRef);
            }
            await deleteBatch.commit();
          }
        } catch (err) {
          errors.push(
            "Failed to clean up extra Firestore user docs: " + err.message,
          );
        }
      }
    }
  }

  if (backupMeta.storageArchivePrefix) {
    try {
      storageFilesRestored = await restoreArchivedStorageFiles(
        bucket,
        backupMeta.storageArchivePrefix,
        backupMeta.storagePrefixes,
      );
    } catch (err) {
      errors.push("Failed to restore Storage files: " + err.message);
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
    role: callerRole,
    backupId,
    collectionsRestored: collectionsToRestore,
    restoredDocuments,
    authUsersRestored: authRestored,
    authUsersUpdated: authUpdated,
    authUsersDeleted: authDeleted,
    storageFilesRestored,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: errors.length === 0,
    restoredDocuments,
    collectionsRestored: collectionsToRestore,
    authUsersRestored: authRestored,
    authUsersUpdated: authUpdated,
    authUsersDeleted: authDeleted,
    storageFilesRestored,
    errors,
    message: `Restored ${restoredDocuments} documents from backup. Auth: ${authRestored} recreated, ${authUpdated} updated, ${authDeleted} removed. Storage: ${storageFilesRestored} files restored.`,
  };
};

function getAuthUserCreateProps(backupUser) {
  return {
    uid: backupUser.uid,
    email: backupUser.email || undefined,
    emailVerified: backupUser.emailVerified || false,
    displayName: backupUser.displayName || undefined,
    photoURL: backupUser.photoURL || undefined,
    phoneNumber: backupUser.phoneNumber || undefined,
    disabled: backupUser.disabled || false,
  };
}

function getAuthUserUpdateProps(backupUser) {
  const updateProps = {
    emailVerified: backupUser.emailVerified || false,
    disabled: backupUser.disabled || false,
  };

  if (backupUser.email) {
    updateProps.email = backupUser.email;
  }
  if (backupUser.displayName !== undefined) {
    updateProps.displayName = backupUser.displayName || null;
  }
  if (backupUser.photoURL !== undefined) {
    updateProps.photoURL = backupUser.photoURL || null;
  }
  if (backupUser.phoneNumber !== undefined) {
    updateProps.phoneNumber = backupUser.phoneNumber || null;
  }

  return updateProps;
}

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
