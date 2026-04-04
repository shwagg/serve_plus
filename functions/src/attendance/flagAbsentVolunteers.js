const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");

const FLAG_DURATION_DAYS = 30;

/**
 * Core logic: scan all past published missions and flag volunteers who missed attendance.
 * Skips volunteers already processed for a given mission.
 */
async function runFlagCheck(db) {
  const now = new Date();

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 1);

  const missionsSnap = await db
    .collection("missions")
    .where("status", "==", "published")
    .get();

  let flaggedCount = 0;

  for (const missionDoc of missionsSnap.docs) {
    const mission = missionDoc.data();
    const missionId = missionDoc.id;

    // Parse targetDate
    let missionDate = null;
    if (mission.targetDate && typeof mission.targetDate.toDate === "function") {
      missionDate = mission.targetDate.toDate();
    } else if (typeof mission.targetDate === "string") {
      missionDate = new Date(mission.targetDate);
    } else if (mission.targetDate instanceof Date) {
      missionDate = mission.targetDate;
    }

    // Only process missions whose date has already passed
    if (!missionDate || missionDate >= cutoff) continue;

    const volunteersSnap = await db
      .collection("missions")
      .doc(missionId)
      .collection("volunteer")
      .where("registrationStatus", "==", "approved")
      .get();

    for (const volunteerDoc of volunteersSnap.docs) {
      const vData = volunteerDoc.data();
      const userId = volunteerDoc.id;

      // Skip volunteers who attended
      if (vData.progress?.attendance === "present") continue;

      // Skip if this specific mission was already processed (prevents double-flagging)
      if (vData.attendanceFlagProcessed === true) continue;

      const flagExpiry = new Date(now);
      flagExpiry.setDate(flagExpiry.getDate() + FLAG_DURATION_DAYS);

      // Fetch user display name for admin notification
      let userName = "A volunteer";
      try {
        const userSnap = await db.collection("users").doc(userId).get();
        if (userSnap.exists) {
          userName = userSnap.data()?.name || userName;
        }
      } catch (_) {}

      // Update user document with the flag
      try {
        await db
          .collection("users")
          .doc(userId)
          .set(
            {
              attendanceFlagged: true,
              attendanceFlaggedAt: admin.firestore.Timestamp.fromDate(now),
              attendanceFlagExpiry: admin.firestore.Timestamp.fromDate(flagExpiry),
              attendanceFlaggedMissionId: missionId,
              attendanceFlaggedMissionTitle: mission.title || "a mission",
            },
            { merge: true }
          );
      } catch (err) {
        console.error(`Failed to flag user ${userId}:`, err);
        continue;
      }

      // Mark volunteer document so we don't re-process
      try {
        await db
          .collection("missions")
          .doc(missionId)
          .collection("volunteer")
          .doc(userId)
          .update({ attendanceFlagProcessed: true });
      } catch (_) {}

      // Notify the volunteer
      try {
        await db
          .collection("users")
          .doc(userId)
          .collection("notifications")
          .add({
            type: "attendance_flag",
            title: "Attendance Flag – Mission Restriction",
            message: `You missed attendance for "${mission.title || "a mission"}". You cannot join new missions for ${FLAG_DURATION_DAYS} days (until ${flagExpiry.toLocaleDateString("en-PH")}).`,
            link: `/event/${missionId}`,
            eventId: missionId,
            read: false,
            createdAt: admin.firestore.Timestamp.fromDate(now),
          });
      } catch (_) {}

      // Notify all admins
      try {
        const adminsSnap = await db
          .collection("users")
          .where("role", "==", "admin")
          .get();

        const adminNotifPromises = adminsSnap.docs.map((adminDoc) =>
          db
            .collection("users")
            .doc(adminDoc.id)
            .collection("notifications")
            .add({
              type: "attendance_flag_admin",
              title: "Volunteer Flagged for Absence",
              message: `${userName} missed attendance for "${mission.title || "a mission"}" and is restricted for ${FLAG_DURATION_DAYS} days.`,
              link: `/admin/event-monitoring/${missionId}`,
              eventId: missionId,
              flaggedUserId: userId,
              flaggedUserName: userName,
              read: false,
              createdAt: admin.firestore.Timestamp.fromDate(now),
            })
        );
        await Promise.allSettled(adminNotifPromises);
      } catch (_) {}

      flaggedCount++;
    }
  }

  return { flaggedCount };
}

/**
 * Scheduled: runs every day at 6 AM (Asia/Manila) to auto-flag absent volunteers.
 */
const scheduledFlagAbsentVolunteers = onSchedule(
  {
    schedule: "0 6 * * *",
    region: "asia-southeast1",
    timeZone: "Asia/Manila",
  },
  async () => {
    const db = admin.firestore();
    const result = await runFlagCheck(db);
    console.log(`[flagAbsent] Scheduled run complete. Flagged: ${result.flaggedCount}`);
  }
);

/**
 * Callable: admin can manually trigger the flag check from the dashboard.
 * Returns the number of newly flagged volunteers.
 */
const manualFlagAbsentVolunteers = async (request) => {
  const db = admin.firestore();
  const result = await runFlagCheck(db);
  return result;
};

module.exports = { scheduledFlagAbsentVolunteers, manualFlagAbsentVolunteers };
