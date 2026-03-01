// Saving computation to firestore such as updating
// user account points
import { doc, getDoc, getDocs, collection, updateDoc, increment, serverTimestamp } from "firebase/firestore";
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

    if (avgRating === undefined || avgRating === null) {
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
            volunteerData.participationStatus?.toLowerCase()
        );

        console.log("Computed Final Points:", finalPoints);
        console.log("===========================");

        // Update user total points under user collection
        if (volunteerData.userId) {
            await updateDoc(
                doc(db, "users", volunteerData.userId),
                {
                    totalPoints: increment(finalPoints)
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
        released: true,
        "feedback.isActive": false
    });

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
    const rawRole = preData.engagement?.participation?.[0];

    if (!rawRole) {
        throw new Error("Role not found.");
    }

    const role = rawRole
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

    const normalizedParticipation =
        volunteerData.participationStatus?.toLowerCase();

    console.log("========== RELEASE DEBUG ==========");
    console.log("Volunteer ID:", volunteerId);
    console.log("Role (raw):", rawRole);
    console.log("Role (normalized):", role);
    console.log("Feedback avgRating:", avgRating);
    console.log("Participation Status (raw):", volunteerData.participationStatus);
    console.log("Participation Status (normalized):", normalizedParticipation);

    const finalPoints = computeFinalPoints(
        role,
        avgRating,
        normalizedParticipation
    );

    console.log("Final Points Computed:", finalPoints);
    console.log("===================================");

    // Increment user totalPoints
    if (volunteerData.userId) {
        await updateDoc(
            doc(db, "users", volunteerData.userId),
            {
                totalPoints: increment(finalPoints)
            }
        );
    }

    await updateDoc(volunteerRef, {
        pointsEarned: finalPoints
    });

    return finalPoints;
};
