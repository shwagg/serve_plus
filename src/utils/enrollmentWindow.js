/**
 * Returns true when `today` falls within the pre-enrollment window for an event.
 *
 * @param {string} today      - Current date as "YYYY-MM-DD"
 * @param {string} eventDate  - Event target date as "YYYY-MM-DD"
 * @param {number} windowDays - Number of days before event day that enrollment opens (0 = disabled)
 * @returns {boolean}
 */
export function isInPreEnrollmentWindow(today, eventDate, windowDays) {
  if (!eventDate || !windowDays || windowDays <= 0) return false;
  const eventMs = new Date(eventDate).getTime();
  const windowStart = new Date(eventMs - windowDays * 86400000).toLocaleDateString("en-CA");
  return today >= windowStart && today < eventDate;
}
