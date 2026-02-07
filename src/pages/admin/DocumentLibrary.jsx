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

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 12, color: '#000' }}>
        <ListAltOutlinedIcon /> Document Library
      </h2>
      {loading ? (
        <div>Loading...</div>
      ) : proposals.length === 0 ? (
        <div style={{ color: '#000', fontWeight: 500 }}>No approved proposals found.</div>
      ) : (
        <div style={{ marginTop: 24 }}>
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 2px 8px #0001",
                marginBottom: 18,
                padding: "18px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: '#000',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 18 }}>{proposal.title}</div>
              <div>
                {proposal.date} &mdash; {proposal.hours} hrs
              </div>
              <span
                style={{
                  background: "#30bdb7",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontWeight: 600,
                  fontSize: 14,
                  width: "fit-content",
                }}
              >
                {proposal.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
