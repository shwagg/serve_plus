import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";

export function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });

    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>; // Loading state
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
