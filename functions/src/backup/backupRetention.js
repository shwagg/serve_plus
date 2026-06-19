const {deleteArchivedStorageFiles} = require("./storageArchive");
const {mapWithConcurrency} = require("./concurrency");

const MAX_COMPLETED_BACKUPS = 10;
const BACKUP_DELETE_CONCURRENCY = 3;

async function pruneOldCompletedBackups({
  db,
  bucket,
  keep = MAX_COMPLETED_BACKUPS,
} = {}) {
  const snapshot = await db
    .collection("backups")
    .orderBy("createdAt", "desc")
    .get();

  const completedBackupDocs = snapshot.docs.filter((doc) => {
    return doc.data()?.status === "completed";
  });
  const backupsToDelete = completedBackupDocs.slice(Math.max(keep, 0));

  await mapWithConcurrency(
    backupsToDelete,
    BACKUP_DELETE_CONCURRENCY,
    async (backupDoc) => {
      await deleteBackupArtifacts(bucket, backupDoc.data());
      await backupDoc.ref.delete();
    },
  );

  return backupsToDelete.length;
}

async function deleteBackupArtifacts(bucket, backupMeta = {}) {
  const storageDeletes = [];
  if (backupMeta.storagePath) {
    storageDeletes.push(
      bucket.file(backupMeta.storagePath).delete({ignoreNotFound: true}),
    );
  }

  if (backupMeta.storageArchivePrefix) {
    storageDeletes.push(
      deleteArchivedStorageFiles(bucket, backupMeta.storageArchivePrefix),
    );
  }

  await Promise.all(storageDeletes);
}

module.exports = {
  MAX_COMPLETED_BACKUPS,
  deleteBackupArtifacts,
  pruneOldCompletedBackups,
};
