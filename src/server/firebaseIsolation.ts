import { readFileSync } from "node:fs";
import { resolveFirebaseWebConfig, type FirebaseWebConfig } from "../lib/firebaseConfig";
import { FirebaseProjectIsolationError, firebaseRuntime, SANDBOX_EMULATOR_PROJECT_ID } from "../lib/firebaseEnvironment";
import { assertFirebaseAdminForRuntime } from "./firebaseAdmin";
import { firebaseProjectId } from "./firebaseIdToken";

export function committedFirebaseWebConfig(root: string): FirebaseWebConfig {
  const raw = JSON.parse(readFileSync(`${root}/firebase-applet-config.json`, "utf8")) as Record<string, unknown>;
  return {
    apiKey: String(raw.apiKey ?? ""),
    authDomain: String(raw.authDomain ?? ""),
    projectId: String(raw.projectId ?? ""),
    storageBucket: String(raw.storageBucket ?? ""),
    messagingSenderId: String(raw.messagingSenderId ?? ""),
    appId: String(raw.appId ?? ""),
  };
}

/**
 * Fail closed before Vite serves or builds.
 * VERCEL_ENV is taken from the real process, not from an env file, so a local
 * file cannot claim to be Vercel Production.
 */
export function validateFirebaseEnvironment(env: NodeJS.ProcessEnv, fallback: FirebaseWebConfig): FirebaseWebConfig {
  const runtime = firebaseRuntime(env);
  const web = resolveFirebaseWebConfig(env, fallback, { runtime, emulatorHost: env.FIRESTORE_EMULATOR_HOST });
  if (runtime === "local" && web.projectId === SANDBOX_EMULATOR_PROJECT_ID) {
    if (web.apiKey === fallback.apiKey || web.appId === fallback.appId || web.projectId === fallback.projectId) {
      throw new FirebaseProjectIsolationError("Local sandbox cannot use the production Firebase web configuration.");
    }
  }
  firebaseProjectId(env);
  assertFirebaseAdminForRuntime(env);
  return web;
}
