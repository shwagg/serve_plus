import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import servePlusIcon from "../assets/serve_plus_icon.svg";
import { auth, functions } from "../firebaseConfig";
import {
  clearMfaSession,
  readMfaSession,
} from "../utils/mfaSession";
import "../styles/ui.css";
import "../styles/mfa.css";

function MfaSetup() {
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appOpenHint, setAppOpenHint] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function beginSetup() {
      const session = readMfaSession();
      if (!session?.sessionToken || session.action !== "MFA_SETUP_REQUIRED") {
        navigate("/auth", {replace: true});
        return;
      }

      try {
        const beginEnrollment = httpsCallable(functions, "beginTotpEnrollment");
        const result = await beginEnrollment({
          sessionToken: session.sessionToken,
        });

        if (!cancelled) {
          setSetup(result.data);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("MFA setup error:", err);
        if (!cancelled) {
          setError(err?.message || "MFA setup expired. Sign in again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    beginSetup();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleCopy = async () => {
    if (!setup?.secret) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Unable to copy setup key.");
    }
  };

  const handleOpenAuthenticator = (event) => {
    event.preventDefault();
    if (!setup?.otpauthUrl) return;

    setAppOpenHint("");
    window.location.assign(setup.otpauthUrl);

    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setAppOpenHint(
          "If the app did not open, scan the QR code or copy the setup key.",
        );
      }
    }, 1200);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const session = readMfaSession();
    if (!session?.sessionToken) {
      navigate("/auth", {replace: true});
      return;
    }

    try {
      const verifyEnrollment = httpsCallable(functions, "verifyTotpEnrollment");
      const result = await verifyEnrollment({
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

      setError("MFA setup failed. Please try again.");
    } catch (err) {
      if (import.meta.env.DEV) console.error("MFA setup verify error:", err);
      setError(err?.message || "Invalid authenticator code.");
    } finally {
      setSubmitting(false);
    }
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
              <h1>Set up authenticator</h1>
              <p>Scan this in Microsoft Authenticator.</p>
            </div>

            {loading ? (
              <p className="ui-smallText">Preparing setup...</p>
            ) : setup ? (
              <>
                <div className="mfa-qr-wrap">
                  <QRCodeSVG value={setup.otpauthUrl} size={176} />
                </div>

                <div className="mfa-key-wrap">
                  <span>{setup.secret}</span>
                  <button type="button" onClick={handleCopy}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                {setup.otpauthUrl && (
                  <a
                    className="mfa-link"
                    href={setup.otpauthUrl}
                    onClick={handleOpenAuthenticator}
                  >
                    Open authenticator app
                  </a>
                )}

                {appOpenHint && (
                  <p className="mfa-help-text">{appOpenHint}</p>
                )}

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
              </>
            ) : null}

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

export default MfaSetup;
