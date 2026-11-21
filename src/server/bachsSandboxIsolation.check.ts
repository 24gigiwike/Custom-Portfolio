import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { BACHS_SANDBOX_PRODUCT_ID } from "./bachsRuntime";
import { handleBachsWebhook } from "./bachsWebhookHandler";
import type { SandboxPaymentRecord, SandboxReceipt, SandboxReceiptStore } from "./bachsSandboxReceipt";

const liveKey = "sk_live_test";
const liveSecret = "live-webhook-secret";
const sandboxSecret = "sandbox-webhook-secret";
const liveProduct = "prod_livepublishing1";
const liveDomain = "prod_livedomain1";
const sandboxDomain = "prod_sandboxdomain1";

function signature(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function collection(input: { id?: string; amount?: string; currency?: string; product?: string; reference?: string; status?: string }): string {
  return JSON.stringify({
    id: input.id ?? "evt_sandbox_collection",
    type: "collection.succeeded",
    created_at: "2026-01-01T00:00:00.000Z",
    organization_id: "org_fixture",
    data: {
      reference: input.reference ?? "publishing:portfolio1234:11111111-1111-1111-1111-111111111111",
      checkout_id: "chk_sandbox",
      charge_id: "pay_sandbox",
      amount: input.amount ?? "10000.00",
      currency: input.currency ?? "NGN",
      product_id: input.product ?? BACHS_SANDBOX_PRODUCT_ID,
      status: input.status ?? "succeeded",
    },
  });
}

function memoryStore(): SandboxReceiptStore & { rows: Map<string, SandboxReceipt> } {
  const rows = new Map<string, SandboxReceipt>();
  return {
    rows,
    read(eventId) { return rows.get(eventId) ?? null; },
    save(receipt) {
      if (rows.has(receipt.eventId)) return "duplicate";
      rows.set(receipt.eventId, receipt);
      return "created";
    },
  };
}

function payment(patch: Partial<SandboxPaymentRecord> = {}): SandboxPaymentRecord {
  return {
    payment_id: "pay_sandbox",
    amount: "10000.00",
    currency: "NGN",
    status: "succeeded",
    reference: "publishing:portfolio1234:11111111-1111-1111-1111-111111111111",
    product_id: BACHS_SANDBOX_PRODUCT_ID,
    ...patch,
  };
}

async function post(input: {
  body: string;
  secretUsed: string;
  store: ReturnType<typeof memoryStore>;
  payment?: SandboxPaymentRecord | null;
  calls: { collection: number; refund: number; domain: number };
}) {
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  await handleBachsWebhook(
    { method: "POST", headers: { "x-bachs-signature-v2": signature(input.secretUsed, input.body) }, body: input.body },
    { status(code) { sent.status = code; return this; }, setHeader() {}, end(value) { sent.body = JSON.parse(value) as Record<string, unknown>; } },
    {
      env: {
        VERCEL_ENV: "production",
        BACHS_API_KEY: liveKey,
        BACHS_WEBHOOK_SECRET: liveSecret,
        BACHS_SANDBOX_WEBHOOK_SECRET: sandboxSecret,
        BACHS_SANDBOX_API_KEY: "sk_sandbox_hosted",
        BACHS_PUBLISHING_PRODUCT_ID: liveProduct,
        BACHS_DOMAIN_PRODUCT_ID: liveDomain,
        BACHS_SANDBOX_DOMAIN_PRODUCT_ID: sandboxDomain,
        FIREBASE_PROJECT_ID: "custom-portfolio-2026",
        VITE_FIREBASE_PROJECT_ID: "custom-portfolio-2026",
      },
      sandboxStore: input.store,
      getSandboxPayment: async () => input.payment === undefined ? payment() : input.payment,
      ingestCollection: async () => ({ kind: "created", document: { paymentId: "pay_live" } }) as never,
      settleCollection: async () => { input.calls.collection += 1; return { kind: "granted", expiresAt: null }; },
      settleRefund: async () => { input.calls.refund += 1; return { kind: "revoked", expiresAt: null }; },
      settleDomainPayment: async () => { input.calls.domain += 1; return "verified"; },
    },
  );
  return { status: sent.status ?? 0, body: sent.body ?? {} };
}

const store = memoryStore();
const calls = { collection: 0, refund: 0, domain: 0 };
const accepted = await post({ body: collection({}), secretUsed: sandboxSecret, store, calls });
assert.equal(accepted.status, 200);
assert.equal(store.rows.size, 1);
assert.equal(store.rows.get("evt_sandbox_collection")?.fulfilment, "not-run");
assert.equal(store.rows.get("evt_sandbox_collection")?.environment, "sandbox");
assert.equal(calls.collection, 0);
assert.equal(calls.refund, 0);
assert.equal(calls.domain, 0);

const duplicate = await post({ body: collection({}), secretUsed: sandboxSecret, store, calls });
assert.equal(duplicate.status, 200);
assert.equal(store.rows.size, 1);

const invalid = await post({ body: collection({ id: "evt_bad_signature" }), secretUsed: "wrong-secret", store, calls });
assert.equal(invalid.status, 400);
assert.equal(invalid.body.code, "invalid-signature");
assert.equal(store.rows.has("evt_bad_signature"), false);

const amount = await post({
  body: collection({ id: "evt_amount", amount: "10000.01" }),
  secretUsed: sandboxSecret,
  store,
  payment: payment({ amount: "10000.00" }),
  calls,
});
assert.equal(amount.status, 400);
assert.equal(amount.body.code, "not-verified");
assert.equal(store.rows.has("evt_amount"), false);

const currency = await post({
  body: collection({ id: "evt_currency", currency: "USD" }),
  secretUsed: sandboxSecret,
  store,
  payment: payment({ currency: "USD" }),
  calls,
});
assert.equal(currency.status, 400);
assert.equal(currency.body.code, "not-verified");

const liveProductEvent = await post({
  body: collection({ id: "evt_live_product", product: liveProduct }),
  secretUsed: sandboxSecret,
  store,
  payment: payment({ product_id: liveProduct }),
  calls,
});
assert.equal(liveProductEvent.status, 400);
assert.equal(calls.collection, 0);

const domainBody = collection({
  id: "evt_domain",
  product: sandboxDomain,
  amount: "15000.00",
  reference: "domain:orderjourney1:payjourney1",
});
const domain = await post({
  body: domainBody,
  secretUsed: sandboxSecret,
  store,
  payment: payment({
    amount: "15000.00",
    product_id: sandboxDomain,
    reference: "domain:orderjourney1:payjourney1",
  }),
  calls,
});
assert.equal(domain.status, 200);
assert.equal(store.rows.get("evt_domain")?.purpose, "domain");
assert.equal(store.rows.get("evt_domain")?.fulfilment, "not-run");
assert.equal(calls.domain, 0);

const refundBody = JSON.stringify({
  id: "evt_refund",
  type: "refund.paid",
  created_at: "2026-01-01T00:00:00.000Z",
  organization_id: "org_fixture",
  data: { reference: "publishing:portfolio1234:11111111-1111-1111-1111-111111111111", payment_id: "pay_sandbox" },
});
const refund = await post({ body: refundBody, secretUsed: sandboxSecret, store, calls });
assert.equal(refund.status, 200);
assert.equal(calls.refund, 0);
assert.equal(store.rows.get("evt_refund")?.fulfilment, "not-run");

const liveBody = collection({ id: "evt_live" });
const live = await post({ body: liveBody, secretUsed: liveSecret, store, calls });
assert.equal(live.status, 200);
assert.equal(calls.collection, 1);
assert.equal(store.rows.has("evt_live"), false);

const source = readFileSync(new URL("./bachsSandboxReceipt.ts", import.meta.url), "utf8");
assert.equal(source.includes("settleRecordedCollection"), false);
assert.equal(source.includes("settleRefundEvent"), false);
assert.equal(source.includes("advanceDomainOrder"), false);
assert.equal(source.includes("https://api.bachs.io"), false);
assert.equal(source.includes("https://sandbox-api.bachs.io"), true);
const handler = readFileSync(new URL("./bachsWebhookHandler.ts", import.meta.url), "utf8");
const sandboxReturn = handler.indexOf("sandboxSigned");
const liveSettle = handler.indexOf("settleVerifiedEvent");
assert.equal(sandboxReturn < liveSettle, true);
assert.equal(timingSafeEqual(Buffer.from("abc"), Buffer.from("abc")), true);

console.log("bachs sandbox isolation checks passed");
