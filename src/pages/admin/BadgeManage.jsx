import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import {
  BADGE_DEFINITIONS,
  BADGE_BY_ID,
  BADGE_CATEGORIES,
} from "../../constants/badgeDefinitions";
import { awardBadge, getStudentBadges } from "../../hooks/badgeSystem";
import BadgeIcon from "../../components/badges/BadgeIcon";
import { useContext } from "react";
import { SessionContext } from "../../context/SessionContext";
import "../../styles/Badge.css";

const INSTITUTIONAL_IDS = ["csce-recognition-award", "outstanding-volunteer"];

function BadgeCatalogTab() {
  const categories = BADGE_CATEGORIES.slice(1); // skip "default" welcome badge
  return (
    <div className="bm-catalog">
      {categories.map((cat) => (
        <div key={cat.key} className="bm-catalog-group">
          <h3 className="bm-catalog-group-title" style={{ color: cat.color }}>
            {cat.label}
          </h3>
          <div className="bm-catalog-grid">
            {BADGE_DEFINITIONS.filter((b) => b.category === cat.key).map((def) => (
              <div key={def.id} className="bm-catalog-card">
                <BadgeIcon badgeId={def.id} earned size="sm" />
                <div className="bm-catalog-info">
                  <div className="bm-catalog-name">{def.name}</div>
                  <div className="bm-catalog-criteria">{def.criteria}</div>
                  <span className={`bm-catalog-type bm-type-${def.triggerType}`}>
                    {def.triggerType === "manual" ? "Manual" : "Automatic"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AwardBadgesTab() {
  const { user } = useContext(SessionContext);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // selected student
  const [studentBadges, setStudentBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [awarding, setAwarding] = useState(null); // badgeId being awarded
  const [toast, setToast] = useState("");

  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const snap = await getDocs(q);
        setStudents(
          snap.docs.map((d) => ({
            uid: d.id,
            displayName: d.data().name || d.data().username || d.data().email || d.id,
            email: d.data().email || "",
            avatar: d.data().avatar || d.data().photoURL || "",
          }))
        );
      } catch (e) {
        console.error("fetchStudents error:", e);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, []);

  const selectStudent = async (student) => {
    setSelected(student);
    setLoadingBadges(true);
    try {
      const badges = await getStudentBadges(student.uid);
      setStudentBadges(badges);
    } catch (e) {
      console.error("getStudentBadges error:", e);
    } finally {
      setLoadingBadges(false);
    }
  };

  const handleAward = async (badgeId) => {
    if (!selected) return;
    setAwarding(badgeId);
    try {
      const awarded = await awardBadge(selected.uid, badgeId, user?.uid ?? "admin");
      if (awarded) {
        setToast(`"${BADGE_BY_ID[badgeId].name}" awarded to ${selected.displayName}!`);
        // Refresh badges
        const badges = await getStudentBadges(selected.uid);
        setStudentBadges(badges);
      } else {
        setToast(`${selected.displayName} already has this badge.`);
      }
    } catch (e) {
      console.error("handleAward error:", e);
      setToast("Something went wrong. Please try again.");
    } finally {
      setAwarding(null);
      setTimeout(() => setToast(""), 3500);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const earnedSet = new Set(studentBadges.map((b) => b.badgeId ?? b.id));

  return (
    <div className="bm-award-layout">
      {/* Left: student list */}
      <div className="bm-student-panel">
        <div className="bm-search-wrap">
          <input
            className="bm-search"
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loadingStudents ? (
          <p className="bm-loading">Loading students…</p>
        ) : filtered.length === 0 ? (
          <p className="bm-empty">No students found.</p>
        ) : (
          <div className="bm-student-list">
            {filtered.map((s) => (
              <div
                key={s.uid}
                className={`bm-student-row${selected?.uid === s.uid ? " selected" : ""}`}
                onClick={() => selectStudent(s)}
              >
                <div className="bm-student-avatar">
                  {s.avatar ? (
                    <img src={s.avatar} alt="" />
                  ) : (
                    <span>{(s.displayName[0] || "?").toUpperCase()}</span>
                  )}
                </div>
                <div className="bm-student-info">
                  <div className="bm-student-name">{s.displayName}</div>
                  <div className="bm-student-email">{s.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: badge management for selected student */}
      <div className="bm-badge-panel">
        {!selected ? (
          <div className="bm-no-selection">
            <span>Select a student to manage their badges</span>
          </div>
        ) : (
          <>
            <div className="bm-student-header">
              <div className="bm-student-avatar large">
                {selected.avatar ? (
                  <img src={selected.avatar} alt="" />
                ) : (
                  <span>{(selected.displayName[0] || "?").toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="bm-selected-name">{selected.displayName}</div>
                <div className="bm-selected-email">{selected.email}</div>
                {!loadingBadges && (
                  <div className="bm-selected-count">
                    {earnedSet.size} of {BADGE_DEFINITIONS.length} badges earned
                  </div>
                )}
              </div>
            </div>

            {loadingBadges ? (
              <p className="bm-loading">Loading badges…</p>
            ) : (
              <>
                {/* Current badge shelf */}
                <div className="bm-earned-section">
                  <h4>Earned Badges</h4>
                  <div className="bm-earned-grid">
                    {BADGE_DEFINITIONS.map((def) => {
                      const earned = earnedSet.has(def.id);
                      return (
                        <div key={def.id} className={`bm-earned-slot${earned ? " earned" : ""}`} title={def.name}>
                          <BadgeIcon badgeId={def.id} earned={earned} size="sm" />
                          <span>{def.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Award institutional badges */}
                <div className="bm-institutional-section">
                  <h4>Award Institutional Badges</h4>
                  <p className="bm-institutional-note">
                    These prestigious badges are awarded manually. Once given, they cannot be revoked.
                  </p>
                  <div className="bm-institutional-grid">
                    {INSTITUTIONAL_IDS.map((badgeId) => {
                      const def = BADGE_BY_ID[badgeId];
                      const alreadyEarned = earnedSet.has(badgeId);
                      return (
                        <div key={badgeId} className="bm-institutional-card">
                          <BadgeIcon badgeId={badgeId} earned size="md" />
                          <div className="bm-institutional-info">
                            <div className="bm-institutional-name">{def.name}</div>
                            <div className="bm-institutional-desc">{def.description}</div>
                            {alreadyEarned ? (
                              <span className="bm-already-awarded">Already awarded</span>
                            ) : (
                              <button
                                className="bm-award-btn"
                                onClick={() => handleAward(badgeId)}
                                disabled={awarding === badgeId}
                              >
                                {awarding === badgeId ? "Awarding…" : "Award Badge"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="bm-toast">{toast}</div>
      )}
    </div>
  );
}

export default function BadgeManage() {
  const [activeTab, setActiveTab] = useState("catalog");

  return (
    <div className="bm-page">
      <div className="bm-header">
        <h2 className="bm-title">Badge Management</h2>
        <p className="bm-subtitle">
          View the badge catalog and award institutional badges to students.
        </p>
      </div>

      <div className="bm-tabs">
        <button
          className={`bm-tab${activeTab === "catalog" ? " active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          Badge Catalog
        </button>
        <button
          className={`bm-tab${activeTab === "award" ? " active" : ""}`}
          onClick={() => setActiveTab("award")}
        >
          Award Badges
        </button>
      </div>

      <div className="bm-body">
        {activeTab === "catalog" && <BadgeCatalogTab />}
        {activeTab === "award"   && <AwardBadgesTab />}
      </div>
    </div>
  );
}
