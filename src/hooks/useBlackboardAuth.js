import { useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export function useBlackboardAuth() {
  const initiateBlackboardAuth = useCallback(() => {
    if (!API_URL) {
      throw new Error("VITE_API_URL is not configured.");
    }

    const baseUrl = API_URL.replace(/\/+$/, "");
    window.location.assign(`${baseUrl}/auth/blackboard/start`);
  }, []);

  return initiateBlackboardAuth;
}

export default useBlackboardAuth;
