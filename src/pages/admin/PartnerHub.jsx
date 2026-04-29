import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function PartnerHub() {
  const [partners, setPartners] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [partnersSnap, missionsSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "partner"))),
          getDocs(collection(db, "missions")),
        ]);
        setPartners(partnersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMissions(missionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getPartnerMissions = (partner) => {
    const name = (partner.organizationName || partner.name || "").toLowerCase().trim();
    return missions.filter(
      (m) => (m.partnerSchool || "").toLowerCase().trim() === name
    );
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const statusColor = (status) => {
    if (!status) return "#94a3b8";
    const s = status.toLowerCase();
    if (s === "published") return "#16a34a";
    if (s === "for_approval" || s === "pending") return "#d97706";
    if (s === "rejected") return "#dc2626";
    if (s === "draft") return "#64748b";
    return "#64748b";
  };

  const formatDate = (d) => {
    if (!d) return null;
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#64748b", fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div className="admin-outlet content">
      <h1 className="page-title">Partner Hub</h1>

      {partners.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No partners registered</p>
          <p className="empty-desc">
            Partners will appear here once they register with a partner account.
          </p>
        </div>
      ) : (
        partners.map((partner) => {
          const partnerMissions = getPartnerMissions(partner);
          const name =
            partner.organizationName || partner.name || partner.email || "Unknown";
          const isOpen = expanded[partner.id];

          return (
            <div key={partner.id} className="card" style={{ marginBottom: 12 }}>
              {/* Partner header — click to expand */}
              <button
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: isOpen ? "1px solid #e5e7eb" : "none",
                  textAlign: "left",
                  gap: 12,
                }}
                onClick={() => toggleExpand(partner.id)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1f3b73" }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {partner.email}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#30bdb7",
                      fontWeight: 600,
                    }}
                  >
                    {partnerMissions.length}{" "}
                    {partnerMissions.length === 1 ? "project" : "projects"}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      color: "#94a3b8",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="card-body">
                  {partnerMissions.length === 0 ? (
                    <div className="empty-state">
                      <p className="empty-desc">No projects linked to this partner yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {partnerMissions.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            background: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{ fontWeight: 600, fontSize: 13, color: "#1f3b73" }}
                            >
                              {m.title || "Untitled"}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {m.projectType === "sl"
                                ? "Service Learning"
                                : m.projectType === "ce"
                                ? "Community Engagement"
                                : m.projectType || ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: statusColor(m.status),
                              }}
                            >
                              {m.status || "—"}
                            </div>
                            {m.targetDate && (
                              <div
                                style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}
                              >
                                {formatDate(m.targetDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
