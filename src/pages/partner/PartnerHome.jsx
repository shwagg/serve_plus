import { Outlet } from "react-router-dom";
import Header from "../../components/Header";
import "../../styles/admin.css";
import "../../styles/partnerDashboard.css";

export default function PartnerHome() {
  return (
    <div className="admin-page">
      <Header />
      <main className="partner-main">
        <Outlet />
      </main>
    </div>
  );
}
