import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

export function firebaseAdminApp(env: NodeJS.ProcessEnv = process.env): App | null {
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
