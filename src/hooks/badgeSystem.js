import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { AUTO_BADGE_RULES, BADGE_BY_ID } from "../constants/badgeDefinitions";
import { createNotification } from "../utils/notificationUtils";

/**
 * Compute a student's badge stats by scanning all missions they participated in.
 * Returns { totalCompleted, totalVerifiedActive, organizerCount, leadOrganizerCount }
 */
async function computeBadgeStats(userId) {
  const missionsSnapshot = await getDocs(collection(db, "missions"));

  let totalCompleted = 0;
  let totalVerifiedActive = 0;
  let organizerCount = 0;
  let leadOrganizerCount = 0;

  for (const missionDoc of missionsSnapshot.docs) {
    const volunteerRef = doc(db, "missions", missionDoc.id, "volunteer", userId);
    const volunteerSnap = await getDoc(volunteerRef);
    if (!volunteerSnap.exists()) continue;

    const v = volunteerSnap.data();
    const status = v.participationStatus;
    const role = v.role;

    // Milestone: Verified Active OR Partial
    if (status === "verified" || status === "partial") {
      totalCompleted++;
    }

    // Performance: Verified Active ONLY
    if (status === "verified") {
      totalVerifiedActive++;
    }

    // Leadership: completed missions as organizer or lead_organizer
    const isOrganizingRole =
      role === "organizer" ||
      role === "lead_organizer" ||
      role === "lead organizer";

    if (isOrganizingRole && (status === "verified" || status === "partial")) {
      organizerCount++;
      if (role === "lead_organizer" || role === "lead organizer") {
        leadOrganizerCount++;
      }
    }
  }

  return { totalCompleted, totalVerifiedActive, organizerCount, leadOrganizerCount };
}

/**
 * Evaluate and assign badges for a student after a mission is graded.
 * Returns an array of badge IDs that were newly earned.
 * Call this after any participation status is updated.
 */
export const checkAndAssignBadges = async (userId) => {
  try {
    const stats = await computeBadgeStats(userId);
    const userBadgesRef = collection(db, "users", userId, "badges");
    const existingSnap = await getDocs(userBadgesRef);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const newlyEarned = [];

    for (const rule of AUTO_BADGE_RULES) {
      const statValue = stats[rule.statField] ?? 0;
      if (statValue >= rule.threshold && !existingIds.has(rule.badgeId)) {
        await awardBadge(userId, rule.badgeId);
        newlyEarned.push(rule.badgeId);
      }
    }

    return newlyEarned;
  } catch (error) {
    console.error("Badge evaluation error:", error);
    return [];
  }
};

/**
 * Award a specific badge to a user and create a badge_earned notification.
 * Safe to call for both auto and manual badges.
 * Returns true if newly awarded, false if already had the badge.
 */
export const awardBadge = async (userId, badgeId, awardedBy = null) => {
  try {
    const userBadgeRef = doc(db, "users", userId, "badges", badgeId);
    const existing = await getDoc(userBadgeRef);
    if (existing.exists()) return false; // already earned — badges are permanent

    const definition = BADGE_BY_ID[badgeId];
    if (!definition) {
      console.warn(`awardBadge: unknown badgeId "${badgeId}"`);
      return false;
    }

    // Write badge record
    await setDoc(userBadgeRef, {
      badgeId,
      name: definition.name,
      category: definition.category,
      earnedAt: serverTimestamp(),
      ...(awardedBy ? { awardedBy } : {}),
    });

    // Create notification (bell + popup trigger)
    await createNotification(userId, {
      type: "badge_earned",
      title: "Badge Earned!",
      message: `You earned the "${definition.name}" badge.`,
      badgeId,
      popupShown: false,
    });

    return true;
  } catch (error) {
    console.error("awardBadge error:", error);
    return false;
  }
};

/**
 * Award the SERVE Ready badge on account verification.
 * Call this in your registration/verification flow.
 */
export const awardServeReadyBadge = async (userId) => {
  return awardBadge(userId, "serve-ready");
};

/**
 * Get all badge records for a student.
 */
export const getStudentBadges = async (userId) => {
  const snap = await getDocs(collection(db, "users", userId, "badges"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
