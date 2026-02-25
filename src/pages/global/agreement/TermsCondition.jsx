import { useNavigate } from "react-router-dom";
import Header from "../../../components/Header";
import "./TermsConditions.css";

export default function TermsCondition() {
  const navigate = useNavigate();
  return (
    <div className="agreement-page">
      <Header />
      <div className="agreement-content">
        <div className="agreement-tabs">
          <span className="agreement-tab-active">Terms and Conditions</span>
          <button
            className="agreement-tab-link"
            onClick={() => navigate("/global/privacy-policy")}
          >
            Privacy Policy →
          </button>
        </div>
        <p>
          Welcome to Serve Plus. These Terms and Conditions outline the rules
          and regulations for the use of our platform. By accessing this
          website, you accept these terms in full. Please read them carefully.
        </p>
        <hr className="agreement-divider" />
        <h2>1. Acceptance of Terms</h2>
        <p>
          By using Serve Plus, you agree to comply with and be bound by these
          terms.
        </p>
        <h2>2. User Responsibilities</h2>
        <p>
          You are responsible for maintaining the confidentiality of your
          account and password and for restricting access to your computer.
        </p>
        <h2>3. Prohibited Activities</h2>
        <ul>
          <li>No unauthorized access or use of the platform.</li>
          <li>No data mining, scraping, or similar activities.</li>
          <li>No activity that disrupts or interferes with the platform.</li>
        </ul>
        <h2>4. Intellectual Property</h2>
        <p>
          All content, trademarks, and data on this site are the property of
          Serve Plus or its licensors.
        </p>
        <h2>5. Modifications</h2>
        <p>
          We reserve the right to revise these terms at any time. Continued use
          of the platform means you accept any changes.
        </p>
        <h2>6. Termination</h2>
        <p>
          We may terminate or suspend access to our platform immediately,
          without prior notice, for any breach of these terms.
        </p>
        <h2>7. Governing Law</h2>
        <p>
          These terms are governed by and construed in accordance with the laws
          of your jurisdiction.
        </p>
        <h2>8. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at
          support@serveplus.com.
        </p>
        <hr className="agreement-divider" />
      </div>
    </div>
  );
}
