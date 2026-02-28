import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "../context/SessionContext";
//uses data from SessionContext, to have prevent redundancy

export function ProtectedRoute({ children, allowedRoles }) {
  const { userData, isSessionActive } = useSession();

  if (isSessionActive && !userData) {
    return <div>Loading...</div>; //to be replaced with loading animation
  }

  //If not logged in
  if (!isSessionActive) {
    return <Navigate to="/auth" replace />;
  }

  //No specific role required
  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  // If role is not allowed, goes back to login
  if (!allowedRoles.includes(userData?.role)) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
