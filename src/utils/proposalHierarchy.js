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

const ACADEMIC_REVIEW_ALIASES = ["program chair", "cluster head", "college engagement head"];
const COLLEGE_DEAN_ALIASES = ["college dean"];
const CLIR_DIRECTOR_ALIASES = ["director"];
const VPAA_ALIASES = ["vpaa"];
const CGC_ENTRY_ALIASES = ["guidance counselor", "guidance councilor", "guidance facilitator"];
const CGC_DIRECTOR_ALIASES = ["director", "sao director", "director/sao", "director / sao"];
const VP_ALIASES = ["vp"];
const COO_ALIASES = ["coo"];

export function normalizeApprovalText(value) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
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

function getNormalizedPositions(user = {}) {
  return getPositionList(user).map(normalizeApprovalText).filter(Boolean);
}

function getPrimaryPosition(user = {}) {
  return getPositionList(user)[0] || "";
}

function getUserDepartment(user = {}) {
  return user?.department || user?.Department || user?.affiliatedDepartment || user?.collegeDepartment || user?.college || "";
}

function isFaculty(user = {}) {
  return normalizeApprovalText(user?.role || user?.userRole || user?.Role) === "faculty";
}

function hasPosition(user, aliases) {
  const normalizedAliases = aliases.map(normalizeApprovalText);
  return getNormalizedPositions(user).some((position) => normalizedAliases.includes(position));
}

function getBestPositionRank(user, aliases) {
  const normalizedAliases = aliases.map(normalizeApprovalText);
  const userPositions = getNormalizedPositions(user);
  return normalizedAliases.findIndex((alias) => userPositions.includes(alias));
}

function getPositionLabel(user, aliases) {
  const rank = getBestPositionRank(user, aliases);
  return rank >= 0 ? aliases[rank] : getPrimaryPosition(user);
}

function sameDepartment(user, department) {
  return normalizeApprovalText(getUserDepartment(user)) === normalizeApprovalText(department);
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

function toSignatoryUser(user, label, positionOverride = "") {
  if (!user) return null;
  return {
    uid: getUserUid(user),
    name: getUserDisplayName(user),
    email: user.email || "",
    position: positionOverride || getPrimaryPosition(user),
    department: getUserDepartment(user),
    label,
  };
}

function findApprover(users, { aliases, department, label, allowNoDepartment = false }, selectedUid = "", selectedName = "") {
  const matches = users.filter((user) => {
    if (!isFaculty(user) || !hasPosition(user, aliases)) return false;
    const userDepartment = getUserDepartment(user);
    if (!department) return allowNoDepartment || !userDepartment;
    return sameDepartment(user, department) || (allowNoDepartment && !userDepartment);
  });

  const rankedMatches = matches
    .map((user) => ({ user, rank: getBestPositionRank(user, aliases) }))
    .filter(({ rank }) => rank >= 0);
  const bestRank = rankedMatches.reduce(
    (best, { rank }) => Math.min(best, rank),
    Number.POSITIVE_INFINITY,
  );
  const bestMatches = Number.isFinite(bestRank)
    ? rankedMatches.filter(({ rank }) => rank === bestRank)
    : [];
  const options = bestMatches.map(({ user }) =>
    toSignatoryUser(user, label, getPositionLabel(user, aliases)),
  );
  const selectedSignatory =
    (selectedUid && options.find((option) => option.uid === selectedUid)) ||
    (selectedName && options.find((option) => normalizeApprovalText(option.name) === normalizeApprovalText(selectedName))) ||
    null;

  return {
    matches,
    bestMatches,
    options,
    signatory: selectedSignatory || (options.length === 1 ? options[0] : null),
  };
}

function requireSingle(result, label) {
  if (result.matches.length === 0) return `No ${label} account was found for this approval route.`;
  if (result.signatory) return "";
  if (result.options.length > 1) return `Please select the ${label} for this proposal.`;
  return `Multiple ${label} accounts were found. Please select one account for this approval route.`;
}

function buildFlowFromTargets(users, reviewedTarget, recommendedTarget, selected = {}) {
  const reviewedResult = findApprover(
    users,
    reviewedTarget,
    selected.reviewedByUid,
    selected.reviewedByName,
  );
  const recommendedResult = findApprover(
    users,
    recommendedTarget,
    selected.recommendedByUid,
    selected.recommendedByName,
  );
  const reviewedError = requireSingle(reviewedResult, reviewedTarget.label);
  const recommendedError = requireSingle(recommendedResult, recommendedTarget.label);

  if (reviewedError || recommendedError) {
    return {
      blocked: true,
      error: reviewedError || recommendedError,
      reviewedBy: reviewedResult.signatory,
      recommendedBy: recommendedResult.signatory,
      reviewedByOptions: reviewedResult.options,
      recommendedByOptions: recommendedResult.options,
    };
  }

  if (reviewedResult.signatory.uid && reviewedResult.signatory.uid === recommendedResult.signatory.uid) {
    return {
      blocked: true,
      error: "Reviewed By and Recommended By must be different people.",
      reviewedBy: reviewedResult.signatory,
      recommendedBy: recommendedResult.signatory,
      reviewedByOptions: reviewedResult.options,
      recommendedByOptions: recommendedResult.options,
    };
  }

  return {
    blocked: false,
    error: "",
    reviewedBy: reviewedResult.signatory,
    recommendedBy: recommendedResult.signatory,
    reviewedByOptions: reviewedResult.options,
    recommendedByOptions: recommendedResult.options,
  };
}

export function getAcademicReviewedByOptions(users, department) {
  return users
    .filter((user) => isFaculty(user) && sameDepartment(user, department) && hasPosition(user, ACADEMIC_REVIEW_ALIASES))
    .map((user) => toSignatoryUser(user, getPositionLabel(user, ACADEMIC_REVIEW_ALIASES) || "Program Chair"));
}

export function getAcademicRecommendedByOptions(users, department) {
  return users
    .filter((user) => isFaculty(user) && sameDepartment(user, department) && hasPosition(user, COLLEGE_DEAN_ALIASES))
    .map((user) => toSignatoryUser(user, "College Dean", getPositionLabel(user, COLLEGE_DEAN_ALIASES)));
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
      ? toSignatoryUser(
          reviewedUser,
          getPositionLabel(reviewedUser, ACADEMIC_REVIEW_ALIASES) || "Program Chair",
          getPositionLabel(reviewedUser, ACADEMIC_REVIEW_ALIASES),
        )
      : {
          uid: reviewedByUid || "",
          name: reviewedByName || "",
          email: "",
          position: "",
          department: "",
          label: "Program Chair",
        },
    recommendedBy: recommendedUser
      ? toSignatoryUser(recommendedUser, "College Dean", getPositionLabel(recommendedUser, COLLEGE_DEAN_ALIASES))
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

export function resolveFacultySignatoryFlow({
  submitter,
  users,
  department,
  reviewedByUid = "",
  reviewedByName = "",
  recommendedByUid = "",
  recommendedByName = "",
}) {
  const submitterPositions = getNormalizedPositions(submitter);
  const submitterDepartment = department || getUserDepartment(submitter);
  const submitterHasPosition = (aliases) =>
    aliases.some((alias) => submitterPositions.includes(normalizeApprovalText(alias)));

  if (submitterHasPosition(["vp", "coo"])) {
    return {
      blocked: true,
      error: "VP and COO accounts can approve proposals, but proposal submission is blocked until a higher approval route is defined.",
      reviewedBy: null,
      recommendedBy: null,
      reviewedByOptions: [],
      recommendedByOptions: [],
    };
  }

  if (!submitterDepartment) {
    return {
      blocked: true,
      error: "Your faculty account needs a department before proposal signatories can be resolved.",
      reviewedBy: null,
      recommendedBy: null,
      reviewedByOptions: [],
      recommendedByOptions: [],
    };
  }

  let reviewedTarget = null;
  let recommendedTarget = null;

  if (normalizeApprovalText(submitterDepartment) === normalizeApprovalText(CLIR_DEPARTMENT)) {
    if (submitterHasPosition(["librarian"])) {
      reviewedTarget = { aliases: CLIR_DIRECTOR_ALIASES, department: submitterDepartment, label: "Director" };
      recommendedTarget = { aliases: VPAA_ALIASES, department: CLIR_DEPARTMENT, label: "VPAA" };
    } else if (submitterHasPosition(["director"])) {
      reviewedTarget = { aliases: VPAA_ALIASES, department: CLIR_DEPARTMENT, label: "VPAA" };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (submitterHasPosition(["vpaa"])) {
      reviewedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
      recommendedTarget = { aliases: COO_ALIASES, label: "COO", allowNoDepartment: true };
    }
  } else if (normalizeApprovalText(submitterDepartment) === normalizeApprovalText(CGC_DEPARTMENT)) {
    if (submitterHasPosition(CGC_ENTRY_ALIASES)) {
      reviewedTarget = { aliases: ["head"], department: CGC_DEPARTMENT, label: "Head" };
      recommendedTarget = { aliases: CGC_DIRECTOR_ALIASES, department: CGC_DEPARTMENT, label: "Director / SAO", allowNoDepartment: true };
    } else if (submitterHasPosition(["head"])) {
      reviewedTarget = { aliases: CGC_DIRECTOR_ALIASES, department: CGC_DEPARTMENT, label: "Director / SAO", allowNoDepartment: true };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (submitterHasPosition(CGC_DIRECTOR_ALIASES)) {
      reviewedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
      recommendedTarget = { aliases: COO_ALIASES, label: "COO", allowNoDepartment: true };
    }
  } else {
    if (submitterHasPosition(["regular", "community chair"])) {
      reviewedTarget = { aliases: ACADEMIC_REVIEW_ALIASES, department: submitterDepartment, label: "Program Chair" };
      recommendedTarget = { aliases: COLLEGE_DEAN_ALIASES, department: submitterDepartment, label: "College Dean" };
    } else if (submitterHasPosition(ACADEMIC_REVIEW_ALIASES)) {
      reviewedTarget = { aliases: COLLEGE_DEAN_ALIASES, department: submitterDepartment, label: "College Dean" };
      recommendedTarget = { aliases: VP_ALIASES, label: "VP", allowNoDepartment: true };
    } else if (submitterHasPosition(["college dean"])) {
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
      reviewedByOptions: [],
      recommendedByOptions: [],
    };
  }

  return buildFlowFromTargets(users, reviewedTarget, recommendedTarget, {
    reviewedByUid,
    reviewedByName,
    recommendedByUid,
    recommendedByName,
  });
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
