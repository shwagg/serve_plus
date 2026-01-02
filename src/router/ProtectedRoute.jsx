import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";


//Note: I changed this code for MFA concept. Example: no other roles can access admin dashboard
//other than if they login or not. this route directs user instead to authentication page.
export function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      // If no role restriction, allow logged-in users
      if (!allowedRoles || allowedRoles.length === 0) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setAllowed(false);
        } else {
          const { role, status } = userSnap.data();

          if (status !== "active") {
            setAllowed(false);
          } else {
            setAllowed(allowedRoles.includes(role));
          }
        }
      } catch (err) {
        console.error("ProtectedRoute error:", err);
        setAllowed(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [allowedRoles]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!allowed) {
    //here, it checks if user has logged in and correct role for the accessing of specific page.
    //if not, it directs them to the authentication page again.
    return <Navigate to="/auth" replace />;
  }

  return children;
}
