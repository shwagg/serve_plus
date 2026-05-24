const ALLOWED_EMAIL_DOMAINS = [
  "@live.mcl.edu.ph",
  "@mcl.edu.ph",
  "@outlook.com",
  "@gmail.com",
];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAllowedEmailDomain(email) {
  const normalized = normalizeEmail(email);
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
}

module.exports = {
  ALLOWED_EMAIL_DOMAINS,
  normalizeEmail,
  isAllowedEmailDomain,
};
