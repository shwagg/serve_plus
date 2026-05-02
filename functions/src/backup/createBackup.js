const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");

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

  // Collections to back up
  const collectionsToBackup = [
    "users",
    "projects",
    "events",
    "auditLogs",
    "announcements",
    "documents",
  ];

  const timestamp = new Date();
  const backupId = `backup_${timestamp.getTime()}`;
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

  try {
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
    sizeInBytes,
    storagePath: filePath,
    status: "completed",
  };

  await db.collection("backups").doc(backupId).set(backupMeta);

  return {
    success: true,
    backupId,
    totalDocuments,
    sizeInBytes,
    message: `Backup created successfully with ${totalDocuments} documents and ${authUsers.length} auth users.`,
  };
};

module.exports = { createBackup };
