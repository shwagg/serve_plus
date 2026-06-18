const STORAGE_PREFIXES_TO_BACKUP = [
  "accomplishment_reports/",
  "badges/custom/",
  "chat-attachments/",
  "consents/",
  "event-certificates/",
  "gallery/",
  "mission-covers/",
  "profile-pictures/",
  "proposals/",
];

const {mapWithConcurrency} = require("./concurrency");

const STORAGE_PREFIX_CONCURRENCY = 4;
const STORAGE_FILE_CONCURRENCY = 25;

function getStorageArchivePrefix(backupId) {
  return `backup-storage/${backupId}/`;
}

async function archiveStoragePrefixes(
  bucket,
  storagePrefixes = STORAGE_PREFIXES_TO_BACKUP,
  archivePrefix,
) {
  const counts = await mapWithConcurrency(
    storagePrefixes,
    STORAGE_PREFIX_CONCURRENCY,
    async (prefix) => {
      const [files] = await bucket.getFiles({ prefix });
      const filesToArchive = files.filter((file) => {
        return shouldArchiveFile(file.name, prefix);
      });

      await mapWithConcurrency(filesToArchive, STORAGE_FILE_CONCURRENCY, (
        file,
      ) => {
        const archivePath = `${archivePrefix}${file.name}`;
        return file.copy(bucket.file(archivePath));
      });

      return filesToArchive.length;
    },
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

async function restoreArchivedStorageFiles(
  bucket,
  archivePrefix,
  storagePrefixes = [],
) {
  if (!archivePrefix) {
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix: archivePrefix });
  const archivedFiles = files.filter((file) => {
    return file.name && !file.name.endsWith("/");
  });
  const destinationPaths = new Set(
    archivedFiles
      .map((file) => file.name.slice(archivePrefix.length))
      .filter(Boolean),
  );

  await mapWithConcurrency(
    normalizeStoragePrefixes(storagePrefixes),
    STORAGE_PREFIX_CONCURRENCY,
    (prefix) => deleteStorageFilesWithPrefix(bucket, prefix, destinationPaths),
  );

  const restoreResults = await mapWithConcurrency(
    archivedFiles,
    STORAGE_FILE_CONCURRENCY,
    async (file) => {
      const destinationPath = file.name.slice(archivePrefix.length);
      if (!destinationPath) {
        return 0;
      }

      await file.copy(bucket.file(destinationPath));
      return 1;
    },
  );

  return restoreResults.reduce((sum, count) => sum + count, 0);
}

async function deleteArchivedStorageFiles(bucket, archivePrefix) {
  if (!archivePrefix) {
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix: archivePrefix });
  const filesToDelete = files.filter((file) => {
    return file.name && !file.name.endsWith("/");
  });
  await deleteStorageFiles(filesToDelete);

  return filesToDelete.length;
}

function shouldArchiveFile(fileName, prefix) {
  return Boolean(fileName) && fileName !== prefix && !fileName.endsWith("/");
}

async function deleteStorageFilesWithPrefix(
  bucket,
  prefix,
  pathsToKeep = new Set(),
) {
  const [files] = await bucket.getFiles({ prefix });
  const filesToDelete = files.filter((file) => {
    return shouldArchiveFile(file.name, prefix) && !pathsToKeep.has(file.name);
  });
  await deleteStorageFiles(filesToDelete);

  return filesToDelete.length;
}

async function deleteStorageFiles(files) {
  await mapWithConcurrency(files, STORAGE_FILE_CONCURRENCY, (file) => {
    return file.delete({ ignoreNotFound: true });
  });
}

function normalizeStoragePrefixes(storagePrefixes) {
  if (!Array.isArray(storagePrefixes)) {
    return [];
  }

  return storagePrefixes.filter((prefix) => {
    return (
      typeof prefix === "string" &&
      prefix.length > 0 &&
      !prefix.startsWith("backup-storage/")
    );
  });
}

module.exports = {
  STORAGE_PREFIXES_TO_BACKUP,
  archiveStoragePrefixes,
  deleteArchivedStorageFiles,
  getStorageArchivePrefix,
  restoreArchivedStorageFiles,
};
