import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { renderAgreementContent } from "../utils/agreementContent";
import { FALLBACK_AGREEMENT_VERSION } from "../utils/agreementVersion";
import { showToast } from "../utils/toast";
import "./styles/AgreementModal.css";

export default function AgreementModal({ uid, onAccepted }) {
  const [activeTab, setActiveTab] = useState("terms"); // "terms" or "privacy"
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Agreement content from Firestore
  const [version, setVersion] = useState(FALLBACK_AGREEMENT_VERSION);
  const [termsIntro, setTermsIntro] = useState("");
  const [termsSections, setTermsSections] = useState([]);
  const [privacyIntro, setPrivacyIntro] = useState("");
  const [privacySections, setPrivacySections] = useState([]);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "agreements"));
        if (snap.exists()) {
          const data = snap.data();
          setVersion(data.version || FALLBACK_AGREEMENT_VERSION);
          setTermsIntro(data.termsIntro || "");
          setTermsSections(data.termsSections || []);
          setPrivacyIntro(data.privacyIntro || "");
          setPrivacySections(data.privacySections || []);
        }
      } catch (err) {
        console.warn("Failed to fetch agreement content:", err);
      }
      setFetching(false);
    };
    fetchContent();
  }, []);

  const canAccept = termsChecked && privacyChecked;

  const handleAccept = async () => {
    if (!canAccept) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        termsAccepted: true,
        privacyAccepted: true,
        agreementVersion: version,
        agreementAcceptedAt: serverTimestamp(),
      });
      onAccepted();
    } catch (err) {
      console.error("Failed to save agreement acceptance:", err);
      showToast("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderBody = (body) => {
    return renderAgreementContent(body);
  };

  const renderIntro = (intro) => {
    return renderAgreementContent(intro, {
      richClassName: "agreement-rich-body agreement-intro-rich",
      plainClassName: "agreement-intro-text",
      preservePlainTextBreaks: true,
    });
  };

  return (
    <div className="agreement-modal-overlay">
      <div className="agreement-modal">
        <h2 className="agreement-modal-title">Agreement Required</h2>
        <p className="agreement-modal-subtitle">
          Please review and accept our Terms &amp; Conditions and Privacy Policy
          to continue.{" "}
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            (v{version})
          </span>
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
          {fetching ? (
            <p style={{ textAlign: "center", color: "#94a3b8" }}>Loading...</p>
          ) : activeTab === "terms" ? (
            <div className="agreement-modal-text">
              {renderIntro(termsIntro)}
              <hr className="agreement-divider" />
              {termsSections.map((s, i) => (
                <div className="agreement-section-block" key={i}>
                  <h3>{s.heading}</h3>
                  {renderBody(s.body)}
                </div>
              ))}
            </div>
          ) : (
            <div className="agreement-modal-text">
              {renderIntro(privacyIntro)}
              <hr className="agreement-divider" />
              {privacySections.map((s, i) => (
                <div className="agreement-section-block" key={i}>
                  <h3>{s.heading}</h3>
                  {renderBody(s.body)}
                </div>
              ))}
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
