import assert from "node:assert/strict";
import {
  assertBachsApiKeyForRuntime,
  assertBachsProductForRuntime,
  BACHS_SANDBOX_PRODUCT_ID,
  BachsRuntimeError,
  publishingBachsClient,
} from "./bachsRuntime";
import { executePublishingCheckout, memoryPublishingCheckoutStore } from "./publishingCheckout";

const sandboxKey = "sk_sandbox_test";
const liveKey = "sk_live_test";
const productionProduct = "prod_productionpublishing1";
const attemptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function rejectsKey(env: NodeJS.ProcessEnv) {
  assert.throws(() => assertBachsApiKeyForRuntime(env), BachsRuntimeError);
  assert.throws(() => publishingBachsClient(env), (error: unknown) => {
    assert.ok(error instanceof BachsRuntimeError);
    assert.equal(error.message.includes("sk_sandbox_"), false);
    assert.equal(error.message.includes("sk_live_"), false);
    assert.equal(error.message.includes(sandboxKey), false);
    assert.equal(error.message.includes(liveKey), false);
    return true;
  });
}

rejectsKey({});
rejectsKey({ VERCEL_ENV: "preview" });
rejectsKey({ VERCEL_ENV: "preview", BACHS_API_KEY: "" });
rejectsKey({ VERCEL_ENV: "preview", BACHS_API_KEY: "sk_sandbox_" });
rejectsKey({ VERCEL_ENV: "preview", BACHS_API_KEY: "sk_test_other" });
rejectsKey({ VERCEL_ENV: "preview", BACHS_API_KEY: liveKey });
rejectsKey({ VERCEL_ENV: "development", BACHS_API_KEY: liveKey });
rejectsKey({ BACHS_API_KEY: liveKey });
rejectsKey({ VERCEL_ENV: "production", BACHS_API_KEY: sandboxKey });
rejectsKey({ VERCEL_ENV: "production" });
rejectsKey({ VERCEL_ENV: "production", BACHS_API_KEY: "sk_live_" });

assertBachsApiKeyForRuntime({ VERCEL_ENV: "preview", BACHS_API_KEY: sandboxKey });
assertBachsApiKeyForRuntime({ BACHS_API_KEY: sandboxKey });
assertBachsApiKeyForRuntime({ VERCEL_ENV: "production", BACHS_API_KEY: liveKey });
assert.equal(publishingBachsClient({ VERCEL_ENV: "preview", BACHS_API_KEY: sandboxKey }).environment, "sandbox");
assert.equal(publishingBachsClient({ VERCEL_ENV: "production", BACHS_API_KEY: liveKey }).environment, "production");

assert.throws(() => assertBachsProductForRuntime({ BACHS_PUBLISHING_PRODUCT_ID: "prod_other" }), BachsRuntimeError);
assert.throws(() => assertBachsProductForRuntime({ VERCEL_ENV: "preview", BACHS_PUBLISHING_PRODUCT_ID: productionProduct }), BachsRuntimeError);
assert.throws(() => assertBachsProductForRuntime({ VERCEL_ENV: "production", BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID }), BachsRuntimeError);
assert.throws(() => assertBachsProductForRuntime({ VERCEL_ENV: "production", BACHS_PUBLISHING_PRODUCT_ID: "not-a-product" }), BachsRuntimeError);
assert.equal(assertBachsProductForRuntime({ BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID }), BACHS_SANDBOX_PRODUCT_ID);
assert.equal(assertBachsProductForRuntime({ VERCEL_ENV: "production", BACHS_PUBLISHING_PRODUCT_ID: productionProduct }), productionProduct);

async function attempt(env: NodeJS.ProcessEnv) {
  const calls: string[] = [];
  const result = await executePublishingCheckout({
    uid: "owner-1",
    body: { portfolioId: "portfolio01", attemptId, productId: "prod_client", amount: "1.00", quantity: 4 },
    env: {
      ...env,
      BACHS_PUBLISHING_SUCCESS_URL: "https://preview.example.com/portfolio/publish/return",
      BACHS_PUBLISHING_CANCEL_URL: "https://preview.example.com/portfolio/publish/cancelled",
    },
    now: new Date("2026-11-17T08:00:00.000Z"),
    loadPortfolio: async () => ({ ownerId: "owner-1", selectedTemplate: "wdk" }),
    loadEntitlement: async () => null,
    store: memoryPublishingCheckoutStore(),
    getProduct: async (productId) => {
      calls.push(`product:${productId}`);
      return {
        id: productId,
        price: { currency: "NGN", amount: "10000.00", price_type: "fixed" as const },
        billing_cycle: null,
        status: "active",
        archived_at: null,
      };
    },
    createCheckout: async (request) => {
      calls.push(`checkout:${request.product_cart?.[0]?.product_id}`);
      return { checkout_id: "chk_runtime", checkout_url: "https://sandbox-checkout.example/runtime" };
    },
  });
  return { result, calls };
}

const previewLive = await attempt({ VERCEL_ENV: "preview", BACHS_API_KEY: liveKey, BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID });
assert.equal(previewLive.result.status, 503);
assert.equal(previewLive.result.body.code, "unavailable");
assert.equal(JSON.stringify(previewLive.result.body).includes("sk_live_"), false);
assert.equal(JSON.stringify(previewLive.result.body).includes(liveKey), false);
assert.deepEqual(previewLive.calls, []);

const previewWrongProduct = await attempt({ VERCEL_ENV: "preview", BACHS_API_KEY: sandboxKey, BACHS_PUBLISHING_PRODUCT_ID: productionProduct });
assert.equal(previewWrongProduct.result.status, 503);
assert.equal(JSON.stringify(previewWrongProduct.result.body).includes(productionProduct), false);
assert.deepEqual(previewWrongProduct.calls, []);

const productionSandboxProduct = await attempt({ VERCEL_ENV: "production", BACHS_API_KEY: liveKey, BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID });
assert.equal(productionSandboxProduct.result.status, 503);
assert.deepEqual(productionSandboxProduct.calls, []);

const previewPinned = await attempt({ VERCEL_ENV: "preview", BACHS_API_KEY: sandboxKey, BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID });
assert.equal(previewPinned.result.status, 200);
assert.deepEqual(previewPinned.calls, [`product:${BACHS_SANDBOX_PRODUCT_ID}`, `checkout:${BACHS_SANDBOX_PRODUCT_ID}`]);

const productionSeparate = await attempt({ VERCEL_ENV: "production", BACHS_API_KEY: liveKey, BACHS_PUBLISHING_PRODUCT_ID: productionProduct });
assert.equal(productionSeparate.result.status, 200);
assert.deepEqual(productionSeparate.calls, [`product:${productionProduct}`, `checkout:${productionProduct}`]);

console.log("bachs runtime checks passed");
