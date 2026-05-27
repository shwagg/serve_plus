import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";
import servePlusIcon from "../assets/serve_plus_icon.svg";
import { auth, functions } from "../firebaseConfig";
import {
  clearMfaSession,
  readMfaSession,
} from "../utils/mfaSession";
import "../styles/ui.css";
import "../styles/mfa.css";

function MfaVerify() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResetMessage("");
    setSubmitting(true);

    const session = readMfaSession();
    if (!session?.sessionToken || session.action !== "MFA_REQUIRED") {
      navigate("/auth", {replace: true});
      return;
    }

    try {
      const verifyLogin = httpsCallable(functions, "verifyTotpLogin");
      const result = await verifyLogin({
        sessionToken: session.sessionToken,
        code,
      });

      if (result.data?.customToken) {
        await signInWithCustomToken(auth, result.data.customToken);
        clearMfaSession();
        navigate("/auth", {
          replace: true,
          state: {mfaComplete: true, from: session.from || null},
        });
        return;
      }

      setError("MFA verification failed. Please try again.");
    } catch (err) {
      if (import.meta.env.DEV) console.error("MFA verify error:", err);
      setError(err?.message || "Invalid authenticator code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestTotpReset = async () => {
    setError("");
    setResetMessage("");
    setRequestingReset(true);

    const session = readMfaSession();
    if (!session?.sessionToken || session.action !== "MFA_REQUIRED") {
      navigate("/auth", {replace: true});
      return;
    }

    try {
      const requestReset = httpsCallable(functions, "requestTotpReset");
      await requestReset({
        sessionToken: session.sessionToken,
      });
      setResetMessage(
        "Your request was sent. A system administrator must reset your TOTP setup before you can sign in with a new QR code.",
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error("TOTP reset request error:", err);
      setError(err?.message || "Unable to request TOTP reset.");
    } finally {
      setRequestingReset(false);
    }
  };

  const handleBackToLogin = (event) => {
    event.preventDefault();
    clearMfaSession();
    navigate("/auth", {replace: true});
  };

  const handleRequestResetLink = (event) => {
    event.preventDefault();
    if (submitting || requestingReset) return;
    handleRequestTotpReset();
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-form-panel">
          <form className="ui-form auth-login-form" onSubmit={handleSubmit}>
            <div className="auth-logo-row">
              <img
                src={servePlusIcon}
                alt="SERVE+"
                className="auth-logo-icon"
              />
              <span className="auth-logo-text">
                SERVE<span className="auth-logo-plus">+</span>
              </span>
            </div>

            <div className="mfa-heading">
              <h1>Authenticator code</h1>
              <p>Enter the 6-digit code from Microsoft Authenticator.</p>
            </div>

            <input
              className="ui-input mfa-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />

            <button
              className="auth-login-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Verifying..." : "Continue"}
            </button>

            <div className="mfa-link-row">
              <a
                className="mfa-text-link"
                href="#request-totp-reset"
                aria-disabled={submitting || requestingReset}
                onClick={handleRequestResetLink}
              >
                {requestingReset ? "Sending request..." : "Request TOTP reset"}
              </a>
              <span aria-hidden="true">|</span>
              <a
                className="mfa-text-link"
                href="/auth"
                onClick={handleBackToLogin}
              >
                Back to login
              </a>
            </div>

            {resetMessage && (
              <p className="mfa-success-text">
                {resetMessage}
              </p>
            )}

            {error && (
              <p className="ui-error" style={{textAlign: "center"}}>
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
