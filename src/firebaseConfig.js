import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAuBOoirb88gGlSCL5hz3kPqKxnwxLUjYk",
  authDomain: "serveplus-a806e.firebaseapp.com",
  projectId: "serveplus-a806e",
  storageBucket: "serveplus-a806e.firebasestorage.app",
  messagingSenderId: "48789144750",
  appId: "1:48789144750:web:29c74c480c2123d495193f"
};

const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Connect to emulators (LOCAL ONLY)
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 0);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export { auth, db, functions };
