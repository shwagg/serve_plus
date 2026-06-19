export const TASK_POINTS_LIMIT = 30;
export const MIN_GROUP_MEMBERS = 2;
export const MAX_GROUP_MEMBERS = 50;
export const TASK_TITLE_MAX_LENGTH = 64;
export const TASK_DESCRIPTION_MAX_LENGTH = 200;

const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export function clampWholeNumberInput(value, min, max) {
  const digitsOnly = String(value ?? "").replace(/\D/g, "");
  if (digitsOnly === "") return "";

  const parsed = parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed)) return "";

  return String(Math.min(max, Math.max(min, parsed)));
}

function parseRequiredWholeNumber(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  if (!WHOLE_NUMBER_PATTERN.test(rawValue)) return null;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) ? parsed : null;
}

export function validateTaskForm(
  formData,
  { maxPoints = TASK_POINTS_LIMIT, targetDate } = {},
) {
  const title = String(formData.title ?? "").trim();
  const description = String(formData.description ?? "").trim();
  const enrollmentDeadline = String(formData.enrollmentDeadline ?? "").trim();
  const type = formData.type || "individual";

  if (!title) {
    return { isValid: false, message: "Task title is required." };
  }

  if (title.length > TASK_TITLE_MAX_LENGTH) {
    return {
      isValid: false,
      message: `Task title must not exceed ${TASK_TITLE_MAX_LENGTH} characters.`,
    };
  }

  if (!description) {
    return { isValid: false, message: "Task description is required." };
  }

  if (description.length > TASK_DESCRIPTION_MAX_LENGTH) {
    return {
      isValid: false,
      message: `Task description must not exceed ${TASK_DESCRIPTION_MAX_LENGTH} characters.`,
    };
  }

  if (!enrollmentDeadline) {
    return { isValid: false, message: "Enrollment deadline time is required." };
  }

  if (!TIME_VALUE_PATTERN.test(enrollmentDeadline)) {
    return { isValid: false, message: "Enter a valid enrollment deadline time." };
  }

  if (!targetDate) {
    return {
      isValid: false,
      message: "Set a target date before adding an enrollment deadline time.",
    };
  }

  const points = parseRequiredWholeNumber(formData.points);
  if (points === null) {
    return { isValid: false, message: "Task points are required." };
  }

  if (points < 0 || points > maxPoints) {
    return {
      isValid: false,
      message: `Task points must be between 0 and ${maxPoints}.`,
    };
  }

  const values = { title, description, enrollmentDeadline, points, type };

  if (type === "grouped") {
    const maxParticipants = parseRequiredWholeNumber(formData.maxParticipants);
    if (maxParticipants === null) {
      return {
        isValid: false,
        message: "Max members per group is required.",
      };
    }

    if (maxParticipants < MIN_GROUP_MEMBERS || maxParticipants > MAX_GROUP_MEMBERS) {
      return {
        isValid: false,
        message: `Max members per group must be between ${MIN_GROUP_MEMBERS} and ${MAX_GROUP_MEMBERS}.`,
      };
    }

    values.maxParticipants = maxParticipants;
  }

  return { isValid: true, values };
}
