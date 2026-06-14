import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../../components/Header";
import { db } from "../../../firebaseConfig";
import { renderAgreementContent } from "../../../utils/agreementContent";
import "./TermsConditions.css";

export default function TermsCondition() {
  const navigate = useNavigate();
  const [intro, setIntro] = useState("");
  const [sections, setSections] = useState([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "agreements"));
        if (snap.exists()) {
          const data = snap.data();
          setIntro(data.termsIntro || "");
          setSections(data.termsSections || []);
          setVersion(data.version || "");
        }
      } catch (err) {
        console.error("Failed to fetch terms:", err);
      }
      setLoading(false);
    };
    fetchTerms();
  }, []);

  return (
    <div className="agreement-page">
      <Header />
      <div className="agreement-content">
        <div className="agreement-tabs">
          <span className="agreement-tab-active">
            Terms and Conditions{" "}
            {version && (
              <small style={{ color: "#94a3b8" }}>(v{version})</small>
            )}
          </span>
          <button
            className="agreement-tab-link"
            onClick={() => navigate("/global/privacy-policy")}
          >
            Privacy Policy &rarr;
          </button>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        ) : (
          <>
            {renderAgreementContent(intro, {
              richClassName: "agreement-rich-body agreement-intro-rich",
              plainClassName: "agreement-intro-text",
              preservePlainTextBreaks: true,
            })}
            <hr className="agreement-divider" />
            {sections.map((s, i) => (
              <div key={i}>
                <h2>{s.heading}</h2>
                {renderAgreementContent(s.body)}
              </div>
            ))}
            <hr className="agreement-divider" />
          </>
        )}
      </div>
    </div>
  );
}
