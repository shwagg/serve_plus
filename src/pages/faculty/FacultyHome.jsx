import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar"
import "../../styles/admin.css";
import "../../styles/student.css";
import { facultyLinks } from "../../hooks/sidebarConfig";


export default function PartnerHome() {
  return (
    <div className="admin-page">
      <Header />
      <Sidebar links={facultyLinks} />

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
