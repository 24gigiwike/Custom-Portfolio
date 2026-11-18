export const PRODUCTION_FIREBASE_PROJECT_ID = "custom-portfolio-2026";
export const STAGING_FIREBASE_PROJECT_ID = "custom-by-broadbrand";

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

export function firebaseRuntimeLabel(runtime: FirebaseRuntime): string {
  if (runtime === "production") return "Vercel Production";
  if (runtime === "preview") return "Vercel Preview";
  return "Local development";
}
