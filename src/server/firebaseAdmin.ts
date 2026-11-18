import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  expectedFirebaseProjectId,
  FirebaseProjectIsolationError,
  firebaseRuntime,
} from "../lib/firebaseEnvironment";

export const FIREBASE_ADMIN_ENV_KEYS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
] as const;

export type FirebaseAdminCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export function readFirebaseAdminCredentials(env: NodeJS.ProcessEnv = process.env): FirebaseAdminCredentials | null {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID?.trim() ?? "";
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
  if (!projectId || !clientEmail || !privateKey) return null;
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return null;
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) return null;
  if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----") || !privateKey.endsWith("-----END PRIVATE KEY-----")) {
    return null;
  }
  return { projectId, clientEmail, privateKey };
}

export function assertFirebaseAdminForRuntime(env: NodeJS.ProcessEnv = process.env): void {
  const present = FIREBASE_ADMIN_ENV_KEYS.filter((key) => (env[key]?.trim() ?? "") !== "");
  if (present.length === 0) return;
  if (present.length !== FIREBASE_ADMIN_ENV_KEYS.length) {
    throw new FirebaseProjectIsolationError(
      "Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY together.",
    );
  }
  const credentials = readFirebaseAdminCredentials(env);
  if (!credentials) {
    throw new FirebaseProjectIsolationError("Firebase Admin credentials are not valid for this environment.");
  }
  const expected = expectedFirebaseProjectId(firebaseRuntime(env));
  const selected = env.FIREBASE_PROJECT_ID?.trim() || env.VITE_FIREBASE_PROJECT_ID?.trim() || "";
  if (credentials.projectId !== expected || (selected && selected !== credentials.projectId)) {
    throw new FirebaseProjectIsolationError(`Firebase Admin credentials do not belong to ${expected}.`);
  }
  if (!credentials.clientEmail.endsWith(`@${credentials.projectId}.iam.gserviceaccount.com`)) {
    throw new FirebaseProjectIsolationError(`Firebase Admin credentials do not belong to ${expected}.`);
  }
}

export function firebaseAdminApp(env: NodeJS.ProcessEnv = process.env): App | null {
  assertFirebaseAdminForRuntime(env);
  const credentials = readFirebaseAdminCredentials(env);
  if (!credentials) return null;
  const appName = `custom-portfolio-admin-${credentials.projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;
  try {
    return initializeApp(
      {
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
        projectId: credentials.projectId,
      },
      appName,
    );
  } catch {
    try {
      return getApp(appName);
    } catch {
      return null;
    }
  }
}

export function firebaseAdminFirestore(env: NodeJS.ProcessEnv = process.env): Firestore | null {
  const app = firebaseAdminApp(env);
  return app ? getFirestore(app) : null;
}
