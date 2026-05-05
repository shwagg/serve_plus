/**
 * auditLogger.js
 * Central utility for writing audit log entries to Firestore.
 * Never throws — audit failures must never break the main application flow.
 *
 * Usage:
 *   import { logAudit } from "../../utils/auditLogger";
 *   logAudit({ action: "ROLE_CHANGED", category: "account", details: { ... } });
 *
 * Every entry written to the `auditLogs` collection will include:
 *   action      – snake-case event label   (e.g. "ROLE_CHANGED")
 *   category    – grouping key             (account | proposal | event | reward | system)
 *   actorUid    – UID of the person who performed the action
 *   actorEmail  – email of the performer
 *   actorName   – display name of the performer (if known)
 *   timestamp   – Firestore server timestamp
 *   ...details  – action-specific payload fields
 */

import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebaseConfig";

export async function logAudit({
  action,
  category,
  actorName,
  actorEmail,
  actorUid,
  details = {},
}) {
  try {
    const cu = getAuth().currentUser;
    const resolvedUid   = actorUid   != null ? actorUid   : (cu?.uid   ?? null);
    const resolvedEmail = actorEmail != null ? actorEmail : (cu?.email ?? null);

    // Resolve a human-readable name:
    // 1. Use explicitly passed actorName if it's a non-empty string
    // 2. Otherwise look up the users/{uid} document (email/password accounts have no displayName)
    // 3. Fall back to Firebase Auth displayName (for social-login accounts)
    let resolvedName = (typeof actorName === "string" && actorName.trim()) ? actorName.trim() : null;
    if (!resolvedName && resolvedUid) {
      try {
        const snap = await getDoc(doc(db, "users", resolvedUid));
        if (snap.exists()) {
          resolvedName = snap.data().name || snap.data().displayName || null;
        }
      } catch (_) { /* non-fatal */ }
    }
    if (!resolvedName) {
      resolvedName = cu?.displayName || null;
    }

    await addDoc(collection(db, "auditLogs"), {
      action,
      category,
      actorUid:   resolvedUid,
      actorEmail: resolvedEmail,
      actorName:  resolvedName,
      details,          // stored as a nested map, not spread
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[Audit] Failed to write log:", e);
  }
}
