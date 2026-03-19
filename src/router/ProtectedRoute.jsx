import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../context/SessionContext";
//uses data from SessionContext, to have prevent redundancy

export function ProtectedRoute({ children, allowedRoles }) {
  const { userData, isSessionActive, authLoading } = useSession();
  const location = useLocation();

  // Wait for Firebase to restore auth state before making any redirect decision
  if (authLoading) {
    return <div>Loading...</div>; //to be replaced with loading animation
  }

  // Not logged in — save intended destination so we can redirect back after login
  if (!isSessionActive) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // Still fetching user data from Firestore
  if (!userData) {
    return <div>Loading...</div>;
  }

  // No specific role required
  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  // If role is not allowed, goes back to login
  if (!allowedRoles.includes(userData?.role)) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
