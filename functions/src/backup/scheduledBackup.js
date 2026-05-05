const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

//Scheduled backup that runs weekly (every Sunday at 2:00 AM).
const scheduledBackup = onSchedule(
  {
    schedule: "0 2 * * 0", // 0 = minute, 2 = hour, * = any day of month, * = any month, 0 = Sunday
    region: "asia-southeast1",
    timeZone: "Asia/Manila",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const collectionsToBackup = ROOT_COLLECTIONS_TO_BACKUP;

    const timestamp = new Date();
    const backupId = `scheduled_${timestamp.getTime()}`;
    const backupData = {};
    let totalDocuments = 0;
    const storageArchivePrefix = getStorageArchivePrefix(backupId);

    for (const collectionName of collectionsToBackup) {
      try {
        const result = await backupCollectionTree(
          db.collection(collectionName),
        );
        backupData[collectionName] = result.documents;
        totalDocuments += result.totalDocuments;
      } catch (err) {
        backupData[collectionName] = {};
      }
    }

    // Serialize with timestamp handling
    const jsonData = JSON.stringify(
      backupData,
      (key, value) => {
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
            createdBy: "system-scheduled",
            createdAt: timestamp.toISOString(),
          },
        },
      });
    } catch (err) {
      try {
        await deleteArchivedStorageFiles(bucket, storageArchivePrefix);
      } catch (cleanupErr) {
        console.warn(
          "Could not clean up scheduled Storage backup files:",
          cleanupErr.message,
        );
      }

      throw err;
    }

    const sizeInBytes = Buffer.byteLength(jsonData, "utf8");

    await db
      .collection("backups")
      .doc(backupId)
      .set({
        backupId,
        label: `Scheduled Backup – ${timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        createdAt: admin.firestore.Timestamp.fromDate(timestamp),
        createdBy: "system-scheduled",
        createdByEmail: "System (Scheduled)",
        collections: collectionsToBackup,
        totalDocuments,
        totalStorageFiles,
        sizeInBytes,
        storagePath: filePath,
        storageArchivePrefix,
        storagePrefixes: STORAGE_PREFIXES_TO_BACKUP,
        status: "completed",
      });

    console.log(
      `Scheduled backup ${backupId} completed: ${totalDocuments} documents, ${totalStorageFiles} storage files, ${sizeInBytes} bytes`,
    );
  },
);

module.exports = { scheduledBackup };
