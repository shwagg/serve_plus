const DOCUMENT_ENTRY_FORMAT = "firestore-document-v1";
const {mapWithConcurrency} = require("./concurrency");

const BACKUP_DOCUMENT_CONCURRENCY = 25;
const BACKUP_SUBCOLLECTION_CONCURRENCY = 10;
const RESTORE_DELETE_CONCURRENCY = 20;
const RESTORE_NESTED_CONCURRENCY = 10;

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

  const totals = await mapWithConcurrency(
    snapshot.docs,
    BACKUP_DOCUMENT_CONCURRENCY,
    async (doc) => {
      const { subcollections, totalDocuments: nestedDocuments } =
        await backupSubcollections(doc.ref);

      documents[doc.id] = {
        __backupMeta: { format: DOCUMENT_ENTRY_FORMAT },
        data: doc.data(),
        subcollections,
      };

      return 1 + nestedDocuments;
    },
  );

  const totalDocuments = totals.reduce((sum, count) => sum + count, 0);

  return { documents, totalDocuments };
}

async function backupSubcollections(docRef) {
  const subcollectionRefs = await docRef.listCollections();
  const subcollections = {};

  const totals = await mapWithConcurrency(
    subcollectionRefs,
    BACKUP_SUBCOLLECTION_CONCURRENCY,
    async (subcollectionRef) => {
      const result = await backupCollectionTree(subcollectionRef);
      subcollections[subcollectionRef.id] = result.documents;
      return result.totalDocuments;
    },
  );

  const totalDocuments = totals.reduce((sum, count) => sum + count, 0);

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

    await mapWithConcurrency(slice, RESTORE_DELETE_CONCURRENCY, async (
      [docId],
    ) => {
      await deleteReferenceTree(collectionRef.doc(docId));
    });

    for (const [docId, rawEntry] of slice) {
      const docRef = collectionRef.doc(docId);
      const entry = normalizeBackupEntry(rawEntry);

      batch.set(docRef, restoreTimestamps(entry.data));
      nestedRestores.push({ docRef, subcollections: entry.subcollections });
    }

    await batch.commit();
    restoredDocuments += slice.length;

    const nestedTasks = nestedRestores.flatMap((nestedRestore) => {
      return Object.entries(nestedRestore.subcollections).map(
        ([subcollectionName, subcollectionData]) => ({
          docRef: nestedRestore.docRef,
          subcollectionName,
          subcollectionData,
        }),
      );
    });
    const nestedCounts = await mapWithConcurrency(
      nestedTasks,
      RESTORE_NESTED_CONCURRENCY,
      async ({docRef, subcollectionName, subcollectionData}) => {
        return restoreCollectionTree(
          docRef.collection(subcollectionName),
          subcollectionData,
          restoreTimestamps,
        );
      },
    );
    restoredDocuments += nestedCounts.reduce((sum, count) => sum + count, 0);
  }

  return restoredDocuments;
}

async function deleteDocsMissingFromBackup(
  collectionRef,
  backupDocIds,
  preserveDocIds,
) {
  const snapshot = await collectionRef.get();

  const docsToDelete = snapshot.docs.filter((doc) => {
    if (backupDocIds.has(doc.id) || preserveDocIds.has(doc.id)) {
      return false;
    }

    return true;
  });

  await mapWithConcurrency(docsToDelete, RESTORE_DELETE_CONCURRENCY, (doc) => {
    return deleteReferenceTree(doc.ref);
  });
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
    await mapWithConcurrency(
      subcollections,
      RESTORE_NESTED_CONCURRENCY,
      fallbackRecursiveDelete,
    );
    await ref.delete();
    return;
  }

  const snapshot = await ref.get();
  await mapWithConcurrency(
    snapshot.docs,
    RESTORE_DELETE_CONCURRENCY,
    (doc) => fallbackRecursiveDelete(doc.ref),
  );
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
