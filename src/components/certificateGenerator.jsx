import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { doc, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { showToast } from "../utils/toast";
import { generateCertificateId, buildCertificateBlob, issueCertificate } from "../utils/certificateUtils";
import "./certificateGenerator.css";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CertificateGenerator() {
  const location = useLocation();
  const navigate = useNavigate();

  const userID = location.state?.userID || "";
  const [recipient, setRecipient] = useState(location.state?.recipient || "");
  const [course, setCourse] = useState(location.state?.course || "");
  const [date, setDate] = useState("");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // Stable certificate ID — generated once, shared across export and release
  const [certificateId] = useState(() => generateCertificateId());

  // Live preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobRef = useRef(null);
  const debounceRef = useRef(null);

  // Modal state (for fullscreen view)
  const [showModal, setShowModal] = useState(false);
  const [modalUrl, setModalUrl] = useState(null);

  // ── Live preview — debounced PDF generation ─────────────────────────────────
  const generatePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const blob = await buildCertificateBlob({ recipient, course, date, loc, day, month, year, certId: certificateId });
      // Revoke previous blob URL
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      // Keep showing old preview on error
    } finally {
      setPreviewLoading(false);
    }
  }, [recipient, course, date, loc, day, month, year, certificateId]);

  useEffect(() => {
    // Only auto-preview if at least recipient or course has a value
    if (!recipient && !course && !loc && !day && !month && !year && !date) {
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(generatePreview, 600);
    return () => clearTimeout(debounceRef.current);
  }, [generatePreview]);

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleOpenFullscreen = async () => {
    try {
      const blob = await buildCertificateBlob({ recipient, course, date, loc, day, month, year, certId: certificateId });
      if (modalUrl) URL.revokeObjectURL(modalUrl);
      const url = URL.createObjectURL(blob);
      setModalUrl(url);
      setShowModal(true);
    } catch (err) {
      showToast("Error generating certificate preview: " + err.message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (modalUrl) {
      URL.revokeObjectURL(modalUrl);
      setModalUrl(null);
    }
  };

  const handleReleaseToStudent = async () => {
    if (!userID) {
      showToast("No volunteer selected. Please select a volunteer.");
      return;
    }
    try {
      await issueCertificate({ userId: userID, recipient, course, date, loc, day, month, year });
      showToast("Certificate released to volunteer and recorded successfully!");
    } catch (err) {
      showToast("Failed to release certificate: " + err.message);
    }
  };

  const hasContent = recipient || course || date || loc || day || month || year;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="certgen-page">
      {/* Top bar */}
      <div className="certgen-topbar">
        <button className="certgen-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <span className="certgen-topbar-title">Certificate Generator</span>
      </div>

      {/* Fullscreen modal */}
      {showModal && modalUrl && (
        <div className="certgen-modal-overlay" onClick={handleCloseModal}>
          <div className="certgen-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="certgen-modal-header">
              <h3>Certificate Preview</h3>
              <button className="certgen-modal-close-btn" onClick={handleCloseModal}>✕</button>
            </div>
            <iframe src={modalUrl} title="Certificate PDF" className="certgen-modal-iframe" />
            <div className="certgen-modal-footer">
              <a href={modalUrl} download="SERVE+_Certificate.pdf" className="certgen-modal-download-link">
                ↓ Download PDF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="certgen-body">
        {/* ── Left: Form card ── */}
        <div className="certgen-form-card">
          <div className="certgen-card-header">
            <h2>Certificate Details</h2>
          </div>
          <div className="certgen-form-body">
            {/* Recipient */}
            <div className="certgen-field">
              <label>Recipient Name</label>
              <input
                type="text"
                maxLength={50}
                placeholder="Enter recipient name"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <span className="certgen-char-count">{recipient.length}/50 characters</span>
            </div>

            {/* Mission Title */}
            <div className="certgen-field">
              <label>Mission Title</label>
              <input
                type="text"
                placeholder="Enter mission title"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="certgen-field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="certgen-field">
              <label>Location</label>
              <input
                type="text"
                placeholder="Enter location"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
              />
            </div>

            {/* Day / Month / Year row */}
            <div className="certgen-row">
              <div className="certgen-field">
                <label>Day</label>
                <input
                  type="text"
                  placeholder="e.g. 12"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
              <div className="certgen-field">
                <label>Month</label>
                <input
                  type="text"
                  placeholder="e.g. May"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div className="certgen-field">
                <label>Year</label>
                <input
                  type="text"
                  placeholder="e.g. 2026"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>

            <hr className="certgen-divider" />

            {/* Actions */}
            <div className="certgen-actions">
              <button className="certgen-btn-primary" onClick={handleOpenFullscreen}>
                ↗ View Fullscreen
              </button>
              <button className="certgen-btn-success" onClick={handleReleaseToStudent}>
                ✓ Release to Volunteer
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Live preview card ── */}
        <div className="certgen-preview-card">
          <div className="certgen-preview-header">
            <h2>Live Preview</h2>
            <span className="certgen-preview-badge">Real PDF</span>
          </div>
          <div className="certgen-preview-body">
            {!hasContent && !previewUrl ? (
              <div className="certgen-preview-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Fill in the certificate details on the left<br/>to see a live PDF preview here.</p>
              </div>
            ) : previewLoading ? (
              <div className="certgen-preview-loading">
                <div className="certgen-spinner" />
                <span>Generating preview…</span>
              </div>
            ) : previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Certificate Live Preview"
                className="certgen-preview-iframe"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
