import "../../styles/partnerDashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { FaCalendarAlt, FaUserFriends, FaFileAlt, FaMapMarkerAlt, FaUsers } from "react-icons/fa";

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [partnerSchool, setPartnerSchool] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartnerSchool = async () => {
      const user = auth.currentUser;
      if (user?.uid) {
        const { getDoc, doc } = await import("firebase/firestore");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.partnerSchool) setPartnerSchool(data.partnerSchool);
          else if (data.name) setPartnerSchool(data.name);
        }
      }
    };
    fetchPartnerSchool();
  }, []);

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "missions"));
      setProposals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchProposals();
  }, []);

  // Filter proposals for this partner
  const partnerProposals = proposals.filter(
    p => p.partnerSchool === partnerSchool
  );
  const pendingProposals = partnerProposals.filter(p => p.status === "for_approval");
  const publishedProposals = partnerProposals.filter(p => p.status === "published");

  // For demo: count volunteers (if you have volunteer data, replace this logic)
  const activeVolunteers = 5;

  return (
    <div className="partner-dashboard">
      <div className="dashboard-cards-row">
        <div className="dashboard-card">
          <FaCalendarAlt className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Upcoming Events</div>
            <div className="dashboard-card-value">{publishedProposals.length}</div>
          </div>
        </div>
        <div className="dashboard-card">
          <FaUserFriends className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Active Volunteers</div>
            <div className="dashboard-card-value">{activeVolunteers}</div>
          </div>
        </div>
        <div className="dashboard-card">
          <FaFileAlt className="dashboard-card-icon" />
          <div>
            <div className="dashboard-card-title">Pending Proposals</div>
            <div className="dashboard-card-value">{pendingProposals.length}</div>
          </div>
        </div>
      </div>
      <h2 className="dashboard-section-title">Upcoming Community Engagement Events</h2>
      <div className="dashboard-events-grid">
        {publishedProposals.length === 0 && !loading && (
          <div style={{ color: '#888', fontSize: 16, padding: 24 }}>No published proposals/events yet.</div>
        )}
        {publishedProposals.map((proposal, idx) => (
          <div
            className="dashboard-event-card"
            key={proposal.id}
            style={{ cursor: 'pointer' }}
            onClick={() => proposal.id && navigate(`/current-event/${proposal.id}`)}
          >
            <span className="dashboard-event-category">{proposal.nature || proposal.projectType || "Event"}</span>
            <div className="dashboard-event-title">{proposal.title}</div>
            <div className="dashboard-event-info">
              <div><FaCalendarAlt className="dashboard-event-icon" /> {proposal.targetDate || proposal.dateProposed || "TBA"}</div>
              <div><FaMapMarkerAlt className="dashboard-event-icon" /> {proposal.location || "TBA"}</div>
              {/* You can add more info here if available */}
            </div>
            {/* Registration/progress bar can be added if you have volunteer/capacity info */}
          </div>
        ))}
      </div>
    </div>
  );
}
