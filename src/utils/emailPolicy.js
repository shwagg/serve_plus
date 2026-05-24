export const ALLOWED_EMAIL_DOMAINS = [
  "@live.mcl.edu.ph",
  "@mcl.edu.ph",
  "@outlook.com",
  "@gmail.com",
];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAllowedEmailDomain(email) {
  const normalized = normalizeEmail(email);
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
}
