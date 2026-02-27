import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../firebaseConfig";
import "./styles/AgreementModal.css";

// Current agreement version — update this whenever admin changes the agreements.
export const CURRENT_AGREEMENT_VERSION = "1.0";

export default function AgreementModal({ uid, onAccepted }) {
  const [activeTab, setActiveTab] = useState("terms"); // "terms" or "privacy"
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const canAccept = termsChecked && privacyChecked;

  const handleAccept = async () => {
    if (!canAccept) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        termsAccepted: true,
        privacyAccepted: true,
        agreementVersion: CURRENT_AGREEMENT_VERSION,
        agreementAcceptedAt: serverTimestamp(),
      });
      onAccepted();
    } catch (err) {
      console.error("Failed to save agreement acceptance:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="agreement-modal-overlay">
      <div className="agreement-modal">
        <h2 className="agreement-modal-title">Agreement Required</h2>
        <p className="agreement-modal-subtitle">
          Please review and accept our Terms &amp; Conditions and Privacy Policy
          to continue.
        </p>

        {/* Tabs */}
        <div className="agreement-modal-tabs">
          <button
            className={`agreement-modal-tab ${activeTab === "terms" ? "active" : ""}`}
            onClick={() => setActiveTab("terms")}
          >
            Terms &amp; Conditions
          </button>
          <button
            className={`agreement-modal-tab ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            Privacy Policy
          </button>
        </div>

        {/* Scrollable content */}
        <div className="agreement-modal-body">
          {activeTab === "terms" ? (
            <div className="agreement-modal-text">
              <p>
                Welcome to Serve Plus. These Terms and Conditions outline the
                rules and regulations for the use of our platform. By accessing
                this website, you accept these terms in full. Please read them
                carefully.
              </p>
              <hr className="agreement-divider" />
              <h3>1. Acceptance of Terms</h3>
              <p>
                By using Serve Plus, you agree to comply with and be bound by
                these terms.
              </p>
              <h3>2. User Responsibilities</h3>
              <p>
                You are responsible for maintaining the confidentiality of your
                account and password and for restricting access to your
                computer.
              </p>
              <h3>3. Prohibited Activities</h3>
              <ul>
                <li>No unauthorized access or use of the platform.</li>
                <li>No data mining, scraping, or similar activities.</li>
                <li>
                  No activity that disrupts or interferes with the platform.
                </li>
              </ul>
              <h3>4. Intellectual Property</h3>
              <p>
                All content, trademarks, and data on this site are the property
                of Serve Plus or its licensors.
              </p>
              <h3>5. Modifications</h3>
              <p>
                We reserve the right to revise these terms at any time.
                Continued use of the platform means you accept any changes.
              </p>
              <h3>6. Termination</h3>
              <p>
                We may terminate or suspend access to our platform immediately,
                without prior notice, for any breach of these terms.
              </p>
              <h3>7. Governing Law</h3>
              <p>
                These terms are governed by and construed in accordance with the
                laws of your jurisdiction.
              </p>
              <h3>8. Contact Us</h3>
              <p>
                If you have any questions about these Terms, please contact us
                at support@serveplus.com.
              </p>
            </div>
          ) : (
            <div className="agreement-modal-text">
              <p>
                Your privacy is important to us. This Privacy Policy explains
                how Serve Plus collects, uses, and protects your information
                when you use our platform.
              </p>
              <hr className="agreement-divider" />
              <h3>1. Information We Collect</h3>
              <ul>
                <li>Personal information (name, email address, etc.)</li>
                <li>Usage data and cookies</li>
              </ul>
              <h3>2. Use of Information</h3>
              <p>
                Information is used to provide and improve our services,
                communicate with users, and ensure platform security.
              </p>
              <h3>3. Data Protection</h3>
              <p>
                We implement security measures to protect your data from
                unauthorized access.
              </p>
              <h3>4. Third-Party Services</h3>
              <p>
                We may use third-party services that collect, monitor, and
                analyze usage.
              </p>
              <h3>5. Changes to This Policy</h3>
              <p>
                We may update our Privacy Policy from time to time. Changes will
                be posted on this page.
              </p>
              <h3>6. Contact Us</h3>
              <p>
                If you have questions about this Privacy Policy, contact us at
                support@serveplus.com.
              </p>
            </div>
          )}
        </div>

        {/* Checkboxes */}
        <div className="agreement-modal-checks">
          <label className="agreement-modal-check">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
            />
            I have read and agree to the <strong>Terms &amp; Conditions</strong>
          </label>
          <label className="agreement-modal-check">
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={(e) => setPrivacyChecked(e.target.checked)}
            />
            I have read and agree to the <strong>Privacy Policy</strong>
          </label>
        </div>

        {/* Accept button */}
        <button
          className={`agreement-modal-btn ${canAccept ? "" : "disabled"}`}
          onClick={handleAccept}
          disabled={!canAccept || loading}
        >
          {loading ? "Saving..." : "I Agree & Continue"}
        </button>
      </div>
    </div>
  );
}
