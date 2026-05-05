import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { computeFinalPoints } from "../../hooks/rewardSystem";
import { releaseVolunteerPoints } from "../global/rewardSaveSystem";
import { showToast } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
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
export default function MissionSubmissionsTable({ missionId, missionTitle }) {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackActive, setIsFeedbackActive] = useState(true);
  const [missionAvgRating, setMissionAvgRating] = useState(0);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerModalTitle, setAnswerModalTitle] = useState("");
  const [answerModalData, setAnswerModalData] = useState(null);

  useEffect(() => {
    if (!missionId) return;
    loadVolunteers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const loadVolunteers = async () => {
    setLoading(true);
    try {
      const missionSnap = await getDoc(doc(db, "missions", missionId));
      const missionData = missionSnap.data() || {};
      setIsFeedbackActive(missionData?.feedback?.isActive !== false);
      setMissionAvgRating(missionData?.feedback?.avgRating || 0);

      const snap = await getDocs(collection(db, "missions", missionId, "volunteer"));
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

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
        } catch (_) {}

        try {
          const postDoc = await getDoc(doc(db, "missions", missionId, "volunteer", userId, "postSurvey", "response"));
          if (postDoc.exists()) postSurveyAnswers = postDoc.data();
        } catch (_) {}

        return {
          ...vData,
          id: userId,
          name: toTitleCase(rawName),
          preSurveyAnswers,
          postSurveyAnswers,
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
    } catch (_) {
      showToast("Failed to update participation status.");
    }
  };

  const handleViewAnswers = (volunteer, type) => {
    const data = type === "pre" ? volunteer.preSurveyAnswers : volunteer.postSurveyAnswers;
    const prefix = type === "pre" ? "Pre-Activity" : "Post-Activity";
    setAnswerModalTitle(`${prefix} Survey Answers${volunteer.name ? ` - ${volunteer.name}` : ""}`);
    setAnswerModalData(data);
    setShowAnswerModal(true);
  };

  if (loading) return <p style={{ color: "#888", padding: 16 }}>Loading submissions…</p>;

  return (
    <>
      {isFeedbackActive && (
        <div style={{ background: "#fff3cd", color: "#856404", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>
          Community feedback form is still active. Points cannot be released yet.
        </div>
      )}

      <div className="table-scroll-wrapper">
        <table className="submission-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 8px #0001" }}>
          <thead>
            <tr style={{ background: "#f3f4f8", color: "#23335b", borderBottom: "2px solid #e0e4ea" }}>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "left", fontSize: "1.05rem" }}>Volunteer Name / Participant</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Role</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Attendance</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Pre-Activity Survey</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Activity Consent Form</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Post-Activity Form</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Participation Factor</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Completion %</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}>Points</th>
              <th style={{ padding: "14px 10px", fontWeight: 700, borderRight: "1px solid #e0e4ea", textAlign: "center", fontSize: "1.05rem" }}> </th>
              <th style={{ padding: "14px 10px", fontWeight: 700, textAlign: "center", fontSize: "1.05rem" }}>Certificate</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 24, color: "#888", background: "#fff" }}>No submissions found.</td>
              </tr>
            ) : volunteers.map((v, idx) => {
              const rawRoles = v.preSurveyAnswers?.engagement?.participation || [];
              const normalizedRoles = rawRoles.map(r => r.trim().toLowerCase().replace(/\s+/g, "_"));
              const isDonorOnly = normalizedRoles.includes("donor") && !normalizedRoles.includes("participant");

              const requiredItems = isDonorOnly
                ? [v.participationStatus]
                : [v.preSurveyAnswers, v.postSurveyAnswers, v.progress?.consent === "submitted", v.progress?.attendance === "present", v.participationStatus];

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
                <tr key={v.id} style={{ background: idx % 2 === 0 ? "#f8f9fb" : "#fff", color: "#23335b" }}>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "left", fontWeight: 500 }}>{v.name}</td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center", fontWeight: 500 }}>
                    {rawRoles.map(r => r.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(", ") || "-"}
                  </td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center" }}>
                    {v.progress?.attendance === "present" ? "Present" : ""}
                  </td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center" }}>
                    {v.preSurveyAnswers
                      ? <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #30bdb7", background: "#f3f4f8", color: "#23335b", cursor: "pointer", fontWeight: 600 }} onClick={() => handleViewAnswers(v, "pre")}>View Answers</button>
                      : ""}
                  </td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center" }}>
                    {v.progress?.consent === "submitted" && v.consentSubmission?.fileUrl
                      ? <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #30bdb7", background: "#f3f4f8", color: "#23335b", cursor: "pointer", fontWeight: 600 }} onClick={() => window.open(v.consentSubmission.fileUrl, "_blank")}>View PDF</button>
                      : ""}
                  </td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center" }}>
                    {v.postSurveyAnswers
                      ? <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #30bdb7", background: "#f3f4f8", color: "#23335b", cursor: "pointer", fontWeight: 600 }} onClick={() => handleViewAnswers(v, "post")}>View Answers</button>
                      : ""}
                  </td>
                  <td className="submission-table-cell">
                    <select
                      className="participation-select"
                      value={v.participationStatus || ""}
                      disabled={!!v.releasedAt}
                      onChange={e => handleParticipationChange(v.id, e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="verified">Verified</option>
                      <option value="partial">Partial</option>
                      <option value="minimal">Minimal</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 10px", borderBottom: "1px solid #e0e4ea", borderRight: "1px solid #e0e4ea", textAlign: "center", fontWeight: 600 }}>
                    {individualCompletion}%
                  </td>
                  <td className="submission-table-cell">
                    {v.releasedAt
                      ? v.pointsEarned
                      : individualCompletion === 100 && previewPoints !== null
                        ? <span title={breakdown ? `Base: ${breakdown.base} | ×${breakdown.multiplier} | Factor: ${breakdown.factor}` : ""} style={{ cursor: "help" }}>{previewPoints}</span>
                        : "-"}
                  </td>
                  <td className="submission-table-cell" style={{ textAlign: "center" }}>
                    {v.releasedAt ? (
                      <span style={{ fontWeight: 700, color: "#555" }}>Released</span>
                    ) : isReadyToRelease ? (
                      <button
                        style={{ background: "#30bdb7", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 600, cursor: "pointer" }}
                        onClick={async () => {
                          try {
                            const finalPoints = await releaseVolunteerPoints(missionId, v.id);
                            await updateDoc(doc(db, "missions", missionId, "volunteer", v.id), { completionStatus: "complete" });
                            setVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, pointsEarned: finalPoints, releasedAt: new Date().toISOString() } : vol));
                          } catch (err) {
                            showToast(err.message);
                          }
                        }}
                      >Release</button>
                    ) : (
                      <span style={{ color: "#c0c0c0", fontWeight: 600 }}>Release</span>
                    )}
                  </td>
                  <td className="submission-table-cell" style={{ textAlign: "center" }}>
                    <button
                      style={{ background: "#1a3764", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => navigate("/certificate-generator", { state: { userID: v.id, recipient: v.name, course: missionTitle || "" } })}
                    >Certificate</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Answer Modal */}
      {showAnswerModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(44,62,80,0.18)", zIndex: 11000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAnswerModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 32, minWidth: 400, maxWidth: "90vw", boxShadow: "0 2px 16px #0002", position: "relative", color: "#000", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <button style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#23335b" }} onClick={() => setShowAnswerModal(false)}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: 24, color: "#000" }}>{answerModalTitle}</h2>
            {answerModalData ? (
              <div style={{ maxWidth: 600, margin: "0 auto" }}>
                {answerModalTitle.startsWith("Pre-Activity") && (
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#23235b", fontSize: "1.08rem", marginBottom: 18 }}>Pre-Activity Survey</h3>
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
                          <span style={{ color: "#30bdb7", fontWeight: 600 }}>Answer: {answerModalData.likert?.[`q${i + 1}`]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {answerModalTitle.startsWith("Post-Activity") && (
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#23235b", fontSize: "1.08rem", marginBottom: 18 }}>Post-Activity Survey</h3>
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
                          <span style={{ color: "#30bdb7", fontWeight: 600 }}>Answer: {answerModalData.likert?.[`q${i + 1}`]}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#888" }}>No answers found.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
