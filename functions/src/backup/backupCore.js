const {Timestamp} = require("firebase-admin/firestore");
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
const {mapWithConcurrency} = require("./concurrency");
const {pruneOldCompletedBackups} = require("./backupRetention");

const ROOT_COLLECTION_CONCURRENCY = 6;

async function createBackupSnapshot({
  admin,
  db,
  bucket,
  backupId,
  timestamp,
  createdBy,
  createdByEmail,
  label,
}) {
  const collectionsToBackup = ROOT_COLLECTIONS_TO_BACKUP;
  const backupData = {};

  const documentCounts = await mapWithConcurrency(
    collectionsToBackup,
    ROOT_COLLECTION_CONCURRENCY,
    async (collectionName) => {
      const result = await backupCollectionTree(db.collection(collectionName));
      backupData[collectionName] = result.documents;
      return result.totalDocuments;
    },
  );

  const totalDocuments = documentCounts.reduce((sum, count) => {
    return sum + count;
  }, 0);

  const authUsers = await listAuthUsers(admin);
  backupData._authUsers = authUsers;

  const jsonData = JSON.stringify(backupData, serializeBackupValue, 2);
  const filePath = `backups/${backupId}.json`;
  const storageArchivePrefix = getStorageArchivePrefix(backupId);
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
          createdBy,
          createdAt: timestamp.toISOString(),
        },
      },
    });

    const sizeInBytes = Buffer.byteLength(jsonData, "utf8");
    const backupMeta = {
      backupId,
      label,
      createdAt: Timestamp.fromDate(timestamp),
      createdBy,
      createdByEmail,
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

    let prunedBackups = 0;
    try {
      prunedBackups = await pruneOldCompletedBackups({db, bucket});
    } catch (err) {
      console.error("Backup retention cleanup failed:", err);
    }

    return {
      backupId,
      totalDocuments,
      totalAuthUsers: authUsers.length,
      totalStorageFiles,
      sizeInBytes,
      prunedBackups,
    };
  } catch (err) {
    await cleanupBackupArtifacts(bucket, filePath, storageArchivePrefix);
    throw err;
  }
}

async function listAuthUsers(admin) {
  const authUsers = [];
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
        providerData: (userRecord.providerData || []).map((provider) => ({
          providerId: provider.providerId,
          uid: provider.uid,
        })),
        customClaims: userRecord.customClaims || null,
      });
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  return authUsers;
}

function serializeBackupValue(key, value) {
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
}

async function cleanupBackupArtifacts(bucket, filePath, storageArchivePrefix) {
  try {
    await bucket.file(filePath).delete({ignoreNotFound: true});
  } catch (err) {
    console.warn("Could not clean up backup JSON file:", err.message);
  }

  try {
    await deleteArchivedStorageFiles(bucket, storageArchivePrefix);
  } catch (err) {
    console.warn("Could not clean up archived Storage files:", err.message);
  }
}

module.exports = {
  createBackupSnapshot,
};
