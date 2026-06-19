const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { createBackupSnapshot } = require("./backupCore");

//Scheduled backup that runs weekly (every Sunday at 2:00 AM).
const scheduledBackup = onSchedule(
  {
    schedule: "0 2 * * 0", // 0 = minute, 2 = hour, * = any day of month, * = any month, 0 = Sunday
    region: "asia-southeast1",
    timeZone: "Asia/Manila",
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 1,
    retryCount: 3,
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const timestamp = new Date();
    const backupId = `scheduled_${timestamp.getTime()}_${
      randomUUID().slice(0, 8)
    }`;

    try {
      const result = await createBackupSnapshot({
        admin,
        db,
        bucket,
        backupId,
        timestamp,
        createdBy: "system-scheduled",
        createdByEmail: "System (Scheduled)",
        label: `Scheduled Backup - ${timestamp.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
      });

      console.log(
        `Scheduled backup ${backupId} completed: ${result.totalDocuments} documents, ${result.totalAuthUsers} auth users, ${result.totalStorageFiles} storage files, ${result.sizeInBytes} bytes`,
      );
      if (result.prunedBackups > 0) {
        console.log(
          `Backup retention removed ${result.prunedBackups} old backup(s).`,
        );
      }
    } catch (err) {
      console.error("Scheduled backup failed:", err);
      throw err;
    }
  },
);

module.exports = { scheduledBackup };
