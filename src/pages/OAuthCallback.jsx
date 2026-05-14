import { useEffect, useRef, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebaseConfig";

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

        const token = searchParams.get("token");

        if (!token) {
          setError("No authentication token received. Please try again.");
          return;
        }

        navigate("/auth/blackboard/complete", { replace: true });
        await signInWithCustomToken(auth, token);
        navigate("/auth", {
          replace: true,
          state: {blackboardComplete: true},
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Blackboard custom token sign-in failed:", err);
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
