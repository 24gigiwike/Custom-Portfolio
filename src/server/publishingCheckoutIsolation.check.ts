import assert from "node:assert/strict";
import { memoryPublishingCheckoutStore } from "./publishingCheckout";
import { handlePublishingCheckout, type PublishingCheckoutHandlerOptions } from "./publishingCheckoutHandler";

const STAGING = "custom-by-broadbrand";
const PRODUCTION = "custom-portfolio-2026";
const adminKey = "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----";
const attemptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function post(
  env: NodeJS.ProcessEnv,
  options: PublishingCheckoutHandlerOptions = {},
  body: unknown = { portfolioId: "portfolio01", attemptId },
) {
  let verified = false;
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  const suppliedVerify = options.verify;
  await handlePublishingCheckout(
    { method: "POST", headers: { authorization: "Bearer local-token" }, body },
    {
      status(code: number) { sent.status = code; return this; },
      setHeader() {},
      end(value: string) { sent.body = JSON.parse(value) as Record<string, unknown>; },
    },
    {
      ...options,
      env,
      verify: async (token, projectId) => {
        verified = true;
        assert.equal(token, "local-token");
        return suppliedVerify ? suppliedVerify(token, projectId) : { uid: "owner-1" };
      },
    },
  );
  return { status: sent.status ?? 0, body: sent.body ?? {}, verified };
}

function refused(result: { status: number; body: Record<string, unknown>; verified: boolean }, verified: boolean) {
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "unavailable");
  assert.equal(result.body.error, "Publishing payment is not available right now.");
  assert.equal(result.verified, verified);
  const text = JSON.stringify(result.body);
  assert.equal(text.includes(STAGING), false);
  assert.equal(text.includes(PRODUCTION), false);
  assert.equal(text.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(text.includes(adminKey), false);
}

const missingProject = await post({ VERCEL_ENV: "" });
refused(missingProject, false);

const previewOnProduction = await post({
  VERCEL_ENV: "preview",
  FIREBASE_PROJECT_ID: PRODUCTION,
  VITE_FIREBASE_PROJECT_ID: PRODUCTION,
});
refused(previewOnProduction, false);

const mismatchedProjects = await post({
  VERCEL_ENV: "preview",
  FIREBASE_PROJECT_ID: STAGING,
  VITE_FIREBASE_PROJECT_ID: PRODUCTION,
});
refused(mismatchedProjects, false);

const productionOnStaging = await post({
  VERCEL_ENV: "production",
  FIREBASE_PROJECT_ID: STAGING,
  VITE_FIREBASE_PROJECT_ID: STAGING,
});
refused(productionOnStaging, false);

let productReads = 0;
let checkoutCalls = 0;
const wrongAdmin = await post({
  VERCEL_ENV: "preview",
  FIREBASE_PROJECT_ID: STAGING,
  VITE_FIREBASE_PROJECT_ID: STAGING,
  FIREBASE_ADMIN_PROJECT_ID: PRODUCTION,
  FIREBASE_ADMIN_CLIENT_EMAIL: `firebase-adminsdk-test@${PRODUCTION}.iam.gserviceaccount.com`,
  FIREBASE_ADMIN_PRIVATE_KEY: adminKey,
}, {
  getProduct: async () => {
    productReads += 1;
    return { id: "prod_test", price: { currency: "NGN", amount: "10000.00" } };
  },
  createCheckout: async () => {
    checkoutCalls += 1;
    return { checkout_id: "chk_unused", checkout_url: "https://sandbox-checkout.example/unused" };
  },
});
refused(wrongAdmin, true);
assert.equal(productReads, 0);
assert.equal(checkoutCalls, 0);

const partialAdmin = await post({
  VERCEL_ENV: "preview",
  FIREBASE_PROJECT_ID: STAGING,
  VITE_FIREBASE_PROJECT_ID: STAGING,
  FIREBASE_ADMIN_PROJECT_ID: STAGING,
});
refused(partialAdmin, true);

let seenProject = "";
const matchingPreview = await post({
  VERCEL_ENV: "preview",
  FIREBASE_PROJECT_ID: STAGING,
  VITE_FIREBASE_PROJECT_ID: STAGING,
}, {
  store: memoryPublishingCheckoutStore(),
  loadPortfolio: async () => ({ ownerId: "owner-1", selectedTemplate: "wdk" }),
  loadEntitlement: async () => ({ uid: "owner-1", portfolioId: "portfolio01", status: "active" }),
  getProduct: async () => {
    throw new Error("An entitled portfolio must not read the Bachs product.");
  },
  createCheckout: async () => {
    throw new Error("An entitled portfolio must not open Bachs checkout.");
  },
  verify: async (_token, projectId) => {
    seenProject = projectId;
    return { uid: "owner-1" };
  },
});
assert.equal(matchingPreview.status, 200);
assert.equal(matchingPreview.body.outcome, "entitled");
assert.equal(matchingPreview.verified, true);
assert.equal(seenProject, STAGING);

console.log("publishing checkout isolation checks passed");
