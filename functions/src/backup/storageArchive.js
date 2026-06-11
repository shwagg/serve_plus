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

function getStorageArchivePrefix(backupId) {
  return `backup-storage/${backupId}/`;
}

async function archiveStoragePrefixes(
  bucket,
  storagePrefixes = STORAGE_PREFIXES_TO_BACKUP,
  archivePrefix,
) {
  let totalStorageFiles = 0;

  for (const prefix of storagePrefixes) {
    const [files] = await bucket.getFiles({ prefix });

    for (const file of files) {
      if (!shouldArchiveFile(file.name, prefix)) {
        continue;
      }

      const archivePath = `${archivePrefix}${file.name}`;
      await file.copy(bucket.file(archivePath));
      totalStorageFiles += 1;
    }
  }

  return totalStorageFiles;
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

  for (const prefix of normalizeStoragePrefixes(storagePrefixes)) {
    await deleteStorageFilesWithPrefix(bucket, prefix, destinationPaths);
  }

  let restoredStorageFiles = 0;

  for (const file of archivedFiles) {
    const destinationPath = file.name.slice(archivePrefix.length);
    if (!destinationPath) {
      continue;
    }

    await file.copy(bucket.file(destinationPath));
    restoredStorageFiles += 1;
  }

  return restoredStorageFiles;
}

async function deleteArchivedStorageFiles(bucket, archivePrefix) {
  if (!archivePrefix) {
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix: archivePrefix });
  let deletedStorageFiles = 0;

  for (const file of files) {
    if (!file.name || file.name.endsWith("/")) {
      continue;
    }

    await file.delete({ ignoreNotFound: true });
    deletedStorageFiles += 1;
  }

  return deletedStorageFiles;
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
  let deletedStorageFiles = 0;

  for (const file of files) {
    if (!shouldArchiveFile(file.name, prefix) || pathsToKeep.has(file.name)) {
      continue;
    }

    await file.delete({ ignoreNotFound: true });
    deletedStorageFiles += 1;
  }

  return deletedStorageFiles;
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
