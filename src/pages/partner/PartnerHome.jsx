import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar"
import "../../styles/admin.css";
import "../../styles/student.css";
import { partnerLinks } from "../../hooks/sidebarConfig";


export default function PartnerHome() {
  return (
    <div className="admin-page">
      <Header />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
