
//page dedicated for admin, containing left collapsible panel, and outlet for main content.
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import "../../styles/admin.css";
import Sidebar from "../../components/Sidebar"
import { adminLinks } from "../../hooks/sidebarConfig";

export default function AdminLayout() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="admin-page">
            <Header />
            <Sidebar
                links={adminLinks}
                roleLabel="Admin"
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />
            {/* ONLY THIS PART CHANGES */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
