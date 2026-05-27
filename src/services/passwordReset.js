import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";
import { normalizeEmail } from "../utils/emailPolicy";

const BLACKBOARD_NO_PASSWORD_MESSAGE =
  "This Blackboard account does not have a SERVE+ password yet. Sign in with Blackboard and create one from Settings first.";
const UNVERIFIED_EMAIL_MESSAGE =
  "Please verify your email before resetting your password.";

export async function requestPasswordReset(email) {
  const resetPassword = httpsCallable(functions, "requestPasswordReset");
  await resetPassword({ email: normalizeEmail(email) });
}

export function getPasswordResetErrorMessage(error) {
  const message = error?.message || "";
  const code = error?.code || "";

  if (message.includes("Blackboard account")) {
    return BLACKBOARD_NO_PASSWORD_MESSAGE;
  }

  if (message.includes("verify your email")) {
    return UNVERIFIED_EMAIL_MESSAGE;
  }

  if (code.endsWith("invalid-argument")) {
    return "Please enter a valid email address.";
  }

  if (code.endsWith("permission-denied")) {
    return message || "Please use an accepted email address.";
  }

  return "Unable to send reset link. Please try again.";
}
