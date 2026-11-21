import assert from "node:assert/strict";
import { resolveFirebaseWebConfig, type FirebaseWebConfig } from "./firebaseConfig";
import { SANDBOX_EMULATOR_PROJECT_ID, SANDBOX_FIRESTORE_EMULATOR_HOST } from "./firebaseEnvironment";
import { firebaseProjectId } from "../server/firebaseIdToken";

const production: FirebaseWebConfig = {
  apiKey: "production-web-key",
  authDomain: "custom-portfolio-2026.firebaseapp.com",
  projectId: "custom-portfolio-2026",
  storageBucket: "custom-portfolio-2026.firebasestorage.app",
  messagingSenderId: "111111111111",
  appId: "1:111111111111:web:production",
};

const sandbox: FirebaseWebConfig = {
  apiKey: "demo-custom-portfolio-web-key",
  authDomain: "demo-custom-portfolio.firebaseapp.com",
  projectId: SANDBOX_EMULATOR_PROJECT_ID,
  storageBucket: "demo-custom-portfolio.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:democustomportfolio",
};

function envFrom(config: FirebaseWebConfig): Record<string, string> {
  return {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    VITE_FIREBASE_APP_ID: config.appId,
  };
}

const selected = resolveFirebaseWebConfig(envFrom(sandbox), production, {
  runtime: "local",
  emulatorHost: SANDBOX_FIRESTORE_EMULATOR_HOST,
});
assert.equal(selected.projectId, SANDBOX_EMULATOR_PROJECT_ID);
assert.notEqual(selected.apiKey, production.apiKey);

assert.throws(() => resolveFirebaseWebConfig(envFrom(sandbox), production, { runtime: "local" }), /custom-by-broadbrand/);
assert.throws(() => resolveFirebaseWebConfig(envFrom(sandbox), production, { runtime: "production", emulatorHost: SANDBOX_FIRESTORE_EMULATOR_HOST }), /custom-portfolio-2026/);
assert.throws(() => resolveFirebaseWebConfig({ VITE_FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID }, production, {
  runtime: "local",
  emulatorHost: SANDBOX_FIRESTORE_EMULATOR_HOST,
}), /Missing/);
assert.equal(resolveFirebaseWebConfig({}, production, { runtime: "production" }).projectId, "custom-portfolio-2026");

assert.equal(firebaseProjectId({
  FIRESTORE_EMULATOR_HOST: SANDBOX_FIRESTORE_EMULATOR_HOST,
  FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID,
  VITE_FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID,
}), SANDBOX_EMULATOR_PROJECT_ID);
assert.throws(() => firebaseProjectId({
  FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID,
  VITE_FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID,
}), /custom-by-broadbrand/);
assert.throws(() => firebaseProjectId({
  VERCEL_ENV: "production",
  FIRESTORE_EMULATOR_HOST: SANDBOX_FIRESTORE_EMULATOR_HOST,
  FIREBASE_PROJECT_ID: SANDBOX_EMULATOR_PROJECT_ID,
}), /custom-portfolio-2026/);

console.log("firebase sandbox config checks passed");
