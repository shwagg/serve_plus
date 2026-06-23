import React, { useEffect, useRef, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc, deleteField, increment } from "firebase/firestore";
import { checkAndAssignBadges } from "../../hooks/badgeSystem";
import { computeFinalPoints, getProgramMultiplier, ROLE_POINTS } from "../../hooks/rewardSystem";
import { getMissionPointsBreakdown } from "../../hooks/missionPoints";
import { releaseVolunteerPoints } from "../global/rewardSaveSystem";
import { showToast } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";
import { createNotification } from "../../utils/notificationUtils";
import { issueCertificate } from "../../utils/certificateUtils";

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getInitials(name) {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

const ROLE_LABELS = {
  lead_organizer: "Lead Organizer",
  organizer: "Organizer",
  donor: "Donor",
};
const ROLE_PRIORITY = ["lead_organizer", "organizer", "donor"];

function hasTaskPhoto(data = {}) {
  return !!data?.taskPhoto?.url;
}

function hasLegacyReflection(data = {}) {
  return !data?.legacyReflectionArchived && String(data?.reflection || "").trim().length > 0;
}

function hasTaskProof(data = {}) {
  return hasTaskPhoto(data) || hasLegacyReflection(data);
}

function getProofKind(data = {}) {
  return hasTaskPhoto(data) ? "photo" : "legacy_reflection";
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function getVolunteerRoles(v = {}) {
  const sourceRoles = Array.isArray(v.roles) && v.roles.length > 0
    ? v.roles
    : (v.role ? [v.role] : []);
  return sourceRoles.map(normalizeRole).filter(Boolean);
}

function getSurveyRoles(v = {}) {
  return (v.preSurveyAnswers?.engagement?.participation || []).map(normalizeRole).filter(Boolean);
}

function getDisplayRoles(v = {}) {
  const roles = getVolunteerRoles(v).length > 0 ? getVolunteerRoles(v) : getSurveyRoles(v);
  return roles.filter(r => r !== "participant");
}

function isDonorOnly(v = {}) {
  const roles = getVolunteerRoles(v).length > 0 ? getVolunteerRoles(v) : getSurveyRoles(v);
  return roles.length === 1 && roles.includes("donor");
}

const PRE_LIKERT = [
  "There are existing problems in the community and I can come up with ideas, suggestions, and solutions to address these problems and issues.",
  "Volunteer work along with teamwork would somehow help solve social problems.",
  "People in the community come from diverse background, culture, and social standing and it is important to understand these differences in order to help solve problems.",
  "I would like to make a difference in the community because I have a social and moral obligation to do so. I would do this even if my contribution would seem very little.",
  "Contributing and improving skills I\u2019ve learned from my degree program or affiliation would somehow solve social problems.",
  "I would definitely participate in community development initiatives but it would be the last of my priorities because I have to consider other aspects of my life first such as academics, friends, family, recreation, etc.",
  "I think that the magnitude of issues in our country and in the world in general is so big that whatever I do to help would be insignificant and would not make any difference.",
  "I would consider participating in community development initiatives whenever I can, and with proper time management and the initiative to do so, I definitely can.",
];

const POST_LIKERT = [
  "The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.",
  "The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.",
  "Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.",
  "Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.",
  "The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.",
  "I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.",
  "I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.",
  "I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.",
];

/**
 * MissionSubmissionsTable
 * Props:
 *   missionId    – Firestore mission document ID (required)
 *   missionTitle – Display name for certificate navigation (optional)
 */
export default function MissionSubmissionsTable({ missionId, missionTitle, refreshKey }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackActive, setIsFeedbackActive] = useState(true);
  const [missionAvgRating, setMissionAvgRating] = useState(0);
  const [missionLocation, setMissionLocation] = useState("");
  const [missionDate, setMissionDate] = useState(null);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerModalTitle, setAnswerModalTitle] = useState("");
  const [answerModalData, setAnswerModalData] = useState(null);
  const [volunteerCard, setVolunteerCard] = useState(null);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalModalVolunteer, setJournalModalVolunteer] = useState(null);
  const [approvingJournal, setApprovingJournal] = useState(null);
  const autoReleasedIdsRef = useRef(new Set());
  const isAutoReleasingRef = useRef(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterAttendance, setFilterAttendance] = useState("");
  const [filterPreSurvey, setFilterPreSurvey] = useState("");
  const [filterConsent, setFilterConsent] = useState("");
  const [filterPostSurvey, setFilterPostSurvey] = useState("");
  // Which column-header filter dropdown is open
  const [openFilter, setOpenFilter] = useState(null);
  const [removingRole, setRemovingRole] = useState(null);
  const [pointsPopover, setPointsPopover] = useState(null);
  const [missionCreatedBy, setMissionCreatedBy] = useState(null);
  const [accomplishmentReport, setAccomplishmentReport] = useState(null);
  const [arActionLoading, setArActionLoading] = useState(false);

  useEffect(() => {
    if (!volunteerCard) return;
    const close = () => setVolunteerCard(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [volunteerCard]);

  useEffect(() => {
    if (!pointsPopover) return;
    const close = () => setPointsPopover(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [pointsPopover]);

  useEffect(() => {
    if (!openFilter) return;
    const close = () => setOpenFilter(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openFilter]);

  useEffect(() => {
    if (!missionId) return;
    loadVolunteers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, refreshKey]);

  const loadVolunteers = async () => {
    setLoading(true);
    try {
      // Round 1: fetch mission metadata, volunteer list, task list, and accomplishment report in parallel
      const [missionSnap, volSnap, tasksSnap, arSnap] = await Promise.all([
        getDoc(doc(db, "missions", missionId)),
        getDocs(collection(db, "missions", missionId, "volunteer")),
        getDocs(collection(db, "missions", missionId, "task")),
        getDoc(doc(db, "missions", missionId, "accomplishmentReport", "submission")).catch(() => null),
      ]);

      const missionData = missionSnap.data() || {};
      setIsFeedbackActive(missionData?.feedback?.isActive !== false);
      setMissionAvgRating(missionData?.feedback?.avgRating || 0);
      setMissionLocation(missionData.location || "");
      const td = missionData.targetDate;
      setMissionDate(td?.toDate ? td.toDate() : td ? new Date(td) : null);
      setMissionCreatedBy(missionData.createdBy || null);
      setAccomplishmentReport(arSnap?.exists?.() ? arSnap.data() : null);

      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const volunteerDocs = volSnap.docs;
      const volunteerIds = volunteerDocs.map(d => d.id);

      if (volunteerIds.length === 0) {
        setVolunteers([]);
        return;
      }

      // Round 2: fetch targeted user docs, all surveys, and all task participant
      // collections in parallel — avoids fetching the entire users collection and
      // eliminates the N×T individual participant reads from the old approach.
      const [userDocs, preSurveyResults, postSurveyResults, taskParticipantSnaps] = await Promise.all([
        Promise.all(volunteerIds.map(uid => getDoc(doc(db, "users", uid)))),
        Promise.allSettled(volunteerIds.map(uid =>
          getDoc(doc(db, "missions", missionId, "volunteer", uid, "preSurvey", "response"))
        )),
        Promise.allSettled(volunteerIds.map(uid =>
          getDoc(doc(db, "missions", missionId, "volunteer", uid, "postSurvey", "response"))
        )),
        Promise.all(tasks.map(task =>
          getDocs(collection(db, "missions", missionId, "task", task.id, "participants"))
        )),
      ]);

      const userMap = new Map(userDocs.map(d => [d.id, d.exists() ? d.data() : null]));
      const preSurveyMap = new Map(
        preSurveyResults.map((r, i) => [volunteerIds[i], r.status === "fulfilled" && r.value.exists() ? r.value.data() : null])
      );
      const postSurveyMap = new Map(
        postSurveyResults.map((r, i) => [volunteerIds[i], r.status === "fulfilled" && r.value.exists() ? r.value.data() : null])
      );

      // taskParticipantMaps: taskId → Map<userId, participantData>
      const taskParticipantMaps = new Map(
        tasks.map((task, i) => [
          task.id,
          new Map(taskParticipantSnaps[i].docs.map(d => [d.id, d.data()])),
        ])
      );

      // Collect unique group docs needed (only for grouped tasks with submitted proof)
      const groupDocRefs = [];
      for (const task of tasks) {
        if (task.type !== "grouped") continue;
        const participantMap = taskParticipantMaps.get(task.id);
        const seenGroups = new Set();
        for (const uid of volunteerIds) {
          const pData = participantMap?.get(uid);
          if (hasTaskProof(pData) && pData?.groupId && !seenGroups.has(pData.groupId)) {
            seenGroups.add(pData.groupId);
            groupDocRefs.push({ taskId: task.id, groupId: pData.groupId });
          }
        }
      }

      const groupDocSnaps = await Promise.all(
        groupDocRefs.map(({ taskId, groupId }) =>
          getDoc(doc(db, "missions", missionId, "task", taskId, "group", groupId))
        )
      );
      const groupDocMap = new Map(
        groupDocRefs.map(({ taskId, groupId }, i) => [
          `${taskId}::${groupId}`,
          groupDocSnaps[i].exists() ? groupDocSnaps[i].data() : {},
        ])
      );

      const result = volunteerDocs.map(d => {
        const userId = d.id;
        const vData = d.data();
        const userData = userMap.get(userId);
        const rawName = userData?.name || userData?.username || "Unknown User";

        const journals = [];
        let joinedTaskCount = 0;
        let approvedProofCount = 0;
        let taskEnrollmentPoints = 0;
        for (const task of tasks) {
          const pData = taskParticipantMaps.get(task.id)?.get(userId);
          if (!pData) continue;
          joinedTaskCount += 1;
          taskEnrollmentPoints +=
            Number(pData.pointsEarned) ||
            Number(pData.pendingPoints) ||
            Number(pData.estimatedPoints) ||
            0;
          if (hasTaskProof(pData) && pData.adminApprovalStatus === "approved") {
            approvedProofCount += 1;
          }
          if (!hasTaskProof(pData)) continue;
          if (task.type === "grouped" && pData.groupId) {
            const groupData = groupDocMap.get(`${task.id}::${pData.groupId}`) || {};
            const proofSource = hasTaskProof(groupData) ? groupData : pData;
            journals.push({
              taskId: task.id,
              taskTitle: task.title || `Task ${task.id}`,
              type: "grouped",
              groupId: pData.groupId,
              taskPhoto: proofSource.taskPhoto || null,
              reflection: proofSource.taskPhoto?.url ? "" : proofSource.reflection || pData.reflection || "",
              proofType: getProofKind(proofSource),
              adminApprovalStatus: proofSource.adminApprovalStatus || pData.adminApprovalStatus || "pending",
              pendingPoints: pData.pendingPoints || Number(task.points) || 0,
            });
          } else {
            journals.push({
              taskId: task.id,
              taskTitle: task.title || `Task ${task.id}`,
              type: task.type || "individual",
              taskPhoto: pData.taskPhoto || null,
              reflection: pData.reflection,
              proofType: getProofKind(pData),
              adminApprovalStatus: pData.adminApprovalStatus || "pending",
              pendingPoints: pData.pendingPoints || 0,
            });
          }
        }

        return {
          ...vData,
          id: userId,
          name: toTitleCase(rawName),
          email: userData?.email || "",
          department: userData?.department || "",
          level: userData?.level || "",
          photoURL: (() => { const p = userData?.avatar || userData?.photoURL || userData?.profilePhoto || ""; return p.includes("ui-avatars.com") ? "" : p; })(),
          totalPoints: userData?.totalPoints || 0,
          taskPoints: Number(vData.taskPoints) || taskEnrollmentPoints,
          preSurveyAnswers: preSurveyMap.get(userId),
          postSurveyAnswers: postSurveyMap.get(userId),
          journals,
          joinedTaskCount,
          approvedProofCount,
        };
      });

      // Auto-sync: keep volunteer.roles aligned with pre-survey participation.
      const toSync = result.filter(v => {
        const allRoles = getSurveyRoles(v);
        return allRoles.length > 0 && JSON.stringify(getVolunteerRoles(v)) !== JSON.stringify(allRoles);
      });
      if (toSync.length > 0) {
        await Promise.all(toSync.map(v => {
          const allRoles = getSurveyRoles(v);
          return updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { roles: allRoles, role: deleteField() });
        }));
        toSync.forEach(v => {
          const allRoles = getSurveyRoles(v);
          const idx = result.findIndex(r => r.id === v.id);
          if (idx !== -1) result[idx] = { ...result[idx], role: undefined, roles: allRoles };
        });
      }

      setVolunteers(result);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentReviewChange = async (volunteerId, value) => {
    try {
      const selectedVolunteer = volunteers.find(v => v.id === volunteerId);
      const volunteerDocRef = doc(db, "missions", missionId, "volunteer", volunteerId);

      // Check if consent bonus needs to be revoked before updating status
      let shouldRevokeBonus = false;
      if (value === "rejected") {
        const volunteerDocSnap = await getDoc(volunteerDocRef);
        if (volunteerDocSnap.exists()) {
          const volData = volunteerDocSnap.data();
          // Check both new (progress.consent) and old (requirementBonus.consent) tracking fields
          shouldRevokeBonus = volData.progress?.consent === 'verified' || Boolean(volData.requirementBonus?.consent);
        }
      }

      const updateData = { "consentSubmission.reviewStatus": value };
      if (shouldRevokeBonus) {
        updateData["progress.consent"] = "submitted";
        updateData["requirementBonus.consent"] = deleteField();
      }

      await updateDoc(volunteerDocRef, updateData);

      if (shouldRevokeBonus) {
        await updateDoc(doc(db, "users", volunteerId), { totalPoints: increment(-5) });
      }
      logAudit({
        action: "VOLUNTEER_CONSENT_REVIEW_UPDATED",
        category: "event",
        details: {
          missionId,
          targetUserId: volunteerId,
          targetUserName: volunteers.find(v => v.id === volunteerId)?.name || "",
          reviewStatus: value,
        },
      });
      setVolunteers(prev => prev.map(v => (
        v.id === volunteerId
          ? {
              ...v,
              consentSubmission: {
                ...(v.consentSubmission || {}),
                reviewStatus: value,
              },
            }
          : v
      )));

      if (value === "approved" || value === "rejected") {
        try {
          const reviewLabel = value === "approved" ? "approved" : "rejected";
          await createNotification(volunteerId, {
            type: value === "approved" ? "consent_approved" : "consent_rejected",
            title: `Consent Form ${value === "approved" ? "Approved" : "Rejected"}`,
            message: `Your activity consent form for "${missionTitle || "this mission"}" has been ${reviewLabel}.`,
            link: `/event/${missionId}/activity`,
          });
        } catch {
          showToast(`Consent review saved for ${selectedVolunteer?.name || "the volunteer"}, but notification could not be sent.`, "error");
        }
      }
    } catch {
      showToast("Failed to update consent review status.");
    }
  };

  const handleRemoveRole = async (volunteerId, roleToRemove) => {
    const key = `${volunteerId}:${roleToRemove}`;
    setRemovingRole(key);
    try {
      const vol = volunteers.find(v => v.id === volunteerId);
      const currentRoles = getVolunteerRoles(vol);
      const newRoles = currentRoles.filter(r => r !== roleToRemove);
      const syncedRoles = newRoles.length > 0 ? newRoles : ["participant"];

      // Remove the matching entry from the pre-survey participation array
      const currentParticipation = vol?.preSurveyAnswers?.engagement?.participation || [];
      const filteredParticipation = currentParticipation.filter(
        r => r.trim().toLowerCase().replace(/\s+/g, "_") !== roleToRemove
      );
      const newParticipation = filteredParticipation.length > 0 ? filteredParticipation : ["participant"];

      await Promise.all([
        updateDoc(doc(db, "missions", missionId, "volunteer", volunteerId), {
          roles: syncedRoles,
          role: deleteField(),
        }),
        ...(JSON.stringify(newParticipation.map(normalizeRole)) !== JSON.stringify(currentParticipation.map(normalizeRole))
          ? [updateDoc(doc(db, "missions", missionId, "volunteer", volunteerId, "preSurvey", "response"), {
              "engagement.participation": newParticipation,
            })]
          : []),
      ]);

      setVolunteers(prev => prev.map(v =>
        v.id === volunteerId ? {
          ...v,
          role: undefined,
          roles: syncedRoles,
          preSurveyAnswers: v.preSurveyAnswers ? {
            ...v.preSurveyAnswers,
            engagement: {
              ...v.preSurveyAnswers.engagement,
              participation: newParticipation,
            },
          } : v.preSurveyAnswers,
        } : v
      ));
    } catch {
      showToast("Failed to remove role.");
    } finally {
      setRemovingRole(null);
    }
  };

  const handleArReview = async (status) => {
    setArActionLoading(true);
    try {
      const arRef = doc(db, "missions", missionId, "accomplishmentReport", "submission");
      await updateDoc(arRef, { status, reviewedAt: new Date().toISOString() });

      const submitterId = accomplishmentReport?.submittedBy;
      if (status === "approved" && submitterId) {
        const submitterVolunteer = volunteers.find(v => v.id === submitterId);
        const submitterName = submitterVolunteer?.name || "Organizer";
        const certDate = missionDate || new Date();
        const certDay = String(certDate.getDate());
        const certMonth = certDate.toLocaleString("en-US", { month: "long" });
        const certYear = String(certDate.getFullYear());

        try {
          await issueCertificate({
            userId: submitterId,
            recipient: submitterName,
            course: missionTitle || "",
            date: `${certMonth} ${certDay}, ${certYear}`,
            loc: missionLocation,
            day: certDay,
            month: certMonth,
            year: certYear,
          });
          await updateDoc(doc(db, "missions", missionId, "volunteer", submitterId), { certIssuedAt: new Date().toISOString() }).catch(() => {});
          setVolunteers(prev => prev.map(v => v.id === submitterId ? { ...v, certIssuedAt: new Date().toISOString() } : v));
        } catch {}

        await createNotification(submitterId, {
          type: "accomplishment_report_approved",
          title: "Accomplishment Report Approved",
          message: `Your accomplishment report for "${missionTitle || "this mission"}" has been approved! Your certificate has been issued.`,
          link: `/profile`,
        }).catch(() => {});

        showToast("Report approved and certificate issued.");
      } else if (status === "revision_needed") {
        if (submitterId) {
          await createNotification(submitterId, {
            type: "accomplishment_report_revision",
            title: "Accomplishment Report Needs Revision",
            message: `Your accomplishment report for "${missionTitle || "this mission"}" needs revision. Please review and resubmit.`,
            link: `/event/${missionId}/activity`,
          }).catch(() => {});
        }
        showToast("Revision requested.");
      }

      setAccomplishmentReport(prev => prev ? { ...prev, status } : prev);
    } catch {
      showToast("Failed to update accomplishment report status.");
    } finally {
      setArActionLoading(false);
    }
  };

  const handleViewAnswers = (volunteer, type) => {
    const data = type === "pre" ? volunteer.preSurveyAnswers : volunteer.postSurveyAnswers;
    const prefix = type === "pre" ? "Pre-Activity" : "Post-Activity";
    setAnswerModalTitle(`${prefix} Survey Answers${volunteer.name ? ` - ${volunteer.name}` : ""}`);
    setAnswerModalData(data);
    setShowAnswerModal(true);
  };

  const handleJournalApproval = async (volunteer, journal, decision) => {
    const { taskId, type, groupId } = journal;
    const volunteerId = volunteer.id;
    const approvalData = { adminApprovalStatus: decision, adminReviewedAt: new Date().toISOString() };
    let notificationTargets = [volunteerId];
    setApprovingJournal({ volunteerId, taskId });
    try {
      if (type === "grouped" && groupId) {
        await updateDoc(doc(db, "missions", missionId, "task", taskId, "group", groupId), approvalData);
        const membersSnap = await getDocs(collection(db, "missions", missionId, "task", taskId, "participants"));
        notificationTargets = membersSnap.docs
          .filter((memberDoc) => memberDoc.data().groupId === groupId)
          .map((memberDoc) => memberDoc.id);
        for (const memberDoc of membersSnap.docs) {
          if (memberDoc.data().groupId === groupId) {
            await updateDoc(memberDoc.ref, approvalData);
          }
        }
        setVolunteers(prev => prev.map(v => ({
          ...v,
          journals: v.journals.map(j =>
            j.taskId === taskId && j.groupId === groupId ? { ...j, adminApprovalStatus: decision } : j
          ),
        })));
      } else {
        await updateDoc(doc(db, "missions", missionId, "task", taskId, "participants", volunteerId), approvalData);
        setVolunteers(prev => prev.map(v => {
          if (v.id !== volunteerId) return v;
          return { ...v, journals: v.journals.map(j => j.taskId === taskId ? { ...j, adminApprovalStatus: decision } : j) };
        }));
      }

      if (journalModalVolunteer?.id === volunteerId) {
        setJournalModalVolunteer(prev => ({
          ...prev,
          journals: prev.journals.map(j =>
            j.taskId === taskId ? { ...j, adminApprovalStatus: decision } : j
          ),
        }));
      }

      if (decision !== "pending") {
        try {
          await Promise.allSettled(notificationTargets.map((targetId) => createNotification(targetId, {
            type: decision === "approved" ? "photo_approved" : "photo_rejected",
            title: `Task Photo ${decision === "approved" ? "Approved" : "Rejected"}`,
            message: `Your task photo proof for "${journal.taskTitle}" has been ${decision}.`,
            link: `/event/${missionId}/activity`,
            missionId,
            taskId,
          })));
        } catch { /* notification failure is non-fatal */ }
      }

      logAudit({
        action: `TASK_PROOF_${decision.toUpperCase()}`,
        category: "event",
        details: { missionId, targetUserId: volunteerId, taskId, taskTitle: journal.taskTitle },
      });
      showToast(`Task proof ${decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "reset to pending"}.`);
    } catch {
      showToast("Failed to update task proof approval status.");
    } finally {
      setApprovingJournal(null);
    }
  };

  // Auto-release points + issue certificate for volunteers who meet all requirements
  // once the community feedback form is closed.
  useEffect(() => {
    if (isFeedbackActive || loading || volunteers.length === 0) return;
    if (isAutoReleasingRef.current) return;

    const pending = volunteers.filter(v => {
      if (v.releasedAt || autoReleasedIdsRef.current.has(v.id)) return false;
      const allTaskProofsApproved =
        !Number(v.joinedTaskCount) ||
        Number(v.approvedProofCount) === Number(v.joinedTaskCount);
      const isConsentApproved = v.consentSubmission?.reviewStatus === "approved";
      const requiredItems = isDonorOnly(v)
        ? [v.preSurveyAnswers]
        : [
            v.preSurveyAnswers,
            v.postSurveyAnswers,
            isConsentApproved,
            v.progress?.attendance === "present",
            ...(Number(v.joinedTaskCount) > 0 ? [allTaskProofsApproved] : []),
          ];
      return requiredItems.every(Boolean);
    });

    if (pending.length === 0) return;

    isAutoReleasingRef.current = true;
    (async () => {
      for (const v of pending) {
        autoReleasedIdsRef.current.add(v.id);
        try {
          const finalPoints = await releaseVolunteerPoints(missionId, v.id);
          await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { completionStatus: "complete" });

          const certDate = missionDate || new Date();
          const certDay = String(certDate.getDate());
          const certMonth = certDate.toLocaleString("en-US", { month: "long" });
          const certYear = String(certDate.getFullYear());

          let certIssued = false;
          try {
            await issueCertificate({
              userId: v.id,
              recipient: v.name,
              course: missionTitle || "",
              missionPoints: typeof finalPoints === "number" ? finalPoints : undefined,
              date: `${certMonth} ${certDay}, ${certYear}`,
              loc: missionLocation,
              day: certDay,
              month: certMonth,
              year: certYear,
            });
            await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { certIssuedAt: new Date().toISOString() });
            certIssued = true;
          } catch { /* cert failure is non-fatal */ }

          const updatedVolunteerSnap = await getDoc(doc(db, "missions", missionId, "volunteer", v.id));
          const updatedVolunteerData = updatedVolunteerSnap.exists() ? updatedVolunteerSnap.data() : {};
          setVolunteers(prev => prev.map(vol => vol.id === v.id ? {
            ...vol,
            ...updatedVolunteerData,
            releasedAt: updatedVolunteerData.releasedAt || new Date().toISOString(),
            ...(certIssued && !updatedVolunteerData.certIssuedAt ? { certIssuedAt: new Date().toISOString() } : {}),
          } : vol));
        } catch {
          autoReleasedIdsRef.current.delete(v.id);
        }
      }
      isAutoReleasingRef.current = false;
    })();
  }, [volunteers, isFeedbackActive, loading]);

  if (loading) return <p style={{ color: "#888", padding: 16 }}>Loading submissions…</p>;

  const filteredVolunteers = volunteers.filter(v => {
    if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase()) && !v.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterRole) {
      const roles = getVolunteerRoles(v).length > 0 ? getVolunteerRoles(v) : getSurveyRoles(v);
      if (!roles.includes(filterRole)) return false;
    }
    if (filterAttendance === "present" && v.progress?.attendance !== "present") return false;
    if (filterAttendance === "absent" && v.progress?.attendance === "present") return false;
    if (filterPreSurvey === "submitted" && !v.preSurveyAnswers) return false;
    if (filterPreSurvey === "not_submitted" && !!v.preSurveyAnswers) return false;
    if (filterConsent) {
      const reviewStatus = v.consentSubmission?.reviewStatus || "";
      const hasFile = Boolean(v.consentSubmission?.fileUrl);
      const effectiveStatus = hasFile ? (reviewStatus || "pending") : "none";
      if (effectiveStatus !== filterConsent) return false;
    }
    if (filterPostSurvey === "submitted" && !v.postSurveyAnswers) return false;
    if (filterPostSurvey === "not_submitted" && !!v.postSurveyAnswers) return false;
    return true;
  });

  const activeFilterCount = [searchQuery, filterRole, filterAttendance, filterPreSurvey, filterConsent, filterPostSurvey].filter(Boolean).length;

  // Pin lead_organizer / organizer / mission proponent to the top
  const getOrgRank = (v) => {
    const roles = getVolunteerRoles(v).length > 0 ? getVolunteerRoles(v) : getSurveyRoles(v);
    if (roles.includes("lead_organizer")) return 0;
    if (roles.includes("organizer")) return 1;
    return 2;
  };
  const sortedVolunteers = [...filteredVolunteers].sort((a, b) => {
    const rankDiff = getOrgRank(a) - getOrgRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });

  const AR_LABELS = {
    submitted:       { label: "Submitted",       bg: "#dbeafe", color: "#1e40af" },
    approved:        { label: "Approved",         bg: "#dcfce7", color: "#166534" },
    revision_needed: { label: "Revision Needed",  bg: "#fef3c7", color: "#92400e" },
  };

  return (
    <>
      {isFeedbackActive ? (
        <div style={{ background: "#fff8e1", color: "#92400e", padding: "14px 18px", borderRadius: 10, marginBottom: 16, border: "2px solid #f59e0b", fontSize: "0.87rem", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>⚠ Community feedback form is still open</div>
          <div style={{ fontWeight: 400 }}>
            Points and certificates will be <b>automatically released</b> once the feedback form is closed.
            The final avg rating determines the points multiplier for all volunteers.
            {missionAvgRating > 0 && (
              <span> Current avg rating: <b>{missionAvgRating}</b> → multiplier will be <b>{getProgramMultiplier(missionAvgRating)}×</b>.</span>
            )}
          </div>
        </div>
      ) : missionAvgRating === 0 ? (
        <div style={{ background: "#fef3c7", color: "#78350f", padding: "10px 16px", borderRadius: 8, marginBottom: 16, border: "1px solid #fde68a", fontSize: "0.84rem", fontWeight: 500 }}>
          No feedback responses received — points multiplier will be <b>1.0×</b> (no bonus).
        </div>
      ) : (
        <div style={{ background: "#ecfdf5", color: "#065f46", padding: "10px 16px", borderRadius: 8, marginBottom: 16, border: "1px solid #6ee7b7", fontSize: "0.84rem", fontWeight: 500 }}>
          Feedback closed · Avg rating: <b>{missionAvgRating}</b> · Multiplier: <b>{getProgramMultiplier(missionAvgRating)}×</b> · Points auto-release is active.
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaed" }}>
        {/* ── Filter bar ── */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: "6px 10px 6px 30px",
                border: "1px solid #dadce0",
                borderRadius: 8,
                fontSize: "0.8rem",
                fontFamily: "inherit",
                color: "#202124",
                width: 200,
                outline: "none",
              }}
            />
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#80868b", fontSize: "0.82rem", pointerEvents: "none" }}>🔍</span>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setSearchQuery(""); setFilterRole(""); setFilterAttendance(""); setFilterPreSurvey(""); setFilterConsent(""); setFilterPostSurvey(""); }}
              style={{ padding: "6px 10px", border: "1px solid #dadce0", borderRadius: 8, background: "#fff", color: "#d93025", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}

          {/* Results count */}
          <span style={{ marginLeft: "auto", color: "#80868b", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
            {filteredVolunteers.length} of {volunteers.length} volunteer{volunteers.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ width: "100%", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", fontSize: "0.84rem" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #e8eaed" }}>
              {/* Volunteer column — no filter dropdown */}
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>
                Volunteer
                <span style={{ marginLeft: 8, background: "#f1f3f4", color: "#5f6368", borderRadius: 99, fontSize: "0.68rem", padding: "2px 7px", fontWeight: 600 }}>
                  {filteredVolunteers.length}
                </span>
              </th>

              {/* Role ▼ */}
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                  Role
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === "role" ? null : "role"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", lineHeight: 1, color: filterRole ? "#1a73e8" : "#9aa0a6", fontSize: "0.65rem" }}
                    title="Filter by role"
                  >▼</button>
                  {filterRole && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a73e8", display: "inline-block", flexShrink: 0 }} />}
                  {openFilter === "role" && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #dadce0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 1000, minWidth: 160, padding: "6px 0", fontWeight: 400 }}>
                      {[["", "All Roles"], ["participant", "Participant"], ["donor", "Donor"], ["organizer", "Organizer"], ["lead_organizer", "Lead Organizer"]].map(([val, label]) => (
                        <div key={val} onClick={() => { setFilterRole(val); setOpenFilter(null); }}
                          style={{ padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", color: filterRole === val ? "#1a73e8" : "#202124", background: filterRole === val ? "#e8f0fe" : "transparent", whiteSpace: "nowrap" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </th>

              {/* Attendance ▼ */}
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                  Attendance
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === "attendance" ? null : "attendance"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", lineHeight: 1, color: filterAttendance ? "#1a73e8" : "#9aa0a6", fontSize: "0.65rem" }}
                    title="Filter by attendance"
                  >▼</button>
                  {filterAttendance && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a73e8", display: "inline-block", flexShrink: 0 }} />}
                  {openFilter === "attendance" && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #dadce0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 1000, minWidth: 150, padding: "6px 0", fontWeight: 400, textAlign: "left" }}>
                      {[["", "All Attendance"], ["present", "Present"], ["absent", "Not Yet"]].map(([val, label]) => (
                        <div key={val} onClick={() => { setFilterAttendance(val); setOpenFilter(null); }}
                          style={{ padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", color: filterAttendance === val ? "#1a73e8" : "#202124", background: filterAttendance === val ? "#e8f0fe" : "transparent", whiteSpace: "nowrap" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </th>

              {/* Pre-Survey ▼ */}
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                  Pre-Survey
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === "preSurvey" ? null : "preSurvey"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", lineHeight: 1, color: filterPreSurvey ? "#1a73e8" : "#9aa0a6", fontSize: "0.65rem" }}
                    title="Filter by pre-survey"
                  >▼</button>
                  {filterPreSurvey && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a73e8", display: "inline-block", flexShrink: 0 }} />}
                  {openFilter === "preSurvey" && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #dadce0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 1000, minWidth: 160, padding: "6px 0", fontWeight: 400, textAlign: "left" }}>
                      {[["", "All"], ["submitted", "Submitted"], ["not_submitted", "Not Submitted"]].map(([val, label]) => (
                        <div key={val} onClick={() => { setFilterPreSurvey(val); setOpenFilter(null); }}
                          style={{ padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", color: filterPreSurvey === val ? "#1a73e8" : "#202124", background: filterPreSurvey === val ? "#e8f0fe" : "transparent", whiteSpace: "nowrap" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </th>

              {/* Consent Form ▼ */}
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                  Consent Form
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === "consent" ? null : "consent"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", lineHeight: 1, color: filterConsent ? "#1a73e8" : "#9aa0a6", fontSize: "0.65rem" }}
                    title="Filter by consent form"
                  >▼</button>
                  {filterConsent && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a73e8", display: "inline-block", flexShrink: 0 }} />}
                  {openFilter === "consent" && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #dadce0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 1000, minWidth: 170, padding: "6px 0", fontWeight: 400, textAlign: "left" }}>
                      {[["", "All"], ["approved", "Approved"], ["pending", "Pending Review"], ["rejected", "Rejected"], ["none", "Not Submitted"]].map(([val, label]) => (
                        <div key={val} onClick={() => { setFilterConsent(val); setOpenFilter(null); }}
                          style={{ padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", color: filterConsent === val ? "#1a73e8" : "#202124", background: filterConsent === val ? "#e8f0fe" : "transparent", whiteSpace: "nowrap" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </th>

              {/* Post-Survey ▼ */}
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", userSelect: "none" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
                  Post-Survey
                  <button
                    onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === "postSurvey" ? null : "postSurvey"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", lineHeight: 1, color: filterPostSurvey ? "#1a73e8" : "#9aa0a6", fontSize: "0.65rem" }}
                    title="Filter by post-survey"
                  >▼</button>
                  {filterPostSurvey && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a73e8", display: "inline-block", flexShrink: 0 }} />}
                  {openFilter === "postSurvey" && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #dadce0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 1000, minWidth: 160, padding: "6px 0", fontWeight: 400, textAlign: "left" }}>
                      {[["", "All"], ["submitted", "Submitted"], ["not_submitted", "Not Submitted"]].map(([val, label]) => (
                        <div key={val} onClick={() => { setFilterPostSurvey(val); setOpenFilter(null); }}
                          style={{ padding: "7px 14px", cursor: "pointer", fontSize: "0.8rem", color: filterPostSurvey === val ? "#1a73e8" : "#202124", background: filterPostSurvey === val ? "#e8f0fe" : "transparent", whiteSpace: "nowrap" }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </th>

              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Task Proof</th>
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Done %</th>
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Points</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Status</th>
              <th style={{ position: "sticky", top: 0, background: "#f3f0ff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed", minWidth: 140 }}>Accomplishment Report</th>
            </tr>
          </thead>
          <tbody>
            {filteredVolunteers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 32, color: "#9aa0a6", fontSize: "0.85rem" }}>{volunteers.length === 0 ? "No submissions found." : "No volunteers match the current filters."}</td>
              </tr>
            ) : sortedVolunteers.map((v, idx) => {
              const rawRoles = v.preSurveyAnswers?.engagement?.participation || [];
              const hasConsentSubmission = Boolean(v.consentSubmission?.fileUrl);
              const consentReviewStatus = v.consentSubmission?.reviewStatus || "";
              const isConsentApproved = consentReviewStatus === "approved";
              const volunteerRoles = getVolunteerRoles(v).length > 0 ? getVolunteerRoles(v) : getSurveyRoles(v);
              const isOrgRole = volunteerRoles.includes("lead_organizer") || volunteerRoles.includes("organizer");

              const journals = v.journals || [];
              const joinedTaskCount = Number(v.joinedTaskCount) || 0;
              const approvedJournalCount = Number(v.approvedProofCount) || journals.filter(j => j.adminApprovalStatus === "approved").length;
              const allJournalsApproved = joinedTaskCount === 0 || approvedJournalCount === joinedTaskCount;

              const requiredItems = isDonorOnly(v)
                ? [v.preSurveyAnswers]
                : [
                    v.preSurveyAnswers,
                    v.postSurveyAnswers,
                    isConsentApproved,
                    v.progress?.attendance === "present",
                    ...(joinedTaskCount > 0 ? [allJournalsApproved] : []),
                  ];

              const completedItems = requiredItems.filter(Boolean).length;
              const individualCompletion = Math.round((completedItems / requiredItems.length) * 100);

              let previewPoints = null;
              let breakdown = null;
              if (rawRoles.length > 0) {
                breakdown = computeFinalPoints(rawRoles, missionAvgRating, "verified");
                previewPoints = breakdown.finalPoints;
              }

              return (
                <tr key={v.id} style={{ borderBottom: idx < sortedVolunteers.length - 1 ? "1px dashed #e8eaed" : "none", background: isOrgRole ? "#f8f6ff" : "transparent" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {v.photoURL ? (
                        <img src={v.photoURL} alt={v.name}
                          style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1.5px solid #e8eaed" }} />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: "#30bdb7", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "0.82rem",
                        }}>
                          {getInitials(v.name)}
                        </div>
                      )}
                      <span
                        style={{ fontWeight: 600, color: "#202124", cursor: "pointer" }}
                        onClick={e => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          setVolunteerCard(prev => prev?.volunteer.id === v.id ? null : { volunteer: v, x: r.right + 8, y: r.top });
                        }}
                      >{v.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {(() => {
                      const specialRoles = getDisplayRoles(v);
                      if (specialRoles.length === 0) {
                        return <span style={{ color: "#5f6368", fontSize: "0.82rem" }}>Participant</span>;
                      }
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {specialRoles.map(role => (
                            <div key={role} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: "0.82rem", color: "#202124" }}>
                                {ROLE_LABELS[role] || role}
                              </span>
                              <button
                                onClick={() => handleRemoveRole(v.id, role)}
                                disabled={removingRole === `${v.id}:${role}`}
                                title={`Remove ${ROLE_LABELS[role] || role}`}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa0a6", fontSize: 11, padding: "0 1px", lineHeight: 1, opacity: removingRole === `${v.id}:${role}` ? 0.4 : 1 }}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", background: "#f8f9fa" }}>
                    {v.progress?.attendance === "present"
                      ? <span style={{ color: "#137333", fontWeight: 700, fontSize: "0.82rem" }}>Present</span>
                      : <span style={{ color: "#80868b", fontSize: "0.82rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {v.preSurveyAnswers
                      ? <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1a73e8", background: "#fff", color: "#1a73e8", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem", whiteSpace: "nowrap" }} onClick={() => handleViewAnswers(v, "pre")}>View</button>
                      : <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {hasConsentSubmission ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <select
                          value={consentReviewStatus}
                          disabled={!!v.releasedAt}
                          onChange={e => handleConsentReviewChange(v.id, e.target.value)}
                          style={{ padding: "4px 8px", border: "1px solid #dadce0", borderRadius: 6, fontSize: "0.78rem", fontFamily: "inherit", color: "#202124", background: "#fff", cursor: !!v.releasedAt ? "not-allowed" : "pointer", maxWidth: 110 }}
                        >
                          <option value="">Select</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <a href={v.consentSubmission.fileUrl} target="_blank" rel="noreferrer"
                          style={{ color: "#1a73e8", fontSize: "0.72rem", fontWeight: 600, textDecoration: "none" }}>
                          View PDF
                        </a>
                      </div>
                    ) : <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {v.postSurveyAnswers
                      ? <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1a73e8", background: "#fff", color: "#1a73e8", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem", whiteSpace: "nowrap" }} onClick={() => handleViewAnswers(v, "post")}>View</button>
                      : <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {joinedTaskCount === 0 ? (
                      <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: allJournalsApproved ? "#137333" : "#202124" }}>
                          {approvedJournalCount}/{joinedTaskCount}
                        </span>
                        {journals.length > 0 && (
                          <button
                            style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #30bdb7", background: "#fff", color: "#30bdb7", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap" }}
                            onClick={() => { setJournalModalVolunteer(v); setShowJournalModal(true); }}
                          >
                            {v.releasedAt ? "View" : "Review"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, background: "#f8f9fa", color: individualCompletion === 100 ? "#137333" : "#202124" }}>
                    {individualCompletion}%
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", background: "#f8f9fa" }}>
                    {(() => {
                      if (!breakdown) return <span style={{ color: "#9aa0a6" }}>—</span>;

                      if (v.releasedAt) {
                        const points = getMissionPointsBreakdown(v, breakdown.finalPoints);
                        return (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const r = e.currentTarget.getBoundingClientRect();
                              setPointsPopover(prev => prev?.volunteerId === v.id ? null : {
                                volunteerId: v.id,
                                x: r.left,
                                y: r.bottom + 6,
                                roleRatingPoints: points.roleRatingPoints,
                                taskJournalPoints: points.taskPoints,
                                requirementPoints: points.requirementPoints,
                                bonusPoints: points.bonusPoints,
                                displayTotal: points.missionPoints,
                                multiplier: breakdown.multiplier,
                                roleBasePoints: breakdown.base,
                              });
                            }}
                            style={{ fontWeight: 700, color: "#202124", cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: "inherit", textDecoration: "underline dotted #9aa0a6" }}
                          >
                            {points.missionPoints}
                          </button>
                        );
                      }

                      return (
                        <span title={`Expected: ${breakdown.finalPoints} pts (role/rating only, before task & bonuses)`} style={{ cursor: "help", fontWeight: 600, color: "#5f6368" }}>
                          {previewPoints}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {v.releasedAt ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ color: "#137333", fontWeight: 700, fontSize: "0.82rem" }}>Completed</span>
                        {v.certIssuedAt
                          ? <span style={{ color: "#1a73e8", fontSize: "0.72rem", fontWeight: 600 }}>Cert Issued</span>
                          : <span style={{ color: "#f9ab00", fontSize: "0.72rem", fontWeight: 600 }}>Cert pending…</span>}
                      </div>
                    ) : individualCompletion === 100 && !isFeedbackActive ? (
                      <span style={{ color: "#5f6368", fontSize: "0.8rem", fontWeight: 600 }}>Processing…</span>
                    ) : individualCompletion === 100 ? (
                      <span style={{ color: "#b45309", fontSize: "0.79rem", fontWeight: 600 }}>Awaiting feedback close</span>
                    ) : (
                      <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>Incomplete</span>
                    )}
                  </td>

                  {/* ── Accomplishment Report column ── */}
                  <td style={{ padding: "12px 16px", textAlign: "center", background: isOrgRole ? "#f3f0ff" : "transparent" }}>
                    {!isOrgRole ? (
                      <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>
                    ) : (() => {
                      const arStatus = accomplishmentReport?.status;
                      const isSubmitter = v.id === accomplishmentReport?.submittedBy;
                      const arLabel = arStatus ? AR_LABELS[arStatus] : null;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          {arLabel ? (
                            <span style={{
                              display: "inline-block", padding: "3px 10px",
                              background: arLabel.bg, color: arLabel.color,
                              borderRadius: 99, fontSize: "0.75rem", fontWeight: 700,
                            }}>
                              {arLabel.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>Not yet submitted</span>
                          )}
                          {isSubmitter && arStatus === "submitted" && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
                              <button
                                disabled={arActionLoading}
                                onClick={() => handleArReview("approved")}
                                style={{ padding: "3px 9px", borderRadius: 6, border: "none", background: "#137333", color: "#fff", fontWeight: 600, fontSize: "0.7rem", cursor: arActionLoading ? "not-allowed" : "pointer" }}
                              >
                                {arActionLoading ? "…" : "Approve"}
                              </button>
                              <button
                                disabled={arActionLoading}
                                onClick={() => handleArReview("revision_needed")}
                                style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #d97706", background: "#fff", color: "#d97706", fontWeight: 600, fontSize: "0.7rem", cursor: arActionLoading ? "not-allowed" : "pointer" }}
                              >
                                Revise
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Task Proof Review Modal */}
      {showJournalModal && journalModalVolunteer && (
        <div
          className="task-proof-modal-overlay"
          onClick={() => setShowJournalModal(false)}
        >
          <div
            className="task-proof-modal"
            onClick={e => e.stopPropagation()}
          >
            <button className="admin-modal-close admin-modal-close--absolute" onClick={() => setShowJournalModal(false)}>×</button>
            <h2 className="task-proof-modal-title">Task Photo Proofs</h2>
            <p className="task-proof-modal-subtitle">{journalModalVolunteer.name}</p>
            {journalModalVolunteer.journals.length === 0 ? (
              <p className="task-proof-modal-empty">No task proof submissions found.</p>
            ) : journalModalVolunteer.journals.map(journal => {
              const isApproving = approvingJournal?.volunteerId === journalModalVolunteer.id && approvingJournal?.taskId === journal.taskId;
              return (
                <div key={journal.taskId} className="task-proof-review-card">
                  <div className="task-proof-review-header">
                    <span className="task-proof-review-title">{journal.taskTitle}</span>
                    <span className="task-proof-review-type">
                      {journal.type === "grouped" ? "Group" : "Individual"}
                    </span>
                  </div>
                  {journal.taskPhoto?.url ? (
                    <a href={journal.taskPhoto.url} target="_blank" rel="noreferrer" className="task-proof-review-image-link">
                      <img
                        src={journal.taskPhoto.url}
                        alt={`${journal.taskTitle} proof`}
                        className="task-proof-review-image"
                      />
                    </a>
                  ) : (
                    <p className="task-proof-review-legacy">
                      <span className="task-proof-review-legacy-label">Legacy reflection</span>
                      <br />
                      {journal.reflection}
                    </p>
                  )}
                  {journal.adminApprovalStatus === "pending" && (
                    <div className="task-proof-review-actions">
                      <button
                        disabled={isApproving}
                        onClick={() => handleJournalApproval(journalModalVolunteer, journal, "approved")}
                        className="task-proof-review-btn task-proof-review-btn--approve"
                      >
                        {isApproving ? "Saving…" : "Approve"}
                      </button>
                      <button
                        disabled={isApproving}
                        onClick={() => handleJournalApproval(journalModalVolunteer, journal, "rejected")}
                        className="task-proof-review-btn task-proof-review-btn--reject"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {journal.adminApprovalStatus !== "pending" && (
                    <button
                      disabled={isApproving || !!journalModalVolunteer.releasedAt}
                      onClick={() => {
                        if (!journalModalVolunteer.releasedAt && !isApproving) {
                          handleJournalApproval(journalModalVolunteer, journal, "pending");
                        }
                      }}
                      title={journalModalVolunteer.releasedAt ? undefined : "Click to undo and reset to pending"}
                      className={`task-proof-status-pill task-proof-status-pill--${journal.adminApprovalStatus}`}
                    >
                      {journal.adminApprovalStatus === "approved" ? "Approved" : "Rejected"}
                      {!journalModalVolunteer.releasedAt && (
                        <span className="task-proof-status-undo">undo</span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {showAnswerModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 11000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAnswerModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 400, maxWidth: "90vw", boxShadow: "0 4px 24px rgba(0,0,0,0.18)", position: "relative", color: "#202124", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <button className="admin-modal-close admin-modal-close--absolute" onClick={() => setShowAnswerModal(false)}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: 24, color: "#202124", fontSize: "1.05rem", fontWeight: 700 }}>{answerModalTitle}</h2>
            {answerModalData ? (
              <div style={{ maxWidth: 600, margin: "0 auto" }}>
                {answerModalTitle.startsWith("Pre-Activity") && (
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#202124", fontSize: "1rem", marginBottom: 18 }}>Pre-Activity Survey</h3>
                    <div style={{ marginBottom: 12 }}><b>Name:</b> {answerModalData.respondent?.name || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>College/Department/Organization:</b> {answerModalData.respondent?.college || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Program:</b> {answerModalData.respondent?.program || ""}</div>
                    {answerModalData.respondent?.college === "Non-Academic Organization" && (
                      <div style={{ marginBottom: 12 }}><b>Organization Name:</b> {answerModalData.respondent?.nonAcademicOrg || ""}</div>
                    )}
                    <div style={{ marginBottom: 12 }}><b>Type of Engagement:</b> {answerModalData.engagement?.type || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Title of Initiative:</b> {answerModalData.engagement?.initiativeTitle || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Type/Level of Participation:</b> {(answerModalData.engagement?.participation || []).join(", ")}{answerModalData.engagement?.participationOther ? `, Other: ${answerModalData.engagement.participationOther}` : ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Previous Community Service Experience:</b> {answerModalData.background?.previousService || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Frequency of Community Service:</b> {answerModalData.background?.frequency || ""}</div>
                    <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>Please indicate how much you agree with each statement (1=Strongly Disagree, 5=Strongly Agree):</div>
                    <ol style={{ paddingLeft: 18 }}>
                      {PRE_LIKERT.map((q, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                          <span>{q}</span><br />
                          <span style={{ color: "#1a73e8", fontWeight: 600 }}>Answer: {answerModalData.likert?.[`q${i + 1}`]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {answerModalTitle.startsWith("Post-Activity") && (
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#202124", fontSize: "1rem", marginBottom: 18 }}>Post-Activity Survey</h3>
                    <div style={{ marginBottom: 12 }}><b>Name:</b> {answerModalData.respondent?.name || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>College/Department/Organization:</b> {answerModalData.respondent?.college || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Program:</b> {answerModalData.respondent?.program || ""}</div>
                    {answerModalData.respondent?.college === "Non-Academic Organization" && (
                      <div style={{ marginBottom: 12 }}><b>Organization Name:</b> {answerModalData.respondent?.nonAcademicOrg || ""}</div>
                    )}
                    <div style={{ marginBottom: 12 }}><b>Type of Engagement:</b> {answerModalData.engagement?.type || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Title of Initiative:</b> {answerModalData.engagement?.initiativeTitle || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Date of Implementation:</b> {answerModalData.engagement?.dateOfImplementation || ""}</div>
                    <div style={{ marginBottom: 12 }}><b>Location/Venue:</b> {answerModalData.engagement?.location || ""}</div>
                    <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>Please indicate how much you agree with each statement (1=Strongly Disagree, 5=Strongly Agree):</div>
                    <ol style={{ paddingLeft: 18 }}>
                      {POST_LIKERT.map((q, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                          <span>{q}</span><br />
                          <span style={{ color: "#1a73e8", fontWeight: 600 }}>Answer: {answerModalData.likert?.[`q${i + 1}`]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#9aa0a6" }}>No answers found.</div>
            )}
          </div>
        </div>
      )}

      {/* volunteer contact card popover */}
      {volunteerCard && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(volunteerCard.y, window.innerHeight - 220),
            left: Math.min(volunteerCard.x, window.innerWidth - 272),
            zIndex: 12000,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            border: "1px solid #e8eaed",
            width: 260,
            padding: "16px 18px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {volunteerCard.volunteer.photoURL ? (
              <img
                src={volunteerCard.volunteer.photoURL}
                alt={volunteerCard.volunteer.name}
                style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #e8eaed" }}
              />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#30bdb7",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, flexShrink: 0,
              }}>
                {getInitials(volunteerCard.volunteer.name)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.93rem", color: "#202124", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {volunteerCard.volunteer.name}
              </div>
              {volunteerCard.volunteer.email && (
                <div style={{ fontSize: "0.72rem", color: "#5f6368", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {volunteerCard.volunteer.email}
                </div>
              )}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #f1f3f4", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "Department", value: /\(([^)]+)\)$/.exec(volunteerCard.volunteer.department)?.[1] || volunteerCard.volunteer.department },
              { label: "Level", value: volunteerCard.volunteer.level },
              { label: "Points", value: volunteerCard.volunteer.totalPoints ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                <span style={{ color: "#80868b" }}>{label}</span>
                <span style={{ color: "#202124", fontWeight: 600 }}>{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pointsPopover && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(pointsPopover.y, window.innerHeight - 240),
            left: Math.min(pointsPopover.x, window.innerWidth - 230),
            zIndex: 12000,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            border: "1px solid #e8eaed",
            width: 220,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Points Breakdown</div>
          {pointsPopover.roleBasePoints != null && (
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 6 }}>
              Role base {pointsPopover.roleBasePoints} x rating {pointsPopover.multiplier}
            </div>
          )}
          {[
            { label: "✅ Requirements", value: pointsPopover.requirementPoints },
            { label: "Role / Rating", value: pointsPopover.roleRatingPoints },
            ...(pointsPopover.taskJournalPoints > 0 ? [{ label: "Task proof", value: pointsPopover.taskJournalPoints }] : []),
            ...(pointsPopover.bonusPoints > 0 ? [{ label: "⭐ Bonuses", value: pointsPopover.bonusPoints }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#5f6368" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "#202124" }}>+{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, paddingTop: 8, marginTop: 2 }}>
            <span style={{ color: "#202124" }}>Total</span>
            <span style={{ color: "#f59e0b" }}>{pointsPopover.displayTotal} pts</span>
          </div>
        </div>
      )}
    </>
  );
}
