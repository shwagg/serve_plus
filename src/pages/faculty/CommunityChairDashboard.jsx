import { useContext, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import ProjectDetailSidebar from "../admin/ProjectDetailSidebar";
import { SessionContext } from "../../context/sessionContextCore";
import { db } from "../../firebaseConfig";
import {
  isCommunityChair,
  normalizeRosterText,
} from "../../utils/communityChair";
import "../../styles/CommunityChairDashboard.css";

const RANGE_OPTIONS = [
  { key: "fourMonths", label: "Term", months: 4 },
  { key: "oneYear", label: "1 Year", months: 12 },
  { key: "allTime", label: "All Time", months: null },
];

const COMPLETED_STATUSES = new Set(["complete", "completed", "graded"]);
const PUBLISHED_HISTORY_STATUSES = new Set(["published", "completed"]);

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMissionRangeDate(mission) {
  return (
    toDate(mission.publishedAt) ||
    toDate(mission.updatedAt) ||
    toDate(mission.createdAt) ||
    toDate(mission.targetDate) ||
    toDate(mission.dateProposed)
  );
}

function formatDate(value) {
  const date = value instanceof Date ? value : toDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function missionDepartment(mission) {
  return mission.affiliatedDepartment || mission.department || "";
}

function hasPublishedHistoryStatus(mission) {
  return PUBLISHED_HISTORY_STATUSES.has(normalizeRosterText(mission.status));
}

function isCompletedVolunteer(volunteer) {
  const completionStatus = normalizeRosterText(volunteer.completionStatus);
  const participationStatus = normalizeRosterText(volunteer.participationStatus);
  return (
    COMPLETED_STATUSES.has(completionStatus) ||
    Boolean(volunteer.releasedAt) ||
    participationStatus === "verified"
  );
}

function getRangeStart(months) {
  if (!months) return null;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months);
  return date;
}

function projectIsInRange(project, range) {
  if (!range.months) return true;
  if (!project.rangeDate) return false;
  const start = getRangeStart(range.months);
  const now = new Date();
  return project.rangeDate >= start && project.rangeDate <= now;
}

function buildRangeStats(projects, range) {
  const included = projects.filter((project) => projectIsInRange(project, range));
  const joinedIds = new Set();
  const completedIds = new Set();

  included.forEach((project) => {
    project.joinedIds.forEach((studentId) => joinedIds.add(studentId));
    project.completedIds.forEach((studentId) => completedIds.add(studentId));
  });

  return {
    projects: included,
    projectCount: included.length,
    joinedCount: joinedIds.size,
    completedCount: completedIds.size,
  };
}

export default function CommunityChairDashboard() {
  const { userData, authLoading } = useContext(SessionContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRangeKey, setActiveRangeKey] = useState("fourMonths");
  const [selectedProject, setSelectedProject] = useState(null);

  const isChair = isCommunityChair(userData);
  const chairDepartment = userData?.department || "";
  const normalizedDepartment = normalizeRosterText(chairDepartment);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      if (authLoading) return;
      if (!isChair || !normalizedDepartment) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const missionSnap = await getDocs(collection(db, "missions"));
        const departmentMissions = missionSnap.docs
          .map((missionDoc) => ({ id: missionDoc.id, ...missionDoc.data() }))
          .filter((mission) => (
            hasPublishedHistoryStatus(mission) &&
            normalizeRosterText(missionDepartment(mission)) === normalizedDepartment
          ));

        const rows = await Promise.all(
          departmentMissions.map(async (mission) => {
            const volunteerSnap = await getDocs(collection(db, "missions", mission.id, "volunteer"));
            const joinedIds = new Set();
            const completedIds = new Set();

            volunteerSnap.docs.forEach((volunteerDoc) => {
              const volunteer = volunteerDoc.data();
              const studentId = volunteerDoc.id || volunteer.userId;
              if (!studentId) return;
              joinedIds.add(studentId);
              if (isCompletedVolunteer(volunteer)) completedIds.add(studentId);
            });

            return {
              ...mission,
              rangeDate: getMissionRangeDate(mission),
              departmentLabel: missionDepartment(mission) || "Unassigned",
              joinedIds,
              completedIds,
              joinedCount: joinedIds.size,
              completedCount: completedIds.size,
            };
          }),
        );

        if (!cancelled) setProjects(rows);
      } catch (err) {
        console.error("Failed to load community chair dashboard:", err);
        if (!cancelled) {
          setProjects([]);
          setError("Unable to load department statistics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isChair, normalizedDepartment]);

  const rangeStats = useMemo(() => {
    return RANGE_OPTIONS.reduce((acc, range) => {
      acc[range.key] = buildRangeStats(projects, range);
      return acc;
    }, {});
  }, [projects]);

  const activeRange = RANGE_OPTIONS.find((range) => range.key === activeRangeKey) || RANGE_OPTIONS[0];
  const activeStats = rangeStats[activeRange.key] || buildRangeStats([], activeRange);
  const visibleProjects = [...activeStats.projects].sort((a, b) => {
    if (!a.rangeDate && !b.rangeDate) {
      return (a.title || "").localeCompare(b.title || "");
    }
    if (!a.rangeDate) return 1;
    if (!b.rangeDate) return -1;
    return b.rangeDate.getTime() - a.rangeDate.getTime();
  });

  if (authLoading || loading) {
    return (
      <div className="ccd-page">
        <div className="ccd-state-panel">Loading department statistics...</div>
      </div>
    );
  }

  if (!isChair) {
    return (
      <div className="ccd-page">
        <div className="ccd-state-panel">
          <h1>Department Statistics</h1>
          <p>This dashboard is available only to faculty assigned as community chair.</p>
        </div>
      </div>
    );
  }

  if (!normalizedDepartment) {
    return (
      <div className="ccd-page">
        <div className="ccd-state-panel">
          <h1>Department Statistics</h1>
          <p>No department is assigned to your faculty account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ccd-page">
      <header className="ccd-header">
        <div>
          <h1>Department Statistics</h1>
          <p>{chairDepartment}</p>
        </div>
      </header>

      {error && <div className="ccd-error">{error}</div>}

      <section className="ccd-range-grid" aria-label="Department statistics by range">
        {RANGE_OPTIONS.map((range) => {
          const stats = rangeStats[range.key] || buildRangeStats([], range);
          const isActive = range.key === activeRangeKey;

          return (
            <button
              key={range.key}
              type="button"
              className={`ccd-range-card${isActive ? " ccd-range-card--active" : ""}`}
              onClick={() => setActiveRangeKey(range.key)}
            >
              <span className="ccd-range-label">{range.label}</span>
              <span className="ccd-range-metrics">
                <span>
                  <strong>{stats.projectCount}</strong>
                  <small>Published Projects</small>
                </span>
                <span>
                  <strong>{stats.joinedCount}</strong>
                  <small>Students Joined</small>
                </span>
                <span>
                  <strong>{stats.completedCount}</strong>
                  <small>Students Completed</small>
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="ccd-project-panel">
        <div className="ccd-panel-header">
          <div>
            <h2>Projects in {activeRange.label}</h2>
            <p>
              {activeStats.projectCount} project{activeStats.projectCount !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="ccd-panel-totals">
            <span>{activeStats.joinedCount} joined</span>
            <span>{activeStats.completedCount} completed</span>
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="ccd-empty">
            No published or completed projects found for this department in the selected range.
          </div>
        ) : (
          <div className="ccd-table-wrap">
            <table className="ccd-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Joined</th>
                  <th>Completed</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => (
                  <tr
                    key={project.id}
                    tabIndex={0}
                    onClick={() => setSelectedProject(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedProject(project);
                      }
                    }}
                  >
                    <td>
                      <strong>{project.title || project.alt || "Untitled Project"}</strong>
                      <span>{project.projectType === "sl" ? "Service Learning" : "Community Engagement"}</span>
                    </td>
                    <td>
                      <span className={`ccd-status ccd-status--${normalizeRosterText(project.status)}`}>
                        {project.status || "published"}
                      </span>
                    </td>
                    <td>{formatDate(project.rangeDate)}</td>
                    <td>{project.departmentLabel}</td>
                    <td>{project.joinedCount}</td>
                    <td>{project.completedCount}</td>
                    <td>{project.location || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProject && (
        <ProjectDetailSidebar
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onApprovalChange={() => {}}
        />
      )}
    </div>
  );
}
