import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  //measurementID missing. measurement id pang built-in analytics daw ni firebase.
};

const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence); // Ensure persistence
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");

// Connect to emulators (LOCAL ONLY)
let emulatorsConnected = false;
if (import.meta.env.DEV) {
  emulatorsConnected = true;
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export { auth, db, functions };
