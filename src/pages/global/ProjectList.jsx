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

    //search bar
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("date_asc"); // nearest date by default


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

    //search bar and filter
    const getTitle = (p) =>
        (p.title || p.alt || p.name || "Untitled").toString().trim();

    const getPoints = (p) => (typeof p.points === "number" ? p.points : Number(p.points) || 0);

    const getDateObj = (p) => {
        if (p.dateAt?.toDate) return p.dateAt.toDate();
        if (!p.date) return null;
        const d = new Date(p.date);
        return isNaN(d.getTime()) ? null : d;
    };

    const normalizedSearch = search.trim().toLowerCase();

    const filteredAndSorted = projects
        .filter((p) => {
            // status filter
            const st = p.status || "draft";
            if (statusFilter !== "all" && st !== statusFilter) return false;

            // search filter
            if (!normalizedSearch) return true;
            const hay = `${getTitle(p)} ${p.location || ""}`.toLowerCase();
            return hay.includes(normalizedSearch);
        })
        .sort((a, b) => {
            if (sortBy === "date_asc" || sortBy === "date_desc") {
                const da = getDateObj(a);
                const db = getDateObj(b);

                // put items with no date at the end
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;

                const diff = da.getTime() - db.getTime();
                return sortBy === "date_asc" ? diff : -diff;
            }

            if (sortBy === "points_desc" || sortBy === "points_asc") {
                const pa = getPoints(a);
                const pb = getPoints(b);
                return sortBy === "points_desc" ? pb - pa : pa - pb;
            }

            if (sortBy === "title_asc") {
                const ta = getTitle(a).toLowerCase();
                const tb = getTitle(b).toLowerCase();
                return ta.localeCompare(tb);
            }
        });


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
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <input
                            type="text"
                            placeholder="Search by title (or location)…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: 8, minWidth: 220 }}
                        />

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ padding: 8 }}
                        >
                            <option value="all">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="for_approval">For approval</option>
                            <option value="published">Published</option>
                            <option value="rejected">Rejected</option>
                            <option value="archived">Archived</option>

                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ padding: 8 }}
                        >
                            <option value="date_asc">Nearest date</option>
                            <option value="date_desc">Farthest date</option>
                            <option value="points_desc">Highest points</option>
                            <option value="points_asc">Lowest points</option>
                            <option value="title_asc">Title A–Z</option>
                        </select>

                        <div style={{ marginLeft: "auto", opacity: 0.8 }}>
                            Showing: <b>{filteredAndSorted.length}</b>
                        </div>
                    </div>

                    {loading ? (
                        <div className="empty-state">
                            <p className="empty-title">Loading projects…</p>
                            <p className="empty-desc">Fetching Missions from Firestore.</p>
                        </div>
                    ) : filteredAndSorted.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-title">No projects yet</p>
                            <p className="empty-desc">No documents found in Missions.</p>
                        </div>
                    ) : (
                        <div className="project-list">
                            {filteredAndSorted.map((p) => (
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
