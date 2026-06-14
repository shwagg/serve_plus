import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const FALLBACK_AGREEMENT_VERSION = "1.0";

export async function fetchCurrentAgreementVersion() {
  try {
    const snap = await getDoc(doc(db, "settings", "agreements"));
    if (snap.exists()) {
      return snap.data().version || FALLBACK_AGREEMENT_VERSION;
    }
  } catch (err) {
    console.warn("Could not fetch agreement version:", err);
  }
  return FALLBACK_AGREEMENT_VERSION;
}
