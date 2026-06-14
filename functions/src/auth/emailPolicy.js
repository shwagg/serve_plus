const ALLOWED_EMAIL_DOMAINS = [
  "@live.mcl.edu.ph",
  "@mcl.edu.ph",
  "@outlook.com",
  "@gmail.com",
  "@outlook.ph",
];
const EMULATOR_EMAIL_DOMAINS = ["@test.com"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmulatorEmailDomain(email) {
  if (!process.env.FUNCTIONS_EMULATOR) return false;
  const normalized = normalizeEmail(email);
  return EMULATOR_EMAIL_DOMAINS.some((domain) =>
    normalized.endsWith(domain)
  );
}

function isAllowedEmailDomain(email) {
  const normalized = normalizeEmail(email);
  const allowedDomains = process.env.FUNCTIONS_EMULATOR
    ? ALLOWED_EMAIL_DOMAINS.concat(EMULATOR_EMAIL_DOMAINS)
    : ALLOWED_EMAIL_DOMAINS;
  return allowedDomains.some((domain) => normalized.endsWith(domain));
}

module.exports = {
  ALLOWED_EMAIL_DOMAINS,
  normalizeEmail,
  isEmulatorEmailDomain,
  isAllowedEmailDomain,
};
