const STORAGE_PREFIXES_TO_BACKUP = [
  "chat-attachments/",
  "consents/",
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

async function restoreArchivedStorageFiles(bucket, archivePrefix) {
  if (!archivePrefix) {
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix: archivePrefix });
  let restoredStorageFiles = 0;

  for (const file of files) {
    if (!file.name || file.name.endsWith("/")) {
      continue;
    }

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

module.exports = {
  STORAGE_PREFIXES_TO_BACKUP,
  archiveStoragePrefixes,
  deleteArchivedStorageFiles,
  getStorageArchivePrefix,
  restoreArchivedStorageFiles,
};