const DOCUMENT_ENTRY_FORMAT = "firestore-document-v1";

const ROOT_COLLECTIONS_TO_BACKUP = [
  "users",
  "missions",
  "loginAttempts",
  "auditLogs",
  "proposal",
  "settings",
  "support",
  "userMissions"
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
) {
  const docEntries = Object.entries(collectionData || {});
  let restoredDocuments = 0;
  const batchSize = 450;

  for (let i = 0; i < docEntries.length; i += batchSize) {
    const batch = collectionRef.firestore.batch();
    const slice = docEntries.slice(i, i + batchSize);
    const nestedRestores = [];

    for (const [docId, rawEntry] of slice) {
      const docRef = collectionRef.doc(docId);
      const entry = normalizeBackupEntry(rawEntry);

      batch.set(docRef, restoreTimestamps(entry.data), { merge: true });
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
