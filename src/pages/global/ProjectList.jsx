import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import "../../styles/AdminDashboard.css";

// demo fallback image
import fallbackImg from "../../assets/react.svg";

export default function ProjectList() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMissions = async () => {
            try {
                const snap = await getDocs(collection(db, "Missions"));
                const rows = snap.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setProjects(rows);
            } catch (err) {
                console.error("Failed to load Missions:", err);
                setProjects([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMissions();
    }, []);

    return (
        <div className="admin-dashboard">
            <h1 className="page-title">Project List</h1>

            <div className="panel">
                <div className="panel-header panel-header-row">
                    <span>Projects</span>

                    <button
                        className="btn-primary"
                        type="button"
                        onClick={() => navigate("/admin/projects/new")}
                    >
                        Add Project
                    </button>
                </div>

                <div className="panel-body">
                    {loading ? (
                        <div className="empty-state">
                            <p className="empty-title">Loading projects…</p>
                            <p className="empty-desc">Fetching Missions from Firestore.</p>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-title">No projects yet</p>
                            <p className="empty-desc">No documents found in Missions.</p>
                        </div>
                    ) : (
                        <div className="project-list">
                            {projects.map((p) => (
                                <div
                                    key={p.id}
                                    className="project-row"
                                    onClick={() => navigate(`/admin/projects/${p.id}`)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="project-row-content">
                                        <img
                                            src={fallbackImg}
                                            alt={p.alt || p.title || "Project"}
                                            className="project-thumb"
                                        />

                                        <div className="project-info">
                                            <div className="project-title-row">
                                                <div className="project-title">
                                                    {p.title || p.alt || "Untitled Mission"}
                                                </div>
                                                <span className={`status-pill status-${(p.status || "draft")}`}>
                                                    {(p.status || "draft").toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="project-meta">
                                                <span className="project-date">{p.date || "No date"}</span>

                                                {p.location && (
                                                    <span className="project-location">{p.location}</span>
                                                )}

                                                {typeof p.points === "number" && (
                                                    <span className="project-points">{p.points} pts</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
