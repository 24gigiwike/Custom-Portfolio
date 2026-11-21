/**
 * Checks whether this process can start a local Bachs sandbox test.
 * It names missing settings and never prints secret values.
 * It does not call Bachs, register a webhook, or write Firebase data.
 */
import { loadEnv } from "vite";
import { FIREBASE_ENV_KEYS } from "../lib/firebaseConfig";
import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID, firebaseRuntime } from "../lib/firebaseEnvironment";
import { PUBLISHING_PAYMENT_CANCELLED_PATH, PUBLISHING_PAYMENT_SUCCESS_PATH } from "../components/portfolio-publish/publishingReturnPath";
import { PRODUCTION_ORIGIN } from "../lib/portfolioSeo";
import { FIREBASE_ADMIN_ENV_KEYS, readFirebaseAdminCredentials } from "./firebaseAdmin";
import { BACHS_SANDBOX_PRODUCT_ID, assertBachsApiKeyForRuntime, assertBachsProductForRuntime, BachsRuntimeError } from "./bachsRuntime";
import { PUBLISHING_CANCEL_URL_ENV, PUBLISHING_SUCCESS_URL_ENV, publishingReturnUrlProblem } from "./publishingCheckout";
import { readDomainProductId, sandboxFirestoreBlocked } from "./domainPayment";
import { readDomainNameApiConfig } from "./domainNameApi";

export const LOCAL_APPLICATION_PORT = 3000;
export const SANDBOX_TUNNEL_LOCAL_ORIGIN = "http://127.0.0.1:3000";
export const SANDBOX_WEBHOOK_LOCAL_TARGET = "http://127.0.0.1:3000/api/bachs-webhook";

/** The tunnel command is prepared here. This module does not start a tunnel or register a webhook. */
export function sandboxWebhookUrl(tunnelOrigin: string): string | null {
  try {
    const url = new URL(tunnelOrigin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return `${url.origin}/api/bachs-webhook`;
  } catch {
    return null;
  }
}

const PRODUCTION_HOST = new URL(PRODUCTION_ORIGIN).host;
export const SANDBOX_EMULATOR_PROJECT_ID = "demo-custom-portfolio";

export type SandboxReadiness = {
  ready: boolean;
  missing: string[];
  invalid: string[];
  notes: string[];
};

function present(env: NodeJS.ProcessEnv, name: string): boolean {
  return (env[name]?.trim() ?? "") !== "";
}

function publicPath(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    if (url.search || url.hash) return null;
    return path;
  } catch {
    return null;
  }
}

/** Reports sandbox setup by variable name. Secret values stay in the supplied environment. */
export function assessBachsSandboxReadiness(env: NodeJS.ProcessEnv): SandboxReadiness {
  const missing: string[] = [];
  const invalid: string[] = [];
  const required = [
    "BACHS_API_KEY",
    "BACHS_WEBHOOK_SECRET",
    "BACHS_PUBLISHING_PRODUCT_ID",
    PUBLISHING_SUCCESS_URL_ENV,
    PUBLISHING_CANCEL_URL_ENV,
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_PROJECT_ID",
    ...FIREBASE_ENV_KEYS,
  ];
  for (const name of required) {
    if (!present(env, name)) missing.push(name);
  }

  if (firebaseRuntime(env) === "production") {
    invalid.push("VERCEL_ENV");
  }

  if (present(env, "BACHS_API_KEY")) {
    try {
      assertBachsApiKeyForRuntime(env);
    } catch (error) {
      if (error instanceof BachsRuntimeError) invalid.push("BACHS_API_KEY");
      else throw error;
    }
  }

  if (present(env, "BACHS_PUBLISHING_PRODUCT_ID")) {
    try {
      const productId = assertBachsProductForRuntime(env);
      if (productId !== BACHS_SANDBOX_PRODUCT_ID) invalid.push("BACHS_PUBLISHING_PRODUCT_ID");
    } catch (error) {
      if (error instanceof BachsRuntimeError) invalid.push("BACHS_PUBLISHING_PRODUCT_ID");
      else throw error;
    }
  }

  const success = env[PUBLISHING_SUCCESS_URL_ENV]?.trim() ?? "";
  const cancel = env[PUBLISHING_CANCEL_URL_ENV]?.trim() ?? "";
  if (success && (publishingReturnUrlProblem(success) || publicPath(success) !== PUBLISHING_PAYMENT_SUCCESS_PATH || new URL(success).host === PRODUCTION_HOST)) {
    invalid.push(PUBLISHING_SUCCESS_URL_ENV);
  }
  if (cancel && (publishingReturnUrlProblem(cancel) || publicPath(cancel) !== PUBLISHING_PAYMENT_CANCELLED_PATH || new URL(cancel).host === PRODUCTION_HOST)) {
    invalid.push(PUBLISHING_CANCEL_URL_ENV);
  }
  if (success && cancel && publishingReturnUrlProblem(success) === null && publishingReturnUrlProblem(cancel) === null) {
    if (new URL(success).host !== new URL(cancel).host) invalid.push(PUBLISHING_CANCEL_URL_ENV);
  }

  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const webProjectId = env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "";
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
  if (projectId && projectId !== SANDBOX_EMULATOR_PROJECT_ID) invalid.push("FIREBASE_PROJECT_ID");
  if (webProjectId && webProjectId !== SANDBOX_EMULATOR_PROJECT_ID) invalid.push("VITE_FIREBASE_PROJECT_ID");
  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID || projectId === STAGING_FIREBASE_PROJECT_ID) invalid.push("FIREBASE_PROJECT_ID");
  if (emulatorHost && !emulatorHost.startsWith("127.0.0.1:")) invalid.push("FIRESTORE_EMULATOR_HOST");
  if (present(env, "FIREBASE_ADMIN_PROJECT_ID") && env.FIREBASE_ADMIN_PROJECT_ID?.trim() !== SANDBOX_EMULATOR_PROJECT_ID) {
    invalid.push("FIREBASE_ADMIN_PROJECT_ID");
  }
  if (FIREBASE_ADMIN_ENV_KEYS.every((name) => present(env, name))) {
    const credentials = readFirebaseAdminCredentials(env);
    if (!credentials || credentials.projectId !== SANDBOX_EMULATOR_PROJECT_ID) invalid.push("FIREBASE_ADMIN_PROJECT_ID");
  }

  const notes = [
    "Sandbox ledger rows are written only to the local Firestore emulator project demo-custom-portfolio.",
    "A sandbox collection does not create or extend a publishing entitlement.",
    "Production Firebase custom-portfolio-2026 is not a sandbox payment store.",
    "The return pages do not grant publishing.",
    "The live success, cancellation, and webhook URLs on customportfolio.broadbrand.com.ng stay unchanged.",
    "Hosted sandbox events use https://customportfolio.broadbrand.com.ng/api/bachs-webhook and BACHS_SANDBOX_WEBHOOK_SECRET.",
    "A sandbox-signed event is stored as a receipt. It does not grant publishing, revoke an entitlement, or register a domain.",
  ];

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    notes,
  };
}

export function assessDomainSandboxReadiness(env: NodeJS.ProcessEnv): SandboxReadiness {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const name of ["BACHS_API_KEY", "BACHS_WEBHOOK_SECRET", "BACHS_DOMAIN_PRODUCT_ID", "BACHS_DOMAIN_SUCCESS_URL", "BACHS_DOMAIN_CANCEL_URL", "FIRESTORE_EMULATOR_HOST", "FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"]) {
    if (!present(env, name)) missing.push(name);
  }
  if (firebaseRuntime(env) === "production") invalid.push("VERCEL_ENV");
  if (present(env, "BACHS_API_KEY")) {
    try {
      assertBachsApiKeyForRuntime(env);
    } catch (error) {
      if (error instanceof BachsRuntimeError) invalid.push("BACHS_API_KEY");
      else throw error;
    }
  }
  if (present(env, "BACHS_DOMAIN_PRODUCT_ID") && !readDomainProductId(env)) invalid.push("BACHS_DOMAIN_PRODUCT_ID");
  const success = env.BACHS_DOMAIN_SUCCESS_URL?.trim() ?? "";
  const cancel = env.BACHS_DOMAIN_CANCEL_URL?.trim() ?? "";
  if (success && (publishingReturnUrlProblem(success) || publicPath(success) !== PUBLISHING_PAYMENT_SUCCESS_PATH || new URL(success).host === PRODUCTION_HOST)) {
    invalid.push("BACHS_DOMAIN_SUCCESS_URL");
  }
  if (cancel && (publishingReturnUrlProblem(cancel) || publicPath(cancel) !== PUBLISHING_PAYMENT_CANCELLED_PATH || new URL(cancel).host === PRODUCTION_HOST)) {
    invalid.push("BACHS_DOMAIN_CANCEL_URL");
  }
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
  if (emulatorHost && emulatorHost !== "127.0.0.1:8080") invalid.push("FIRESTORE_EMULATOR_HOST");
  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const webProjectId = env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "";
  if (projectId && projectId !== SANDBOX_EMULATOR_PROJECT_ID) invalid.push("FIREBASE_PROJECT_ID");
  if (webProjectId && webProjectId !== SANDBOX_EMULATOR_PROJECT_ID) invalid.push("VITE_FIREBASE_PROJECT_ID");
  if (present(env, "BACHS_API_KEY") && present(env, "FIREBASE_PROJECT_ID") && !sandboxFirestoreBlocked({ ...env, FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID })) {
    invalid.push("BACHS_API_KEY");
  }
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    notes: [
      `The local application port is ${LOCAL_APPLICATION_PORT}.`,
      "Hosted domain sandbox events use https://customportfolio.broadbrand.com.ng/api/bachs-webhook.",
      "Do not register that webhook or send a sandbox payment until both actions are explicitly authorized.",
      "Sandbox domain rows stay on the Firestore emulator. They cannot use custom-portfolio-2026.",
      "A domain webhook reference cannot grant a publishing entitlement.",
    ],
  };
}

export function formatSandboxReadiness(report: SandboxReadiness): string {
  const lines = [
    `ready: ${report.ready}`,
    `missing: ${report.missing.join(", ") || "none"}`,
    `invalid: ${report.invalid.join(", ") || "none"}`,
    ...report.notes,
  ];
  return lines.join("\n");
}

if (process.argv.includes("--report") || process.argv.includes("--domain-report")) {
  const loaded = loadEnv("development", process.cwd(), "");
  const env: NodeJS.ProcessEnv = { ...loaded, VERCEL_ENV: process.env.VERCEL_ENV ?? "" };
  const report = process.argv.includes("--domain-report") ? assessDomainSandboxReadiness(env) : assessBachsSandboxReadiness(env);
  const domainProduct = readDomainProductId(env);
  const publishingProduct = env.BACHS_PUBLISHING_PRODUCT_ID?.trim() ?? "";
  process.stdout.write(`${formatSandboxReadiness(report)}\n`);
  process.stdout.write(`sandboxKeyLoaded: ${(env.BACHS_API_KEY ?? "").startsWith("sk_sandbox_")}\n`);
  process.stdout.write(`domainProductRecognized: ${Boolean(domainProduct)}\n`);
  process.stdout.write(`publishingProductLoaded: ${publishingProduct !== ""}\n`);
  process.stdout.write(`productsDistinct: ${Boolean(domainProduct) && publishingProduct !== "" && domainProduct !== publishingProduct && domainProduct !== BACHS_SANDBOX_PRODUCT_ID}\n`);
  process.stdout.write(`emulatorHost: ${env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080"}\n`);
  process.stdout.write(`emulatorProject: ${env.FIREBASE_PROJECT_ID === SANDBOX_EMULATOR_PROJECT_ID}\n`);
  process.stdout.write(`productionWriteBlocked: ${sandboxFirestoreBlocked({ BACHS_API_KEY: "sk_sandbox_probe", FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT_ID, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })}\n`);
  process.stdout.write(`registrarConfigured: ${readDomainNameApiConfig(env) !== null}\n`);
  process.exit(report.ready ? 0 : 1);
}
