const MFA_SESSION_KEY = "serveplus:mfa-session";

export function saveMfaSession(session) {
  sessionStorage.setItem(MFA_SESSION_KEY, JSON.stringify(session));
}

export function readMfaSession() {
  const raw = sessionStorage.getItem(MFA_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    clearMfaSession();
    return null;
  }
}

export function clearMfaSession() {
  sessionStorage.removeItem(MFA_SESSION_KEY);
}

export function getMfaRouteForAction(action) {
  return action === "MFA_SETUP_REQUIRED" ?
    "/auth/mfa/setup" :
    "/auth/mfa/verify";
}
