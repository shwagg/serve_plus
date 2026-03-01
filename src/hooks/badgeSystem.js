import { collection, doc, getDocs, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const checkAndAssignBadges = async (userId) => {
    try {
        // 1️⃣ Get all missions this user participated in
        const missionsSnapshot = await getDocs(collection(db, "missions"));

        let missionCount = 0;
        let verifiedCount = 0;
        let organizerCount = 0;

        for (const missionDoc of missionsSnapshot.docs) {
            const volunteerRef = doc(
                db,
                "missions",
                missionDoc.id,
                "volunteer",
                userId
            );

            const volunteerSnap = await getDoc(volunteerRef);

            if (!volunteerSnap.exists()) continue;

            const volunteerData = volunteerSnap.data();

            // Count completed mission
            if (
                volunteerData.progress?.attendance === "present" &&
                volunteerData.participationStatus !== "no_show"
            ) {
                missionCount++;
            }

            // Count verified missions
            if (volunteerData.participationStatus === "verified") {
                verifiedCount++;
            }

            // Count organizer roles
            if (
                volunteerData.role === "organizer" ||
                volunteerData.role === "lead organizer"
            ) {
                organizerCount++;
            }
        }

        // 2️⃣ Get all active badges
        const badgeSnapshot = await getDocs(collection(db, "badges"));

        for (const badgeDoc of badgeSnapshot.docs) {
            const badge = badgeDoc.data();

            if (badge.archived || badge.type !== "automatic") continue;

            let qualifies = false;

            if (badge.ruleType === "mission_count") {
                qualifies = missionCount >= badge.threshold;
            }

            if (badge.ruleType === "verified_count") {
                qualifies = verifiedCount >= badge.threshold;
            }

            if (badge.ruleType === "organizer_count") {
                qualifies = organizerCount >= badge.threshold;
            }

            if (!qualifies) continue;

            // 3️⃣ Check if user already has badge
            const userBadgeRef = doc(
                db,
                "users",
                userId,
                "badges",
                badgeDoc.id
            );

            const userBadgeSnap = await getDoc(userBadgeRef);

            if (userBadgeSnap.exists()) continue;

            // 4️⃣ Award badge
            await setDoc(userBadgeRef, {
                badgeId: badgeDoc.id,
                nameSnapshot: badge.name,
                category: badge.category,
                earnedAt: new Date()
            });

            // 5️⃣ Increment awardedCount
            await updateDoc(doc(db, "badges", badgeDoc.id), {
                awardedCount: increment(1),
                locked: true
            });
        }

    } catch (error) {
        console.error("Badge assignment error:", error);
    }
};