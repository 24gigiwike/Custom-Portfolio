import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { resolveFirebaseWebConfig, type FirebaseWebConfig } from "./firebaseConfig";
import { firebaseRuntime } from "./firebaseEnvironment";

/**
 * Browser Firebase client.
 * Local development and Vercel Preview require the staging web config.
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
  { runtime: firebaseRuntime({ VERCEL_ENV: __VERCEL_ENV__ }) },
);

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

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
