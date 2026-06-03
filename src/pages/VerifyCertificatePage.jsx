import React, { useState, useRef } from "react";
import QRScanner from "../components/QRScanner";
import "../components/styles/ChatModal.css";
import { getFirestore, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { app } from "../firebaseConfig";

export default function VerifyCertificatePage() {
  const [tab, setTab] = useState("id");
  const [certificateId, setCertificateId] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [certInfo, setCertInfo] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const lastSearchRef = useRef(0);
  const SEARCH_COOLDOWN_MS = 3000; // prevent rapid repeated queries

  const fetchCertificateInfo = async (id) => {
    // Rate limiting: enforce a cooldown between searches
    const now = Date.now();
    if (now - lastSearchRef.current < SEARCH_COOLDOWN_MS) {
      setSearchError("Please wait a moment before searching again.");
      return;
    }
    lastSearchRef.current = now;

    // Sanitize: trim whitespace and cap length to prevent oversized queries
    const sanitized = id.trim().slice(0, 100);
    if (!sanitized) return;

    setCertInfo(null);
    setSearchError("");
    setSearching(true);
    try {
      const db = getFirestore(app);
      const certQuery = query(
        collectionGroup(db, "certificates"),
        where("certificateId", "==", sanitized)
      );
      const querySnapshot = await getDocs(certQuery);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        // UID is intentionally omitted — it is a sensitive internal identifier
        setCertInfo({
          name: data.recipient || "",
          course: data.course || "",
          releasedAt: data.releasedAt?.toDate ? data.releasedAt.toDate().toLocaleString() : (data.releasedAt || ""),
          certificateId: data.certificateId || "",
        });
      } else {
        setSearchError("Sorry, but there is no ID matching our records.");
      }
    } catch (err) {
      setSearchError("Error searching for certificate. Please try again.");
    }
    setSearching(false);
  };

  // For search button click
  const handleSearch = async (e) => {
    e.preventDefault();
    await fetchCertificateInfo(certificateId);
  };

  // For QR scan
  const handleQRScan = async (result) => {
    setScanResult(result);
    let certIdToSearch = result;
    // Try to parse as JSON and extract certificateId
    try {
      const parsed = JSON.parse(result);
      if (parsed && parsed.certificateId) {
        certIdToSearch = parsed.certificateId;
      }
    } catch (e) {
      // Not JSON, use as is
    }
    if (certIdToSearch) {
      await fetchCertificateInfo(certIdToSearch);
    }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#fff', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Back Button */}
      <button
        onClick={() => window.history.back()}
        style={{
          position: 'absolute',
          top: 32,
          left: 32,
          background: '#fff',
          color: '#1a3764',
          border: '1.5px solid #3ec6e0',
          borderRadius: 8,
          padding: '8px 18px',
          fontSize: 17,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px #3ec6e022',
          zIndex: 10
        }}
      >
        ← Back
      </button>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 32, color: '#1a3764', marginBottom: 0, letterSpacing: 1 }}>Certificate Verification</div>
          <div style={{ color: '#3ec6e0', fontSize: 18, marginTop: 8, fontWeight: 500 }}>
            Verify the authenticity of certificates using QR code scanning or certificate ID search
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, width: '100%' }}>
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0001', display: 'flex', overflow: 'hidden', width: 420, maxWidth: '100%', margin: '0 auto' }}>
            <button
              onClick={() => setTab('id')}
              style={{
                flex: 1,
                padding: '14px 0',
                fontSize: 18,
                background: tab === 'id' ? '#1a3764' : '#e3f6f9',
                color: tab === 'id' ? '#fff' : '#1a3764',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                transition: 'background 0.2s',
              }}
            >
              ID Search
            </button>
            <button
              onClick={() => setTab('qr')}
              style={{
                flex: 1,
                padding: '14px 0',
                fontSize: 18,
                background: tab === 'qr' ? '#3ec6e0' : '#e3f6f9',
                color: tab === 'qr' ? '#fff' : '#1a3764',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                transition: 'background 0.2s',
              }}
            >
              QR Scanner
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #3ec6e033', padding: 32, width: 420, maxWidth: '100%', margin: '0 auto' }}>
            {tab === 'id' && (
              <>
                <form onSubmit={handleSearch}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
                    <input
                      type="text"
                      value={certificateId}
                      onChange={e => setCertificateId(e.target.value)}
                      placeholder="Enter Certificate ID (e.g., CERT-2024-001)"
                      maxLength={100}
                      style={{ flex: 1, padding: '12px 16px', fontSize: 17, border: '1.5px solid #3ec6e0', borderRadius: 6, marginRight: 8, color: '#1a3764' }}
                      required
                    />
                    <button type="submit" style={{ background: '#3ec6e0', border: 'none', borderRadius: 6, padding: '10px 16px', color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 600 }} disabled={searching}>
                      {searching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </form>
                {certInfo && (
                  <div style={{ marginTop: 18, color: '#1a3764', background: '#e3f6f9', borderRadius: 6, padding: 16, border: '1px solid #3ec6e0', fontSize: 16 }}>
                    <div><strong>Name:</strong> {certInfo.name}</div>
                    <div><strong>Course:</strong> {certInfo.course}</div>
                    <div><strong>Released At:</strong> {certInfo.releasedAt}</div>
                    <div><strong>Certificate ID:</strong> {certInfo.certificateId}</div>
                  </div>
                )}
                {searchError && (
                  <div style={{ marginTop: 18, color: '#b91c1c', background: '#fff0f0', borderRadius: 6, padding: 14, border: '1px solid #fca5a5', fontSize: 16 }}>
                    {searchError}
                  </div>
                )}
              </>
            )}
            {tab === 'qr' && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ marginBottom: 16, fontWeight: 500, color: '#3ec6e0', fontSize: 18 }}>Scan Certificate QR Code</div>
                <div style={{ width: 280, maxWidth: '100%' }}>
                  <QRScanner onScan={handleQRScan} />
                </div>
                {certInfo && (
                  <div style={{ marginTop: 18, color: '#1a3764', background: '#e3f6f9', borderRadius: 6, padding: 16, border: '1px solid #3ec6e0', fontSize: 16 }}>
                    <div><strong>Name:</strong> {certInfo.name}</div>
                    <div><strong>Course:</strong> {certInfo.course}</div>
                    <div><strong>Released At:</strong> {certInfo.releasedAt}</div>
                    <div><strong>Certificate ID:</strong> {certInfo.certificateId}</div>
                  </div>
                )}
                {searchError && (
                  <div style={{ marginTop: 18, color: '#b91c1c', background: '#fff0f0', borderRadius: 6, padding: 14, border: '1px solid #fca5a5', fontSize: 16 }}>
                    {searchError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
