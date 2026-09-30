export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const ENV_TO_FIELD = [
  ["VITE_FIREBASE_API_KEY", "apiKey"],
  ["VITE_FIREBASE_AUTH_DOMAIN", "authDomain"],
  ["VITE_FIREBASE_PROJECT_ID", "projectId"],
  ["VITE_FIREBASE_STORAGE_BUCKET", "storageBucket"],
  ["VITE_FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
  ["VITE_FIREBASE_APP_ID", "appId"],
] as const;

function isProvided(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Use either a complete VITE_FIREBASE_* set or the committed configuration.
 * A partial set must not be mixed with the fallback project.
 */
export function resolveFirebaseWebConfig(
  env: Partial<Record<(typeof FIREBASE_ENV_KEYS)[number], string | undefined>>,
  fallback: FirebaseWebConfig
): FirebaseWebConfig {
  const provided = ENV_TO_FIELD.filter(([key]) => isProvided(env[key]));

  if (provided.length === 0) {
    return fallback;
  }

  if (provided.length !== ENV_TO_FIELD.length) {
    const missing = ENV_TO_FIELD.filter(([key]) => !isProvided(env[key])).map(([key]) => key);
    throw new Error(
      `Incomplete Firebase configuration. Set all of ${FIREBASE_ENV_KEYS.join(", ")} together, or set none of them to use the committed custom-portfolio-2026 configuration. Missing: ${missing.join(", ")}.`
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY!.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID!.trim(),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET!.trim(),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID!.trim(),
    appId: env.VITE_FIREBASE_APP_ID!.trim(),
  };
}
