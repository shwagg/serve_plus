// Saving computation to firestore such as updating
// user account 'totalPoints' and in mission 'pointsEarned'
import { doc, getDoc, getDocs, collection, updateDoc, increment, arrayUnion, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { getAuth } from "firebase/auth";
import { computeFinalPoints, getLevelInfo } from "../../hooks/rewardSystem";
import { getMissionPointsBreakdown, getRequirementPoints } from "../../hooks/missionPoints";
import { checkAndAssignBadges } from "../../hooks/badgeSystem";
import { logAudit } from "../../utils/auditLogger";
import { createNotification } from "../../utils/notificationUtils";

function normalizeMissionRoles(rawRoles) {
    const roles = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? [rawRoles] : []);
    return roles.map(role => String(role || "").trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
}

export const releaseMissionPoints = async (missionId) => {
    const volunteerSnap = await getDocs(
        collection(db, "missions", missionId, "volunteer")
    );

    for (const volunteerDoc of volunteerSnap.docs) {
        await releaseVolunteerPoints(missionId, volunteerDoc.id);
    }

    return true;
};

export const releaseVolunteerPoints = async (missionId, volunteerId) => {
    const missionRef = doc(db, "missions", missionId);
    const missionSnap = await getDoc(missionRef);

    if (!missionSnap.exists()) {
        throw new Error("Mission not found.");
    }

    const missionData = missionSnap.data();
    const avgRating = missionData.feedback?.avgRating ?? 0;

    const volunteerRef = doc(db, "missions", missionId, "volunteer", volunteerId);
    const volunteerSnap = await getDoc(volunteerRef);

    if (!volunteerSnap.exists()) {
        throw new Error("Volunteer not found.");
    }

    const volunteerData = volunteerSnap.data();
    if (volunteerData.releasedAt) {
        throw new Error("Points already released for this volunteer.");
    }

    const preDoc = await getDoc(
        doc(db, "missions", missionId, "volunteer", volunteerId, "preSurvey", "response")
    );

    if (!preDoc.exists()) {
        throw new Error("Pre-survey not found.");
    }

    const preData = preDoc.data();
    const rawRole = preData.engagement?.participation;

    if (!rawRole || (Array.isArray(rawRole) && rawRole.length === 0)) {
        throw new Error("Role not found.");
    }

    const role = rawRole;
    const normalizedRoles = normalizeMissionRoles(rawRole);

    const breakdown = computeFinalPoints(role, avgRating, "verified");

    const roleRatingPoints = breakdown.finalPoints;

    // Sum approved task-journal points for this volunteer
    const tasksSnap = await getDocs(collection(db, "missions", missionId, "task"));
    let approvedTaskPoints = 0;
    for (const taskDoc of tasksSnap.docs) {
        const pRef = doc(db, "missions", missionId, "task", taskDoc.id, "participants", volunteerId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists() && pSnap.data().adminApprovalStatus === "approved") {
            const participantData = pSnap.data();
            approvedTaskPoints += Number(participantData.pointsEarned) || Number(participantData.pendingPoints) || 0;
        }
    }
    approvedTaskPoints = Math.min(30, approvedTaskPoints);
    const storedTaskPoints = Number(volunteerData.taskPoints) || 0;
    const legacyTaskPoints = Number(volunteerData.pointsEarned) || 0;
    const taskPoints = Math.max(storedTaskPoints, legacyTaskPoints, approvedTaskPoints);

    // ── Bonus point computation ────────────────────────────────────────────
    let totalBonusPoints = 0;
    let userUpdateExtras = {};
    let levelBefore = 1;
    let levelAfter = 1;
    let bonusBreakdown = {};

    if (volunteerData.userId) {
        const userDocRef = doc(db, "users", volunteerData.userId);
        const userSnapBefore = await getDoc(userDocRef);
        const uData = userSnapBefore.exists() ? userSnapBefore.data() : {};
        const ptsBefore = uData.totalPoints || 0;
        levelBefore = getLevelInfo(ptsBefore).level;

        // Term streak bonus: +5 pts flat if the student has already completed ≥1 mission
        // in the past 3 months (i.e., this is their 2nd+ mission this term).
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const recentMissions = (uData.missionReleaseDates || []).filter(
            d => new Date(d) >= threeMonthsAgo
        );
        const termStreakBonus = recentMissions.length >= 1 ? 5 : 0;

        // Role diversity bonus: +5 pts first time completing each non-participant role
        const doneRoles = new Set(uData.rolesCompleted || []);
        const roleArray = Array.isArray(rawRole) ? rawRole : [rawRole];
        const newRoles = [];
        let roleDiversityBonus = 0;
        for (const r of roleArray) {
            const norm = r.trim().toLowerCase().replace(/\s+/g, "_");
            if (norm !== "participant" && !doneRoles.has(norm)) {
                roleDiversityBonus += 5;
                newRoles.push(norm);
            }
        }

        // SDG breadth bonus: +3 pts per unique SDG contributed to for the first time
        const doneSdgs = new Set(uData.sdgsContributed || []);
        const missionSdgs = missionData.sdgs || [];
        const newSdgs = [];
        let sdgBonus = 0;
        for (const sdg of missionSdgs) {
            if (!doneSdgs.has(sdg)) {
                sdgBonus += 3;
                newSdgs.push(sdg);
            }
        }

        totalBonusPoints = termStreakBonus + roleDiversityBonus + sdgBonus;
        levelAfter = getLevelInfo(ptsBefore + roleRatingPoints + totalBonusPoints).level;

        userUpdateExtras = {
            missionsCompleted: increment(1),
            missionReleaseDates: arrayUnion(new Date().toISOString()),
            ...(newRoles.length > 0 ? { rolesCompleted: arrayUnion(...newRoles) } : {}),
            ...(newSdgs.length > 0 ? { sdgsContributed: arrayUnion(...newSdgs) } : {}),
        };

        if (termStreakBonus > 0) bonusBreakdown.termStreak = { amount: termStreakBonus };
        if (roleDiversityBonus > 0) bonusBreakdown.roleDiversity = { amount: roleDiversityBonus };
        if (sdgBonus > 0) bonusBreakdown.sdg = { amount: sdgBonus, count: newSdgs.length };
    }

    const releaseDelta = roleRatingPoints + totalBonusPoints;
    const requirementPoints = getRequirementPoints(volunteerData);
    const missionPoints = requirementPoints + taskPoints + roleRatingPoints + totalBonusPoints;

    // Increment user totalPoints + persist bonus-tracking fields
    if (volunteerData.userId) {
        await updateDoc(
            doc(db, "users", volunteerData.userId),
            {
                totalPoints: increment(releaseDelta),
                ...userUpdateExtras,
            }
        );
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;

    let adminName = "Admin";

    if (currentUser) {
        const adminSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            adminName =
                adminData.name ||
                adminData.username ||
                currentUser.email;
        }
    }

    await updateDoc(volunteerRef, {
        pointsEarned: taskPoints + roleRatingPoints + totalBonusPoints,
        requirementPoints,
        taskPoints,
        roleRatingPoints,
        missionPoints,
        pointsBreakdown: {
            requirementPoints,
            taskPoints,
            roleRatingPoints,
            bonusPoints: totalBonusPoints,
            missionPoints,
            roleBasePoints: breakdown.base,
            feedbackMultiplier: breakdown.multiplier,
            participationFactor: breakdown.factor,
        },
        completionStatus: "graded",
        releasedAt: serverTimestamp(),
        releasedBy: adminName,
        roles: normalizedRoles,
        role: deleteField(),
        ...(totalBonusPoints > 0 ? { bonusPoints: totalBonusPoints } : {}),
    });

    logAudit({
      action: "POINTS_RELEASED",
      category: "reward",
      actorName: adminName,
      details: {
        missionId,
        targetUserId: volunteerId,
        targetUserName: volunteerData.displayName || volunteerData.name || "",
        pointsEarned: missionPoints,
        bonusPoints: totalBonusPoints,
      },
    });

    // Level-up notification if the student crossed a level threshold
    if (volunteerData.userId && levelAfter > levelBefore) {
        await createNotification(volunteerData.userId, {
            type: "level_up",
            title: "Level Up!",
            message: `You reached Level ${levelAfter}!`,
            newLevel: levelAfter,
            popupShown: false,
        });
    }

    // Points released notification — always shown when points > 0 so the student
    // sees their full breakdown (base + any bonuses earned this mission).
    if (volunteerData.userId && missionPoints > 0) {
        await createNotification(volunteerData.userId, {
            type: "bonus_earned",
            title: "Points Released!",
            message: `You earned ${missionPoints} points from this mission!`,
            popupShown: false,
            missionId,
            missionTitle: missionData.title || "Mission",
            totalPoints: missionPoints,
            basePoints: taskPoints + roleRatingPoints,
            requirementPoints,
            pointsBreakdown: getMissionPointsBreakdown({
                requirementPoints,
                taskPoints,
                roleRatingPoints,
                bonusPoints: totalBonusPoints,
                missionPoints,
            }),
            bonuses: bonusBreakdown,
        });
    }

    // Check and assign any newly earned badges after grading
    await checkAndAssignBadges(volunteerId);

    return missionPoints;
};
