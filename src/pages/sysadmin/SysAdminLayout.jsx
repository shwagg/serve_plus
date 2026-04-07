import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import "../../styles/admin.css";
import Sidebar from "../../components/Sidebar";
import { sysadminLinks } from "../../hooks/sidebarConfig";

export default function SysAdminLayout() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="admin-page">
            <Header />
            <Sidebar
                links={sysadminLinks}
                roleLabel="System Admin"
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
