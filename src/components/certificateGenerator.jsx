import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
  const [recipient, setRecipient] = useState("");
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

  // Download as image or PDF (placeholder)
  const handleDownload = () => {
    window.print(); // For demo, use print dialog
  };

  return (
    <div className="certificate-generator-container">
      <div className="certificate-form-panel">
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
  );
}
