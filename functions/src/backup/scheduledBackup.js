const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");


//Scheduled backup that runs weekly (every Sunday at 2:00 AM).
//Automatically backs up all critical Firestore collections.
const scheduledBackup = onSchedule(
  {
    schedule: "0 2 * * 0", // Every Sunday at 2:00 AM
    region: "asia-southeast1",
    timeZone: "Asia/Manila",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const collectionsToBackup = [
      "users",
      "projects",
      "events",
      "auditLogs",
      "announcements",
      "documents",
    ];

    const timestamp = new Date();
    const backupId = `scheduled_${timestamp.getTime()}`;
    const backupData = {};
    let totalDocuments = 0;

    for (const collectionName of collectionsToBackup) {
      try {
        const snapshot = await db.collection(collectionName).get();
        const docs = {};
        snapshot.forEach((doc) => {
          docs[doc.id] = doc.data();
        });
        backupData[collectionName] = docs;
        totalDocuments += snapshot.size;
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
        sizeInBytes,
        storagePath: filePath,
        status: "completed",
      });

    console.log(
      `Scheduled backup ${backupId} completed: ${totalDocuments} documents, ${sizeInBytes} bytes`,
    );
  },
);

module.exports = { scheduledBackup };
