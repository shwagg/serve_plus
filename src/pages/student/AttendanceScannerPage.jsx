import React, { useState } from "react";
import QRScanner from "../../components/QRScanner";
export default function AttendanceScannerPage() {
  const [result, setResult] = useState("");

  const handleScan = (decodedText) => {
    setResult(decodedText);
    // TODO: Send decodedText to backend/Firestore to record attendance
    // Optionally show a success message
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", textAlign: "center" }}>
      <h2>Scan Attendance QR Code</h2>
      <QRScanner onScan={handleScan} />
      {result && (
        <div style={{ marginTop: 24 }}>
          <strong>Scanned QR Code:</strong>
          <div style={{ wordBreak: "break-all", marginTop: 8 }}>{result}</div>
        </div>
      )}
    </div>
  );
}
