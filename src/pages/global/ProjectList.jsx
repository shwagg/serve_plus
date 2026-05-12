import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import ProjectDetailSidebar from "../admin/ProjectDetailSidebar";
import "../../styles/ProjectList.css";
import { ViewKanbanOutlinedIcon, ListAltOutlinedIcon } from "../../components/icons/index";

//kanban board
const KANBAN_COLUMNS = [
    { key: "draft", label: "Draft" },
    { key: "for_approval", label: "For Approval" },
    { key: "published", label: "Published" },
];

// demo fallback image
import fallbackImg from "../../assets/react.svg";

export default function ProjectList({ mode = "admin" }) {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [view, setView] = useState(() => {
        return localStorage.getItem("projectView") || "list";
    });

    const [showAddDropdown, setShowAddDropdown] = useState(false);

    //search bar
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("date_asc"); // nearest date by default

    // Partner school for filtering
    const [partnerSchool, setPartnerSchool] = useState("");

    // Fetch partner's school if mode is partner
    useEffect(() => {
        const fetchPartnerSchool = async () => {
            if (mode === "partner" && user?.uid) {
                try {
                    const { getDoc, doc } = await import("firebase/firestore");
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        if (data.organizationName) setPartnerSchool(data.organizationName);
                        else if (data.name) setPartnerSchool(data.name); // fallback: use partner's name
                    }
                } catch (err) {
                    setPartnerSchool("");
                }
            }
        };
        fetchPartnerSchool();
    }, [mode, user]);

    useEffect(() => {
        const fetchMissions = async () => {
            try {
                const snap = await getDocs(collection(db, "missions"));
                const rows = snap.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setProjects(rows);
            } catch (err) {
                console.error("Failed to load missions:", err);
                setProjects([]);
            } finally {
                setLoading(false);
            }
        };
        fetchMissions();
    }, []);

    useEffect(() => {
        localStorage.setItem("projectView", view);
    }, [view]);

    //search bar and filter
    const getTitle = (p) =>
        (p.title || p.alt || p.name || "Untitled").toString().trim();

    const getPoints = (p) => (typeof p.points === "number" ? p.points : Number(p.points) || 0);

    const getDateObj = (p) => {
        const td = p.targetDate || p.targetDates;
        if (!td) return null;
        const d = new Date(td);
        return isNaN(d.getTime()) ? null : d;
    };
    //for approval
    const handleSendForApproval = async (projectId) => {
        const ref = doc(db, "missions", projectId);

        await updateDoc(ref, {
            status: "for_approval",
            submittedForApprovalAt: serverTimestamp(),
            submittedBy: user.uid,
        });
    };


    //updating firestore fields to "approved/rejected project"
    const handlePartnerApprove = async (projectId) => {
        console.log("APPROVE CLICKED:", projectId);
        const ref = doc(db, "missions", projectId);
        await updateDoc(ref, {
            "approvals.partner.approved": true,
            "approvals.partner.decidedAt": serverTimestamp(),
            "approvals.partner.decidedBy": user.uid,
        });
    };

    const handlePartnerReject = async (projectId) => {
        const ref = doc(db, "missions", projectId);

        await updateDoc(ref, {
            status: "rejected",
            "partner.approved": false,
            "partner.decidedAt": serverTimestamp(),
            "partner.decidedBy": user?.uid,
        });
    };
    const handleFacultyApprove = async (projectId) => {
        const ref = doc(db, "missions", projectId);

        await updateDoc(ref, {
            "approvals.faculty.approved": true,
            "approvals.faculty.decidedAt": serverTimestamp(),
            "approvals.faculty.decidedBy": user.uid,
        });
    };


    const handleFacultyReject = async (projectId) => {
        const ref = doc(db, "missions", projectId);

        await updateDoc(ref, {
            status: "rejected",

            "approvals.faculty.approved": false,
            "approvals.faculty.decidedAt": serverTimestamp(),
            "approvals.faculty.decidedBy": user.uid,
        });
    };

    const normalizedSearch = search.trim().toLowerCase();

    const filteredAndSorted = projects
        .filter((p) => {
            const st = p.status ?? "draft";
            const partnerDecidedByMe = p.approvals?.partner?.decidedBy === user?.uid;
            const facultyDecidedByMe = p.approvals?.faculty?.decidedBy === user?.uid;
            // (PARTNER SIDE)
            if (mode === "partner") {
                // Only show proposals for this partner school
                if (!partnerSchool) return false;
                if (p.partnerSchool !== partnerSchool) return false;

                // Always show the event if the partner is the owner (by id or other logic)
                // You can add a prop/eventId to force-show a specific event if needed
                // For now, show all events for this partner

                // waiting for admin action
                if (st === "for_approval") return true;
                // already live projects they participated in
                if (st === "published") return true;
                // past projects
                if (st === "archived") return true;

                // Optionally: show all events for this partner regardless of status
                // return true;

                return false;
            }

            // (FACULTY SIDE)
            if (mode === "faculty") {
                //this is after partner approved the project
                if (st === "approved") return true;
                if (facultyDecidedByMe &&
                    (st === "rejected" || st === "to_publish")) { return true; }
                return false;
            }
            // (ADMIN SIDE)
            if (statusFilter !== "all" && st !== statusFilter) return false;
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
        <div className="admin-outlet">
            <div className="admin-outlet content">
                <h1 className="page-title">Project</h1>

                <div className="panel">
                    <div className="panel-header panel-header-row">
                        <span>Projects</span>

                        <div className="panel-header-actions">
                            <input
                                type="text"
                                placeholder="Search projects…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="project-search"
                            />

                            {mode === "admin" && (
                                <div className="add-project-container">
                                    <button
                                        className="add-project-pill"
                                        type="button"
                                        onClick={() => setShowAddDropdown((v) => !v)}
                                    >
                                        Add Project
                                        <span className="caret">▾</span>
                                    </button>

                                    {showAddDropdown && (
                                        <div className="add-project-menu">
                                            <div className="add-project-menu-label">
                                                Add Project
                                            </div>

                                            <button
                                                className="add-project-menu-item"
                                                onClick={() => {
                                                    navigate("/admin/projects/new?type=SL");
                                                    setShowAddDropdown(false);
                                                }}
                                            >
                                                Service Learning
                                            </button>

                                            <button
                                                className="add-project-menu-item"
                                                onClick={() => {
                                                    navigate("/admin/projects/new?type=CE");
                                                    setShowAddDropdown(false);
                                                }}
                                            >
                                                Community Engagement
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="panel-body">
                        <div className="project-controls-row">
                            {/* LEFT: STATUS BUTTONS */}
                            <div className="project-status-group">
                                {["all", "published", "for_approval", "draft", "archived"].map((st) => (
                                    <button
                                        key={st}
                                        className={`status-pill filter-pill ${statusFilter === st ? "active" : ""}`}

                                        onClick={() => setStatusFilter(st)}
                                    >
                                        {st === "all"
                                            ? "ALL"
                                            : st.replace("_", " ").toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {/* RIGHT: VIEW BUTTONS (MOVED HERE) */}
                            <div className="project-view-toggle">
                                {mode === "admin" && (
                                    <button
                                        className={`view-icon-btn ${view === "kanban" ? "active" : ""}`}
                                        onClick={() => setView("kanban")}
                                        title="Kanban Board"
                                    >
                                        <ViewKanbanOutlinedIcon />
                                    </button>
                                )}

                                <button
                                    className={`view-icon-btn ${view === "list" ? "active" : ""}`}
                                    onClick={() => setView("list")}
                                    title="Card List"
                                >
                                    <ListAltOutlinedIcon />
                                </button>
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
                            <>
                                {view === "kanban" && mode === "admin" && (
                                    <div className="kanban-board">
                                        {KANBAN_COLUMNS.map((col) => (
                                            <div key={col.key} className="kanban-column">
                                                <h3>{col.label}</h3>

                                                {
                                                    filteredAndSorted
                                                        .filter((p) => p.status === col.key)
                                                        .map((p) => (
                                                            <ProjectCard
                                                                key={p.id}
                                                                project={p}
                                                                mode={mode}
                                                                navigate={navigate}
                                                                onPartnerApprove={handlePartnerApprove}
                                                                onPartnerReject={handlePartnerReject}
                                                            setSelectedProject={setSelectedProject}
                                                            />

                                                        ))
                                                }
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {view === "list" && (
                                    <div className="project-list">
                                        {filteredAndSorted.map((p) => (
                                            <ProjectCard
                                                key={p.id}
                                                project={p}
                                                mode={mode}
                                                setSelectedProject={setSelectedProject}
                                            />
                                        ))}
                                    </div>
                                )}

                            </>
                        )}
                    </div>
                </div>
            </div>
            {selectedProject && (
                <ProjectDetailSidebar
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onApprovalChange={() => {}}
                />
            )}

        </div >

    );
}


//progress bar
function ProjectProgress({ status }) {
    const stepMap = {
        draft: 25,
        for_approval: 50,
        approved: 75,
        published: 100,
    };

    const value = stepMap[status] || 25;

    return (
        <div style={{ marginTop: 6 }}>
            <div className="bar-track">
                <div
                    className="bar-fill"
                    style={{ width: `${value}%` }}
                />
                <span className="bar-value">{value}%</span>
            </div>
        </div>
    );
}
//kanban board card
function ProjectCard({ project: p, mode, onPartnerApprove, onPartnerReject, navigate, setSelectedProject }) {
    const partnerApproved = p.approvals?.partner?.approved;
    const facultyApproved = p.approvals?.faculty?.approved;
    const completedSteps = [
        partnerApproved,
        facultyApproved,
        partnerApproved && facultyApproved,
    ].filter(Boolean).length;

    const canPublish =
        mode === "admin" &&
        partnerApproved === true &&
        facultyApproved === true &&
        p.status === "for_approval";
    //was going to set where admin would add points and badge before publishing to students view
    return (
        <div
            className="kanban-card"
            onClick={() => {
                if (setSelectedProject) {
                    setSelectedProject(p);
                }
            }}
        >

            <div className="project-title">{p.title || "Untitled Project"}</div>

            <div className="project-meta">
                <span>{p.targetDate || p.targetDates || "No date"}</span>
                <span>{p.nature || "—"}</span>
                <span>{p.volunteerHours || 0} hrs</span>
            </div>

            <span className={`status-pill status-${p.status}`}>
                {(p.status || "draft").replace("_", " ").toUpperCase()}
            </span>
            {/* PARTNER ACTIONS */}
            {mode === "partner" && p.status === "for_approval" && (
                <>
                    {!partnerApproved ? (
                        <div className="partner-actions">
                            <button
                                className="btn-success"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPartnerApprove(p.id);
                                }}
                            >
                                Approve
                            </button>

                            <button
                                className="btn-danger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPartnerReject(p.id);
                                }}
                            >
                                Reject
                            </button>
                        </div>
                    ) : (
                        <div className="partner-approved">
                            ✔ Approved
                        </div>
                    )}
                </>
            )}

            {/* ADMIN ONLY */}
            {mode === "admin" && (
                <>
                    <div className="approval-progress">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={`approval-step ${completedSteps > i ? "done" : ""
                                    }`}
                            />
                        ))}
                    </div>

                    {canPublish && (
                        <button
                            className="btn-success"
                            onClick={(e) => {
                                e.stopPropagation(); // prevents opening ProjectDetails
                                navigate(`/admin/projects/${p.id}`);
                            }}
                        >
                            Go to Publish
                        </button>
                    )}

                </>
            )}
        </div>
    );
}

