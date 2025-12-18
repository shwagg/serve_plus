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
        const q = query(
          collection(db, "auditLogs"),
          where("action", "in", ["LOGIN", "LOGOUT"]),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            action: data.action,
            uid: data.uid,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-",
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
    <div className="audit-logs-container">
      <h2>Audit Logs</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="audit-logs-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>UID</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.uid}</td>
                <td>{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
