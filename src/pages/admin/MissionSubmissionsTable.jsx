import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc, deleteField, increment } from "firebase/firestore";
import { computeFinalPoints } from "../../hooks/rewardSystem";
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
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackActive, setIsFeedbackActive] = useState(true);
  const [missionAvgRating, setMissionAvgRating] = useState(0);
  const [missionLocation, setMissionLocation] = useState("");
  const [missionDate, setMissionDate] = useState(null);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerModalTitle, setAnswerModalTitle] = useState("");
  const [answerModalData, setAnswerModalData] = useState(null);
  const [issuingCertFor, setIssuingCertFor] = useState(null);
  const [isReleasingFor, setIsReleasingFor] = useState(null);
  const [volunteerCard, setVolunteerCard] = useState(null);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalModalVolunteer, setJournalModalVolunteer] = useState(null);
  const [approvingJournal, setApprovingJournal] = useState(null);

  useEffect(() => {
    if (!volunteerCard) return;
    const close = () => setVolunteerCard(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [volunteerCard]);

  useEffect(() => {
    if (!missionId) return;
    loadVolunteers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, refreshKey]);

  const loadVolunteers = async () => {
    setLoading(true);
    try {
      const missionSnap = await getDoc(doc(db, "missions", missionId));
      const missionData = missionSnap.data() || {};
      setIsFeedbackActive(missionData?.feedback?.isActive !== false);
      setMissionAvgRating(missionData?.feedback?.avgRating || 0);
      setMissionLocation(missionData.location || "");
      const td = missionData.targetDate;
      setMissionDate(td?.toDate ? td.toDate() : td ? new Date(td) : null);

      const snap = await getDocs(collection(db, "missions", missionId, "volunteer"));
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

      const tasksSnap = await getDocs(collection(db, "missions", missionId, "task"));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const result = await Promise.all(snap.docs.map(async (d) => {
        const userId = d.id;
        const vData = d.data();
        const userData = usersMap.get(userId);
        const rawName = userData?.name || userData?.username || "Unknown User";

        let preSurveyAnswers = null;
        let postSurveyAnswers = null;

        try {
          const preDoc = await getDoc(doc(db, "missions", missionId, "volunteer", userId, "preSurvey", "response"));
          if (preDoc.exists()) preSurveyAnswers = preDoc.data();
        } catch {
          preSurveyAnswers = null;
        }

        try {
          const postDoc = await getDoc(doc(db, "missions", missionId, "volunteer", userId, "postSurvey", "response"));
          if (postDoc.exists()) postSurveyAnswers = postDoc.data();
        } catch {
          postSurveyAnswers = null;
        }

        const journals = [];
        for (const task of tasks) {
          try {
            const pSnap = await getDoc(doc(db, "missions", missionId, "task", task.id, "participants", userId));
            if (pSnap.exists()) {
              const pData = pSnap.data();
              if (pData.reflection && pData.reflection.trim()) {
                if (task.type === "grouped" && pData.groupId) {
                  const groupSnap = await getDoc(doc(db, "missions", missionId, "task", task.id, "group", pData.groupId));
                  const groupData = groupSnap.exists() ? groupSnap.data() : {};
                  journals.push({
                    taskId: task.id,
                    taskTitle: task.title || `Task ${task.id}`,
                    type: "grouped",
                    groupId: pData.groupId,
                    reflection: groupData.reflection || pData.reflection,
                    adminApprovalStatus: groupData.adminApprovalStatus || pData.adminApprovalStatus || "pending",
                    pendingPoints: pData.pendingPoints || Number(task.points) || 0,
                  });
                } else {
                  journals.push({
                    taskId: task.id,
                    taskTitle: task.title || `Task ${task.id}`,
                    type: task.type || "individual",
                    reflection: pData.reflection,
                    adminApprovalStatus: pData.adminApprovalStatus || "pending",
                    pendingPoints: pData.pendingPoints || 0,
                  });
                }
              }
            }
          } catch {
            // skip tasks that fail to load
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
          preSurveyAnswers,
          postSurveyAnswers,
          journals,
        };
      }));

      setVolunteers(result);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipationChange = async (volunteerId, value) => {
    try {
      await updateDoc(doc(db, "missions", missionId, "volunteer", volunteerId), { participationStatus: value });
      logAudit({
        action: "VOLUNTEER_PARTICIPATION_UPDATED",
        category: "event",
        details: {
          missionId,
          targetUserId: volunteerId,
          targetUserName: volunteers.find(v => v.id === volunteerId)?.name || "",
          participationStatus: value,
        },
      });
      setVolunteers(prev => prev.map(v => v.id === volunteerId ? { ...v, participationStatus: value } : v));
    } catch {
      showToast("Failed to update participation status.");
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
        shouldRevokeBonus = volunteerDocSnap.exists() && !!volunteerDocSnap.data().requirementBonus?.consent;
      }

      const updateData = { "consentSubmission.reviewStatus": value };
      if (shouldRevokeBonus) updateData["requirementBonus.consent"] = deleteField();

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
    setApprovingJournal({ volunteerId, taskId });
    try {
      if (type === "grouped" && groupId) {
        await updateDoc(doc(db, "missions", missionId, "task", taskId, "group", groupId), approvalData);
        const membersSnap = await getDocs(collection(db, "missions", missionId, "task", taskId, "participants"));
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

      try {
        await createNotification(volunteerId, {
          type: decision === "approved" ? "journal_approved" : "journal_rejected",
          title: `Journal ${decision === "approved" ? "Approved" : "Rejected"}`,
          message: `Your journal for "${journal.taskTitle}" has been ${decision}.`,
          link: `/event/${missionId}/activity`,
        });
      } catch { /* notification failure is non-fatal */ }

      logAudit({
        action: `JOURNAL_${decision.toUpperCase()}`,
        category: "event",
        details: { missionId, targetUserId: volunteerId, taskId, taskTitle: journal.taskTitle },
      });
      showToast(`Journal ${decision === "approved" ? "approved" : "rejected"}.`);
    } catch {
      showToast("Failed to update journal approval status.");
    } finally {
      setApprovingJournal(null);
    }
  };

  if (loading) return <p style={{ color: "#888", padding: 16 }}>Loading submissions…</p>;

  return (
    <>
      {isFeedbackActive && (
        <div style={{ background: "#e8f0fe", color: "#1a73e8", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600, border: "1px solid #c5d9fd", fontSize: "0.85rem" }}>
          ⚠ Community feedback form is still active. Points cannot be released yet.
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaed" }}>
        <div style={{ width: "100%", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: "0.84rem" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #e8eaed" }}>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>
                Volunteer
                <span style={{ marginLeft: 8, background: "#f1f3f4", color: "#5f6368", borderRadius: 99, fontSize: "0.68rem", padding: "2px 7px", fontWeight: 600 }}>
                  {volunteers.length}
                </span>
              </th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "left", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Role</th>
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Attendance</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Pre-Survey</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Consent Form</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Post-Survey</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Journal</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Participation</th>
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Done %</th>
              <th style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Points</th>
              <th style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2, padding: "12px 16px", fontWeight: 600, color: "#5f6368", fontSize: "0.8rem", textAlign: "center", whiteSpace: "nowrap", boxShadow: "inset 0 -1.5px 0 #e8eaed" }}>Release</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 32, color: "#9aa0a6", fontSize: "0.85rem" }}>No submissions found.</td>
              </tr>
            ) : volunteers.map((v, idx) => {
              const rawRoles = v.preSurveyAnswers?.engagement?.participation || [];
              const normalizedRoles = rawRoles.map(r => r.trim().toLowerCase().replace(/\s+/g, "_"));
              const isDonorOnly = normalizedRoles.includes("donor") && !normalizedRoles.includes("participant");
              const hasConsentSubmission = Boolean(v.consentSubmission?.fileUrl);
              const consentReviewStatus = v.consentSubmission?.reviewStatus || "";
              const isConsentApproved = consentReviewStatus === "approved";

              const journals = v.journals || [];
              const approvedJournalCount = journals.filter(j => j.adminApprovalStatus === "approved").length;
              const allJournalsApproved = journals.length === 0 || approvedJournalCount === journals.length;

              const requiredItems = isDonorOnly
                ? [v.participationStatus]
                : [
                    v.preSurveyAnswers,
                    v.postSurveyAnswers,
                    isConsentApproved,
                    v.progress?.attendance === "present",
                    v.participationStatus,
                    ...(journals.length > 0 ? [allJournalsApproved] : []),
                  ];

              const completedItems = requiredItems.filter(Boolean).length;
              const individualCompletion = Math.round((completedItems / requiredItems.length) * 100);

              let previewPoints = null;
              let breakdown = null;
              if (v.participationStatus && rawRoles.length > 0) {
                breakdown = computeFinalPoints(rawRoles, missionAvgRating, v.participationStatus.toLowerCase());
                previewPoints = breakdown.finalPoints;
              }

              const isReadyToRelease =
                (individualCompletion === 100 || v.participationStatus === "no_show") &&
                !isFeedbackActive &&
                !v.releasedAt;

              return (
                <tr key={v.id} style={{ borderBottom: idx < volunteers.length - 1 ? "1px dashed #e8eaed" : "none" }}>
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
                  <td style={{ padding: "12px 16px", color: "#5f6368", fontSize: "0.82rem" }}>
                    {rawRoles.map(r => r.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", background: "#f8f9fa" }}>
                    {v.progress?.attendance === "present"
                      ? <span style={{ color: "#137333", fontWeight: 700, fontSize: "0.82rem" }}>✓ Present</span>
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
                    {journals.length === 0 ? (
                      <span style={{ color: "#9aa0a6", fontSize: "0.8rem" }}>—</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: allJournalsApproved ? "#137333" : "#202124" }}>
                          {approvedJournalCount}/{journals.length}
                        </span>
                        <button
                          disabled={!!v.releasedAt}
                          style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #30bdb7", background: "#fff", color: "#30bdb7", cursor: !!v.releasedAt ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap" }}
                          onClick={() => { setJournalModalVolunteer(v); setShowJournalModal(true); }}
                        >
                          Review
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <select
                      value={v.participationStatus || ""}
                      disabled={!!v.releasedAt}
                      onChange={e => handleParticipationChange(v.id, e.target.value)}
                      style={{ padding: "4px 8px", border: "1px solid #dadce0", borderRadius: 6, fontSize: "0.78rem", fontFamily: "inherit", color: "#202124", background: "#fff", cursor: !!v.releasedAt ? "not-allowed" : "pointer", maxWidth: 110 }}
                    >
                      <option value="">Select</option>
                      <option value="verified">Verified</option>
                      <option value="partial">Partial</option>
                      <option value="minimal">Minimal</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, background: "#f8f9fa", color: individualCompletion === 100 ? "#137333" : "#202124" }}>
                    {individualCompletion}%
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", background: "#f8f9fa" }}>
                    {v.releasedAt
                      ? <span style={{ fontWeight: 700, color: "#202124" }}>{v.pointsEarned}</span>
                      : individualCompletion === 100 && previewPoints !== null
                        ? <span title={breakdown ? `Base: ${breakdown.base} | ×${breakdown.multiplier} | Factor: ${breakdown.factor}` : ""} style={{ cursor: "help", fontWeight: 600, color: "#5f6368" }}>{previewPoints}</span>
                        : <span style={{ color: "#9aa0a6" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {v.releasedAt ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#137333", fontWeight: 700, fontSize: "0.8rem" }}>✓ Released</span>
                        {!v.certIssuedAt && (
                          <button
                            disabled={issuingCertFor === v.id}
                            style={{ padding: "3px 8px", background: issuingCertFor === v.id ? "#f1f3f4" : "#fff", color: "#1a73e8", border: "1px solid #1a73e8", borderRadius: 6, fontWeight: 600, fontSize: "0.72rem", cursor: issuingCertFor === v.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                            onClick={async () => {
                              setIssuingCertFor(v.id);
                              try {
                                const certDate = missionDate || new Date();
                                const certDay = String(certDate.getDate());
                                const certMonth = certDate.toLocaleString("en-US", { month: "long" });
                                const certYear = String(certDate.getFullYear());
                                await issueCertificate({
                                  userId: v.id,
                                  recipient: v.name,
                                  course: missionTitle || "",
                                  date: `${certMonth} ${certDay}, ${certYear}`,
                                  loc: missionLocation,
                                  day: certDay,
                                  month: certMonth,
                                  year: certYear,
                                });
                                await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { certIssuedAt: new Date().toISOString() });
                                setVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, certIssuedAt: new Date().toISOString() } : vol));
                                showToast("Certificate issued successfully!");
                              } catch (err) {
                                showToast("Failed to issue certificate: " + err.message);
                              } finally {
                                setIssuingCertFor(null);
                              }
                            }}
                          >
                            {issuingCertFor === v.id ? "Issuing…" : "Issue Cert"}
                          </button>
                        )}
                        {v.certIssuedAt && (
                          <span style={{ color: "#1a73e8", fontSize: "0.72rem", fontWeight: 600 }}>🎓 Cert issued</span>
                        )}
                      </div>
                    ) : isReadyToRelease ? (
                      <button
                        disabled={isReleasingFor === v.id}
                        style={{ padding: "4px 12px", background: isReleasingFor === v.id ? "#e8f0fe" : "#1a73e8", color: isReleasingFor === v.id ? "#1a73e8" : "#fff", border: isReleasingFor === v.id ? "1px solid #1a73e8" : "none", borderRadius: 6, fontWeight: 600, fontSize: "0.78rem", cursor: isReleasingFor === v.id ? "not-allowed" : "pointer" }}
                        onClick={async () => {
                          setIsReleasingFor(v.id);
                          try {
                            const finalPoints = await releaseVolunteerPoints(missionId, v.id);
                            await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { completionStatus: "complete" });
                            setVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, pointsEarned: finalPoints, releasedAt: new Date().toISOString() } : vol));

                            const certDate = missionDate || new Date();
                            const certDay = String(certDate.getDate());
                            const certMonth = certDate.toLocaleString("en-US", { month: "long" });
                            const certYear = String(certDate.getFullYear());
                            const certDateStr = `${certMonth} ${certDay}, ${certYear}`;

                            try {
                              await issueCertificate({
                                userId: v.id,
                                recipient: v.name,
                                course: missionTitle || "",
                                date: certDateStr,
                                loc: missionLocation,
                                day: certDay,
                                month: certMonth,
                                year: certYear,
                              });
                              await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { certIssuedAt: new Date().toISOString() });
                              setVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, certIssuedAt: new Date().toISOString() } : vol));
                            } catch {
                              showToast("Points released, but certificate could not be generated automatically.");
                            }
                          } catch (err) {
                            showToast(err.message);
                          } finally {
                            setIsReleasingFor(null);
                          }
                        }}
                      >{isReleasingFor === v.id ? "Releasing…" : "Release"}</button>
                    ) : (
                      <span style={{ color: "#dadce0", fontWeight: 600, fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Journal Review Modal */}
      {showJournalModal && journalModalVolunteer && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 11000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowJournalModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 480, maxWidth: "90vw", boxShadow: "0 4px 24px rgba(0,0,0,0.18)", position: "relative", color: "#202124", maxHeight: "82vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <button className="admin-modal-close admin-modal-close--absolute" onClick={() => setShowJournalModal(false)}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: 4, color: "#202124", fontSize: "1.05rem", fontWeight: 700 }}>Journal Submissions</h2>
            <p style={{ textAlign: "center", color: "#5f6368", fontSize: "0.85rem", marginBottom: 24 }}>{journalModalVolunteer.name}</p>
            {journalModalVolunteer.journals.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9aa0a6" }}>No journal submissions found.</p>
            ) : journalModalVolunteer.journals.map(journal => {
              const isApproving = approvingJournal?.volunteerId === journalModalVolunteer.id && approvingJournal?.taskId === journal.taskId;
              return (
                <div key={journal.taskId} style={{ marginBottom: 20, border: "1px solid #e8eaed", borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#202124" }}>{journal.taskTitle}</span>
                      <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#80868b", background: "#f1f3f4", borderRadius: 99, padding: "1px 7px" }}>
                        {journal.type === "grouped" ? "Group" : "Individual"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: journal.adminApprovalStatus === "approved" ? "#137333" : journal.adminApprovalStatus === "rejected" ? "#d93025" : "#f9ab00" }}>
                      {journal.adminApprovalStatus === "approved" ? "Approved" : journal.adminApprovalStatus === "rejected" ? "Rejected" : "Pending"}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "#3c4043", lineHeight: 1.6, margin: "0 0 12px 0", background: "#f8f9fa", borderRadius: 6, padding: "10px 12px" }}>
                    {journal.reflection}
                  </p>
                  {journal.adminApprovalStatus === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={isApproving}
                        onClick={() => handleJournalApproval(journalModalVolunteer, journal, "approved")}
                        style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: isApproving ? "#e6f4ea" : "#137333", color: isApproving ? "#137333" : "#fff", fontWeight: 600, fontSize: "0.78rem", cursor: isApproving ? "not-allowed" : "pointer" }}
                      >
                        {isApproving ? "Saving…" : "Approve"}
                      </button>
                      <button
                        disabled={isApproving}
                        onClick={() => handleJournalApproval(journalModalVolunteer, journal, "rejected")}
                        style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #d93025", background: "#fff", color: "#d93025", fontWeight: 600, fontSize: "0.78rem", cursor: isApproving ? "not-allowed" : "pointer" }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {journal.adminApprovalStatus !== "pending" && !journalModalVolunteer.releasedAt && (
                    <button
                      disabled={isApproving}
                      onClick={() => handleJournalApproval(journalModalVolunteer, journal, "pending")}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #dadce0", background: "#fff", color: "#5f6368", fontWeight: 600, fontSize: "0.72rem", cursor: isApproving ? "not-allowed" : "pointer" }}
                    >
                      Reset to Pending
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
    </>
  );
}
