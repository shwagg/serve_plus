import "../../styles/AdminDashboard.css";
import { Link, useNavigate } from "react-router-dom";

export default function ProjectList() {
    const navigate = useNavigate();
    return (
        <>
            <h1 className="page-title">Project List</h1>
            <div className="panel">
                <div className="panel-header panel-header-analytics">
                    <span>Projects</span>
                    <button className="btn"
                        type="button"
                        onClick={() => navigate("/admin/projects/new")}
                    >Add Project</button>
                </div>

                <div className="panel-body">
                    {/* later: map projects here */}
                    <div className="empty-state">
                        <p className="empty-title">No projects yet</p>
                        <p className="empty-desc">
                            Once you create a project, it will appear here automatically.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
