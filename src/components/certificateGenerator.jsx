import React, { useState, useEffect } from "react";
import { PDFDocument } from 'pdf-lib';
import { useLocation, useNavigate } from "react-router-dom";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, db } from "../firebaseConfig";
import { doc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./certificateGenerator.css";

const today = new Date();
const formattedDate = today.toLocaleDateString(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const courseOptions = [
  "Service Learning Initiative",
  "Community Engagement Event",
  // Add more as needed
];


export default function CertificateGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  // Get userID and optionally recipient from navigation state (admin flow)
  const userID = location.state?.userID || "";
  const initialRecipient = location.state?.recipient || "";
  const [recipient, setRecipient] = useState(initialRecipient);
  const [course, setCourse] = useState("");
  const [date, setDate] = useState("");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // Pre-fill from navigation state if available
  useEffect(() => {
    if (location.state) {
      if (location.state.recipient) setRecipient(location.state.recipient);
      if (location.state.course) setCourse(location.state.course);
    }
  }, [location.state]);

  // Modal state for PDF preview
  const [showModal, setShowModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Helper: Fill PDF with form data and return Blob
  const fillCertificatePdfBlob = async () => {
    const existingPdfBytes = await fetch('/assets/SERVE+ Certificate (1).pdf').then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    form.getTextField('text_4lt').setText(recipient || '');
    form.getTextField('text_5ablb').setText(course || '');
    form.getTextField('text_6sfji').setText(date || '');
    form.getTextField('text_7mfui').setText(loc || '');
    form.getTextField('text_8bhoi').setText(day || '');
    form.getTextField('text_9gtoh').setText(month || '');
    form.getTextField('text_10fuuc').setText(year || '');
    form.flatten();
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  // Helper: Fill PDF and return URL for preview
  const fillCertificatePdf = async () => {
    const blob = await fillCertificatePdfBlob();
    return URL.createObjectURL(blob);
  };

  const handleDownload = async () => {
    const url = await fillCertificatePdf();
    setPdfUrl(url);
    setShowModal(true);
  };

  // Handler: Release to Student (save to Storage)
  const handleReleaseToStudent = async () => {
    try {
      // Use userID from navigation state (admin flow)
      if (!userID) {
        alert("No student selected. Please select a student.");
        return;
      }
      // Generate the PDF Blob
      const blob = await fillCertificatePdfBlob();
      // Compose file name: volunteername_eventname.pdf
      const safeRecipient = (recipient || "recipient").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const safeCourse = (course || "event").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const fileName = `${safeRecipient}_${safeCourse}.pdf`;
      // Get Firebase Storage instance (emulator)
      const storage = getStorage(app);
      const storageRef = ref(storage, `event-certificates/${userID}/${fileName}`);
      await uploadBytes(storageRef, blob);
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      // Save certificate metadata to Firestore under users/{userID}/certificates
      const certData = {
        fileName,
        downloadURL,
        recipient,
        course,
        date,
        loc,
        day,
        month,
        year,
        releasedAt: serverTimestamp(),
      };
      await addDoc(collection(doc(db, "users", userID), "certificates"), certData);

      // Create notification for the student
      await addDoc(collection(doc(db, "users", userID), "notifications"), {
        type: "certificate_obtained",
        message: `Congratulations! A certificate has been obtained for event "${course}".`,
        event: course,
        createdAt: serverTimestamp(),
        read: false
      });

      alert("Certificate released to student, saved to Storage, and recorded in Firestore!");
    } catch (err) {
      alert("Failed to release certificate: " + err.message);
    }
  };
  const handleCloseModal = () => {
    setShowModal(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  return (
    <div className="certificate-generator-centered-container">
      {/* Back Button */}
      <div className="certificate-back-row">
        <button className="certificate-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="certificate-back-spacer" />
      </div>
      {/* Sample Preview Title at the very top */}
      <div className="certificate-preview-title-row">
        <span className="certificate-preview-title">Sample Preview</span>
      </div>
      {/* Modal Popup for PDF Preview */}
      {showModal && pdfUrl && (
        <div className="certificate-modal-overlay">
          <div className="certificate-modal-content">
            <button className="certificate-modal-close-btn" onClick={handleCloseModal}>X</button>
            <h2 className="certificate-modal-title">SERVE+ Certificate PDF Preview</h2>
            <iframe
              src={pdfUrl}
              title="Certificate PDF"
              className="certificate-modal-iframe"
            />
            <a href={pdfUrl} download="Filled_CERTIFICATE.pdf" className="certificate-modal-download-link">Download PDF</a>
          </div>
        </div>
      )}
      <div className="certificate-details-main-content">
        <div className="certificate-details-form-container">
          <h2>Certificate Details</h2>

          <label>Recipient Name</label>
          <input
            type="text"
            maxLength={50}
            placeholder="Enter recipient name"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className="text_4lt"
          />
          <div className="char-count">{recipient.length}/50 characters</div>

          <label>Mission Title</label>
          <input
            type="text"
            placeholder="Enter mission title"
            value={course}
            onChange={e => setCourse(e.target.value)}
            className="text_5ablb"
          />

          <label>Date</label>
          <input
            type="date"
            className="text_6sfji"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          <label>Location</label>
          <input
            type="text"
            placeholder="Enter location"
            className="text_7mfui"
            value={loc}
            onChange={e => setLoc(e.target.value)}
          />

          <label>Day</label>
          <input
            type="text"
            placeholder="Day"
            className="text_8bhoi"
            value={day}
            onChange={e => setDay(e.target.value)}
          />

          <label>Month</label>
          <input
            type="text"
            placeholder="Month"
            className="text_9gtoh"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />

          <label>Year</label>
          <input
            type="text"
            placeholder="Year"
            className="text_10fuuc"
            value={year}
            onChange={e => setYear(e.target.value)}
          />

          <button className="download-btn" onClick={handleDownload}>
            Download Certificate
          </button>
          <button className="release-btn" onClick={handleReleaseToStudent}>
            Release to Student
          </button>
        </div>
        <div className="certificate-preview-panel">
          <div className="certificate-border">
            <div className="certificate-inner-border">
              <div className="certificate-content" style={{ fontFamily: 'Georgia, serif', color: '#000' }}>
                <h1 style={{ color: '#1a3764', fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: 2 }}>CERTIFICATE</h1>
                <h2 style={{ color: '#1a3764', fontSize: '2rem', fontWeight: 400, margin: 0, letterSpacing: 2 }}>OF PARTICIPATION</h2>
                <div style={{ margin: '24px 0 12px 0', fontWeight: 700, fontSize: '1.3rem' }}>This certificate is proudly presented to</div>
                <div style={{ borderTop: '3px solid #3ec6e0', width: '80%', margin: '0 auto 18px auto' }}></div>
                <div className="cert-recipient text_4lt" style={{ fontSize: '1.5rem', fontWeight: 700, margin: '12px 0' }}>
                  {recipient || "Recipient Name"}
                </div>
                <div style={{ borderTop: '1.5px solid #222', width: '80%', margin: '0 auto 18px auto' }}></div>
                <div style={{ fontSize: '1.1rem', marginBottom: 8 }}>for actively participating in the</div>
                <div className="text_5ablb" style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 4 }}>
                  {course || "[Mission Title / Event Name]"}
                </div>
                <div style={{ fontSize: '1rem', marginBottom: 8 }}>
                  organized by the Center for Service Learning and Community engagement (CSCE)
                </div>
                <div style={{ fontSize: '1rem', marginBottom: 8 }}>
                  held on <span className="text_6sfji">{date || '[Date]'}</span> at <span className="text_7mfui">{loc || '[Location]'}</span>.
                </div>
                <div style={{ fontSize: '1rem', marginBottom: 8 }}>
                  Your dedication to service learning and commitment to making a positive impact in the community are truly commendable.
                </div>
                <div style={{ fontSize: '1rem', marginBottom: 24 }}>
                  Given this <span className="text_8bhoi">{day || '[Day]'}</span> of <span className="text_9gtoh">{month || '[Month]'}</span>, <span className="text_10fuuc">{year || '[Year]'}</span>.
                </div>
                {/* Decorative seal placeholder */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, #ffd700 60%, #e6a700 100%)', border: '4px solid #e6a700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#b8860b' }}>★</div>
                </div>
                <div style={{ borderTop: '3px solid #3ec6e0', width: '80%', margin: '0 auto 18px auto' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
