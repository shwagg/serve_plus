import { useEffect, useRef, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebaseConfig";

const API_URL = import.meta.env.VITE_API_URL;

function getBlackboardExchangeUrl() {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured.");
  }

  const baseUrl = API_URL.replace(/\/+$/, "");

  try {
    const url = new URL(baseUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart === "blackboardAuth" || lastPart === "blackboardCallback") {
      pathParts[pathParts.length - 1] = "exchangeBlackboardCode";
      url.pathname = `/${pathParts.join("/")}`;
    } else {
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/exchangeBlackboardCode`;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${baseUrl.replace(/\/(?:blackboardAuth|blackboardCallback)$/, "")}` +
      "/exchangeBlackboardCode";
  }
}

function OAuthCallback() {
  const [error, setError] = useState("");
  const hasStarted = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const completeBlackboardLogin = async () => {
      try {
        if (hasStarted.current) return;
        hasStarted.current = true;

        const code = searchParams.get("code");

        if (!code) {
          setError("No sign-in code received. Please try again.");
          return;
        }

        navigate("/auth/blackboard/complete", { replace: true });

        const response = await fetch(getBlackboardExchangeUrl(), {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({code}),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.customToken) {
          throw new Error(data.error || "Blackboard code exchange failed.");
        }

        await signInWithCustomToken(auth, data.customToken);
        navigate("/auth", {
          replace: true,
          state: {blackboardComplete: true},
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Blackboard code exchange sign-in failed:", err);
        }
        setError("Authentication failed. Please try signing in again.");
      }
    };

    completeBlackboardLogin();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="ui-container">
        <div className="ui-card">
          <div style={{ textAlign: "center" }}>
            <h2 className="ui-title">Authentication Failed</h2>
            <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>
            <button
              className="ui-btn"
              style={{ marginTop: 24 }}
              onClick={() => navigate("/auth", { replace: true })}
            >
              BACK TO LOGIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-container">
      <div className="ui-card">
        <div style={{ textAlign: "center" }}>
          <h2 className="ui-title">Completing Sign In</h2>
          <p style={{ color: "#475569", marginTop: 16 }}>
            Please wait while we verify your account...
          </p>
        </div>
      </div>
    </div>
  );
}

export default OAuthCallback;
