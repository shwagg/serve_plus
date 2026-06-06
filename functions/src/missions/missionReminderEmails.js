const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const {defineString} = require("firebase-functions/params");
const {onSchedule} = require("firebase-functions/v2/scheduler");

const MANILA_TIME_ZONE = "Asia/Manila";
const REGION = "asia-southeast1";
const VOLUNTEER_COLLECTION = "volunteer";
const SMTP_USER = defineString("SMTP_USER");
const SMTP_PASS = defineString("SMTP_PASS");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REMINDERS_BY_DAYS_AWAY = {
  3: {
    type: "3days",
    message: "This event is coming up in 3 days.",
  },
  1: {
    type: "1day",
    message: "This event is tomorrow.",
  },
  0: {
    type: "today",
    message: "This event is happening today.",
  },
};

const manilaDatePartsFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const manilaDisplayDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

function getManilaPartsFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const values = {};
  for (const part of manilaDatePartsFormatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function isValidDateParts(parts) {
  if (!parts?.year || !parts?.month || !parts?.day) return false;

  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return candidate.getUTCFullYear() === parts.year &&
    candidate.getUTCMonth() === parts.month - 1 &&
    candidate.getUTCDate() === parts.day;
}

function parseDateOnlyString(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  return isValidDateParts(parts) ? parts : null;
}

function getManilaDateParts(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return getManilaPartsFromDate(value.toDate());
  }

  if (value instanceof Date) {
    return getManilaPartsFromDate(value);
  }

  if (typeof value === "string") {
    // Date inputs from the app are saved as YYYY-MM-DD and should stay on
    // that Manila calendar day, not shift through UTC parsing.
    const dateOnlyParts = parseDateOnlyString(value);
    if (dateOnlyParts) return dateOnlyParts;

    const parsed = new Date(value);
    return getManilaPartsFromDate(parsed);
  }

  return null;
}

function toUtcDayNumber(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY;
}

function getDaysAway(todayParts, targetParts) {
  return toUtcDayNumber(targetParts) - toUtcDayNumber(todayParts);
}

function formatManilaDate(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return manilaDisplayDateFormatter.format(date);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isBlackboardProvider(value) {
  return String(value || "").trim().toLowerCase() === "blackboard";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getVolunteerName(userData, volunteerData) {
  return userData?.name ||
    userData?.fullName ||
    userData?.displayName ||
    volunteerData?.fullName ||
    volunteerData?.name ||
    volunteerData?.displayName ||
    "Volunteer";
}

function buildEmailPayload({
  fromAddress,
  email,
  volunteerName,
  missionTitle,
  eventDate,
  eventLocation,
  reminderMessage,
}) {
  const subject = `Event Reminder: ${missionTitle}`;
  const text = [
    'SERVE+',
    "",
    `Hello ${volunteerName},`,
    "",
    reminderMessage,
    "",
    `Mission: ${missionTitle}`,
    `Event date: ${eventDate}`,
    `Location: ${eventLocation}`,
  ].join("\n");

  // Keep the HTML simple so the email renders consistently across clients.
  const html = [
    `<p>Hello ${escapeHtml(volunteerName)},</p>`,
    `<p>${escapeHtml(reminderMessage)}</p>`,
    "<ul>",
    `<li><strong>Mission:</strong> ${escapeHtml(missionTitle)}</li>`,
    `<li><strong>Event date:</strong> ${escapeHtml(eventDate)}</li>`,
    `<li><strong>Location:</strong> ${escapeHtml(eventLocation)}</li>`,
    "</ul>",
  ].join("");

  return {
    from: fromAddress,
    to: email,
    subject,
    text,
    html,
  };
}

async function processVolunteer({
  db,
  missionRef,
  missionId,
  missionTitle,
  eventDate,
  eventLocation,
  reminder,
  volunteerDoc,
  mailTransporter,
  fromAddress,
  counters,
  log,
}) {
  counters.volunteersScanned += 1;

  const userId = volunteerDoc.id;
  const volunteerData = volunteerDoc.data();

  if (
    volunteerData.registrationStatus &&
    volunteerData.registrationStatus !== "approved"
  ) {
    counters.volunteersSkippedStatus += 1;
    return;
  }

  const logRef = missionRef
    .collection("reminderLogs")
    .doc(`${userId}_${reminder.type}`);
  // The per-volunteer reminder log prevents the scheduled job from sending
  // the same 3-day, 1-day, or same-day reminder more than once.
  const logSnap = await logRef.get();
  if (logSnap.exists) {
    counters.duplicateReminders += 1;
    return;
  }

  const userSnap = await db.collection("users").doc(userId).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  if (!isBlackboardProvider(userData.authProvider)) {
    counters.volunteersSkippedProvider += 1;
    return;
  }

  const email = normalizeEmail(userData.email || volunteerData.email);
  if (!email) {
    counters.volunteersSkippedEmail += 1;
    return;
  }

  const volunteerName = getVolunteerName(userData, volunteerData);
  const emailPayload = buildEmailPayload({
    fromAddress,
    email,
    volunteerName,
    missionTitle,
    eventDate,
    eventLocation,
    reminderMessage: reminder.message,
  });

  await mailTransporter.sendMail(emailPayload);

  await logRef.create({
    userId,
    email,
    reminderType: reminder.type,
    missionId,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  counters.emailsSent += 1;
  log.info("Mission reminder email sent", {
    missionId,
    userId,
    reminderType: reminder.type,
  });
}

async function runMissionReminderEmails(db, mailTransporter, options = {}) {
  const fromAddress = String(options.fromAddress || "").trim();
  if (!fromAddress) {
    throw new Error("SMTP sender address is required.");
  }

  const log = options.logger || logger;
  const todayParts = getManilaDateParts(options.now || new Date());
  const counters = {
    missionsScanned: 0,
    missionsSkippedNoTargetDate: 0,
    missionsSkippedDate: 0,
    volunteersScanned: 0,
    volunteersSkippedStatus: 0,
    volunteersSkippedProvider: 0,
    volunteersSkippedEmail: 0,
    duplicateReminders: 0,
    emailsSent: 0,
    emailFailures: 0,
  };

  const missionsSnap = await db
    .collection("missions")
    .where("status", "==", "published")
    .get();

  counters.missionsScanned = missionsSnap.size;

  for (const missionDoc of missionsSnap.docs) {
    const mission = missionDoc.data();
    const missionId = missionDoc.id;
    const targetParts = getManilaDateParts(mission.targetDate);

    if (!targetParts) {
      counters.missionsSkippedNoTargetDate += 1;
      log.warn("Skipping mission with missing or invalid targetDate", {
        missionId,
      });
      continue;
    }

    const daysAway = getDaysAway(todayParts, targetParts);
    const reminder = REMINDERS_BY_DAYS_AWAY[daysAway];
    if (!reminder) {
      counters.missionsSkippedDate += 1;
      continue;
    }

    const missionRef = db.collection("missions").doc(missionId);
    const missionTitle = mission.title || "Untitled Mission";
    const eventDate = formatManilaDate(targetParts);
    const eventLocation = mission.location || "TBA";

    let volunteersSnap;
    try {
      volunteersSnap = await missionRef.collection(VOLUNTEER_COLLECTION).get();
    } catch (err) {
      counters.emailFailures += 1;
      log.error("Failed to load mission volunteers", {
        missionId,
        message: err.message,
      });
      continue;
    }

    for (const volunteerDoc of volunteersSnap.docs) {
      try {
        await processVolunteer({
          db,
          missionRef,
          missionId,
          missionTitle,
          eventDate,
          eventLocation,
          reminder,
          volunteerDoc,
          mailTransporter,
          fromAddress,
          counters,
          log,
        });
      } catch (err) {
        counters.emailFailures += 1;
        log.error("Mission reminder email failed", {
          missionId,
          userId: volunteerDoc.id,
          reminderType: reminder.type,
          message: err.message,
        });
      }
    }
  }

  log.info("Mission reminder email run complete", counters);
  return counters;
}

const scheduledMissionReminderEmails = onSchedule(
  {
    // Cloud Scheduler runs this once per day at 2:10 AM in Manila.
    schedule: "10 2 * * *",
    region: REGION,
    timeZone: MANILA_TIME_ZONE,
    maxInstances: 1,
  },
  async () => {
    const db = admin.firestore();
    const smtpUser = SMTP_USER.value();
    const smtpPass = SMTP_PASS.value();

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP_USER and SMTP_PASS are required.");
    }

    const mailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    return runMissionReminderEmails(db, mailTransporter, {
      fromAddress: `SERVE+ <${smtpUser}>`,
    });
  },
);

module.exports = {
  scheduledMissionReminderEmails,
  runMissionReminderEmails,
  getManilaDateParts,
};
