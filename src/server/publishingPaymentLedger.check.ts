import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CheckoutSessionResponse, PaymentResponse, WebhookEvent } from "@bachs/sdk";
import { handleBachsWebhook } from "./bachsWebhookHandler";
import {
  firestorePaymentLedgerStore,
  ingestVerifiedCollection,
  memoryPaymentLedgerStore,
  PublishingLedgerError,
  type PublishingLedgerDocument,
  type VerifiedPaymentDraft,
} from "./publishingPaymentLedger";

const portfolioId = "portfolio01";
const attemptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reference = `publishing:${portfolioId}:${attemptId}`;
const checkoutId = "chk_testcheckout";
const paymentId = "ch_testpayment";
const sandboxProduct = "prod_d8c0e88a960141ac884b";
const liveProduct = "prod_livepublishing1";
const owner = "owner-1";
const verifiedAt = "2026-03-01T00:00:00.000Z";
const customerEmail = "person@example.com";

function sandboxEnv(): NodeJS.ProcessEnv {
  return {
    VERCEL_ENV: "preview",
    BACHS_API_KEY: "sk_sandbox_test",
    BACHS_WEBHOOK_SECRET: "sandbox-webhook-secret",
    BACHS_PUBLISHING_PRODUCT_ID: sandboxProduct,
    FIREBASE_PROJECT_ID: "custom-by-broadbrand",
    VITE_FIREBASE_PROJECT_ID: "custom-by-broadbrand",
  };
}

function liveEnv(): NodeJS.ProcessEnv {
  return {
    VERCEL_ENV: "production",
    BACHS_API_KEY: "sk_live_test",
    BACHS_WEBHOOK_SECRET: "live-webhook-secret",
    BACHS_PUBLISHING_PRODUCT_ID: liveProduct,
    FIREBASE_PROJECT_ID: "custom-portfolio-2026",
    VITE_FIREBASE_PROJECT_ID: "custom-portfolio-2026",
  };
}

function attempt(product = sandboxProduct) {
  return {
    portfolioId,
    uid: owner,
    attemptId,
    reference,
    checkoutId,
    productId: product,
    quantity: 1 as const,
    idempotencyKey: `publishing-checkout:${portfolioId}:${attemptId}`,
    status: "open",
  };
}

function session(product = sandboxProduct, charge: string | null = paymentId): CheckoutSessionResponse {
  return {
    checkout_id: checkoutId,
    status: "completed",
    reference,
    metadata: { uid: owner, portfolioId, purpose: "annual-publishing" },
    products: [{ product_id: product, quantity: 1 }],
    charge: charge ? {
      payment_id: charge,
      status: "succeeded",
      amount: "10000.00",
      currency: "NGN",
      created_at: verifiedAt,
      updated_at: verifiedAt,
    } : null,
  } as CheckoutSessionResponse;
}

function payment(product = sandboxProduct, patch: Record<string, unknown> = {}): PaymentResponse {
  return {
    payment_id: paymentId,
    checkout_id: checkoutId,
    reference,
    status: "succeeded",
    amount: "10000.00",
    amount_paid: "10000.00",
    currency: "NGN",
    billing_reason: "purchase",
    created_at: verifiedAt,
    updated_at: verifiedAt,
    line_items: [{ product_id: product, quantity: 1 }],
    customer: { email: customerEmail },
    ...patch,
  } as PaymentResponse;
}

function collection(patch: Record<string, unknown> = {}, id = "evt_collection"): WebhookEvent {
  return {
    id,
    type: "collection.succeeded",
    created_at: verifiedAt,
    organization_id: "acct_test",
    data: { charge_id: paymentId, checkout_id: checkoutId, reference, ...patch },
  };
}

function fakeDb(attempts: Map<string, unknown>) {
  const docs = new Map<string, PublishingLedgerDocument>();
  let queue = Promise.resolve();
  let failed = false;
  const db = {
    docs,
    failNext() { failed = true; },
    collection(name: string) {
      return { doc(id: string) { return { path: `${name}/${id}` }; } };
    },
    async runTransaction<T>(fn: (tx: {
      get(ref: { path: string }): Promise<{ exists: boolean; data(): unknown }>;
      set(ref: { path: string }, data: PublishingLedgerDocument): void;
    }) => Promise<T>): Promise<T> {
      if (failed) {
        failed = false;
        throw new Error("database down");
      }
      const run = queue.then(async () => {
        const writes: Array<[string, PublishingLedgerDocument]> = [];
        const result = await fn({
          async get(ref) {
            const value = ref.path.startsWith("publishingCheckoutAttempts/")
              ? attempts.get(ref.path.slice("publishingCheckoutAttempts/".length))
              : docs.get(ref.path);
            return { exists: value != null, data: () => value };
          },
          set(ref, data) { writes.push([ref.path, data]); },
        });
        for (const [path, data] of writes) docs.set(path, data);
        return result;
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  return db;
}

async function record(input: {
  env?: NodeJS.ProcessEnv;
  event?: WebhookEvent;
  attempt?: unknown;
  session?: CheckoutSessionResponse;
  payment?: PaymentResponse;
  attempts?: Map<string, unknown>;
  db?: ReturnType<typeof fakeDb>;
  now?: Date;
  chargeId?: string | null;
}) {
  const env = input.env ?? sandboxEnv();
  const attempts = input.attempts ?? new Map([[portfolioId, input.attempt === undefined ? attempt() : input.attempt]]);
  const db = input.db ?? fakeDb(attempts);
  const calls = { checkout: [] as string[], payment: [] as string[] };
  const event = input.event ?? collection(input.chargeId === undefined ? {} : { charge_id: input.chargeId });
  const result = await ingestVerifiedCollection({
    event,
    env,
    now: input.now ?? new Date(verifiedAt),
    loadAttempt: async (id) => attempts.get(id) ?? null,
    getCheckout: async (id) => {
      calls.checkout.push(id);
      return input.session ?? session();
    },
    getPayment: async (id) => {
      calls.payment.push(id);
      return input.payment ?? payment();
    },
    store: firestorePaymentLedgerStore(db as never),
  });
  return { result, db, calls, attempts };
}

const valid = await record({});
assert.equal(valid.result.kind, "created");
assert.equal(valid.calls.payment[0], paymentId);
const stored = valid.db.docs.get(`payments/${paymentId}`);
assert.ok(stored);
assert.equal(stored.paymentId, paymentId);
assert.equal(stored.checkoutId, checkoutId);
assert.equal(stored.reference, reference);
assert.equal(stored.portfolioId, portfolioId);
assert.equal(stored.uid, owner);
assert.equal(stored.productId, sandboxProduct);
assert.equal(stored.amount, "10000.00");
assert.equal(stored.amountPaid, "10000.00");
assert.equal(stored.currency, "NGN");
assert.equal(stored.billingReason, "purchase");
assert.equal(stored.status, "succeeded");
assert.equal(stored.runtimeMode, "sandbox");
assert.equal(stored.originalEventId, "evt_collection");
assert.deepEqual(stored.processedEventIds, ["evt_collection"]);
assert.equal(stored.verifiedAt, verifiedAt);
assert.equal(JSON.stringify(stored).includes(customerEmail), false);
assert.equal(JSON.stringify(stored).includes("sk_sandbox"), false);

async function rejected(setup: Parameters<typeof record>[0], outcome: PublishingLedgerError["outcome"]) {
  const attempts = setup.attempts ?? new Map([[portfolioId, setup.attempt === undefined ? attempt() : setup.attempt]]);
  const db = setup.db ?? fakeDb(attempts);
  await assert.rejects(
    () => record({ ...setup, attempts, db }),
    (error: unknown) => error instanceof PublishingLedgerError && error.outcome === outcome,
  );
  return db;
}

const wrongReference = await rejected({ event: collection({ reference: `publishing:${portfolioId}:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` }) }, "not-verified");
assert.equal(wrongReference.docs.size, 0);

const wrongCheckout = await rejected({ event: collection({ checkout_id: "chk_other" }) }, "not-verified");
assert.equal(wrongCheckout.docs.size, 0);

const wrongOwner = await rejected({
  session: { ...session(), metadata: { uid: "other-owner", portfolioId, purpose: "annual-publishing" } } as CheckoutSessionResponse,
}, "not-verified");
assert.equal(wrongOwner.docs.size, 0);

const wrongProduct = await rejected({
  session: session("prod_otherproduct01"),
}, "not-verified");
assert.equal(wrongProduct.docs.size, 0);

const wrongAmount = await rejected({ payment: payment(sandboxProduct, { amount: "10000.01" }) }, "not-verified");
assert.equal(wrongAmount.docs.size, 0);

const wrongCurrency = await rejected({ payment: payment(sandboxProduct, { currency: "USD" }) }, "not-verified");
assert.equal(wrongCurrency.docs.size, 0);

const wrongReason = await rejected({ payment: payment(sandboxProduct, { billing_reason: "subscription_cycle" }) }, "not-verified");
assert.equal(wrongReason.docs.size, 0);

const wrongQuantity = await rejected({
  session: { ...session(), products: [{ product_id: sandboxProduct, quantity: 2 }] } as CheckoutSessionResponse,
}, "not-verified");
assert.equal(wrongQuantity.docs.size, 0);

for (const status of ["accepted", "overpaid", "underpaid", "failed", "expired"]) {
  const db = await rejected({ payment: payment(sandboxProduct, { status }) }, "not-verified");
  assert.equal(db.docs.size, 0, status);
}

const fromSession = await record({
  chargeId: null,
  session: session(sandboxProduct, paymentId),
});
assert.equal(fromSession.result.kind, "created");
assert.deepEqual(fromSession.calls.payment, [paymentId]);

const noCharge = await rejected({
  chargeId: null,
  session: session(sandboxProduct, null),
}, "unidentified");
assert.equal(noCharge.docs.size, 0);

const first = await record({ now: new Date(verifiedAt) });
const duplicate = await record({
  db: first.db,
  attempts: first.attempts,
  event: collection({}, "evt_collection"),
});
assert.equal(duplicate.result.kind, "duplicate");
assert.equal(first.db.docs.size, 1);
assert.deepEqual(first.db.docs.get(`payments/${paymentId}`)?.processedEventIds, ["evt_collection"]);

const secondEvent = await record({
  db: first.db,
  attempts: first.attempts,
  event: collection({}, "evt_collection_again"),
  now: new Date("2026-04-01T00:00:00.000Z"),
});
assert.equal(secondEvent.result.kind, "attached");
assert.equal(first.db.docs.size, 1);
const attached = first.db.docs.get(`payments/${paymentId}`);
assert.equal(attached?.originalEventId, "evt_collection");
assert.deepEqual(attached?.processedEventIds, ["evt_collection", "evt_collection_again"]);
assert.equal(attached?.verifiedAt, verifiedAt);

const concurrentAttempts = new Map([[portfolioId, attempt()]]);
const concurrentDb = fakeDb(concurrentAttempts);
const concurrent = await Promise.all([
  record({ attempts: concurrentAttempts, db: concurrentDb, event: collection({}, "evt_concurrent") }),
  record({ attempts: concurrentAttempts, db: concurrentDb, event: collection({}, "evt_concurrent") }),
]);
assert.deepEqual(concurrent.map((item) => item.result.kind).sort(), ["created", "duplicate"]);
assert.equal(concurrentDb.docs.size, 1);

const sandboxRecord = await record({});
const liveRecord = await record({
  env: liveEnv(),
  event: collection({}, "evt_live"),
  attempt: attempt(liveProduct),
  session: session(liveProduct),
  payment: payment(liveProduct),
  db: fakeDb(new Map([[portfolioId, attempt(liveProduct)]])),
});
assert.equal(sandboxRecord.db.docs.get(`payments/${paymentId}`)?.runtimeMode, "sandbox");
assert.equal(liveRecord.db.docs.get(`payments/${paymentId}`)?.runtimeMode, "live");

const crossAttempts = new Map([[portfolioId, attempt()]]);
const crossDb = fakeDb(crossAttempts);
await record({ attempts: crossAttempts, db: crossDb });
const crossStore = memoryPaymentLedgerStore((id) => crossAttempts.get(id) ?? null);
const sandboxDraft = crossDb.docs.get(`payments/${paymentId}`);
assert.ok(sandboxDraft);
await crossStore.commit({
  paymentId,
  checkoutId,
  reference,
  portfolioId,
  uid: owner,
  productId: sandboxProduct,
  amount: "10000.00",
  amountPaid: "10000.00",
  currency: "NGN",
  billingReason: "purchase",
  status: "succeeded",
  runtimeMode: "sandbox",
  eventId: "evt_collection",
  verifiedAt,
});
const environmentStore = memoryPaymentLedgerStore((id) => crossAttempts.get(id) ?? null);
await environmentStore.commit({
  ...sandboxDraftToDraft(sandboxDraft),
  paymentId: "pay_environment_split",
  ledgerEnvironment: "local",
  eventId: "evt_local_env",
});
await assert.rejects(
  () => environmentStore.commit({
    ...sandboxDraftToDraft(sandboxDraft),
    paymentId: "pay_environment_split",
    ledgerEnvironment: "preview",
    eventId: "evt_preview_env",
  }),
);
await assert.rejects(
  () => crossStore.commit({ ...sandboxDraftToDraft(sandboxDraft), runtimeMode: "live", eventId: "evt_live_cross" }),
  (error: unknown) => error instanceof PublishingLedgerError && error.outcome === "conflict",
);
assert.equal(crossStore.payments.get(paymentId)?.runtimeMode, "sandbox");

const failingAttempts = new Map([[portfolioId, attempt()]]);
const failingDb = fakeDb(failingAttempts);
failingDb.failNext();
await assert.rejects(
  () => record({ attempts: failingAttempts, db: failingDb }),
  (error: unknown) => error instanceof PublishingLedgerError && error.outcome === "unavailable",
);
assert.equal(failingDb.docs.size, 0);

function sandboxDraftToDraft(document: PublishingLedgerDocument): VerifiedPaymentDraft {
  return {
    paymentId: document.paymentId,
    checkoutId: document.checkoutId,
    reference: document.reference,
    portfolioId: document.portfolioId,
    uid: document.uid,
    productId: document.productId,
    amount: document.amount,
    amountPaid: document.amountPaid,
    currency: "NGN",
    billingReason: "purchase",
    status: "succeeded",
    runtimeMode: "sandbox",
    eventId: "evt_collection",
    verifiedAt: document.verifiedAt,
  };
}

function signature(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

async function post(input: {
  env: NodeJS.ProcessEnv;
  body: string;
  secret: string;
  headerSecret?: string;
  ingest?: typeof ingestVerifiedCollection;
}) {
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  await handleBachsWebhook(
    {
      method: "POST",
      headers: input.headerSecret === undefined ? { "x-bachs-signature-v2": signature(input.secret, input.body) } : {},
      body: input.body,
    },
    {
      status(code: number) { sent.status = code; return this; },
      setHeader() {},
      end(value: string) { sent.body = JSON.parse(value) as Record<string, unknown>; },
    },
    {
      env: input.env,
      ingestCollection: input.ingest,
      collectionLedger: {
        loadAttempt: async () => attempt(),
        getCheckout: async () => session(),
        getPayment: async () => payment(),
        store: memoryPaymentLedgerStore(() => attempt()),
      },
      settleCollection: async () => ({ kind: "skipped", expiresAt: null }),
    },
  );
  return sent;
}

const raw = JSON.stringify(collection().data && {
  id: "evt_handler",
  type: "collection.succeeded",
  created_at: verifiedAt,
  organization_id: "acct_test",
  data: collection().data,
});
let ingestStarted = false;
let releaseIngest = () => {};
const gate = new Promise<void>((resolve) => { releaseIngest = resolve; });
const delayed = post({
  env: sandboxEnv(),
  body: raw,
  secret: "sandbox-webhook-secret",
  ingest: async () => {
    ingestStarted = true;
    await gate;
    return valid.result;
  },
});
await Promise.resolve();
assert.equal(ingestStarted, true);
const early = await Promise.race([
  delayed.then(() => "ended"),
  Promise.resolve("waiting"),
]);
assert.equal(early, "waiting");
releaseIngest();
const ended = await delayed;
assert.equal(ended.status, 200);
assert.deepEqual(ended.body, { received: true });

const badSignature = await post({
  env: sandboxEnv(),
  body: raw,
  secret: "other-secret",
  ingest: async () => { throw new Error("ledger should not run"); },
});
assert.equal(badSignature.status, 400);
assert.equal(badSignature.body?.code, "invalid-signature");

const sandboxKey = await post({
  env: { ...liveEnv(), BACHS_API_KEY: "sk_sandbox_test" },
  body: raw,
  secret: "live-webhook-secret",
  ingest: async () => { throw new Error("sandbox key must not record a production payment"); },
});
assert.equal(sandboxKey.status, 503);
assert.equal(sandboxKey.body?.code, "unavailable");

const sandboxSignature = await post({
  env: liveEnv(),
  body: raw,
  secret: "sandbox-webhook-secret",
  ingest: async () => { throw new Error("sandbox signature must not record a production payment"); },
});
assert.equal(sandboxSignature.status, 400);
assert.equal(sandboxSignature.body?.code, "invalid-signature");

const failedBody = JSON.stringify({
  id: "evt_fail",
  type: "collection.succeeded",
  created_at: verifiedAt,
  organization_id: "acct_test",
  data: collection().data,
});
const failedAck = await post({
  env: sandboxEnv(),
  body: failedBody,
  secret: "sandbox-webhook-secret",
  ingest: async () => { throw new PublishingLedgerError("unavailable"); },
});
assert.equal(failedAck.status, 503);
assert.equal(failedAck.body?.received, undefined);
assert.equal(failedAck.body?.code, "unavailable");

const ledgerSource = readFileSync(new URL("./publishingPaymentLedger.ts", import.meta.url), "utf8");
assert.equal(ledgerSource.includes("portfolioPublishingEntitlements"), false);
assert.equal(ledgerSource.includes("publishingControls"), false);
const handlerSource = readFileSync(new URL("./bachsWebhookHandler.ts", import.meta.url), "utf8");
assert.equal(handlerSource.includes("collection(\"payments\")"), false);
assert.equal(handlerSource.includes("portfolioPublishingEntitlements"), false);
const checkoutSource = readFileSync(new URL("./publishingCheckout.ts", import.meta.url), "utf8");
assert.equal(checkoutSource.includes("publishingPaymentLedger"), false);
const returnSource = readFileSync(new URL("../lib/publishingReturn.ts", import.meta.url), "utf8");
const returnPage = readFileSync(new URL("../components/portfolio-publish/PublishingPaymentReturn.tsx", import.meta.url), "utf8");
assert.equal(returnSource.includes("publishingPaymentLedger"), false);
assert.equal(returnPage.includes("payments"), false);
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const paymentRules = rules.slice(rules.indexOf("match /payments/{paymentId}"));
assert.match(paymentRules, /allow create, update, delete: if false/);
assert.match(rules, /match \/publishingControls\/\{document\}[\s\S]*allow read, write: if false/);

console.log("publishing payment ledger checks passed");
