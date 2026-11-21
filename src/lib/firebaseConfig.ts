import {
  expectedFirebaseProjectId,
  FirebaseProjectIsolationError,
  firebaseRuntimeLabel,
  SANDBOX_EMULATOR_PROJECT_ID,
  SANDBOX_FIRESTORE_EMULATOR_HOST,
  type FirebaseRuntime,
} from "./firebaseEnvironment";

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

function bucketMatchesProject(bucket: string, projectId: string): boolean {
  if (bucket.endsWith(".firebasestorage.app") || bucket.endsWith(".appspot.com")) {
    return bucket === `${projectId}.firebasestorage.app` || bucket === `${projectId}.appspot.com`;
  }
  return true;
}

function assertSelectedProject(config: FirebaseWebConfig, runtime: FirebaseRuntime, emulatorHost?: string): void {
  const sandbox = runtime === "local"
    && (emulatorHost ?? "").trim() === SANDBOX_FIRESTORE_EMULATOR_HOST
    && config.projectId === SANDBOX_EMULATOR_PROJECT_ID;
  const expected = sandbox ? SANDBOX_EMULATOR_PROJECT_ID : expectedFirebaseProjectId(runtime);
  const label = firebaseRuntimeLabel(runtime);
  if (config.projectId !== expected) {
    throw new FirebaseProjectIsolationError(`${label} must use Firebase project ${expected}.`);
  }
  if (config.authDomain.endsWith(".firebaseapp.com") && config.authDomain !== `${expected}.firebaseapp.com`) {
    throw new FirebaseProjectIsolationError("Firebase auth domain does not match the selected project.");
  }
  if (!bucketMatchesProject(config.storageBucket, expected)) {
    throw new FirebaseProjectIsolationError("Firebase storage bucket does not match the selected project.");
  }
}

/**
 * Local development and Vercel Preview require the complete staging web config.
 * Vercel Production may use that same complete set for custom-portfolio-2026,
 * or the committed production config when every VITE_FIREBASE_* value is empty.
 * A partial set is never mixed with the other project.
 */
export function resolveFirebaseWebConfig(
  env: Partial<Record<(typeof FIREBASE_ENV_KEYS)[number], string | undefined>>,
  fallback: FirebaseWebConfig,
  options: { runtime: FirebaseRuntime; emulatorHost?: string },
): FirebaseWebConfig {
  const runtime = options.runtime;
  const expected = expectedFirebaseProjectId(runtime);
  const provided = ENV_TO_FIELD.filter(([key]) => isProvided(env[key]));
  const missing = ENV_TO_FIELD.filter(([key]) => !isProvided(env[key])).map(([key]) => key);

  if (runtime !== "production") {
    if (provided.length !== ENV_TO_FIELD.length) {
      throw new FirebaseProjectIsolationError(
        `${firebaseRuntimeLabel(runtime)} requires a complete Firebase web configuration for ${expected}. Missing: ${missing.join(", ")}.`,
      );
    }
    const selected = webConfigFromEnv(env);
    assertSelectedProject(selected, runtime, options.emulatorHost);
    return selected;
  }

  if (provided.length === 0) {
    assertSelectedProject(fallback, runtime);
    return fallback;
  }

  if (provided.length !== ENV_TO_FIELD.length) {
    throw new FirebaseProjectIsolationError(
      `Incomplete Firebase configuration. Set all of ${FIREBASE_ENV_KEYS.join(", ")} together. Missing: ${missing.join(", ")}.`,
    );
  }

  const selected = webConfigFromEnv(env);
  assertSelectedProject(selected, runtime, options.emulatorHost);
  return selected;
}

function webConfigFromEnv(
  env: Partial<Record<(typeof FIREBASE_ENV_KEYS)[number], string | undefined>>,
): FirebaseWebConfig {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY!.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID!.trim(),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET!.trim(),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID!.trim(),
    appId: env.VITE_FIREBASE_APP_ID!.trim(),
  };
}
