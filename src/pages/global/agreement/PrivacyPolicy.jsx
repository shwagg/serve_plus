import { useNavigate } from "react-router-dom";
import Header from "../../../components/Header";
import "./PrivacyPolicy.css";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="agreement-page">
      <Header />
      <div className="agreement-content">
        <div className="agreement-tabs">
          <button
            className="agreement-tab-link"
            onClick={() => navigate("/global/terms-condition")}
          >
            ← Terms and Conditions
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
            Privacy Policy
          </span>
        </div>
        <p>
          Your privacy is important to us. This Privacy Policy explains how
          Serve Plus collects, uses, and protects your information when you use
          our platform.
        </p>
        <hr className="agreement-divider" />
        <h2>1. Information We Collect</h2>
        <ul>
          <li>Personal information (name, email address, etc.)</li>
          <li>Usage data and cookies</li>
        </ul>
        <h2>2. Use of Information</h2>
        <p>
          Information is used to provide and improve our services, communicate
          with users, and ensure platform security.
        </p>
        <h2>3. Data Protection</h2>
        <p>
          We implement security measures to protect your data from unauthorized
          access.
        </p>
        <h2>4. Third-Party Services</h2>
        <p>
          We may use third-party services that collect, monitor, and analyze
          usage.
        </p>
        <h2>5. Changes to This Policy</h2>
        <p>
          We may update our Privacy Policy from time to time. Changes will be
          posted on this page.
        </p>
        <h2>6. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at [wala
          pa tayong email].
        </p>
      </div>
    </div>
  );
}
