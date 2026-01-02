//this page stays for every page acts as navigation on the left side of admin page.
import { Outlet, NavLink } from "react-router-dom";
import "../../styles/AdminDashboard.css";

export default function AdminLayout() {
    return (
        <div className="admin-page">
            <aside className="admin-sidebar">

                <nav className="sidebar-nav">
                    <div className="sidebar-group">
                        <p className="sidebar-group-title">Events</p>

                        <NavLink to="/admin/dashboard" className="sidebar-item-link">
                            Dashboard
                        </NavLink>

                        <NavLink to="/admin/projects" end className="sidebar-item-link">
                            Project List
                        </NavLink>

                        {/* others can remain text for now if you want */}
                        <NavLink to="/admin/projects/new" className="sidebar-item-link">
                            Service-Learning Proposal
                        </NavLink>
                        <p className="sidebar-item">Current Event Monitoring</p>
                    </div>
                </nav>
            </aside>

            {/* ONLY THIS PART CHANGES */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
