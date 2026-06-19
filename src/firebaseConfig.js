import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

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
const db = getFirestore(app);
const functions = getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || "us-central1");
const storage = getStorage(app);

// Connect to emulators based on env flags.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const emulateAuth = import.meta.env.VITE_EMULATE_AUTH === "true" || useEmulators;
const emulateFirestore = import.meta.env.VITE_EMULATE_FIRESTORE === "true" || useEmulators;
const emulateFunctions = import.meta.env.VITE_EMULATE_FUNCTIONS === "true" || useEmulators;
const emulateStorage = import.meta.env.VITE_EMULATE_STORAGE === "true" || useEmulators;

if (emulateAuth) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
}
if (emulateFirestore) {
  connectFirestoreEmulator(db, "localhost", 8080);
}
if (emulateFunctions) {
  connectFunctionsEmulator(functions, "localhost", 5001);
}
if (emulateStorage) {
  connectStorageEmulator(storage, "localhost", 9199);
}

// Ensure persistence after any emulator configuration to avoid emulator-config errors
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Ignore persistence errors (e.g., when running in certain emulator configurations)
});

export { app, auth, db, functions, storage };
