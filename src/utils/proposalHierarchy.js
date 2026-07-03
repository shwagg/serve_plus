export const CGC_DEPARTMENT = "Center for Guidance and Counseling (CGC)";
export const CLIR_DEPARTMENT = "Center for Learning and Information Resources (CLIR)";
export const SHS_DEPARTMENT = "Mapua MCL Senior High School (SHS)";

export const ACADEMIC_DEPARTMENTS = [
  "College of Arts and Science (CAS)",
  "College of Computer and Information Science (CCIS)",
  "College of Health Sciences (CHS)",
  "College of Nursing (CN)",
  "College of Maritime Education and Training (CMET)",
  "E.T. Yuchengco College of Business (ETYCB)",
  "Mapua-Laguna Institute of Aviation (MIA)",
  "Mapua Institute of Technology at Laguna (MITL)",
];

export const PROPOSAL_DEPARTMENTS = [
  ...ACADEMIC_DEPARTMENTS,
  SHS_DEPARTMENT,
  CGC_DEPARTMENT,
  CLIR_DEPARTMENT,
];

export function normalizeApprovalText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getUserUid(user = {}) {
  return user?.id || user?.uid || user?.userId || "";
}

export function getUserDisplayName(user = {}) {
  const fromParts = [
    user?.firstName,
    user?.middleInitial,
    user?.lastName,
  ].map((part) => String(part || "").trim()).filter(Boolean).join(" ");

  return user?.name || user?.fullName || user?.displayName || fromParts || user?.email || "";
}

export function getPositionList(user = {}) {
  const raw = user?.position || user?.positions || user?.Position || user?.Positions || "";
  if (Array.isArray(raw)) return raw;
  return raw ? [raw] : [];
}

function hasPosition(user, aliases) {
  const normalizedAliases = aliases.map(normalizeApprovalText);
  return getPositionList(user).some((position) =>
    normalizedAliases.includes(normalizeApprovalText(position))
  );
}

function getPrimaryPosition(user = {}) {
  return getPositionList(user)[0] || "";
}

function sameDepartment(user, department) {
  return normalizeApprovalText(user?.department) === normalizeApprovalText(department);
}

function isFaculty(user = {}) {
  return normalizeApprovalText(user?.role || user?.userRole || user?.Role) === "faculty";
}

function userMatchesName(user, name) {
  const target = normalizeApprovalText(name);
  if (!target) return false;
  return [
    getUserDisplayName(user),
    user?.email,
    user?.username,
  ].some((value) => normalizeApprovalText(value) === target);
}

function toSignatoryUser(user, label) {
  if (!user) return null;
  return {
    uid: getUserUid(user),
    name: getUserDisplayName(user),
    email: user.email || "",
    position: getPrimaryPosition(user),
    department: user.department || "",
    label,
  };
}

function findApprover(users, { aliases, department, label, allowNoDepartment = false }) {
  const matches = users.filter((user) => {
    if (!isFaculty(user) || !hasPosition(user, aliases)) return false;
    if (!department) return allowNoDepartment || !user.department;
    return sameDepartment(user, department) || (allowNoDepartment && !user.department);
  });

  return {
    matches,
    signatory: matches.length === 1 ? toSignatoryUser(matches[0], label) : null,
  };
}

const ACADEMIC_REVIEW_ALIASES = ["program chair", "cluster head", "college engagement head"];
const COLLEGE_DEAN_ALIASES = ["college dean"];
const CLIR_DIRECTOR_ALIASES = ["director"];
const VPAA_ALIASES = ["vpaa"];
const CGC_ENTRY_ALIASES = ["guidance counselor", "guidance councilor", "guidance facilitator"];
const CGC_DIRECTOR_ALIASES = ["director", "sao director", "director/sao", "director / sao"];
const VP_ALIASES = ["vp"];
const COO_ALIASES = ["coo"];

export function getAcademicReviewedByOptions(users, department) {
  return users
    .filter((user) => isFaculty(user) && sameDepartment(user, department) && hasPosition(user, ACADEMIC_REVIEW_ALIASES))
    .map((user) => toSignatoryUser(user, getPrimaryPosition(user) || "Program Chair"));
}

export function getAcademicRecommendedByOptions(users, department) {
  return users
    .filter((user) => isFaculty(user) && sameDepartment(user, department) && hasPosition(user, COLLEGE_DEAN_ALIASES))
    .map((user) => toSignatoryUser(user, "College Dean"));
}

export function findUserByUidOrName(users, uid, name) {
  if (uid) {
    const byUid = users.find((user) => getUserUid(user) === uid);
    if (byUid) return byUid;
  }
  if (name) return users.find((user) => userMatchesName(user, name)) || null;
  return null;
}

export function buildStudentSignatoryFlow({ users, reviewedByUid, reviewedByName, recommendedByUid, recommendedByName }) {
  const reviewedUser = findUserByUidOrName(users, reviewedByUid, reviewedByName);
  const recommendedUser = findUserByUidOrName(users, recommendedByUid, recommendedByName);

  return {
    reviewedBy: reviewedUser
      ? toSignatoryUser(reviewedUser, getPrimaryPosition(reviewedUser) || "Program Chair")
      : {
          uid: reviewedByUid || "",
          name: reviewedByName || "",
          email: "",
          position: "",
          department: "",
          label: "Program Chair",
        },
    recommendedBy: recommendedUser
      ? toSignatoryUser(recommendedUser, getPrimaryPosition(recommendedUser) || "College Dean")
      : {
          uid: recommendedByUid || "",
          name: recommendedByName || "",
          email: "",
          position: "",
          department: "",
          label: "College Dean",
        },
  };
}

function requireSingle(result, label) {
  if (result.matches.length === 0) return `No ${label} account was found for this approval route.`;
  if (result.matches.length > 1) return `Multiple ${label} accounts were found. Please keep exactly one account for this approval route.`;
  return "";
}

function buildFlowFromTargets(users, reviewedTarget, recommendedTarget) {
  const reviewedResult = findApprover(users, reviewedTarget);
  const recommendedResult = findApprover(users, recommendedTarget);
  const reviewedError = requireSingle(reviewedResult, reviewedTarget.label);
  const recommendedError = requireSingle(recommendedResult, recommendedTarget.label);

  if (reviewedError || recommendedError) {
    return {
      blocked: true,
      error: reviewedError || recommendedError,
      reviewedBy: reviewedResult.signatory,
      recommendedBy: recommendedResult.signatory,
    };
  }

  if (reviewedResult.signatory.uid && reviewedResult.signatory.uid === recommendedResult.signatory.uid) {
    return {
      blocked: true,
      error: "Reviewed By and Recommended By must be different people.",
      reviewedBy: reviewedResult.signatory,
      recommendedBy: recommendedResult.signatory,
    };
  }

  return {
    blocked: false,
    error: "",
    reviewedBy: reviewedResult.signatory,
    recommendedBy: recommendedResult.signatory,
  };
}

export function resolveFacultySignatoryFlow({ submitter, users, department }) {
  const submitterPosition = normalizeApprovalText(getPrimaryPosition(submitter));
  const submitterDepartment = department || submitter?.department || "";

  if (["vp", "coo"].includes(submitterPosition)) {
    return {
      blocked: true,
      error: "VP and COO accounts can approve proposals, but proposal submission is blocked until a higher approval route is defined.",
      reviewedBy: null,
      recommendedBy: null,
    };
  }

  if (!submitterDepartment) {
    return {
      blocked: true,
      error: "Your faculty account needs a department before proposal signatories can be resolved.",
      reviewedBy: null,
      recommendedBy: null,
    };
  }

  let reviewedTarget = null;
  let recommendedTarget = null;

  if (normalizeApprovalText(submitterDepartment) === normalizeApprovalText(CLIR_DEPARTMENT)) {
    if (submitterPosition === "librarian") {
      reviewedTarget = { aliases: CLIR_DIRECTOR_ALIASES, department: submitterDepartment, label: "Director" };
      recommendedTarget = { aliases: VPAA_ALIASES, department: CLIR_DEPARTMENT, label: "VPAA" };
    } else if (submitterPosition === "director") {
      reviewedTarget = { aliases: VPAA_ALIASES, department: CLIR_DEPARTMENT, label: "VPAA" };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (submitterPosition === "vpaa") {
      reviewedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
      recommendedTarget = { aliases: COO_ALIASES, label: "COO", allowNoDepartment: true };
    }
  } else if (normalizeApprovalText(submitterDepartment) === normalizeApprovalText(CGC_DEPARTMENT)) {
    if (CGC_ENTRY_ALIASES.includes(submitterPosition)) {
      reviewedTarget = { aliases: ["head"], department: CGC_DEPARTMENT, label: "Head" };
      recommendedTarget = { aliases: CGC_DIRECTOR_ALIASES, department: CGC_DEPARTMENT, label: "Director / SAO", allowNoDepartment: true };
    } else if (submitterPosition === "head") {
      reviewedTarget = { aliases: CGC_DIRECTOR_ALIASES, department: CGC_DEPARTMENT, label: "Director / SAO", allowNoDepartment: true };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (CGC_DIRECTOR_ALIASES.includes(submitterPosition)) {
      reviewedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
      recommendedTarget = { aliases: COO_ALIASES, label: "COO", allowNoDepartment: true };
    }
  } else {
    if (["regular", "community chair"].includes(submitterPosition)) {
      reviewedTarget = { aliases: ACADEMIC_REVIEW_ALIASES, department: submitterDepartment, label: "Program Chair / Cluster Head / College Engagement Head" };
      recommendedTarget = { aliases: COLLEGE_DEAN_ALIASES, department: submitterDepartment, label: "College Dean" };
    } else if (ACADEMIC_REVIEW_ALIASES.includes(submitterPosition)) {
      reviewedTarget = { aliases: COLLEGE_DEAN_ALIASES, department: submitterDepartment, label: "College Dean" };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (submitterPosition === "college dean") {
      reviewedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
      recommendedTarget = { aliases: COO_ALIASES, label: "COO", allowNoDepartment: true };
    }
  }

  if (!reviewedTarget || !recommendedTarget) {
    return {
      blocked: true,
      error: `No approval hierarchy is configured for ${getPrimaryPosition(submitter) || "this faculty position"}.`,
      reviewedBy: null,
      recommendedBy: null,
    };
  }

  return buildFlowFromTargets(users, reviewedTarget, recommendedTarget);
}

function signatoryNameMatches(signatory, user) {
  if (!signatory?.name) return false;
  return userMatchesName(user, signatory.name);
}

export function getProposalSignatory(proposal = {}, field) {
  const flowSignatory = proposal.signatoryFlow?.[field];
  if (flowSignatory?.name || flowSignatory?.uid) return flowSignatory;

  if (field === "reviewedBy") {
    return {
      uid: proposal.selectedReviewedByUid || "",
      name: proposal.selectedReviewedBy || "",
      label: "Program Chair",
    };
  }

  if (field === "recommendedBy") {
    return {
      uid: proposal.selectedRecommendedByUid || "",
      name: proposal.selectedRecommendedBy || "",
      label: "College Dean",
    };
  }

  return null;
}

export function getProposalStepLabel(proposal = {}, field) {
  return getProposalSignatory(proposal, field)?.label ||
    (field === "reviewedBy" ? "Program Chair" : "College Dean");
}

export function isUserDesignatedForApprovalField(proposal = {}, user = {}, currentUid = "", field) {
  const signatory = getProposalSignatory(proposal, field);
  const hasUid = !!signatory?.uid;
  const uid = currentUid || getUserUid(user);

  if (hasUid) return !!uid && signatory.uid === uid;
  if (signatory?.name) return signatoryNameMatches(signatory, user);

  return false;
}

function getLegacyFacultyApprovalField(user = {}) {
  if (!isFaculty(user)) return null;
  if (hasPosition(user, ACADEMIC_REVIEW_ALIASES)) return "reviewedBy";
  if (hasPosition(user, COLLEGE_DEAN_ALIASES)) return "recommendedBy";
  return null;
}

export function getUserApprovalFieldForProposal(proposal = {}, user = {}, currentUid = "") {
  const role = normalizeApprovalText(user?.role || user?.userRole || user?.Role);

  if (role === "admin") {
    if (hasPosition(user, ["regular"])) return "endorsedBy";
    if (hasPosition(user, ["director"])) return "approvedBy";
    return null;
  }

  if (role !== "faculty") return null;

  if (isUserDesignatedForApprovalField(proposal, user, currentUid, "reviewedBy")) return "reviewedBy";
  if (isUserDesignatedForApprovalField(proposal, user, currentUid, "recommendedBy")) return "recommendedBy";

  const hasNewDesignations = !!(
    proposal.selectedReviewedByUid ||
    proposal.selectedRecommendedByUid ||
    proposal.signatoryFlow?.reviewedBy?.uid ||
    proposal.signatoryFlow?.recommendedBy?.uid ||
    proposal.signatoryFlow?.reviewedBy?.name ||
    proposal.signatoryFlow?.recommendedBy?.name
  );

  return hasNewDesignations ? null : getLegacyFacultyApprovalField(user);
}
