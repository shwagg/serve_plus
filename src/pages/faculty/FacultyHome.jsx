import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import "../../styles/admin.css";
import "../../styles/student.css";
import { facultyLinks } from "../../hooks/sidebarConfig";

const isMobile = () => window.innerWidth <= 768;

export default function FacultyHome() {
  const [collapsed, setCollapsed] = useState(isMobile);

  useEffect(() => {
    const handleResize = () => {
      if (isMobile()) setCollapsed(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`admin-page${collapsed ? " sidebar-collapsed" : ""}`}>
      <Header />
      <Sidebar links={facultyLinks} collapsed={collapsed} setCollapsed={setCollapsed} />
      {!collapsed && (
        <div className="mobile-sidebar-overlay" onClick={() => setCollapsed(true)} />
      )}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
