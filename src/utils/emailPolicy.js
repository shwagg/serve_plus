export const ALLOWED_EMAIL_DOMAINS = [
  "@live.mcl.edu.ph",
  "@mcl.edu.ph",
  "@outlook.com",
  "@gmail.com",
  "@outlook.ph",
];
const EMULATOR_EMAIL_DOMAINS = ["@test.com"];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAllowedEmailDomain(email) {
  const normalized = normalizeEmail(email);
  const allowedDomains = import.meta.env.VITE_USE_EMULATORS === "true"
    ? ALLOWED_EMAIL_DOMAINS.concat(EMULATOR_EMAIL_DOMAINS)
    : ALLOWED_EMAIL_DOMAINS;
  return allowedDomains.some((domain) => normalized.endsWith(domain));
}
