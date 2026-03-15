import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListAltOutlinedIcon } from "../../components/icons/index";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { computeFinalPoints } from "../../hooks/rewardSystem";
import { releaseVolunteerPoints } from "../global/rewardSaveSystem";
import "../../styles/DocumentLibrary.css";

function toTitleCase(str) {
  if (!str) return str;

  return str
    .toLowerCase()
    .split(" ")
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function DocumentLibrary() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [currentMissionId, setCurrentMissionId] = useState(null);
  const [missionAvgRating, setMissionAvgRating] = useState(0);
  const [isMissionReleased, setIsMissionReleased] = useState(false);
  const [isFeedbackActive, setIsFeedbackActive] = useState(true);
  const [volunteers, setVolunteers] = useState([]);
  const allComplete =
    volunteers.length > 0 &&
    volunteers.every(v => {
      const completedItems = [
        v.preSurveyAnswers,
        v.postSurveyAnswers,
        v.progress?.consent === "submitted",
        v.progress?.attendance === "present",
        v.participationStatus
      ].filter(Boolean).length;

      return completedItems === 5;
    });
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answerModalTitle, setAnswerModalTitle] = useState("");
  const [answerModalData, setAnswerModalData] = useState(null);

  const fetchApprovedProposals = async () => {
    const snap = await getDocs(collection(db, "missions"));
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => doc.status === "published");
  };
  const fetchVolunteerStats = async (missionId) => {
    const snap = await getDocs(
      collection(db, "missions", missionId, "volunteer")
    );
    const volunteers = snap.docs.map(d => d.data());
    const total = volunteers.length;
    const count = (key, value) =>
      volunteers.filter(v => v.progress?.[key] === value).length;
    const completed =
      count("preSurvey", "submitted") +
      count("consent", "submitted") +
      count("attendance", "present") +
      count("postSurvey", "submitted");

    const maxPossible = total * 4;

    return {
      total,
      preSurvey: count("preSurvey", "submitted"),
      consent: count("consent", "submitted"),
      attendance: count("attendance", "present"),
      postSurvey: count("postSurvey", "submitted"),
      completionRate:
        maxPossible === 0
          ? 0
          : Math.round((completed / maxPossible) * 100),
    };
  };

  // set participation factor for computation
  const handleParticipationChange = async (missionId, volunteerId, value) => {
    try {
      await updateDoc(
        doc(db, "missions", missionId, "volunteer", volunteerId),
        {
          participationStatus: value,
        }
      );
      setVolunteers(prev =>
        prev.map(v =>
          v.id === volunteerId ? { ...v, participationStatus: value } : v
        )
      );

    } catch (err) {
      console.error("Error updating participation:", err);
      alert("Failed to update participation status.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const missions = await fetchApprovedProposals();

      const statsMap = {};
      for (const mission of missions) {
        statsMap[mission.id] = await fetchVolunteerStats(mission.id);
      }

      setProposals(missions);
      setStats(statsMap);
      setLoading(false);
    };

    loadData();
  }, []);

  // Card style with hover effect
  const cardStyle = (isHovered) => ({
    flex: '1 1 320px',
    minWidth: 320,
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    boxShadow: isHovered ? '0 4px 16px #1a376433' : '0 2px 8px #0001',
    padding: '24px',
    marginBottom: 18,
    color: '#000',
    border: '2px solid #1a3764',
    transition: 'box-shadow 0.2s, transform 0.2s',
    transform: isHovered ? 'translateY(-4px) scale(1.03)' : 'none',
    cursor: 'pointer',
  });

  // Override font color for all text in document-library
  const documentLibraryStyle = {
    color: '#000',
  };

  const handleViewSubmissions = async (missionId) => {
    setCurrentMissionId(missionId);
    const missionSnap = await getDoc(doc(db, "missions", missionId));
    const missionData = missionSnap.data();
    const isReleased = missionData?.released === true;
    const avgRating = missionData?.feedback?.avgRating || 0;
    const feedbackActive = missionData?.feedback?.isActive !== false;

    setIsFeedbackActive(feedbackActive);
    setShowSubmissionsModal(true);
    // Fetch volunteers for the selected mission
    const snap = await getDocs(
      collection(db, "missions", missionId, "volunteer")
    );

    const volunteersRaw = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const usersSnap = await getDocs(collection(db, "users"));
    const usersMap = new Map();

    usersSnap.docs.forEach(userDoc => {
      usersMap.set(userDoc.id, userDoc.data());
    });

    const volunteers = await Promise.all(
      volunteersRaw.map(async (v) => {

        // Fetching survey answers
        let preSurveyAnswers = null;
        let postSurveyAnswers = null;

        try {
          const preDoc = await getDoc(
            doc(db, "missions", missionId, "volunteer", v.id, "preSurvey", "response")
          );
          if (preDoc.exists()) preSurveyAnswers = preDoc.data();
        } catch (e) { }

        try {
          const postDoc = await getDoc(
            doc(db, "missions", missionId, "volunteer", v.id, "postSurvey", "response")
          );
          if (postDoc.exists()) postSurveyAnswers = postDoc.data();
        } catch (e) { }

        const userData = usersMap.get(v.id);
        //validation to keep names in title case
        const rawName = userData?.name || userData?.username || "Unknown User";

        return {
          ...v,
          name: toTitleCase(rawName),
          preSurveyAnswers,
          postSurveyAnswers
        };
      })
    );

    setVolunteers(volunteers);
    setMissionAvgRating(avgRating);
    setIsMissionReleased(isReleased);
  };

  // Helper to open answer modal
  const handleViewAnswers = (volunteer, type) => {
    let title = type === 'pre' ? 'Pre-Activity Survey Answers' : 'Post-Activity Survey Answers';
    let data = type === 'pre' ? volunteer.preSurveyAnswers : volunteer.postSurveyAnswers;
    // fallback for old data structure
    if (!data && volunteer.answers) {
      data = volunteer.answers;
    }
    setAnswerModalTitle(title + (volunteer.name ? ` - ${volunteer.name}` : ''));
    setAnswerModalData(data);
    setShowAnswerModal(true);
  };

  return (
    <>
      <div className="document-library" style={documentLibraryStyle}>
        <h2>Document Library</h2>

        {loading ? (
          <p className="loading-state">Loading submissions…</p>
        ) : proposals.length === 0 ? (
          <p className="empty-state">No approved events found.</p>
        ) : (
          <div className="library-grid">
            {proposals.map((mission) => {
              // Find volunteers for this mission if modal is open for this mission
              const missionVolunteers = currentMissionId === mission.id ? volunteers : [];
              // Fallback to stats if not viewing submissions
              const s = stats[mission.id];

              // Use live data if available, otherwise fallback to stats
              const total = missionVolunteers.length || s?.total || 0;
              const preSurvey = missionVolunteers.length ? missionVolunteers.filter(v => v.preSurveyAnswers).length : s?.preSurvey || 0;
              const postSurvey = missionVolunteers.length ? missionVolunteers.filter(v => v.postSurveyAnswers).length : s?.postSurvey || 0;
              const consent = missionVolunteers.length ? missionVolunteers.filter(v => v.progress?.consent === 'submitted').length : s?.consent || 0;
              const attendance = missionVolunteers.length ? missionVolunteers.filter(v => v.progress?.attendance === 'present').length : s?.attendance || 0;

              return (
                <div key={mission.id} className="library-card" style={{
                  background: '#fff',
                  borderRadius: '20px',
                  boxShadow: '0 2px 8px #0001',
                  padding: '32px 24px',
                  marginBottom: '24px',
                  color: '#23335b',
                  border: '2px solid #23335b',
                  maxWidth: '380px',
                  minWidth: '260px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ marginBottom: 18, fontWeight: 700, fontSize: '1.25rem', textAlign: 'center' }}>{mission.title || mission.name}</h3>
                    <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #e0e4ea', margin: '0 0 18px 0' }} />
                    <p className="library-meta" style={{ marginBottom: 8, fontWeight: 600, fontSize: '1.1rem', textAlign: 'center' }}>
                      Volunteers Joined: {total}
                    </p>
                    <ul className="library-meta" style={{ marginBottom: 24, paddingLeft: 18, color: '#23335b', fontSize: '1rem', textAlign: 'left' }}>
                      <li>Pre-Activity Survey: {preSurvey}</li>
                      <li>Consent Submitted: {consent}</li>
                      <li>Attendance Marked: {attendance}</li>
                      <li>Post-Activity Survey: {postSurvey}</li>
                    </ul>
                  </div>
                  <button
                    className="library-link library-btn"
                    onClick={() => handleViewSubmissions(mission.id)}
                    style={{
                      background: '#30bdb7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '16px 0',
                      fontWeight: 600,
                      fontSize: '1.08rem',
                      cursor: 'pointer',
                      width: '180px',
                      marginBottom: '8px',
                      marginTop: '8px',
                      transition: 'background 0.18s',
                      boxShadow: '0 2px 8px #0001',
                    }}
                  >
                    View Submissions
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submissions Modal - must be outside the map! */}
      {showSubmissionsModal && (
        <div
          className="submission-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(44,62,80,0.08)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowSubmissionsModal(false)}
        >
          <div
            className="submission-modal-content"
            style={{
              background: '#f8f9fb',
              borderRadius: 18,
              padding: 32,
              minWidth: 800,
              maxWidth: '90vw',
              boxShadow: '0 2px 16px #0002',
              position: 'relative',
              color: '#000',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="submission-modal-close"
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                fontSize: 22,
                cursor: 'pointer',
                color: '#23335b',
                boxShadow: '0 1px 4px #0001',
              }}
              onClick={() => setShowSubmissionsModal(false)}
            >
              ×
            </button>

            {/*Headings of the summary table modal */}
            <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#000' }}>Submissions</h2>

            {isFeedbackActive && (
              <div style={{
                background: '#fff3cd',
                color: '#856404',
                padding: '10px 16px',
                borderRadius: 8,
                marginBottom: 16,
                fontWeight: 600,
                textAlign: 'center'
              }}>
                Community feedback form is still active. Points cannot be released yet.
              </div>
            )}

            <div className="table-scroll-wrapper">
              <table className="submission-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 8px #0001' }}>
                <thead>
                  <tr style={{ background: '#f3f4f8', color: '#23335b', borderBottom: '2px solid #e0e4ea' }}>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'left', fontSize: '1.05rem' }}>Student Name / Participant</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Attendance</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Pre-Activity Survey</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Activity Consent Form</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Post-Activity Form</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Participation Factor</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Completion %</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}>Points</th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, borderRight: '1px solid #e0e4ea', textAlign: 'center', fontSize: '1.05rem' }}> </th>
                    <th style={{ padding: '14px 10px', fontWeight: 700, textAlign: 'center', fontSize: '1.05rem' }}>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#888', background: '#fff' }}>No submissions found.</td>

                    </tr>
                  ) : volunteers.map((v, idx) => {
                    const completedItems = [
                      v.preSurveyAnswers,
                      v.postSurveyAnswers,
                      v.progress?.consent === "submitted",
                      v.progress?.attendance === "present",
                      v.participationStatus
                    ].filter(Boolean).length;

                    const individualCompletion = Math.round((completedItems / 5) * 100);
                    // Compute points without saving yet
                    let previewPoints = null;

                    if (v.participationStatus) {
                      const rawRole =
                        v.preSurveyAnswers?.engagement?.participation?.[0] || null;

                      if (rawRole) {
                        const role = rawRole
                          .trim()
                          .toLowerCase()
                          .replace(/\s+/g, "_");

                        console.log("Volunteer:", v.name);
                        console.log("Raw Role:", rawRole);
                        console.log("Normalized Role:", role);

                        const normalizedParticipation =
                          v.participationStatus?.toLowerCase();

                        console.log("====== PREVIEW DEBUG ======");
                        console.log("Volunteer:", v.name);
                        console.log("Role (raw):", rawRole);
                        console.log("Role (normalized):", role);
                        console.log("missionAvgRating:", missionAvgRating);
                        console.log("Participation (raw):", v.participationStatus);
                        console.log("Participation (normalized):", normalizedParticipation);

                        previewPoints = computeFinalPoints(
                          role,
                          missionAvgRating || 0,
                          normalizedParticipation
                        );

                        console.log("Preview Points:", previewPoints);
                        console.log("===========================");
                      }
                    }

                    const isReadyToRelease =
                      individualCompletion === 100 &&
                      !isFeedbackActive &&
                      !isMissionReleased &&
                      !(v.pointsEarned > 0);

                    return (
                      <tr key={v.id} style={{ background: idx % 2 === 0 ? '#f8f9fb' : '#fff', color: '#23335b' }}>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'left', fontWeight: 500 }}>{v.name}</td>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'center' }}>
                          {v.progress?.attendance === 'present' ? 'Present' : ''}
                        </td>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'center' }}>
                          {v.preSurveyAnswers ? (
                            <button style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #30bdb7', background: '#f3f4f8', color: '#23335b', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleViewAnswers(v, 'pre')}>View Answers</button>
                          ) : ''}
                        </td>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'center' }}>
                          {v.progress?.consent === 'submitted' && v.consentSubmission?.fileUrl ? (
                            <button
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #30bdb7', background: '#f3f4f8', color: '#23335b', cursor: 'pointer', fontWeight: 600 }}
                              onClick={() => window.open(v.consentSubmission.fileUrl, '_blank')}
                            >
                              View PDF
                            </button>
                          ) : ''}
                        </td>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'center' }}>
                          {v.postSurveyAnswers ? (
                            <button style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #30bdb7', background: '#f3f4f8', color: '#23335b', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleViewAnswers(v, 'post')}>View Answers</button>
                          ) : ''}
                        </td>
                        <td className="submission-table-cell">
                          <select
                            className="participation-select"
                            value={v.participationStatus || ""}
                            disabled={isMissionReleased}
                            onChange={(e) =>
                              handleParticipationChange(currentMissionId, v.id, e.target.value)
                            }
                          >
                            <option value="">Select</option>
                            <option value="verified">Verified</option>
                            <option value="partial">Partial</option>
                            <option value="minimal">Minimal</option>
                            <option value="no_show">No-show</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 10px', borderBottom: '1px solid #e0e4ea', borderRight: '1px solid #e0e4ea', textAlign: 'center', fontWeight: 600 }}>
                          {individualCompletion}%
                        </td>

                        <td className="submission-table-cell">
                          {
                            isMissionReleased && v.pointsEarned !== undefined
                              ? v.pointsEarned
                              : individualCompletion === 100
                                ? previewPoints ?? "-"
                                : "-"
                          }
                        </td>
                        {/*release button column */}
                        <td className="submission-table-cell" style={{ textAlign: "center" }}>
                          {/* Already Released */}
                          {v.pointsEarned > 0 ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#555",
                              }}
                            >
                              Released
                            </span>
                          ) : individualCompletion !== 100 ? (
                            /* Not completed – light grey flat text */
                            <span
                              style={{
                                color: "#c0c0c0",
                                fontWeight: 600,
                              }}
                            >
                              Release
                            </span>
                          ) : (
                            /* Completed – teal clickable button */
                            <button
                              style={{
                                background: "#30bdb7",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 14px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                              onClick={async () => {
                                try {
                                  const finalPoints = await releaseVolunteerPoints(
                                    currentMissionId,
                                    v.id
                                  );

                                  setVolunteers(prev =>
                                    prev.map(vol =>
                                      vol.id === v.id
                                        ? { ...vol, pointsEarned: finalPoints }
                                        : vol
                                    )
                                  );

                                } catch (err) {
                                  alert(err.message);
                                }
                              }}
                            >
                              Release
                            </button>
                          )}
                        </td>
                        {/* Certificate column */}
                        <td className="submission-table-cell" style={{ textAlign: "center" }}>
                          <button
                            style={{
                              background: '#1a3764',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 14px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              // Pass userID, recipient, and course/event as state
                              navigate('/certificate-generator', {
                                state: {
                                  userID: v.id, // This is the student's userID
                                  recipient: v.name,
                                  course: (proposals.find(m => m.id === currentMissionId)?.title) || '',
                                }
                              });
                            }}
                          >
                            Certificate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Answer Preview Modal */}
            {showAnswerModal && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(44,62,80,0.18)',
                  zIndex: 11000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowAnswerModal(false)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 32,
                    minWidth: 400,
                    maxWidth: '90vw',
                    boxShadow: '0 2px 16px #0002',
                    position: 'relative',
                    color: '#000',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      background: 'none',
                      border: 'none',
                      fontSize: 22,
                      cursor: 'pointer',
                      color: '#23335b',
                    }}
                    onClick={() => setShowAnswerModal(false)}
                  >
                    ×
                  </button>

                  <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#000' }}>{answerModalTitle}</h2>
                  {answerModalData ? (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                      {/* Pre-Activity Survey Preview */}
                      {answerModalTitle.startsWith('Pre-Activity') && (
                        <div>
                          <h3 style={{ fontWeight: 700, color: '#23235b', fontSize: '1.08rem', marginBottom: 18 }}>Pre-Activity Survey</h3>
                          <div style={{ marginBottom: 12 }}><b>Name:</b> {answerModalData.respondent?.name || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>College/Department/Organization:</b> {answerModalData.respondent?.college || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Program:</b> {answerModalData.respondent?.program || ''}</div>
                          {answerModalData.respondent?.college === 'Non-Academic Organization' && (
                            <div style={{ marginBottom: 12 }}><b>Organization Name:</b> {answerModalData.respondent?.nonAcademicOrg || ''}</div>
                          )}
                          <div style={{ marginBottom: 12 }}><b>Type of Engagement:</b> {answerModalData.engagement?.type || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Title of Initiative:</b> {answerModalData.engagement?.initiativeTitle || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Type/Level of Participation:</b> {(answerModalData.engagement?.participation || []).join(', ')} {answerModalData.engagement?.participationOther ? `, Other: ${answerModalData.engagement?.participationOther}` : ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Previous Community Service Experience:</b> {answerModalData.background?.previousService || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Frequency of Community Service:</b> {answerModalData.background?.frequency || ''}</div>
                          <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>Please indicate how much you agree with each statement (1=Strongly Disagree, 5=Strongly Agree):</div>
                          <ol style={{ paddingLeft: 18 }}>
                            {[
                              'There are existing problems in the community and I can come up with ideas, suggestions, and solutions to address these problems and issues.',
                              'Volunteer work along with teamwork would somehow help solve social problems.',
                              'People in the community come from diverse background, culture, and social standing and it is important to understand these differences in order to help solve problems.',
                              'I would like to make a difference in the community because I have a social and moral obligation to do so. I would do this even if my contribution would seem very little.',
                              'Contributing and improving skills I’ve learned from my degree program or affiliation would somehow solve social problems.',
                              'I would definitely participate in community development initiatives but it would be the last of my priorities because I have to consider other aspects of my life first such as academics, friends, family, recreation, etc.',
                              'I think that the magnitude of issues in our country and in the world in general is so big that whatever I do to help would be insignificant and would not make any difference.',
                              'I would consider participating in community development initiatives whenever I can, and with proper time management and the initiative to do so, I definitely can.'
                            ].map((q, idx) => (
                              <li key={idx} style={{ marginBottom: 6 }}>
                                <span>{q}</span><br />
                                <span style={{ color: '#30bdb7', fontWeight: 600 }}>Answer: {answerModalData.likert && answerModalData.likert[`q${idx + 1}`]}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {/* Post-Activity Survey Preview */}
                      {answerModalTitle.startsWith('Post-Activity') && (
                        <div>
                          <h3 style={{ fontWeight: 700, color: '#23235b', fontSize: '1.08rem', marginBottom: 18 }}>Post-Activity Survey</h3>
                          <div style={{ marginBottom: 12 }}><b>Name:</b> {answerModalData.respondent?.name || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>College/Department/Organization:</b> {answerModalData.respondent?.college || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Program:</b> {answerModalData.respondent?.program || ''}</div>
                          {answerModalData.respondent?.college === 'Non-Academic Organization' && (
                            <div style={{ marginBottom: 12 }}><b>Organization Name:</b> {answerModalData.respondent?.nonAcademicOrg || ''}</div>
                          )}
                          <div style={{ marginBottom: 12 }}><b>Type of Engagement:</b> {answerModalData.engagement?.type || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Title of Initiative:</b> {answerModalData.engagement?.initiativeTitle || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Date of Implementation:</b> {answerModalData.engagement?.dateOfImplementation || ''}</div>
                          <div style={{ marginBottom: 12 }}><b>Location/Venue:</b> {answerModalData.engagement?.location || ''}</div>
                          <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>Please indicate how much you agree with each statement (1=Strongly Disagree, 5=Strongly Agree):</div>
                          <ol style={{ paddingLeft: 18 }}>
                            {[
                              'The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.',
                              'The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.',
                              'Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.',
                              'Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.',
                              'The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.',
                              'I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.',
                              'I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.',
                              'I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.'
                            ].map((q, idx) => (
                              <li key={idx} style={{ marginBottom: 6 }}>
                                <span>{q}</span><br />
                                <span style={{ color: '#30bdb7', fontWeight: 600 }}>Answer: {answerModalData.likert && answerModalData.likert[`q${idx + 1}`]}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#888' }}>No answers found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
