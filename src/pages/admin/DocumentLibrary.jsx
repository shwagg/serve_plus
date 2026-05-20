import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListAltOutlinedIcon } from "../../components/icons/index";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { showToast, showConfirm } from "../../utils/toast";
import "../../styles/DocumentLibrary.css";
import MissionSubmissionsTable from "./MissionSubmissionsTable";

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
  const [missionTitle, setMissionTitle] = useState("");

  const handleBackfillUserId = async () => {
    if (!await showConfirm("Backfill userId for all existing volunteer documents? This is a one-time fix.")) return;
    const missionsSnap = await getDocs(collection(db, "missions"));
    let updated = 0;
    for (const missionDoc of missionsSnap.docs) {
      const volunteersSnap = await getDocs(collection(db, "missions", missionDoc.id, "volunteer"));
      for (const volunteerDoc of volunteersSnap.docs) {
        if (!volunteerDoc.data().userId) {
          await updateDoc(doc(db, "missions", missionDoc.id, "volunteer", volunteerDoc.id), {
            userId: volunteerDoc.id,
          });
          updated++;
        }
      }
    }
    showToast(`Done. Updated ${updated} volunteer document(s).`);
  };

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

  const handleViewSubmissions = async (missionId, title) => {
    setCurrentMissionId(missionId);
    setMissionTitle(title || "");
    setShowSubmissionsModal(true);
  };

  return (
    <>
      <div className="document-library" style={documentLibraryStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2>Document Library</h2>
          <button
            onClick={handleBackfillUserId}
            style={{ background: '#23335b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Backfill User IDs
          </button>
        </div>

        {loading ? (
          <p className="loading-state">Loading submissions…</p>
        ) : proposals.length === 0 ? (
          <p className="empty-state">No approved events found.</p>
        ) : (
          <div className="library-grid">
            {proposals.map((mission) => {
              const s = stats[mission.id];
              const total = s?.total || 0;
              const preSurvey = s?.preSurvey || 0;
              const postSurvey = s?.postSurvey || 0;
              const consent = s?.consent || 0;
              const attendance = s?.attendance || 0;

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
                    onClick={() => handleViewSubmissions(mission.id, mission.title || mission.name)}
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
              className="submission-modal-close admin-modal-close admin-modal-close--absolute"
              onClick={() => setShowSubmissionsModal(false)}
            >
              ×
            </button>

            <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#000' }}>Submissions</h2>

            <MissionSubmissionsTable missionId={currentMissionId} missionTitle={missionTitle} />
          </div>
        </div>
      )}
    </>
  );
}

