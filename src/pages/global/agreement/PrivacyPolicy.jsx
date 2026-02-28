import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../../components/Header";
import { db } from "../../../firebaseConfig";
import "./PrivacyPolicy.css";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [intro, setIntro] = useState("");
  const [sections, setSections] = useState([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "agreements"));
        if (snap.exists()) {
          const data = snap.data();
          setIntro(data.privacyIntro || "");
          setSections(data.privacySections || []);
          setVersion(data.version || "");
        }
      } catch (err) {
        console.error("Failed to fetch privacy policy:", err);
      }
      setLoading(false);
    };
    fetchPrivacy();
  }, []);

  const renderBody = (body) => {
    if (!body) return null;
    const lines = body.split("\n").filter((l) => l.trim());
    if (lines.length > 1) {
      return (
        <ul>
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      );
    }
    return <p>{body}</p>;
  };

  return (
    <div className="agreement-page">
      <Header />
      <div className="agreement-content">
        <div className="agreement-tabs">
          <button
            className="agreement-tab-link"
            onClick={() => navigate("/global/terms-condition")}
          >
            &larr; Terms and Conditions
          </button>
          <span
            className="agreement-tab-active"
            style={{
              textAlign: "right",
              paddingLeft: "1.2rem",
              paddingRight: 0,
              borderLeft: "1px solid #e0e0e0",
              borderBottom: "3px solid #1976d2",
              flex: 1,
            }}
          >
            Privacy Policy{" "}
            {version && (
              <small style={{ color: "#94a3b8" }}>(v{version})</small>
            )}
          </span>
        </div>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        ) : (
          <>
            {intro && <p>{intro}</p>}
            <hr className="agreement-divider" />
            {sections.map((s, i) => (
              <div key={i}>
                <h2>{s.heading}</h2>
                {renderBody(s.body)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
