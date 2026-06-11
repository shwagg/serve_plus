const DOCUMENT_ENTRY_FORMAT = "firestore-document-v1";

const ROOT_COLLECTIONS_TO_BACKUP = [
  "users",
  "missions",
  "auditLogs",
  "adminAnnouncements",
  "proposal",
  "proposalSubmission",
  "settings",
  "systemConfig",
  "support",
  "userMissions",
  "activityJournals",
  "badgeOverrides",
  "customBadges",
  "loginAttempts",
  "passwordResetAttempts",
  "mfaFactors",
  "mfaSessions",
];

async function backupCollectionTree(collectionRef) {
  const snapshot = await collectionRef.get();
  const documents = {};
  let totalDocuments = 0;

  for (const doc of snapshot.docs) {
    const { subcollections, totalDocuments: nestedDocuments } =
      await backupSubcollections(doc.ref);

    documents[doc.id] = {
      __backupMeta: { format: DOCUMENT_ENTRY_FORMAT },
      data: doc.data(),
      subcollections,
    };

    totalDocuments += 1 + nestedDocuments;
  }

  return { documents, totalDocuments };
}

async function backupSubcollections(docRef) {
  const subcollectionRefs = await docRef.listCollections();
  const subcollections = {};
  let totalDocuments = 0;

  for (const subcollectionRef of subcollectionRefs) {
    const result = await backupCollectionTree(subcollectionRef);
    subcollections[subcollectionRef.id] = result.documents;
    totalDocuments += result.totalDocuments;
  }

  return { subcollections, totalDocuments };
}

async function restoreCollectionTree(
  collectionRef,
  collectionData,
  restoreTimestamps,
  options = {},
) {
  const docEntries = Object.entries(collectionData || {});
  const backupDocIds = new Set(docEntries.map(([docId]) => docId));
  const preserveDocIds = options.preserveDocIds || new Set();
  let restoredDocuments = 0;
  const batchSize = 450;

  await deleteDocsMissingFromBackup(collectionRef, backupDocIds, preserveDocIds);

  for (let i = 0; i < docEntries.length; i += batchSize) {
    const batch = collectionRef.firestore.batch();
    const slice = docEntries.slice(i, i + batchSize);
    const nestedRestores = [];

    for (const [docId, rawEntry] of slice) {
      const docRef = collectionRef.doc(docId);
      const entry = normalizeBackupEntry(rawEntry);

      await deleteReferenceTree(docRef);
      batch.set(docRef, restoreTimestamps(entry.data));
      nestedRestores.push({ docRef, subcollections: entry.subcollections });
    }

    await batch.commit();
    restoredDocuments += slice.length;

    for (const nestedRestore of nestedRestores) {
      for (const [subcollectionName, subcollectionData] of Object.entries(
        nestedRestore.subcollections,
      )) {
        restoredDocuments += await restoreCollectionTree(
          nestedRestore.docRef.collection(subcollectionName),
          subcollectionData,
          restoreTimestamps,
        );
      }
    }
  }

  return restoredDocuments;
}

async function deleteDocsMissingFromBackup(
  collectionRef,
  backupDocIds,
  preserveDocIds,
) {
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    if (backupDocIds.has(doc.id) || preserveDocIds.has(doc.id)) {
      continue;
    }

    await deleteReferenceTree(doc.ref);
  }
}

async function deleteReferenceTree(ref) {
  const firestore = ref.firestore;
  if (typeof firestore.recursiveDelete === "function") {
    await firestore.recursiveDelete(ref);
    return;
  }

  await fallbackRecursiveDelete(ref);
}

async function fallbackRecursiveDelete(ref) {
  if (typeof ref.listCollections === "function") {
    const subcollections = await ref.listCollections();
    for (const subcollectionRef of subcollections) {
      await fallbackRecursiveDelete(subcollectionRef);
    }
    await ref.delete();
    return;
  }

  const snapshot = await ref.get();
  for (const doc of snapshot.docs) {
    await fallbackRecursiveDelete(doc.ref);
  }
}

function getBackupCollectionNames(backupData) {
  return Object.keys(backupData || {}).filter((key) => !key.startsWith("_"));
}

function normalizeBackupEntry(rawEntry) {
  if (
    rawEntry &&
    typeof rawEntry === "object" &&
    rawEntry.__backupMeta &&
    rawEntry.__backupMeta.format === DOCUMENT_ENTRY_FORMAT
  ) {
    return {
      data: rawEntry.data || {},
      subcollections: rawEntry.subcollections || {},
    };
  }

  return {
    data: rawEntry || {},
    subcollections: {},
  };
}

module.exports = {
  ROOT_COLLECTIONS_TO_BACKUP,
  backupCollectionTree,
  getBackupCollectionNames,
  restoreCollectionTree,
};
