export const PRODUCTION_FIREBASE_PROJECT_ID = "custom-portfolio-2026";
export const STAGING_FIREBASE_PROJECT_ID = "custom-by-broadbrand";
export const SANDBOX_EMULATOR_PROJECT_ID = "demo-custom-portfolio";
export const SANDBOX_FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
export const SANDBOX_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

export type FirebaseRuntime = "local" | "preview" | "production";

export class FirebaseProjectIsolationError extends Error {
  readonly name = "FirebaseProjectIsolationError";

  constructor(message: string) {
    super(message);
  }
}

/**
 * Vercel sets VERCEL_ENV to production, preview, or development.
 * Only the production value may use the committed production project.
 * A missing or unknown value is local, including `vite` on a developer machine.
 */
export function firebaseRuntime(env: { VERCEL_ENV?: string }): FirebaseRuntime {
  const vercel = env.VERCEL_ENV?.trim().toLowerCase() ?? "";
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  return "local";
}

export function expectedFirebaseProjectId(runtime: FirebaseRuntime): string {
  return runtime === "production" ? PRODUCTION_FIREBASE_PROJECT_ID : STAGING_FIREBASE_PROJECT_ID;
}

/** Local sandbox only. Production and preview never qualify. */
export function isLocalSandboxEmulator(env: {
  VERCEL_ENV?: string;
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}): boolean {
  if (firebaseRuntime(env) !== "local") return false;
  if ((env.FIRESTORE_EMULATOR_HOST ?? "").trim() !== SANDBOX_FIRESTORE_EMULATOR_HOST) return false;
  const server = (env.FIREBASE_PROJECT_ID ?? "").trim();
  const client = (env.VITE_FIREBASE_PROJECT_ID ?? "").trim();
  if (server && client && server !== client) return false;
  return (server || client) === SANDBOX_EMULATOR_PROJECT_ID;
}

export function firebaseRuntimeLabel(runtime: FirebaseRuntime): string {
  if (runtime === "production") return "Vercel Production";
  if (runtime === "preview") return "Vercel Preview";
  return "Local development";
}
