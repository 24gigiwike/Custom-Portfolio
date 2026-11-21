import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { resolveFirebaseWebConfig, type FirebaseWebConfig } from "./firebaseConfig";
import {
  FirebaseProjectIsolationError,
  firebaseRuntime,
  SANDBOX_AUTH_EMULATOR_HOST,
  SANDBOX_EMULATOR_PROJECT_ID,
  SANDBOX_FIRESTORE_EMULATOR_HOST,
} from "./firebaseEnvironment";

/**
 * Browser Firebase client.
 * Local sandbox uses the demo project and the emulators on 127.0.0.1.
 * Vercel Preview keeps the staging web config.
 * The committed production config is inlined only for a Vercel Production build.
 */

declare const __VERCEL_ENV__: string;
declare const __FIREBASE_COMMITTED_CONFIG__: FirebaseWebConfig | null;

const committed = __FIREBASE_COMMITTED_CONFIG__;
const fallback: FirebaseWebConfig = committed ?? {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const authEmulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST?.trim() ?? "";
const firebaseConfig = resolveFirebaseWebConfig(
  {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  fallback,
  { runtime: firebaseRuntime({ VERCEL_ENV: __VERCEL_ENV__ }), emulatorHost: firestoreEmulatorHost },
);

if (firebaseConfig.projectId === SANDBOX_EMULATOR_PROJECT_ID && (__VERCEL_ENV__ === "production" || firestoreEmulatorHost !== SANDBOX_FIRESTORE_EMULATOR_HOST || authEmulatorHost !== SANDBOX_AUTH_EMULATOR_HOST)) {
  throw new FirebaseProjectIsolationError("Local sandbox Firebase must use the Firestore and Auth emulators on 127.0.0.1.");
}

let app: FirebaseApp;

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.warn("Firebase initialization notice:", error);
    app = getApps()[0] || initializeApp(firebaseConfig, "custom-portfolio-app");
  }
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

const emulatorState = globalThis as { __customPortfolioEmulators?: boolean };
if (firebaseConfig.projectId === SANDBOX_EMULATOR_PROJECT_ID && !emulatorState.__customPortfolioEmulators) {
  const [firestoreHost, firestorePort] = SANDBOX_FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  connectAuthEmulator(auth, `http://${SANDBOX_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  emulatorState.__customPortfolioEmulators = true;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
