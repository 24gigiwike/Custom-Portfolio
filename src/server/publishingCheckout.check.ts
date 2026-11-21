import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CreateCheckoutSessionRequest } from "@bachs/sdk";
import {
  executePublishingCheckout,
  memoryPublishingCheckoutStore,
  PublishingCheckoutGatewayError,
  readPublishingReturnUrls,
} from "./publishingCheckout";
import { handlePublishingCheckout } from "./publishingCheckoutHandler";

const productId = "prod_d8c0e88a960141ac884b";
const now = new Date("2026-11-17T08:00:00.000Z");
const attemptA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attemptB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const urls = {
  BACHS_API_KEY: "sk_sandbox_test",
  BACHS_PUBLISHING_PRODUCT_ID: productId,
  BACHS_PUBLISHING_SUCCESS_URL: "https://preview.example.com/publish/return",
  BACHS_PUBLISHING_CANCEL_URL: "https://preview.example.com/publish/cancel",
};

function product() {
  return {
    id: productId,
    price: { currency: "NGN", amount: "10000.00", price_type: "fixed" as const },
    billing_cycle: null,
    status: "active",
    archived_at: null,
  };
}

function harness(overrides: {
  env?: NodeJS.ProcessEnv;
  portfolio?: { ownerId: string; selectedTemplate: string } | null;
  portfolios?: Record<string, { ownerId: string; selectedTemplate: string }>;
  entitlement?: unknown;
  entitlements?: Record<string, unknown>;
  getProduct?: () => Promise<ReturnType<typeof product>>;
  createCheckout?: (request: CreateCheckoutSessionRequest, key: string) => Promise<{ checkout_id: string; checkout_url: string; expires_at?: string }>;
} = {}) {
  const store = memoryPublishingCheckoutStore();
  const calls: { request: CreateCheckoutSessionRequest; key: string }[] = [];
  const productReads: string[] = [];
  const run = (body: unknown, uid = "owner-1") => executePublishingCheckout({
    uid,
    body,
    env: overrides.env ?? urls,
    now,
    loadPortfolio: async (portfolioId) => {
      if (overrides.portfolios) return overrides.portfolios[portfolioId] ?? null;
      return overrides.portfolio === undefined ? { ownerId: "owner-1", selectedTemplate: "wdk" } : overrides.portfolio;
    },
    loadEntitlement: async (portfolioId) => overrides.entitlements?.[portfolioId] ?? overrides.entitlement ?? null,
    store,
    getProduct: overrides.getProduct ?? (async (id) => {
      productReads.push(id);
      return product();
    }),
    createCheckout: overrides.createCheckout ?? (async (request, key) => {
      calls.push({ request, key });
      return { checkout_id: `chk_${key.slice(-6)}`, checkout_url: `https://sandbox-checkout.example/${key}`, expires_at: "2026-11-17T09:00:00.000Z" };
    }),
  });
  return { run, calls, productReads };
}

const missingAuth = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  void handlePublishingCheckout({ method: "POST", headers: {}, body: {} }, {
    status(code: number) { sent.status = code; return this; },
    setHeader() {},
    end(body: string) { sent.body = JSON.parse(body) as Record<string, unknown>; },
  }).then(() => resolve({ status: sent.status ?? 0, body: sent.body ?? {} }));
});
assert.equal(missingAuth.status, 401);
assert.equal(missingAuth.body.code, "unauthenticated");

const paid = harness({ entitlement: { uid: "owner-1", portfolioId: "portfolio01", status: "active" } });
const entitled = await paid.run({ portfolioId: "portfolio01", attemptId: attemptA, amount: "1.00" });
assert.equal(entitled.status, 200);
assert.equal(entitled.body.outcome, "entitled");
assert.equal(paid.calls.length, 0);
assert.equal(paid.productReads.length, 0);

const tooSoon = harness({
  entitlement: {
    uid: "owner-1",
    portfolioId: "portfolio01",
    status: "active",
    expiresAt: { toMillis: () => Date.parse("2026-11-25T08:00:00.000Z") },
  },
});
const closed = await tooSoon.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(closed.body.outcome, "entitled");
assert.equal(tooSoon.calls.length, 0);

const due = harness({
  entitlement: {
    uid: "owner-1",
    portfolioId: "portfolio01",
    status: "active",
    expiresAt: { toMillis: () => Date.parse("2026-11-24T08:00:00.000Z") },
  },
});
const windowCheckout = await due.run({ portfolioId: "portfolio01", attemptId: attemptB });
assert.equal(windowCheckout.body.outcome, "checkout");
assert.equal(windowCheckout.body.purpose, "renew");

const expired = harness({ entitlement: { uid: "owner-1", portfolioId: "portfolio01", status: "active", expiresAt: "2026-01-01T00:00:00.000Z" } });
const renewal = await expired.run({ portfolioId: "portfolio01", attemptId: attemptA, amount: "1.00", success_url: "http://localhost/stolen" });
assert.equal(renewal.body.outcome, "checkout");
assert.equal(renewal.body.purpose, "renew");
assert.equal(expired.calls.length, 1);
assert.equal(expired.calls[0]?.request.product_cart?.[0]?.product_id, productId);
assert.equal("amount" in (expired.calls[0]?.request.product_cart?.[0] ?? {}), false);
assert.equal(expired.calls[0]?.request.success_url, urls.BACHS_PUBLISHING_SUCCESS_URL);
assert.equal(expired.calls[0]?.key, `publishing-checkout:portfolio01:${attemptA}`);

const first = harness();
const opened = await first.run({ portfolioId: "portfolio01", attemptId: attemptA, amount: "1.00", quantity: 9 });
assert.equal(opened.status, 200);
assert.equal(opened.body.purpose, "publish");
assert.equal(String(opened.body.checkoutUrl).startsWith("https://"), true);
const repeat = await first.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(repeat.body.checkoutId, opened.body.checkoutId);
assert.equal(first.calls.length, 1);

const isolated = harness({
  portfolios: {
    portfolio01: { ownerId: "owner-1", selectedTemplate: "wdk" },
    portfolio02: { ownerId: "owner-1", selectedTemplate: "wdk" },
  },
});
const firstPortfolio = await isolated.run({ portfolioId: "portfolio01", attemptId: attemptA });
const secondPortfolio = await isolated.run({ portfolioId: "portfolio02", attemptId: attemptB });
assert.notEqual(firstPortfolio.body.checkoutId, secondPortfolio.body.checkoutId);
assert.equal(isolated.calls[1]?.request.metadata?.portfolioId, "portfolio02");
assert.equal(isolated.calls[1]?.key.includes("portfolio02"), true);

const pending = harness();
await pending.run({ portfolioId: "portfolio01", attemptId: attemptA });
const otherAttempt = await pending.run({ portfolioId: "portfolio01", attemptId: attemptB });
assert.equal(otherAttempt.status, 200);
assert.equal(otherAttempt.body.checkoutId, pending.calls[0] ? `chk_${pending.calls[0].key.slice(-6)}` : "");
assert.equal(pending.calls.length, 1);

const uncertainKeys: string[] = [];
const uncertain = harness({
  createCheckout: async (_request, key) => {
    uncertainKeys.push(key);
    if (uncertainKeys.length === 1) throw new PublishingCheckoutGatewayError("lost", true, null);
    return { checkout_id: "chk_retry", checkout_url: "https://sandbox-checkout.example/retry", expires_at: "2026-11-17T09:00:00.000Z" };
  },
});
const lost = await uncertain.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(lost.status, 503);
assert.equal(lost.body.code, "checkout-uncertain");
const recovered = await uncertain.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(recovered.status, 200);
assert.equal(recovered.body.checkoutId, "chk_retry");
assert.deepEqual(uncertainKeys, [
  `publishing-checkout:portfolio01:${attemptA}`,
  `publishing-checkout:portfolio01:${attemptA}`,
]);

const failed = harness({
  createCheckout: async () => {
    throw new PublishingCheckoutGatewayError("no", false, 400);
  },
});
const rejected = await failed.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(rejected.status, 502);
assert.equal(rejected.body.code, "checkout-failed");

const stranger = harness({ portfolio: { ownerId: "owner-2", selectedTemplate: "wdk" } });
const forbidden = await stranger.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(forbidden.status, 403);
assert.equal(stranger.calls.length, 0);

const mismatch = harness({
  getProduct: async () => ({ ...product(), price: { currency: "USD", amount: "10.00", price_type: "fixed" as const } }),
});
const wrongProduct = await mismatch.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(wrongProduct.status, 503);
assert.equal(wrongProduct.body.code, "product-mismatch");
assert.equal(mismatch.calls.length, 0);

const noUrl = harness({ env: { BACHS_PUBLISHING_PRODUCT_ID: productId } });
const missingUrl = await noUrl.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(missingUrl.status, 503);
assert.deepEqual(missingUrl.body.missing, ["BACHS_PUBLISHING_SUCCESS_URL", "BACHS_PUBLISHING_CANCEL_URL"]);
assert.equal(noUrl.productReads.length, 0);
assert.equal(noUrl.calls.length, 0);

const localUrl = harness({
  env: {
    BACHS_PUBLISHING_PRODUCT_ID: productId,
    BACHS_PUBLISHING_SUCCESS_URL: "https://localhost/return",
    BACHS_PUBLISHING_CANCEL_URL: "http://preview.example.com/cancel",
  },
});
const invalidUrl = await localUrl.run({ portfolioId: "portfolio01", attemptId: attemptA });
assert.equal(invalidUrl.status, 503);
assert.deepEqual(invalidUrl.body.invalid, ["BACHS_PUBLISHING_SUCCESS_URL", "BACHS_PUBLISHING_CANCEL_URL"]);
assert.equal(localUrl.calls.length, 0);
assert.equal(readPublishingReturnUrls({ BACHS_PUBLISHING_SUCCESS_URL: "https://10.0.0.4/return", BACHS_PUBLISHING_CANCEL_URL: "https://preview.example.com/cancel" }).ok, false);

const source = readFileSync(new URL("./publishingCheckout.ts", import.meta.url), "utf8");
assert.equal(source.includes("portfolioPublishingEntitlements"), false);
assert.equal(source.includes("collection(\"payments\")"), false);
const publishSource = readFileSync(new URL("../lib/userPortfolio.ts", import.meta.url), "utf8");
const publishFn = publishSource.slice(publishSource.indexOf("export async function publishPortfolio"), publishSource.indexOf("export async function unpublishPortfolio"));
assert.match(publishFn, /publicationAttemptAccess/);
assert.equal(publishFn.includes("new Date()"), false);
assert.match(publishFn, /access !== "entitled"/);
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
assert.match(rules, /data\.expiresAt is timestamp && data\.expiresAt > request\.time/);
const screen = readFileSync(new URL("../components/portfolio-publish/PortfolioPublish.tsx", import.meta.url), "utf8");
assert.match(screen, /Annual Publishing Plan/);
assert.match(screen, /Continue to payment/);
assert.match(screen, /requestPublishingCheckout/);
assert.equal(screen.includes("checkout_id"), false);

console.log("publishing checkout checks passed");
