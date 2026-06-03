// Saving computation to firestore such as updating
// user account 'totalPoints' and in mission 'pointsEarned'
import { doc, getDoc, getDocs, collection, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { getAuth } from "firebase/auth";
import { computeFinalPoints, getLevelInfo } from "../../hooks/rewardSystem";
import { checkAndAssignBadges } from "../../hooks/badgeSystem";
import { logAudit } from "../../utils/auditLogger";
import { createNotification } from "../../utils/notificationUtils";

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

    const breakdown = computeFinalPoints(role, avgRating, "verified");

    const finalPoints = breakdown.finalPoints;

    // Sum approved task-journal points for this volunteer
    const tasksSnap = await getDocs(collection(db, "missions", missionId, "task"));
    let approvedTaskPoints = 0;
    for (const taskDoc of tasksSnap.docs) {
        const pRef = doc(db, "missions", missionId, "task", taskDoc.id, "participants", volunteerId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists() && pSnap.data().adminApprovalStatus === "approved") {
            approvedTaskPoints += Number(pSnap.data().pendingPoints) || 0;
        }
    }
    approvedTaskPoints = Math.min(30, approvedTaskPoints);
    const basePoints = finalPoints + approvedTaskPoints;

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

        // Returning participant bonus: rewards students who keep coming back across missions.
        // 2nd mission = +5%, 3rd+ = +10% of base role points. No time window — fits
        // the school-year schedule where only 2 projects are offered per year.
        const missionsCompletedSoFar = uData.missionsCompleted || 0;
        const returningPct = missionsCompletedSoFar >= 2 ? 0.10 : missionsCompletedSoFar === 1 ? 0.05 : 0;
        const returningBonus = returningPct > 0 ? Math.round(finalPoints * returningPct * 10) / 10 : 0;

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

        totalBonusPoints = returningBonus + termStreakBonus + roleDiversityBonus + sdgBonus;
        levelAfter = getLevelInfo(ptsBefore + basePoints + totalBonusPoints).level;

        userUpdateExtras = {
            missionsCompleted: increment(1),
            missionReleaseDates: arrayUnion(new Date().toISOString()),
            ...(newRoles.length > 0 ? { rolesCompleted: arrayUnion(...newRoles) } : {}),
            ...(newSdgs.length > 0 ? { sdgsContributed: arrayUnion(...newSdgs) } : {}),
        };

        if (returningBonus > 0) bonusBreakdown.returning = { amount: returningBonus, pct: Math.round(returningPct * 100) };
        if (termStreakBonus > 0) bonusBreakdown.termStreak = { amount: termStreakBonus };
        if (roleDiversityBonus > 0) bonusBreakdown.roleDiversity = { amount: roleDiversityBonus };
        if (sdgBonus > 0) bonusBreakdown.sdg = { amount: sdgBonus, count: newSdgs.length };
    }

    const releasedPoints = basePoints + totalBonusPoints;

    // Requirement bonuses are already in the user's totalPoints (awarded at completion time).
    // We read them here only to include in the history panel display total.
    const requirementBonus = volunteerData.requirementBonus || {};
    const requirementPoints = Object.values(requirementBonus).reduce((sum, v) => sum + (Number(v) || 0), 0);

    const totalPoints = releasedPoints;

    // Increment user totalPoints + persist bonus-tracking fields
    if (volunteerData.userId) {
        await updateDoc(
            doc(db, "users", volunteerData.userId),
            {
                totalPoints: increment(totalPoints),
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
        pointsEarned: totalPoints,
        completionStatus: "graded",
        releasedAt: serverTimestamp(),
        releasedBy: adminName,
        roles: Array.isArray(rawRole) ? rawRole : [rawRole],
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
        pointsEarned: totalPoints,
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
    const displayTotal = totalPoints + requirementPoints;
    if (volunteerData.userId && displayTotal > 0) {
        await createNotification(volunteerData.userId, {
            type: "bonus_earned",
            title: "Points Released!",
            message: `You earned ${displayTotal} points from this mission!`,
            popupShown: false,
            missionId,
            missionTitle: missionData.title || "Mission",
            totalPoints: displayTotal,
            basePoints,
            requirementPoints,
            bonuses: bonusBreakdown,
        });
    }

    // Check and assign any newly earned badges after grading
    await checkAndAssignBadges(volunteerId);

    return totalPoints;
};
