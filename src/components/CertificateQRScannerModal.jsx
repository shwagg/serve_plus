import React, { useState } from "react";
import QRScanner from "./QRScanner";
import "./styles/ChatModal.css";

export default function CertificateQRScannerModal({ isOpen, onClose }) {
  const [scanResult, setScanResult] = useState(null);

  const handleScan = (result) => {
    setScanResult(result);
    // Optionally, you can close the modal or trigger further actions here
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-content" onClick={e => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h2>Verify Certificate</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
          <QRScanner onScan={handleScan} />
          {scanResult && (
            <div style={{ marginTop: '1rem', color: '#1A375C', wordBreak: 'break-all' }}>
              <strong>Scanned Result:</strong>
              <div>{scanResult}</div>
            </div>
          )}
        </div>
        <button className="chat-modal-close" onClick={onClose} style={{marginTop: '1rem'}}>Close</button>
      </div>
    </div>
  );
}
