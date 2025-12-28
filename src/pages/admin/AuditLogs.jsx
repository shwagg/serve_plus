import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Fetch all login/logout logs for all users
        const q = query(
          collection(db, "auditLogs"),
          where("action", "in", ["LOGIN", "LOGOUT"]),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: data.uid || doc.id,
            action: data.action,
            email: data.email || "-", // fallback if not present
            role: data.role || "-", // fallback if not present
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "short" }) : "-",
          };
        });
        setLogs(logsData);
      } catch (err) {
        setLogs([]);
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  return (
    <div
      className="audit-logs-page"
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: 0,
        margin: 0,
      }}
    >
      <header
        style={{
          width: "100%",
          background: "#f1f5f9",
          color: "#111",
          padding: "2rem 0 1.5rem 0",
          textAlign: "center",
          fontWeight: 700,
          fontSize: "2.5rem",
          letterSpacing: "-1px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >


        Audit Logs
      </header>
      <main
        style={{
          width: "100%",
          maxWidth: "1100px",
          margin: "2.5rem auto 0 auto",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "2.5rem 2rem 2rem 2rem",
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading ? (
          <p style={{ textAlign: "center", fontSize: "1.2rem", color: "#64748b" }}>Loading...</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              className="audit-logs-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                fontSize: "1.08rem",
              }}
            >
              <thead style={{ background: "#e5e7eb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.5px" }}>ID</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.5px" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.5px" }}>Role</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.5px" }}>Date & Time</th>
                  <th style={{ textAlign: "left", padding: "1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.5px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#111" }}>
                      <p>No audit logs found.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #e2e8f0", color: "#111"}}>
                        <td style={{ padding: "1rem" }}>{log.id}</td>
                        <td style={{ padding: "1rem" }}>{log.email}</td>
                        <td style={{ padding: "1rem" }}>{log.role}</td>
                        <td style={{ padding: "1rem" }}>{log.timestamp}</td>
                        <td style={{ padding: "1rem" }}>{log.action}</td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
