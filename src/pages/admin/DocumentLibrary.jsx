import React, { useEffect, useState } from "react";
import { ListAltOutlinedIcon } from "../../components/icons/index";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function DocumentLibrary() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
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
    color: '#1a3764',
    border: '2px solid #1a3764',
    transition: 'box-shadow 0.2s, transform 0.2s',
    transform: isHovered ? 'translateY(-4px) scale(1.03)' : 'none',
    cursor: 'pointer',
  });

  return (
    <div className="document-library">
      <h2>Document Library</h2>

      {loading ? (
        <p className="loading-state">Loading submissions…</p>
      ) : proposals.length === 0 ? (
        <p className="empty-state">No approved events found.</p>
      ) : (
        <div className="library-grid">
          {proposals.map((mission) => {
            const s = stats[mission.id];
            const completion = s?.completionRate ?? 0;

            return (
              <div key={mission.id} className="library-card">
                <div>
                  <h3>{mission.title || mission.name}</h3>

                  <p className="library-meta">
                    Volunteers Joined: {s?.total ?? 0}
                  </p>

                  <ul className="library-meta">
                    <li>Pre-Activity Survey: {s?.preSurvey ?? 0}</li>
                    <li>Consent Submitted: {s?.consent ?? 0}</li>
                    <li>Attendance Marked: {s?.attendance ?? 0}</li>
                    <li>Post-Activity Survey: {s?.postSurvey ?? 0}</li>
                  </ul>
                </div>

                <div className="library-footer">
                  <a
                    href={`/admin/forms/documents/${mission.id}`}
                    className="library-link"
                  >
                    View Submissions
                  </a>

                  <span
                    className={`library-progress ${completion >= 75 ? "good" : "warn"
                      }`}
                  >
                    {completion}% Complete
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

}
