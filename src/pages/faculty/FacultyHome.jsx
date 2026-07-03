import { useState, useEffect, useContext, useMemo } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import "../../styles/admin.css";
import "../../styles/student.css";
import { facultyLinks } from "../../hooks/sidebarConfig";
import { SessionContext } from "../../context/sessionContextCore";
import { isCommunityChair } from "../../utils/communityChair";

const isMobile = () => window.innerWidth <= 768;

export default function FacultyHome() {
  const { userData } = useContext(SessionContext);
  const [collapsed, setCollapsed] = useState(isMobile);
  const sidebarLinks = useMemo(() => {
    if (!isCommunityChair(userData)) return facultyLinks;
    return [
      {
        key: "dashboard",
        label: "Dashboard",
        children: [
          { label: "Overview", to: "/faculty/dashboard" },
        ],
      },
      ...facultyLinks,
    ];
  }, [userData]);

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
      <Sidebar links={sidebarLinks} collapsed={collapsed} setCollapsed={setCollapsed} />
      {!collapsed && (
        <div className="mobile-sidebar-overlay" onClick={() => setCollapsed(true)} />
      )}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
