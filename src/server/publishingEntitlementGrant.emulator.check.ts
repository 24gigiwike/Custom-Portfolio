import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PaymentResponse, WebhookEvent } from "@bachs/sdk";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { handleBachsWebhook } from "./bachsWebhookHandler";
import { PublishingLedgerError, type PublishingLedgerDocument } from "./publishingPaymentLedger";
import { settleRecordedCollection, settleRefundEvent } from "./publishingEntitlementGrant";

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (emulator !== "127.0.0.1:8080") {
  throw new Error("Refusing to run publishing entitlement checks outside the local Firestore emulator.");
}

const app = initializeApp({ projectId: "demo-custom-portfolio" }, "publishing-entitlement-grant");
const db = getFirestore(app);
const productId = "prod_livepublishing1";
const liveEnv = {
  VERCEL_ENV: "production",
  BACHS_API_KEY: "sk_live_test",
  BACHS_WEBHOOK_SECRET: "live-webhook-secret",
  BACHS_PUBLISHING_PRODUCT_ID: productId,
  FIREBASE_PROJECT_ID: "custom-portfolio-2026",
  VITE_FIREBASE_PROJECT_ID: "custom-portfolio-2026",
};

const run = Date.now().toString(36);
let serial = 0;

function nextId(prefix: string): string {
  serial += 1;
  return `${prefix}${run}${String(serial).padStart(2, "0")}`;
}

function iso(value: string): string {
  return new Date(value).toISOString();
}

function expiryOf(data: DocumentData | undefined): string {
  const stamp = data?.expiresAt as { toDate?: () => Date } | undefined;
  if (!stamp || typeof stamp.toDate !== "function") throw new Error("expiresAt is not a Firestore Timestamp");
  return stamp.toDate().toISOString();
}

async function readEntitlement(portfolioId: string) {
  const snap = await db.collection("portfolioPublishingEntitlements").doc(portfolioId).get();
  return snap.exists ? snap.data() : null;
}

async function seedCharge(input: {
  portfolioId: string;
  uid: string;
  paymentId: string;
  verifiedAt: string;
  runtimeMode?: "live" | "sandbox";
  status?: string;
  amount?: string;
  productId?: string;
  ownerId?: string;
}) {
  const attemptId = "11111111-1111-4111-8111-111111111111";
  const reference = `publishing:${input.portfolioId}:${attemptId}`;
  const checkoutId = `chk_${input.paymentId}`;
  const payment: PublishingLedgerDocument = {
    paymentId: input.paymentId,
    checkoutId,
    reference,
    portfolioId: input.portfolioId,
    uid: input.uid,
    productId: input.productId ?? productId,
    quantity: 1,
    amount: input.amount ?? "10000.00",
    amountPaid: input.amount ?? "10000.00",
    currency: "NGN",
    billingReason: "purchase",
    status: "succeeded",
    runtimeMode: input.runtimeMode ?? "live",
    originalEventId: `evt_${input.paymentId}`,
    processedEventIds: [`evt_${input.paymentId}`],
    verifiedAt: input.verifiedAt,
    schemaVersion: 1,
  };
  await db.collection("payments").doc(input.paymentId).set({ ...payment, status: input.status ?? payment.status });
  await db.collection("publishingCheckoutAttempts").doc(input.portfolioId).set({
    portfolioId: input.portfolioId,
    uid: input.ownerId ?? input.uid,
    attemptId,
    reference,
    checkoutId,
    productId: input.productId ?? productId,
    quantity: 1,
  });
  return payment;
}

function refundEvent(refundId: string, chargeId: string, type = "refund.paid"): WebhookEvent {
  return {
    id: `evt_${refundId}`,
    type,
    created_at: "2026-04-01T00:00:00.000Z",
    organization_id: "org_test",
    data: { refund_id: refundId, charge_id: chargeId, status: "paid" },
  } as WebhookEvent;
}

function retrieved(input: {
  refundId: string;
  chargeId: string;
  refundStatus?: string;
  paymentStatus?: string;
  requested?: string | null;
}) {
  return {
    getRefund: async () => ({
      refund_id: input.refundId,
      charge_id: input.chargeId,
      status: input.refundStatus ?? "success",
      requested_amount: input.requested === undefined ? "10000.00" : input.requested,
    }),
    getPayment: async () => ({ payment_id: input.chargeId, status: input.paymentStatus ?? "refunded" }) as PaymentResponse,
  };
}

async function grant(paymentId: string) {
  return settleRecordedCollection({ env: liveEnv, paymentId, db });
}

await db.collection("publishingControls").doc("gate").delete();

const firstPortfolio = nextId("portfolio");
const firstOwner = nextId("owner");
const firstPayment = nextId("pay");
const firstVerified = "2026-03-01T00:00:00.000Z";
await seedCharge({ portfolioId: firstPortfolio, uid: firstOwner, paymentId: firstPayment, verifiedAt: firstVerified });
const first = await grant(firstPayment);
assert.equal(first.kind, "granted");
assert.equal(first.expiresAt, iso("2027-03-01T00:00:00.000Z"));
const firstDoc = await readEntitlement(firstPortfolio);
assert.ok(firstDoc);
assert.equal(firstDoc.uid, firstOwner);
assert.equal(firstDoc.portfolioId, firstPortfolio);
assert.equal(firstDoc.paymentId, firstPayment);
assert.equal(firstDoc.productId, productId);
assert.equal(firstDoc.planName, "Annual Publishing");
assert.equal(firstDoc.termMonths, 12);
assert.equal(firstDoc.status, "active");
assert.equal(firstDoc.runtimeMode, "live");
assert.equal(firstDoc.renewalBasis, "first");
assert.equal(expiryOf(firstDoc), iso("2027-03-01T00:00:00.000Z"));
assert.deepEqual(firstDoc.appliedPaymentIds, [firstPayment]);

const earlyPortfolio = nextId("portfolio");
const earlyOwner = nextId("owner");
const earlyPayment = nextId("pay");
await seedCharge({ portfolioId: earlyPortfolio, uid: earlyOwner, paymentId: earlyPayment, verifiedAt: firstVerified });
await db.collection("portfolioPublishingEntitlements").doc(earlyPortfolio).set({
  uid: earlyOwner,
  portfolioId: earlyPortfolio,
  status: "active",
  runtimeMode: "live",
  grantedAt: "2025-03-01T00:00:00.000Z",
  expiresAt: Timestamp.fromDate(new Date("2026-03-05T00:00:00.000Z")),
  appliedPaymentIds: ["pay_prior_early"],
  paymentHistory: [{
    paymentId: "pay_prior_early",
    portfolioId: earlyPortfolio,
    uid: earlyOwner,
    verifiedAt: "2026-06-01T00:00:00.000Z",
    amount: "10000.00",
    currency: "NGN",
    providerReference: "publishing:prior:early",
  }],
});
const early = await grant(earlyPayment);
assert.equal(early.kind, "granted");
assert.equal(early.expiresAt, iso("2027-03-05T00:00:00.000Z"));
const earlyDoc = await readEntitlement(earlyPortfolio);
assert.equal(earlyDoc?.renewalBasis, "early");
assert.equal(earlyDoc?.grantedAt, "2025-03-01T00:00:00.000Z");
assert.equal(expiryOf(earlyDoc ?? undefined), iso("2027-03-05T00:00:00.000Z"));

const latePortfolio = nextId("portfolio");
const lateOwner = nextId("owner");
const latePayment = nextId("pay");
await seedCharge({ portfolioId: latePortfolio, uid: lateOwner, paymentId: latePayment, verifiedAt: firstVerified });
await db.collection("portfolioPublishingEntitlements").doc(latePortfolio).set({
  uid: lateOwner,
  portfolioId: latePortfolio,
  status: "active",
  runtimeMode: "live",
  grantedAt: "2024-01-01T00:00:00.000Z",
  expiresAt: Timestamp.fromDate(new Date("2025-01-01T00:00:00.000Z")),
  appliedPaymentIds: ["pay_prior_late"],
  paymentHistory: [{
    paymentId: "pay_prior_late",
    portfolioId: latePortfolio,
    uid: lateOwner,
    verifiedAt: "2024-01-01T00:00:00.000Z",
    amount: "10000.00",
    currency: "NGN",
    providerReference: "publishing:prior:late",
  }],
});
const late = await grant(latePayment);
assert.equal(late.kind, "granted");
assert.equal(late.expiresAt, iso("2027-03-01T00:00:00.000Z"));
assert.equal((await readEntitlement(latePortfolio))?.renewalBasis, "late");

const repeat = await grant(firstPayment);
assert.equal(repeat.kind, "duplicate");
assert.equal(repeat.expiresAt, iso("2027-03-01T00:00:00.000Z"));
assert.deepEqual((await readEntitlement(firstPortfolio))?.appliedPaymentIds, [firstPayment]);

const concurrentPortfolio = nextId("portfolio");
const concurrentOwner = nextId("owner");
const concurrentPayment = nextId("pay");
await seedCharge({
  portfolioId: concurrentPortfolio,
  uid: concurrentOwner,
  paymentId: concurrentPayment,
  verifiedAt: firstVerified,
});
const concurrent = await Promise.all([grant(concurrentPayment), grant(concurrentPayment)]);
assert.deepEqual(concurrent.map((item) => item.kind).sort(), ["duplicate", "granted"]);
const concurrentDoc = await readEntitlement(concurrentPortfolio);
assert.deepEqual(concurrentDoc?.appliedPaymentIds, [concurrentPayment]);
assert.equal(expiryOf(concurrentDoc ?? undefined), iso("2027-03-01T00:00:00.000Z"));

const foreignPortfolio = nextId("portfolio");
const foreignOwner = nextId("owner");
const foreignPayment = nextId("pay");
await seedCharge({ portfolioId: foreignPortfolio, uid: foreignOwner, paymentId: foreignPayment, verifiedAt: firstVerified });
await db.collection("portfolioPublishingEntitlements").doc(foreignPortfolio).set({
  uid: foreignOwner,
  portfolioId: "differentportfolio",
  status: "active",
  runtimeMode: "live",
  expiresAt: Timestamp.fromDate(new Date("2027-01-01T00:00:00.000Z")),
  appliedPaymentIds: [],
  paymentHistory: [],
});
const wrongPortfolio = await grant(foreignPayment);
assert.equal(wrongPortfolio.kind, "mismatch");
assert.equal((await readEntitlement(foreignPortfolio))?.portfolioId, "differentportfolio");
const isolated = await readEntitlement(firstPortfolio);
assert.equal(isolated?.status, "active");
assert.equal(expiryOf(isolated ?? undefined), iso("2027-03-01T00:00:00.000Z"));

const ownerPortfolio = nextId("portfolio");
const ownerUid = nextId("owner");
const ownerPayment = nextId("pay");
await seedCharge({ portfolioId: ownerPortfolio, uid: ownerUid, paymentId: ownerPayment, verifiedAt: firstVerified });
await db.collection("portfolioPublishingEntitlements").doc(ownerPortfolio).set({
  uid: "someone-else",
  portfolioId: ownerPortfolio,
  status: "active",
  runtimeMode: "live",
  expiresAt: Timestamp.fromDate(new Date("2027-01-01T00:00:00.000Z")),
  appliedPaymentIds: [],
  paymentHistory: [],
});
assert.equal((await grant(ownerPayment)).kind, "mismatch");
assert.equal((await readEntitlement(ownerPortfolio))?.uid, "someone-else");

const missing = await grant(nextId("pay"));
assert.equal(missing.kind, "missing");
assert.equal(await readEntitlement("missingportfolio"), null);

const unverifiedPortfolio = nextId("portfolio");
const unverifiedPayment = nextId("pay");
await seedCharge({
  portfolioId: unverifiedPortfolio,
  uid: nextId("owner"),
  paymentId: unverifiedPayment,
  verifiedAt: firstVerified,
  status: "accepted",
});
assert.equal((await grant(unverifiedPayment)).kind, "unverified");
assert.equal(await readEntitlement(unverifiedPortfolio), null);

const sandboxPortfolio = nextId("portfolio");
const sandboxPayment = nextId("pay");
await seedCharge({
  portfolioId: sandboxPortfolio,
  uid: nextId("owner"),
  paymentId: sandboxPayment,
  verifiedAt: firstVerified,
  runtimeMode: "sandbox",
});
assert.equal((await grant(sandboxPayment)).kind, "skipped");
assert.equal(await readEntitlement(sandboxPortfolio), null);
const previewEnv = {
  ...liveEnv,
  VERCEL_ENV: "preview",
  BACHS_API_KEY: "sk_sandbox_test",
  BACHS_PUBLISHING_PRODUCT_ID: "prod_d8c0e88a960141ac884b",
  FIREBASE_PROJECT_ID: "custom-by-broadbrand",
  VITE_FIREBASE_PROJECT_ID: "custom-by-broadbrand",
};
assert.equal((await settleRecordedCollection({ env: previewEnv, paymentId: firstPayment, db })).kind, "skipped");
assert.equal(expiryOf((await readEntitlement(firstPortfolio)) ?? undefined), iso("2027-03-01T00:00:00.000Z"));

const refundPortfolio = nextId("portfolio");
const refundOwner = nextId("owner");
const refundPayment = nextId("pay");
const otherPortfolio = nextId("portfolio");
const otherOwner = nextId("owner");
const otherPayment = nextId("pay");
await seedCharge({ portfolioId: refundPortfolio, uid: refundOwner, paymentId: refundPayment, verifiedAt: firstVerified });
await seedCharge({ portfolioId: otherPortfolio, uid: otherOwner, paymentId: otherPayment, verifiedAt: firstVerified });
assert.equal((await grant(refundPayment)).kind, "granted");
assert.equal((await grant(otherPayment)).kind, "granted");
const refundId = nextId("rfnd");
const full = await settleRefundEvent({
  event: refundEvent(refundId, refundPayment),
  env: liveEnv,
  db,
  now: new Date("2026-04-02T00:00:00.000Z"),
  ...retrieved({ refundId, chargeId: refundPayment }),
});
assert.equal(full.kind, "revoked");
assert.equal((await readEntitlement(refundPortfolio))?.status, "revoked");
assert.equal((await readEntitlement(otherPortfolio))?.status, "active");
const again = await settleRefundEvent({
  event: refundEvent(refundId, refundPayment),
  env: liveEnv,
  db,
  ...retrieved({ refundId, chargeId: refundPayment }),
});
assert.equal(again.kind, "duplicate");
assert.deepEqual((await readEntitlement(refundPortfolio))?.processedRefundIds, [refundId]);
assert.equal((await readEntitlement(otherPortfolio))?.status, "active");

async function keepRefund(input: { refundStatus?: string; paymentStatus?: string; requested?: string | null }) {
  const portfolioId = nextId("portfolio");
  const paymentId = nextId("pay");
  const id = nextId("rfnd");
  await seedCharge({ portfolioId, uid: nextId("owner"), paymentId, verifiedAt: firstVerified });
  assert.equal((await grant(paymentId)).kind, "granted");
  const result = await settleRefundEvent({
    event: refundEvent(id, paymentId),
    env: liveEnv,
    db,
    ...retrieved({ refundId: id, chargeId: paymentId, ...input }),
  });
  assert.equal(result.kind, "kept");
  assert.equal((await readEntitlement(portfolioId))?.status, "active");
}
await keepRefund({ paymentStatus: "partially_refunded" });
await keepRefund({ refundStatus: "failed", paymentStatus: "succeeded" });
await keepRefund({ refundStatus: "processing", paymentStatus: "succeeded" });
await keepRefund({ refundStatus: "paid" });
await keepRefund({ requested: "5000.00" });

const otherRefund = nextId("rfnd");
const moved = await settleRefundEvent({
  event: refundEvent(otherRefund, otherPayment),
  env: liveEnv,
  db,
  ...retrieved({ refundId: otherRefund, chargeId: otherPayment }),
});
assert.equal(moved.kind, "revoked");
assert.equal((await readEntitlement(otherPortfolio))?.status, "revoked");
assert.equal((await readEntitlement(firstPortfolio))?.status, "active");

let refundReads = 0;
const created = await settleRefundEvent({
  event: refundEvent(nextId("rfnd"), refundPayment, "refund.created"),
  env: liveEnv,
  db,
  getRefund: async () => { refundReads += 1; return {}; },
  getPayment: async () => { refundReads += 1; return {} as PaymentResponse; },
});
assert.equal(created.kind, "kept");
assert.equal(refundReads, 0);
const failedEvent = await settleRefundEvent({
  event: refundEvent(nextId("rfnd"), refundPayment, "refund.failed"),
  env: liveEnv,
  db,
  getRefund: async () => { refundReads += 1; return {}; },
});
assert.equal(failedEvent.kind, "kept");
assert.equal(refundReads, 0);

const failing = {
  collection: (name: string) => db.collection(name),
  runTransaction: async () => { throw new Error("database unavailable"); },
} as unknown as Firestore;
const beforeFailure = expiryOf((await readEntitlement(firstPortfolio)) ?? undefined);
let handlerStatus = 0;
let handlerBody: Record<string, unknown> = {};
await handleBachsWebhook(
  { method: "POST", headers: {}, body: "{}" },
  {
    status(code: number) { handlerStatus = code; return this; },
    setHeader() {},
    end(value: string) { handlerBody = JSON.parse(value) as Record<string, unknown>; },
  },
  {
    env: liveEnv,
    constructEvent: () => ({ id: "evt_db", type: "collection.succeeded", created_at: firstVerified, organization_id: "org_test", data: {} }) as WebhookEvent,
    ingestCollection: async () => ({
      kind: "created",
      document: {
        paymentId: firstPayment,
        checkoutId: "chk",
        reference: "publishing:unused:11111111-1111-4111-8111-111111111111",
        portfolioId: firstPortfolio,
        uid: firstOwner,
        productId,
        quantity: 1,
        amount: "10000.00",
        amountPaid: "10000.00",
        currency: "NGN",
        billingReason: "purchase",
        status: "succeeded",
        runtimeMode: "live",
        originalEventId: "evt_db",
        processedEventIds: ["evt_db"],
        verifiedAt: firstVerified,
        schemaVersion: 1,
      },
    }),
    firestore: failing,
  },
);
assert.equal(handlerStatus, 503);
assert.equal(handlerBody.received, undefined);
assert.equal(handlerBody.code, "unavailable");
assert.equal(expiryOf((await readEntitlement(firstPortfolio)) ?? undefined), beforeFailure);
await assert.rejects(
  () => settleRecordedCollection({ env: liveEnv, paymentId: firstPayment, db: failing }),
  (error: unknown) => error instanceof PublishingLedgerError && error.outcome === "unavailable",
);

let refundCalls = 0;
handlerStatus = 0;
handlerBody = {};
await handleBachsWebhook(
  { method: "POST", headers: {}, body: "{}" },
  {
    status(code: number) { handlerStatus = code; return this; },
    setHeader() {},
    end(value: string) { handlerBody = JSON.parse(value) as Record<string, unknown>; },
  },
  {
    env: liveEnv,
    constructEvent: () => refundEvent("rfnd_db_failure", firstPayment),
    settleRefund: (input) => settleRefundEvent({
      ...input,
      db: failing,
      getRefund: async () => { refundCalls += 1; return { refund_id: "rfnd_db_failure", charge_id: firstPayment, status: "success", requested_amount: "10000.00" }; },
      getPayment: async () => ({ payment_id: firstPayment, status: "refunded" }) as PaymentResponse,
    }),
  },
);
assert.equal(refundCalls, 1);
assert.equal(handlerStatus, 503);
assert.equal(handlerBody.received, undefined);
assert.equal((await readEntitlement(firstPortfolio))?.status, "active");
assert.equal(expiryOf((await readEntitlement(firstPortfolio)) ?? undefined), beforeFailure);

const anchoredPortfolio = nextId("portfolio");
const anchoredOwner = nextId("owner");
const anchoredPayment = nextId("pay");
const anchoredExpiry = "2026-03-05T00:00:00.000Z";
await seedCharge({ portfolioId: anchoredPortfolio, uid: anchoredOwner, paymentId: anchoredPayment, verifiedAt: "2026-03-20T00:00:00.000Z" });
await db.collection("portfolioPublishingEntitlements").doc(anchoredPortfolio).set({
  uid: anchoredOwner,
  portfolioId: anchoredPortfolio,
  status: "active",
  runtimeMode: "live",
  paymentId: "pay_prior_anchor",
  grantedAt: "2025-03-05T00:00:00.000Z",
  expiresAt: Timestamp.fromDate(new Date(anchoredExpiry)),
  appliedPaymentIds: ["pay_prior_anchor"],
  paymentHistory: [{
    paymentId: "pay_prior_anchor",
    portfolioId: anchoredPortfolio,
    uid: anchoredOwner,
    verifiedAt: "2025-03-05T00:00:00.000Z",
    amount: "10000.00",
    currency: "NGN",
    providerReference: "publishing:prior:anchor",
  }],
});
await db.collection("payments").doc(anchoredPayment).set({ renewalBasis: "extend", anchoredExpiresAt: anchoredExpiry }, { merge: true });
const anchored = await grant(anchoredPayment);
assert.equal(anchored.kind, "granted");
assert.equal(anchored.expiresAt, iso("2027-03-05T00:00:00.000Z"));

const earlyBlockedPortfolio = nextId("portfolio");
const earlyBlockedPayment = nextId("pay");
await seedCharge({ portfolioId: earlyBlockedPortfolio, uid: nextId("owner"), paymentId: earlyBlockedPayment, verifiedAt: firstVerified });
await db.collection("portfolioPublishingEntitlements").doc(earlyBlockedPortfolio).set({
  uid: (await db.collection("payments").doc(earlyBlockedPayment).get()).data()?.uid,
  portfolioId: earlyBlockedPortfolio,
  status: "active",
  runtimeMode: "live",
  expiresAt: Timestamp.fromDate(new Date("2027-06-01T00:00:00.000Z")),
  appliedPaymentIds: ["pay_far"],
  paymentHistory: [{
    paymentId: "pay_far",
    portfolioId: earlyBlockedPortfolio,
    uid: (await db.collection("payments").doc(earlyBlockedPayment).get()).data()?.uid,
    verifiedAt: "2026-06-01T00:00:00.000Z",
    amount: "10000.00",
    currency: "NGN",
    providerReference: "publishing:prior:far",
  }],
});
assert.equal((await grant(earlyBlockedPayment)).kind, "mismatch");
assert.equal(expiryOf((await readEntitlement(earlyBlockedPortfolio)) ?? undefined), iso("2027-06-01T00:00:00.000Z"));

const heldPortfolio = nextId("portfolio");
const heldOwner = nextId("owner");
const heldPayment = nextId("pay");
const heldRefund = nextId("rfnd");
await seedCharge({ portfolioId: heldPortfolio, uid: heldOwner, paymentId: heldPayment, verifiedAt: firstVerified });
const held = await settleRefundEvent({
  event: refundEvent(heldRefund, heldPayment),
  env: liveEnv,
  db,
  ...retrieved({ refundId: heldRefund, chargeId: heldPayment }),
});
assert.equal(held.kind, "held");
assert.equal((await grant(heldPayment)).kind, "skipped");
assert.equal(await readEntitlement(heldPortfolio), null);

const followedPortfolio = nextId("portfolio");
const followedOwner = nextId("owner");
const followedFirst = nextId("pay");
const followedSecond = nextId("pay");
await seedCharge({ portfolioId: followedPortfolio, uid: followedOwner, paymentId: followedFirst, verifiedAt: "2026-03-01T00:00:00.000Z" });
assert.equal((await grant(followedFirst)).kind, "granted");
await seedCharge({ portfolioId: followedPortfolio, uid: followedOwner, paymentId: followedSecond, verifiedAt: "2027-02-25T00:00:00.000Z" });
assert.equal((await grant(followedSecond)).kind, "granted");
const olderRefund = nextId("rfnd");
const older = await settleRefundEvent({
  event: refundEvent(olderRefund, followedFirst),
  env: liveEnv,
  db,
  ...retrieved({ refundId: olderRefund, chargeId: followedFirst }),
});
assert.equal(older.kind, "kept");
assert.equal((await readEntitlement(followedPortfolio))?.status, "active");
assert.equal((await readEntitlement(followedPortfolio))?.paymentId, followedSecond);
assert.equal(expiryOf((await readEntitlement(followedPortfolio)) ?? undefined), iso("2028-03-01T00:00:00.000Z"));

const restoredPortfolio = nextId("portfolio");
const restoredOwner = nextId("owner");
const restoredPayment = nextId("pay");
const restoredNext = nextId("pay");
const restoredRefund = nextId("rfnd");
await seedCharge({ portfolioId: restoredPortfolio, uid: restoredOwner, paymentId: restoredPayment, verifiedAt: firstVerified });
assert.equal((await grant(restoredPayment)).kind, "granted");
assert.equal((await settleRefundEvent({
  event: refundEvent(restoredRefund, restoredPayment),
  env: liveEnv,
  db,
  ...retrieved({ refundId: restoredRefund, chargeId: restoredPayment }),
})).kind, "revoked");
await seedCharge({ portfolioId: restoredPortfolio, uid: restoredOwner, paymentId: restoredNext, verifiedAt: "2026-04-01T00:00:00.000Z" });
assert.equal((await grant(restoredNext)).kind, "granted");
const restoredDoc = await readEntitlement(restoredPortfolio);
assert.equal(restoredDoc?.status, "active");
assert.equal(restoredDoc?.paymentId, restoredNext);
assert.ok(Array.isArray(restoredDoc?.processedRefundIds) && restoredDoc.processedRefundIds.includes(restoredRefund));
assert.equal(expiryOf(restoredDoc ?? undefined), iso("2027-04-01T00:00:00.000Z"));

const manualPortfolio = nextId("portfolio");
const manualOwner = nextId("owner");
const manualPayment = nextId("pay");
await db.collection("portfolios").doc(manualPortfolio).set({
  ownerId: manualOwner,
  publishing: { status: "draft", publishedAt: "2026-01-01T00:00:00.000Z" },
  published: false,
});
await seedCharge({ portfolioId: manualPortfolio, uid: manualOwner, paymentId: manualPayment, verifiedAt: firstVerified });
assert.equal((await grant(manualPayment)).kind, "granted");
const manualAfter = (await db.collection("portfolios").doc(manualPortfolio).get()).data();
assert.equal(manualAfter?.publishing.status, "draft");
assert.equal(manualAfter?.published, false);
assert.equal((await db.collection("publicPortfolios").doc(manualPortfolio).get()).exists, false);

const pausedPortfolio = nextId("portfolio");
const pausedOwner = nextId("owner");
const pausedPayment = nextId("pay");
await db.collection("portfolios").doc(pausedPortfolio).set({
  ownerId: pausedOwner,
  publishing: { status: "published", publishedAt: "2026-01-01T00:00:00.000Z" },
  published: true,
});
await seedCharge({ portfolioId: pausedPortfolio, uid: pausedOwner, paymentId: pausedPayment, verifiedAt: firstVerified });
assert.equal((await grant(pausedPayment)).kind, "granted");
const pausedAfter = (await db.collection("portfolios").doc(pausedPortfolio).get()).data();
assert.equal(pausedAfter?.publishing.status, "published");
assert.equal(expiryOf((await readEntitlement(pausedPortfolio)) ?? undefined), iso("2027-03-01T00:00:00.000Z"));

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
assert.match(rules, /match \/publishingControls\/\{document\}[\s\S]*allow read, write: if false/);
assert.equal((await db.collection("publishingControls").doc("gate").get()).exists, false);
const grantSource = readFileSync(new URL("./publishingEntitlementGrant.ts", import.meta.url), "utf8");
assert.equal(grantSource.includes("publishingControls"), false);
const portfolioSource = readFileSync(new URL("../lib/userPortfolio.ts", import.meta.url), "utf8");
const publicSource = readFileSync(new URL("../lib/publicPortfolio.ts", import.meta.url), "utf8");
assert.match(portfolioSource, /export async function publishPortfolio/);
assert.match(portfolioSource, /publicationAttemptAccess\(/);
assert.match(publicSource, /const WDK_TEMPLATE_ID = templateConfig\.id/);
assert.match(publicSource, /const CREATIVE_TEMPLATE_ID = creativeTemplateConfig\.id/);

console.log("publishing entitlement grant checks passed");
