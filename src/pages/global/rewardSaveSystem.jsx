// Saving computation to firestore such as updating
// user account 'totalPoints' and in mission 'pointsEarned'
import { doc, getDoc, getDocs, collection, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { getAuth } from "firebase/auth";
import { computeFinalPoints } from "../../hooks/rewardSystem";
import { checkAndAssignBadges } from "../../hooks/badgeSystem";
import { logAudit } from "../../utils/auditLogger";

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
    const avgRating = missionData.feedback?.avgRating;

    if (avgRating === undefined || avgRating === null) {
        throw new Error("Mission feedback not computed yet.");
    }

    const volunteerRef = doc(db, "missions", missionId, "volunteer", volunteerId);
    const volunteerSnap = await getDoc(volunteerRef);

    if (!volunteerSnap.exists()) {
        throw new Error("Volunteer not found.");
    }

    const volunteerData = volunteerSnap.data();
    if (volunteerData.releasedAt) {
        throw new Error("Points already released for this volunteer.");
    }

    if (!volunteerData.participationStatus) {
        throw new Error("Participation status not set.");
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

    // computeFinalPoints handles both string and array roles
    const role = rawRole;

    const normalizedParticipation =
        volunteerData.participationStatus?.toLowerCase();

    const breakdown = computeFinalPoints(
        role,
        avgRating,
        volunteerData.participationStatus?.toLowerCase()
    );

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
    const totalPoints = finalPoints + approvedTaskPoints;

    // Increment user totalPoints
    if (volunteerData.userId) {
        await updateDoc(
            doc(db, "users", volunteerData.userId),
            {
                totalPoints: increment(totalPoints)
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
      },
    });

    // Check and assign any newly earned badges after grading
    await checkAndAssignBadges(volunteerId);

    return totalPoints;
};
