
//this page stays for every page acts as navigation on the left side of admin page.

import { Outlet, NavLink } from "react-router-dom";
import Header from "../../components/Header";
import "../../styles/AdminDashboard.css";

export default function AdminLayout() {
    return (
        <div className="admin-page">
            <Header />
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
                        <NavLink to="/admin/projects/new" className="sidebar-item-link">
                            Project Proposal
                        </NavLink>
                        <p className="sidebar-item">Current Event Monitoring</p>
                        <NavLink to="/admin/roster" className="sidebar-item-link">
                            Roster Account Management
                        </NavLink>
                        <NavLink to="/admin/audit-logs" className="sidebar-item-link">
                            Audit Logs
                        </NavLink>
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
