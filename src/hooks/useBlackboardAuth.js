import { useCallback } from "react";
import { OAuthProvider, signInWithRedirect } from "firebase/auth";
import { auth } from "../firebaseConfig";

const BLACKBOARD_OIDC_PROVIDER_ID =
  import.meta.env.VITE_BLACKBOARD_OIDC_PROVIDER_ID || "oidc.oidc.blackboard";

export function useBlackboardAuth() {
  const initiateOidc = useCallback(() => {
    const provider = new OAuthProvider(BLACKBOARD_OIDC_PROVIDER_ID);
    provider.addScope("openid");
    provider.addScope("email");
    provider.addScope("profile");

    return signInWithRedirect(auth, provider);
  }, []);

  return initiateOidc;
}

export default useBlackboardAuth;
