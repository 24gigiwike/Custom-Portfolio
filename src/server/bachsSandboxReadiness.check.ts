import assert from "node:assert/strict";
import { FIREBASE_ENV_KEYS } from "../lib/firebaseConfig";
import { BACHS_SANDBOX_PRODUCT_ID } from "./bachsRuntime";
import { assessBachsSandboxReadiness, assessDomainSandboxReadiness, formatSandboxReadiness, sandboxWebhookUrl, SANDBOX_WEBHOOK_LOCAL_TARGET } from "./bachsSandboxReadiness";

const secret = "sk_sandbox_testsecret";
const webhookSecret = "whsec_test_value";

function stagingEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    VERCEL_ENV: "",
    BACHS_API_KEY: secret,
    BACHS_WEBHOOK_SECRET: webhookSecret,
    BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID,
    BACHS_PUBLISHING_SUCCESS_URL: "https://tunnel.example.com/portfolio/publish/return",
    BACHS_PUBLISHING_CANCEL_URL: "https://tunnel.example.com/portfolio/publish/cancelled",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_PROJECT_ID: "demo-custom-portfolio",
    VITE_FIREBASE_API_KEY: "emulator-web-key",
    VITE_FIREBASE_AUTH_DOMAIN: "demo-custom-portfolio.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "demo-custom-portfolio",
    VITE_FIREBASE_STORAGE_BUCKET: "demo-custom-portfolio.firebasestorage.app",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
    VITE_FIREBASE_APP_ID: "1:1234567890:web:emulator",
    ...overrides,
  };
}

const ready = assessBachsSandboxReadiness(stagingEnv());
assert.equal(ready.ready, true);
assert.deepEqual(ready.missing, []);
assert.deepEqual(ready.invalid, []);
assert.equal(ready.notes.some((note) => note.includes("does not create or extend")), true);

const printed = formatSandboxReadiness(ready);
assert.equal(printed.includes(secret), false);
assert.equal(printed.includes(webhookSecret), false);
assert.equal(printed.includes("emulator-web-key"), false);
assert.equal(printed.includes("custom-by-broadbrand"), false);

const empty = assessBachsSandboxReadiness({});
assert.equal(empty.ready, false);
for (const name of ["BACHS_API_KEY", "BACHS_WEBHOOK_SECRET", "FIRESTORE_EMULATOR_HOST", "FIREBASE_PROJECT_ID", ...FIREBASE_ENV_KEYS]) {
  assert.equal(empty.missing.includes(name), true);
}

const live = assessBachsSandboxReadiness(stagingEnv({ BACHS_API_KEY: "sk_live_testsecret" }));
assert.equal(live.ready, false);
assert.equal(live.invalid.includes("BACHS_API_KEY"), true);

const production = assessBachsSandboxReadiness(stagingEnv({ VERCEL_ENV: "production" }));
assert.equal(production.invalid.includes("VERCEL_ENV"), true);

const localhost = assessBachsSandboxReadiness(stagingEnv({
  BACHS_PUBLISHING_SUCCESS_URL: "https://localhost/portfolio/publish/return",
}));
assert.equal(localhost.invalid.includes("BACHS_PUBLISHING_SUCCESS_URL"), true);

const productionHost = assessBachsSandboxReadiness(stagingEnv({
  BACHS_PUBLISHING_SUCCESS_URL: "https://customportfolio.broadbrand.com.ng/portfolio/publish/return",
  BACHS_PUBLISHING_CANCEL_URL: "https://customportfolio.broadbrand.com.ng/portfolio/publish/cancelled",
}));
assert.equal(productionHost.invalid.includes("BACHS_PUBLISHING_SUCCESS_URL"), true);
assert.equal(productionHost.invalid.includes("BACHS_PUBLISHING_CANCEL_URL"), true);

const wrongProject = assessBachsSandboxReadiness(stagingEnv({
  FIREBASE_PROJECT_ID: "custom-portfolio-2026",
  VITE_FIREBASE_PROJECT_ID: "custom-portfolio-2026",
  FIREBASE_ADMIN_PROJECT_ID: "custom-portfolio-2026",
  FIREBASE_ADMIN_CLIENT_EMAIL: "local-test@custom-portfolio-2026.iam.gserviceaccount.com",
}));
assert.equal(wrongProject.invalid.includes("FIREBASE_PROJECT_ID"), true);
assert.equal(wrongProject.invalid.includes("FIREBASE_ADMIN_PROJECT_ID"), true);

const retired = assessBachsSandboxReadiness(stagingEnv({
  FIREBASE_PROJECT_ID: "custom-by-broadbrand",
  VITE_FIREBASE_PROJECT_ID: "custom-by-broadbrand",
}));
assert.equal(retired.invalid.includes("FIREBASE_PROJECT_ID"), true);
assert.equal(retired.invalid.includes("VITE_FIREBASE_PROJECT_ID"), true);

const domainReady = assessDomainSandboxReadiness({
  ...stagingEnv(),
  BACHS_DOMAIN_PRODUCT_ID: "prod_domainsandbox1",
  BACHS_DOMAIN_SUCCESS_URL: "https://tunnel.example.com/portfolio/publish/return",
  BACHS_DOMAIN_CANCEL_URL: "https://tunnel.example.com/portfolio/publish/cancelled",
});
assert.equal(domainReady.ready, true);
assert.equal(sandboxWebhookUrl("https://tunnel.example.com"), "https://tunnel.example.com/api/bachs-webhook");
assert.equal(SANDBOX_WEBHOOK_LOCAL_TARGET, "http://127.0.0.1:3000/api/bachs-webhook");
assert.equal(sandboxWebhookUrl("http://127.0.0.1:3000"), null);
const domainProductionUrls = assessDomainSandboxReadiness({
  ...stagingEnv(),
  BACHS_DOMAIN_PRODUCT_ID: "prod_domainsandbox1",
  BACHS_DOMAIN_SUCCESS_URL: "https://customportfolio.broadbrand.com.ng/portfolio/publish/return",
  BACHS_DOMAIN_CANCEL_URL: "https://customportfolio.broadbrand.com.ng/portfolio/publish/cancelled",
});
assert.equal(domainProductionUrls.ready, false);
assert.equal(domainProductionUrls.invalid.includes("BACHS_DOMAIN_SUCCESS_URL"), true);
