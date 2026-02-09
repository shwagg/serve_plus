import React, { useEffect, useState } from "react";
import { ListAltOutlinedIcon } from "../../components/icons/index";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const fetchApprovedProposals = async () => {
  const snap = await getDocs(collection(db, "missions"));
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((doc) => (doc.status || '').toLowerCase() === "approved");
};

export default function DocumentLibrary() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedProposals().then((data) => {
      setProposals(data);
      setLoading(false);
    });
  }, []);

  // Hover state for cards
  const [hovered, setHovered] = useState(null);

  // Card style with hover effect
  const cardStyle = (isHovered) => ({
    flex: '1 1 320px',
    minWidth: 320,
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    boxShadow: isHovered ? '0 4px 16px #1a376433' : '0 2px 8px #0001',
    padding: '24px',
    marginBottom: 18,
    color: '#1a3764',
    border: '2px solid #1a3764',
    transition: 'box-shadow 0.2s, transform 0.2s',
    transform: isHovered ? 'translateY(-4px) scale(1.03)' : 'none',
    cursor: 'pointer',
  });

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 12, color: '#1a3764', fontWeight: 700 }}>
        <ListAltOutlinedIcon /> Document Library
      </h2>
      <div style={{ marginTop: 32, background: '#1a3764', borderRadius: 16, color: '#fff', padding: '16px 0', fontWeight: 700, fontSize: 22, boxShadow: '0 2px 8px #0001' }}>
        <div style={{ paddingLeft: 32 }}>Events</div>
      </div>
      <div style={{ marginTop: 24 }}>
        
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {/* Temporary UI: Example event cards, replace with dynamic proposals if needed */}
          <div
            style={cardStyle(hovered === 0)}
            onMouseEnter={() => setHovered(0)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Laguna Lake Watershed Reforestation & River Cleanup Drive</div>
            <div style={{ fontWeight: 600, color: '#1a3764', marginBottom: 8 }}>Published by:</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#1a3764', fontWeight: 500 }}>
              <li>Rhea A. Nayang</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <a href="#" style={{ color: '#30bdb7', fontWeight: 600, textDecoration: 'none', fontSize: 16 }}>Details</a>
              <span style={{ color: '#8bc34a', fontWeight: 700, fontSize: 16 }}>Complete</span>
            </div>
          </div>
          <div
            style={cardStyle(hovered === 1)}
            onMouseEnter={() => setHovered(1)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Project L.E.A.D.: Literacy and Educational Advancement Drive</div>
            <div style={{ fontWeight: 600, color: '#1a3764', marginBottom: 8 }}>Published by:</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#1a3764', fontWeight: 500 }}>
              <li>Maria T. Alonzo</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <a href="#" style={{ color: '#30bdb7', fontWeight: 600, textDecoration: 'none', fontSize: 16 }}>Details</a>
              <span style={{ color: '#ff9800', fontWeight: 700, fontSize: 16 }}>Pending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
