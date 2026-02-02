import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Get all participants in a mission's chat subcollection
 * No duplicate participant array - single source of truth
 * @param {string} missionId - The ID of the mission
 * @returns {Promise<Object>} Object with arrays of volunteers, faculty, partners, and admins
 */
export async function getChatParticipants(missionId) {
  try {
    // Query all participant types
    const [volunteersSnap, adminsSnap, facultySnap, partnerSnap] = await Promise.all([
      getDocs(collection(db, "Missions", missionId, "volunteer")),
      getDocs(query(collection(db, "users"), where("role", "==", "admin"))),
      getDocs(collection(db, "Missions", missionId, "faculty")),
      getDocs(collection(db, "Missions", missionId, "partner"))
    ]);

    return {
      volunteers: volunteersSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().email || "Unknown",
        email: doc.data().email || "",
        role: "volunteer"
      })),
      admins: adminsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().displayName || "Admin",
        email: doc.data().email || "",
        role: "admin"
      })),
      faculty: facultySnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().email || "Unknown",
        email: doc.data().email || "",
        role: "faculty"
      })),
      partners: partnerSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().email || "Unknown",
        email: doc.data().email || "",
        role: "partner"
      }))
    };
  } catch (error) {
    console.error(`Error getting chat participants: ${error.message}`);
    return { volunteers: [], admins: [], faculty: [], partners: [] };
  }
}

/**
 * Get all participant user IDs as a flat array
 * @param {string} missionId - The ID of the mission
 * @returns {Promise<string[]>} Array of all participant user IDs
 */
export async function getChatParticipantIds(missionId) {
  try {
    const participants = await getChatParticipants(missionId);
    return [
      ...participants.volunteers.map(v => v.id),
      ...participants.admins.map(a => a.id),
      ...participants.faculty.map(f => f.id),
      ...participants.partners.map(p => p.id) 
    ];
  } catch (error) {
    console.error(`Error getting participant IDs: ${error.message}`);
    return [];
  }
}

/**
 * Check if a user is a participant in a mission's chat
 * @param {string} missionId - The ID of the mission
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} True if user is a participant
 */
export async function isUserChatParticipant(missionId, userId) {
  try {
    // Check if user is a volunteer
    const volunteerRef = doc(db, "Missions", missionId, "volunteer", userId);
    const volunteerSnap = await getDoc(volunteerRef);
    if (volunteerSnap.exists()) return true;

    // Check if user is admin
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().role === "admin") return true;

    // Check if user is faculty
    const facultyRef = doc(db, "Missions", missionId, "faculty", userId);
    const facultySnap = await getDoc(facultyRef);
    if (facultySnap.exists()) return true;

    // Check if user is partner
    const partnerRef = doc(db, "Missions", missionId, "partner", userId);
    const partnerSnap = await getDoc(partnerRef);
    if (partnerSnap.exists()) return true;
    
    return false;
  } catch (error) {
    console.error(`Error checking user participation: ${error.message}`);
    return false;
  }
}
