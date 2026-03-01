// Saving computation to firestore such as updating
// user account points
import { doc, getDoc, getDocs, collection, updateDoc, increment } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { computeFinalPoints } from "../../hooks/rewardSystem";
import { checkAndAssignBadges } from "../../hooks/badgeSystem";

export const releaseMissionPoints = async (missionId) => {
    const missionRef = doc(db, "missions", missionId);
    const missionSnap = await getDoc(missionRef);

    if (!missionSnap.exists()) {
        throw new Error("Mission not found.");
    }

    const missionData = missionSnap.data();
    const avgRating = missionData.feedback?.avgRating;

    if (!avgRating) {
        throw new Error("Mission feedback not computed yet.");
    }

    const volunteerSnap = await getDocs(
        collection(db, "missions", missionId, "volunteer")
    );

    for (const volunteerDoc of volunteerSnap.docs) {

        const volunteerData = volunteerDoc.data();

        if (!volunteerData.participationStatus) {
            console.log("❌ No participationStatus for:", volunteerDoc.id);
            continue;
        }

        // Getting role from preSurvey subcollection
        const preDoc = await getDoc(
            doc(db, "missions", missionId, "volunteer", volunteerDoc.id, "preSurvey", "response")
        );

        if (!preDoc.exists()) {
            console.log("❌ No preSurvey found for:", volunteerDoc.id);
            continue;
        }

        const preData = preDoc.data();

        const rawRole = preData.engagement?.participation?.[0];

        if (!rawRole) {
            console.log("❌ No role found in preSurvey for:", volunteerDoc.id);
            continue;
        }

        // depends on the choices from preSurvey
        const role = rawRole.trim().toLowerCase();
        // DEBUG LOGS
        console.log("========== DEBUG ==========");
        console.log("Volunteer ID:", volunteerDoc.id);
        console.log("Role (raw):", rawRole);
        console.log("Role (for rewardSystem):", role);
        console.log("Feedback avgRating:", avgRating);
        console.log("Participation Status:", volunteerData.participationStatus);

        const finalPoints = computeFinalPoints(
            role,
            avgRating,
            volunteerData.participationStatus
        );

        console.log("Computed Final Points:", finalPoints);
        console.log("===========================");

        // Update user total points
        if (volunteerData.userId) {
            await updateDoc(
                doc(db, "users", volunteerData.userId),
                {
                    pointsEarned: increment(finalPoints)
                }
            );
        }

        // Save under volunteer based on the mission joined
        await updateDoc(
            doc(db, "missions", missionId, "volunteer", volunteerDoc.id),
            {
                pointsEarned: finalPoints
            }
        );
    }

    // Check and assign badges after points are released
    for (const volunteerDoc of volunteerSnap.docs) {
        const volunteerData = volunteerDoc.data();
        if (volunteerData.userId) {
            await checkAndAssignBadges(volunteerData.userId);
        }
    }

    // After release points to user, locks the document lib to prevent future edit
    await updateDoc(missionRef, {
        released: true
    });

    return true;
};
