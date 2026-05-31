import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

export async function createNotification(userId, notificationData) {
  const notificationsRef = collection(db, "users", userId, "notifications");
  await addDoc(notificationsRef, {
    ...notificationData,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyUsersByRoles(roles, notificationData) {
  if (!roles || roles.length === 0) return;

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "in", roles));
  const snapshot = await getDocs(q);

  await Promise.allSettled(
    snapshot.docs.map((docSnap) => createNotification(docSnap.id, notificationData))
  );
}

export async function notifyEventParticipants(missionId, notificationData) {
  if (!missionId) return;

  try {
    // Get all volunteers who joined this mission
    const volunteersRef = collection(db, "missions", missionId, "volunteer");
    const volunteersSnapshot = await getDocs(volunteersRef);

    await Promise.allSettled(
      volunteersSnapshot.docs.map((docSnap) => createNotification(docSnap.id, {
        ...notificationData,
        eventId: missionId,
      }))
    );
  } catch (error) {
    console.error("Error notifying event participants:", error);
    throw error;
  }
}

export async function markNotificationAsRead(userId, notificationId) {
  const notificationRef = doc(db, "users", userId, "notifications", notificationId);
  await updateDoc(notificationRef, { read: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsAsRead(userId) {
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, where("read", "==", false));
  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, {
    read: true,
    readAt: serverTimestamp(),
  }));
  await Promise.all(updates);
}

export async function cleanupOldReadNotifications(userId) {
  if (!userId) return;
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, where("read", "==", true));
  const snapshot = await getDocs(q);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const deletions = snapshot.docs.filter((docSnap) => {
    const data = docSnap.data();
    const readAt = data.readAt?.toDate?.() || data.createdAt?.toDate?.();
    return readAt && readAt.getTime() <= cutoff;
  });

  await Promise.all(deletions.map((docSnap) => deleteDoc(docSnap.ref)));
}

export function subscribeToNotifications(userId, callback) {
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate?.(),
      readAt: docSnap.data().readAt?.toDate?.(),
    }));
    callback(notifications);
  });
}

function parseMissionTargetDate(rawTargetDates, now = new Date()) {
  const parseOne = (value) => {
    if (!value) return null;
    if (value?.toDate && typeof value.toDate === 'function') {
      const date = value.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Prefer local-date parsing for YYYY-MM-DD to avoid UTC shifting.
      const match = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
      if (match) {
        const [year, month, day] = trimmed.split('-').map(Number);
        const local = new Date(year, month - 1, day);
        return Number.isNaN(local.getTime()) ? null : local;
      }
      const date = new Date(trimmed);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  if (Array.isArray(rawTargetDates)) {
    const parsed = rawTargetDates
      .map(parseOne)
      .filter(Boolean)
      .sort((a, b) => a - b);
    const nextUpcoming = parsed.find((d) => d > now);
    return nextUpcoming ?? null;
  }

  return parseOne(rawTargetDates);
}

// Check for upcoming events and create notifications
export async function checkUpcomingEvents(userId) {
  try {
    console.log('[checkUpcomingEvents] Starting check for user:', userId);
    
    // Get user's registered events
    const missionsRef = collection(db, "missions");
    const missionsSnapshot = await getDocs(missionsRef);
    
    console.log('[checkUpcomingEvents] Found missions:', missionsSnapshot.size);
    
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    console.log('[checkUpcomingEvents] Date range:', {
      now: now.toISOString(),
      oneWeekFromNow: oneWeekFromNow.toISOString()
    });
    
    for (const missionDoc of missionsSnapshot.docs) {
      const missionData = missionDoc.data();
      const missionId = missionDoc.id;
      
      console.log(`[checkUpcomingEvents] Checking mission ${missionId}:`, missionData.title);
      
      // Check if user is registered for this event
      const volunteerDocRef = doc(db, "missions", missionId, "volunteer", userId);
      const volunteerDoc = await getDoc(volunteerDocRef);
      
      console.log(`[checkUpcomingEvents] User registered for ${missionId}:`, volunteerDoc.exists());
      
      if (!volunteerDoc.exists()) continue;
      
      // Check if event is within 1 week
      const eventDate = parseMissionTargetDate(missionData.targetDates, now);
      console.log(`[checkUpcomingEvents] Event date for ${missionId}:`, eventDate, 'Raw type:', typeof missionData.targetDates);

      if (!eventDate) {
        console.log(`[checkUpcomingEvents] Mission ${missionId} has invalid targetDates:`, missionData.targetDates);
        continue;
      }
      
      if (eventDate <= oneWeekFromNow && eventDate > now) {
        // Calculate days until event
        const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        
        console.log(`[checkUpcomingEvents] Event ${missionId} is upcoming (${daysUntil} days)`);
        
        // Check if notification already exists for this event
        const notificationsRef = collection(db, "users", userId, "notifications");
        const existingQuery = query(
          notificationsRef,
          where("type", "==", "event_upcoming"),
          where("eventId", "==", missionId)
        );
        const existingNotifications = await getDocs(existingQuery);
        
        console.log(`[checkUpcomingEvents] Existing notifications for ${missionId}:`, existingNotifications.size);
        
        // Only create if no notification exists yet
        if (existingNotifications.empty) {
          console.log(`[checkUpcomingEvents] Creating notification for ${missionId}`);
          await createNotification(userId, {
            type: "event_upcoming",
            title: "Event Coming Up Soon!",
            message: `${missionData.title || "Your event"} is ${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`,
            link: `/event/${missionId}`,
            eventId: missionId,
          });
          console.log(`[checkUpcomingEvents] Notification created successfully`);
        }
      } else {
        console.log(`[checkUpcomingEvents] Event ${missionId} not in range:`, {
          eventDate,
          isBeforeOneWeek: eventDate <= oneWeekFromNow,
          isAfterNow: eventDate > now
        });
      }
    }
    console.log('[checkUpcomingEvents] Check complete');
  } catch (error) {
    console.error("Error checking upcoming events:", error);
  }
}

// Check for overdue reflections and create notifications
export async function checkOverdueReflections(userId) {
  try {
    console.log('[checkOverdueReflections] Starting check for user:', userId);
    
    // Get all missions
    const missionsRef = collection(db, "missions");
    const missionsSnapshot = await getDocs(missionsRef);
    
    const now = new Date();
    
    for (const missionDoc of missionsSnapshot.docs) {
      const missionId = missionDoc.id;
      
      // Check if user is registered for this event
      const volunteerDocRef = doc(db, "missions", missionId, "volunteer", userId);
      const volunteerDoc = await getDoc(volunteerDocRef);
      
      if (!volunteerDoc.exists()) continue;
      
      // Get all tasks for this mission
      const tasksRef = collection(db, "missions", missionId, "task");
      const tasksSnapshot = await getDocs(tasksRef);
      
      for (const taskDoc of tasksSnapshot.docs) {
        const taskData = taskDoc.data();
        const taskId = taskDoc.id;
        
        // Skip if no due date
        if (!taskData.dueDate) continue;
        
        const dueDate = new Date(taskData.dueDate);
        
        // Check if deadline has passed
        if (dueDate < now) {
          // Check if user has submitted reflection
          const participantRef = doc(
            db,
            "missions",
            missionId,
            "task",
            taskId,
            "participants",
            userId
          );
          const participantSnap = await getDoc(participantRef);
          
          // If no participant doc or no reflection, it's overdue
          const hasReflection = participantSnap.exists() && 
                               participantSnap.data().reflection && 
                               participantSnap.data().reflection.trim();
          
          if (!hasReflection) {
            // Check if notification already exists
            const notificationsRef = collection(db, "users", userId, "notifications");
            const existingQuery = query(
              notificationsRef,
              where("type", "==", "reflection_overdue"),
              where("taskId", "==", taskId),
              where("missionId", "==", missionId)
            );
            const existingNotifications = await getDocs(existingQuery);
            
            // Only create if no notification exists yet
            if (existingNotifications.empty) {
              console.log(`[checkOverdueReflections] Task ${taskId} overdue for mission ${missionId}`);
              await createNotification(userId, {
                type: "reflection_overdue",
                title: "Reflection Overdue",
                message: `Your reflection for "${taskData.title}" has passed its deadline.`,
                link: `/event/${missionId}/activity`,
                taskId: taskId,
                missionId: missionId,
              });
            }
          }
        }
      }
    }
    
    console.log('[checkOverdueReflections] Check complete');
  } catch (error) {
    console.error("Error checking overdue reflections:", error);
  }
}
