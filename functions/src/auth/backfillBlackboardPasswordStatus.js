const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

function isBlackboardLinked(userData) {
  return (
    userData?.authProvider === "blackboard" ||
    Boolean(userData?.blackboardId || userData?.blackboardAuthUid)
  );
}

function hasPasswordProvider(userRecord) {
  return (userRecord.providerData || []).some(
    (provider) => provider.providerId === "password",
  );
}

async function assertAdminCaller(request) {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new Error("Authentication is required");
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== "admin" && role !== "sysadmin") {
    throw new Error("Admin access is required");
  }
}

async function commitBatch(batch, count) {
  if (count === 0) return;
  await batch.commit();
}

async function backfillBlackboardPasswordStatus(request) {
  await assertAdminCaller(request);

  const dryRun = request.data?.dryRun !== false;
  const usersSnap = await admin.firestore().collection("users").get();

  let checked = 0;
  let linked = 0;
  let changed = 0;
  let skippedMissingAuthUser = 0;
  let batch = admin.firestore().batch();
  let batchCount = 0;
  const samples = [];

  for (const userDoc of usersSnap.docs) {
    checked += 1;
    const userData = userDoc.data();

    if (!isBlackboardLinked(userData)) continue;
    linked += 1;

    let userRecord;
    try {
      userRecord = await admin.auth().getUser(userDoc.id);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        skippedMissingAuthUser += 1;
        continue;
      }
      throw error;
    }

    const nextHasServePassword = hasPasswordProvider(userRecord);
    if (userData.hasServePassword === nextHasServePassword) continue;

    changed += 1;
    if (samples.length < 10) {
      samples.push({
        uid: userDoc.id,
        email: userData.email || userRecord.email || null,
        from: userData.hasServePassword ?? null,
        to: nextHasServePassword,
      });
    }

    if (!dryRun) {
      batch.update(userDoc.ref, {
        hasServePassword: nextHasServePassword,
        passwordStatusBackfilledAt: FieldValue.serverTimestamp(),
      });
      batchCount += 1;

      if (batchCount >= 400) {
        await commitBatch(batch, batchCount);
        batch = admin.firestore().batch();
        batchCount = 0;
      }
    }
  }

  if (!dryRun) {
    await commitBatch(batch, batchCount);
  }

  return {
    dryRun,
    checked,
    linked,
    changed,
    skippedMissingAuthUser,
    samples,
  };
}

module.exports = { backfillBlackboardPasswordStatus };
