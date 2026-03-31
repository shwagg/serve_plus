import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import "../../styles/admin.css";
import "../../styles/AuditLogs.css";

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
        let logsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            docId: doc.id,
            action: data.action,
            email: data.email || "-", // fallback if not present
            name: data.name || data.displayName || "", // fallback if not present
            role: data.role || "-", // fallback if not present
            uid: data.uid || data.userId || "", // fallback if not present
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "short" }) : "-",
          };
        });

        // Find logs missing a name but with a uid
        const logsMissingName = logsData.filter(log => !log.name && log.uid);
        // Fetch names in parallel
        const nameFetches = logsMissingName.map(async (log) => {
          try {
            const userDoc = await getDoc(doc(db, "users", log.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return { uid: log.uid, name: userData.name || userData.displayName || "-" };
            }
          } catch (e) {}
          return { uid: log.uid, name: "-" };
        });
        const fetchedNames = await Promise.all(nameFetches);
        // Map of uid to name
        const nameMap = Object.fromEntries(fetchedNames.map(n => [n.uid, n.name]));
        // Merge names into logsData
        logsData = logsData.map(log => {
          if (!log.name && log.uid && nameMap[log.uid]) {
            return { ...log, name: nameMap[log.uid] };
          }
          return log;
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
    <div className="admin-outlet">
      <div className="audit-logs-container">
        {loading ? (
          <p style={{ textAlign: "center", fontSize: "1.2rem", color: "#bfc7e0" }}>Loading...</p>
        ) : (
          <div>
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="no-logs">
                      <p>No audit logs found.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.docId}>
                      <td>{log.uid || log.docId}</td>
                      <td>{log.name}</td>
                      <td>{log.email}</td>
                      <td>{log.role}</td>
                      <td>{log.timestamp}</td>
                      <td>
                        <span className={`audit-badge ${log.action === 'LOGIN' ? 'success' : log.action === 'LOGOUT' ? 'pending' : ''}`}>
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
