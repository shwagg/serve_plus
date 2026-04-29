
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import "../../styles/admin.css";
import Sidebar from "../../components/Sidebar"
import { adminLinks } from "../../hooks/sidebarConfig";

const isMobile = () => window.innerWidth <= 768;

export default function AdminLayout() {
    const [collapsed, setCollapsed] = useState(isMobile);

    useEffect(() => {
        const handleResize = () => {
            if (isMobile()) setCollapsed(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={`admin-page${collapsed ? " sidebar-collapsed" : ""}`}>
            <Header />
            <Sidebar
                links={adminLinks}
                roleLabel="Admin"
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />
            {/* Tap-outside backdrop — visible only on mobile via CSS */}
            {!collapsed && (
                <div
                    className="mobile-sidebar-overlay"
                    onClick={() => setCollapsed(true)}
                />
            )}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
