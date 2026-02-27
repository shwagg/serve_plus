const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");


//Lists all available backups ordered by creation date (newest first).
const listBackups = async (request) => {
  const db = admin.firestore();

  // Only admins can list backups
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only administrators can view backups.",
    );
  }

  const snapshot = await db
    .collection("backups")
    .orderBy("createdAt", "desc")
    .get();

  const backups = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      backupId: data.backupId,
      label: data.label,
      createdAt: data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : null,
      createdByEmail: data.createdByEmail || data.createdBy,
      collections: data.collections,
      totalDocuments: data.totalDocuments,
      sizeInBytes: data.sizeInBytes,
      status: data.status,
      lastRestoredAt: data.lastRestoredAt?.toDate?.()
        ? data.lastRestoredAt.toDate().toISOString()
        : null,
    };
  });

  return { success: true, backups };
};

module.exports = { listBackups };
