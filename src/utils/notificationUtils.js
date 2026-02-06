import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
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

export async function markNotificationAsRead(userId, notificationId) {
  const notificationRef = doc(db, "users", userId, "notifications", notificationId);
  await updateDoc(notificationRef, { read: true });
}

export async function markAllNotificationsAsRead(userId) {
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, where("read", "==", false));
  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, { read: true }));
  await Promise.all(updates);
}

export function subscribeToNotifications(userId, callback) {
  const notificationsRef = collection(db, "users", userId, "notifications");
  const q = query(notificationsRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate?.(),
    }));
    callback(notifications);
  });
}
