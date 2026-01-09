import { useCallback } from "react";

const BLACKBOARD_AUTHORIZE_URL = import.meta.env.VITE_BLACKBOARD_AUTHORIZE_URL
const BLACKBOARD_CLIENT_ID = import.meta.env.VITE_BLACKBOARD_CLIENT_ID;
const BLACKBOARD_REDIRECT_URI = import.meta.env.VITE_BLACKBOARD_REDIRECT_URI;

//generates a random cross-site request forgery for security
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


export function useBlackboardAuth() {
  const initiateOAuth = useCallback(() => {
    // Generate state for CSRF protection
    const state = generateState();
    sessionStorage.setItem("oauth_state", state);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: BLACKBOARD_CLIENT_ID,
      response_type: "code",
      redirect_uri: BLACKBOARD_REDIRECT_URI,
      scope: "openid profile email", // Request specific scopes
      state: state,
    });

    const authorizationUrl = `${BLACKBOARD_AUTHORIZE_URL}?${params.toString()}`;

    // Redirect to Blackboard authorization page
    window.location.href = authorizationUrl;
  }, []);

  return initiateOAuth;
}

export default useBlackboardAuth;
