/** use http://localhost:5173/oauth-callback to manually run kasi hindi siya lalabas dahil wala pa sa yung credentials
needed for token exchange sa blackboard */

import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

function OAuthCallback() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get("token");
        const provider = searchParams.get("provider");

        if (!token) {
          setError("No authentication token received. Please try again.");
          setLoading(false);
          return;
        }

        // Sign in with custom token from backend
        const userCred = await signInWithCustomToken(auth, token);
        const uid = userCred.user.uid;

        console.log("OAuth sign-in successful, uid:", uid);

        // Fetch user profile to determine role
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setError("User profile not found. Please contact administrator.");
          setLoading(false);
          return;
        }

        const { role, status } = userSnap.data();

        // Check if account is active
        if (status !== "active") {
          setError("Your account is not active. Please contact administrator.");
          setLoading(false);
          return;
        }

        // Redirect based on role
        const redirectMap = {
          admin: "/admin/dashboard",
          faculty: "/faculty/projects",
          partner: "/partner/projects",
          student: "/student/home",
        };

        const redirectPath = redirectMap[role] || "/student/home";
        navigate(redirectPath, { replace: true });

      } catch (err) {
        console.error("OAuth callback error:", err);
        setError("Authentication failed. Please try signing in again.");
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="ui-container">
        <div className="ui-card">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 className="ui-title">Completing Sign In</h2>
            <p style={{ color: "#475569", marginTop: 16 }}>
              Please wait while we verify your account...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-container">
      <div className="ui-card">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
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

export default OAuthCallback;
