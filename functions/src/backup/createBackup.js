const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");
const {
  ROOT_COLLECTIONS_TO_BACKUP,
  backupCollectionTree,
} = require("./firestoreTree");
const {
  STORAGE_PREFIXES_TO_BACKUP,
  archiveStoragePrefixes,
  deleteArchivedStorageFiles,
  getStorageArchivePrefix,
} = require("./storageArchive");

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

  const collectionsToBackup = ROOT_COLLECTIONS_TO_BACKUP;

  const timestamp = new Date();
  const backupId = `backup_${timestamp.getTime()}`;
  const backupData = {};
  let totalDocuments = 0;
  const storageArchivePrefix = getStorageArchivePrefix(backupId);

  for (const collectionName of collectionsToBackup) {
    try {
      const result = await backupCollectionTree(db.collection(collectionName));
      backupData[collectionName] = result.documents;
      totalDocuments += result.totalDocuments;
    } catch (err) {
      // If collection doesn't exist or is empty, skip
      backupData[collectionName] = {};
    }
  }

  // Also back up Firebase Auth users
  const authUsers = [];
  try {
    let nextPageToken;
    do {
      const listResult = await admin.auth().listUsers(1000, nextPageToken);
      for (const userRecord of listResult.users) {
        authUsers.push({
          uid: userRecord.uid,
          email: userRecord.email || null,
          emailVerified: userRecord.emailVerified || false,
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
          phoneNumber: userRecord.phoneNumber || null,
          disabled: userRecord.disabled || false,
          providerData: (userRecord.providerData || []).map((p) => ({
            providerId: p.providerId,
            uid: p.uid,
          })),
          customClaims: userRecord.customClaims || null,
        });
      }
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);
  } catch (err) {
    console.warn("Could not back up Auth users:", err.message);
  }
  backupData._authUsers = authUsers;

  // Serialize and upload to Cloud Storage
  const jsonData = JSON.stringify(
    backupData,
    (key, value) => {
      // Handle Firestore Timestamps
      if (
        value &&
        value._seconds !== undefined &&
        value._nanoseconds !== undefined
      ) {
        return {
          _type: "timestamp",
          _seconds: value._seconds,
          _nanoseconds: value._nanoseconds,
        };
      }
      return value;
    },
    2,
  );

  const filePath = `backups/${backupId}.json`;
  const file = bucket.file(filePath);
  let totalStorageFiles = 0;

  try {
    totalStorageFiles = await archiveStoragePrefixes(
      bucket,
      STORAGE_PREFIXES_TO_BACKUP,
      storageArchivePrefix,
    );

    await file.save(jsonData, {
      contentType: "application/json",
      metadata: {
        metadata: {
          backupId,
          createdBy: callerUid,
          createdAt: timestamp.toISOString(),
        },
      },
    });
  } catch (err) {
    try {
      await deleteArchivedStorageFiles(bucket, storageArchivePrefix);
    } catch (cleanupErr) {
      console.warn(
        "Could not clean up archived Storage backup files:",
        cleanupErr.message,
      );
    }

    console.error("Error saving backup to Storage:", err);
    throw new HttpsError(
      "internal",
      "Failed to save backup file: " + err.message,
    );
  }

  // Store backup metadata in Firestore
  const sizeInBytes = Buffer.byteLength(jsonData, "utf8");
  const backupMeta = {
    backupId,
    label: label || `Backup ${timestamp.toLocaleDateString("en-US")}`,
    createdAt: Timestamp.fromDate(timestamp),
    createdBy: callerUid,
    createdByEmail:
      callerDoc.data().email || callerDoc.data().name || callerUid,
    collections: collectionsToBackup,
    totalDocuments,
    totalAuthUsers: authUsers.length,
    totalStorageFiles,
    sizeInBytes,
    storagePath: filePath,
    storageArchivePrefix,
    storagePrefixes: STORAGE_PREFIXES_TO_BACKUP,
    status: "completed",
  };

  await db.collection("backups").doc(backupId).set(backupMeta);

  return {
    success: true,
    backupId,
    totalDocuments,
    sizeInBytes,
    totalStorageFiles,
    message: `Backup created successfully with ${totalDocuments} documents, ${authUsers.length} auth users, and ${totalStorageFiles} storage files.`,
  };
};

module.exports = { createBackup };
