/**
 * Grants or revokes one portfolio entitlement from a verified ledger record.
 * The payment ledger is read inside the transaction. Browser dates and
 * webhook statuses are not the authority. This module does not enable the
 * publishing gate.
 */
import type { PaymentResponse, WebhookEvent } from "@bachs/sdk";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { firebaseRuntime } from "../lib/firebaseEnvironment";
import {
  ANNUAL_PUBLISHING_PLAN,
  PAYMENT_COLLECTION,
  PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION,
} from "../lib/publishingEntitlement";
import {
  firestoreExpiryMillis,
  gracePeriodEndsAt,
  planPublishingRenewal,
  type PublishingPaymentHistoryEntry,
} from "../lib/publishingTerm";
import { PUBLISHING_CHECKOUT_COLLECTION, type PublishingCheckoutAttempt } from "./publishingCheckout";
import { firebaseAdminFirestore } from "./firebaseAdmin";
import {
  assertBachsApiKeyForRuntime,
  assertBachsProductForRuntime,
  BachsRuntimeError,
  publishingBachsClient,
} from "./bachsRuntime";
import { PublishingLedgerError, type PublishingLedgerDocument } from "./publishingPaymentLedger";
import { decidePublishingCharge, decidePublishingRefund, serverPublishingTaxConfiguration } from "./publishingPaymentDecision";

const REFUND_ID = /^[A-Za-z0-9_-]{1,200}$/;
const REFUND_HOLD_COLLECTION = "publishingRefundHolds";

export type PublishingEntitlementDocument = {
  uid: string;
  portfolioId: string;
  status: "active" | "revoked";
  source: "payment";
  paymentId: string;
  providerReference: string;
  productId: string;
  planName: typeof ANNUAL_PUBLISHING_PLAN.plan;
  planDuration: typeof ANNUAL_PUBLISHING_PLAN.duration;
  priceLabel: typeof ANNUAL_PUBLISHING_PLAN.priceLabel;
  termMonths: 12;
  grantReason: "verified-payment";
  grantedAt: string;
  verifiedAt: string;
  expiresAt: Timestamp;
  appliedPaymentIds: string[];
  paymentHistory: PublishingPaymentHistoryEntry[];
  runtimeMode: "live";
  renewalBasis: "first" | "early" | "grace" | "late";
  gracePeriodEndsAt: Timestamp;
  refundedPaymentIds?: string[];
  schemaVersion: 1;
  revokedAt?: Timestamp;
  refundId?: string;
  processedRefundIds?: string[];
};

export type PublishingSettlement = {
  kind: "granted" | "duplicate" | "skipped" | "revoked" | "kept" | "held" | "missing" | "unverified" | "mismatch";
  expiresAt: string | null;
};

type RetrievedRefund = {
  refund_id?: unknown;
  charge_id?: unknown;
  status?: unknown;
  requested_amount?: unknown;
};

function liveLedger(value: unknown): PublishingLedgerDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<PublishingLedgerDocument>;
  if (record.schemaVersion !== 1 || record.quantity !== 1 || record.status !== "succeeded") return null;
  if (record.currency !== "NGN" || record.billingReason !== "purchase" || record.runtimeMode !== "live") return null;
  if (typeof record.paymentId !== "string" || typeof record.checkoutId !== "string") return null;
  if (typeof record.reference !== "string" || typeof record.portfolioId !== "string" || typeof record.uid !== "string") return null;
  if (typeof record.productId !== "string" || record.amount !== "10000.00" || record.amountPaid !== "10000.00") return null;
  if (typeof record.verifiedAt !== "string") return null;
  return record as PublishingLedgerDocument;
}

function historyEntry(payment: PublishingLedgerDocument): PublishingPaymentHistoryEntry {
  return {
    paymentId: payment.paymentId,
    portfolioId: payment.portfolioId,
    uid: payment.uid,
    verifiedAt: payment.verifiedAt,
    amount: payment.amount,
    currency: "NGN",
    providerReference: payment.reference,
  };
}

function readHistory(value: unknown): PublishingPaymentHistoryEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: PublishingPaymentHistoryEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Partial<PublishingPaymentHistoryEntry>;
    if (typeof record.paymentId !== "string" || typeof record.portfolioId !== "string") return null;
    if (typeof record.uid !== "string" || typeof record.verifiedAt !== "string") return null;
    if (record.amount !== "10000.00" || record.currency !== "NGN" || typeof record.providerReference !== "string") return null;
    entries.push({
      paymentId: record.paymentId,
      portfolioId: record.portfolioId,
      uid: record.uid,
      verifiedAt: record.verifiedAt,
      amount: "10000.00",
      currency: "NGN",
      providerReference: record.providerReference,
    });
  }
  return entries;
}

function attemptMatches(attempt: unknown, payment: PublishingLedgerDocument): boolean {
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) return false;
  const record = attempt as Partial<PublishingCheckoutAttempt>;
  return record.uid === payment.uid
    && record.portfolioId === payment.portfolioId
    && record.reference === payment.reference
    && record.checkoutId === payment.checkoutId
    && record.productId === payment.productId
    && record.quantity === 1;
}

function paymentStillVerified(payment: PublishingLedgerDocument): boolean {
  const decision = decidePublishingCharge({
    tax: serverPublishingTaxConfiguration(),
    charge: {
      chargeId: payment.paymentId,
      checkoutId: payment.checkoutId,
      status: payment.status,
      currency: payment.currency,
      amount: payment.amount,
      amountPaid: payment.amountPaid,
      settlementAmount: null,
      processingFee: null,
      billingReason: payment.billingReason,
    },
    checkout: {
      checkoutId: payment.checkoutId,
      ownerId: payment.uid,
      portfolioId: payment.portfolioId,
      productId: payment.productId,
      quantity: 1,
    },
    priorFullRefund: false,
  });
  return decision.action === "grant"
    && decision.ownerId === payment.uid
    && decision.portfolioId === payment.portfolioId;
}

function database(input: { env: NodeJS.ProcessEnv; db?: Firestore | null }): Firestore {
  const db = input.db === undefined ? firebaseAdminFirestore(input.env) : input.db;
  if (!db) throw new PublishingLedgerError("unavailable");
  return db;
}

/**
 * Applies one recorded live payment to its portfolio entitlement.
 * A sandbox ledger record and a non-production runtime leave entitlements unchanged.
 */
export async function settleRecordedCollection(input: {
  env: NodeJS.ProcessEnv;
  paymentId: string;
  db?: Firestore | null;
}): Promise<PublishingSettlement> {
  let productId = "";
  try {
    assertBachsApiKeyForRuntime(input.env);
    productId = assertBachsProductForRuntime(input.env);
  } catch (error) {
    if (error instanceof BachsRuntimeError) throw new PublishingLedgerError("unavailable");
    throw error;
  }
  const db = database(input);
  const paymentRef = db.collection(PAYMENT_COLLECTION).doc(input.paymentId);
  try {
    return await db.runTransaction(async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists) return { kind: "missing", expiresAt: null };
      const raw = paymentSnap.data();
      if (!raw || typeof raw !== "object" || (raw as { runtimeMode?: unknown }).runtimeMode === "sandbox") {
        return { kind: "skipped", expiresAt: null };
      }
      if (firebaseRuntime(input.env) !== "production") return { kind: "skipped", expiresAt: null };
      const payment = liveLedger(raw);
      if (!payment || payment.paymentId !== input.paymentId || payment.productId !== productId || !paymentStillVerified(payment)) {
        return { kind: "unverified", expiresAt: null };
      }
      const holdSnap = await transaction.get(db.collection(REFUND_HOLD_COLLECTION).doc(payment.paymentId));
      const attemptSnap = await transaction.get(db.collection(PUBLISHING_CHECKOUT_COLLECTION).doc(payment.portfolioId));
      const attempt = attemptSnap.data();
      if (attempt && attempt.reference === payment.reference && !attemptMatches(attempt, payment)) {
        return { kind: "mismatch", expiresAt: null };
      }
      const entitlementRef = db.collection(PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION).doc(payment.portfolioId);
      const entitlementSnap = await transaction.get(entitlementRef);
      if (holdSnap.exists || typeof (raw as { refundId?: unknown }).refundId === "string") {
        const heldRefund = holdSnap.data()?.refundId;
        if (typeof heldRefund === "string" && typeof (raw as { refundId?: unknown }).refundId !== "string") {
          transaction.set(paymentRef, { refundId: heldRefund }, { merge: true });
        }
        return { kind: "skipped", expiresAt: null };
      }
      const current = entitlementSnap.exists ? entitlementSnap.data() : null;
      if (current && (current.uid !== payment.uid || current.portfolioId !== payment.portfolioId)) {
        return { kind: "mismatch", expiresAt: null };
      }
      const applied = current && Array.isArray(current.appliedPaymentIds) ? current.appliedPaymentIds : [];
      if (applied.includes(payment.paymentId)) {
        const millis = current ? firestoreExpiryMillis(current.expiresAt) : null;
        return { kind: "duplicate", expiresAt: millis == null ? null : new Date(millis).toISOString() };
      }
      if (!applied.every((id: unknown) => typeof id === "string")) return { kind: "mismatch", expiresAt: null };
      const active = current?.status === "active";
      const hasExpiry = Boolean(current) && Object.prototype.hasOwnProperty.call(current, "expiresAt");
      if (active && !hasExpiry) return { kind: "skipped", expiresAt: null };
      const expiryMillis = hasExpiry ? firestoreExpiryMillis(current?.expiresAt) : null;
      if (active && hasExpiry && expiryMillis == null) return { kind: "mismatch", expiresAt: null };
      const history = current ? readHistory(current.paymentHistory) : [];
      if (!history) return { kind: "mismatch", expiresAt: null };
      const anchoredExpiresAt = typeof (raw as { anchoredExpiresAt?: unknown }).anchoredExpiresAt === "string"
        ? (raw as { anchoredExpiresAt: string }).anchoredExpiresAt
        : null;
      const honorAnchor = (raw as { renewalBasis?: unknown }).renewalBasis === "extend"
        && anchoredExpiresAt != null
        && active
        && expiryMillis === Date.parse(anchoredExpiresAt);
      if ((raw as { renewalBasis?: unknown }).renewalBasis === "extend" && anchoredExpiresAt && active && expiryMillis != null && expiryMillis !== Date.parse(anchoredExpiresAt)) {
        transaction.set(entitlementRef, {
          appliedPaymentIds: [...applied, payment.paymentId],
          paymentHistory: [...history, historyEntry(payment)],
        }, { merge: true });
        return { kind: "kept", expiresAt: new Date(expiryMillis).toISOString() };
      }
      const entry = historyEntry(payment);
      const planned = planPublishingRenewal({
        verifiedAt: payment.verifiedAt,
        currentExpiresAt: active && expiryMillis != null ? new Date(expiryMillis).toISOString() : null,
        history,
        payment: entry,
        honorAnchor,
        anchoredExpiresAt: honorAnchor ? anchoredExpiresAt : null,
      });
      if ("ok" in planned) return { kind: "mismatch", expiresAt: null };
      const keptRefunds = Array.isArray(current?.processedRefundIds) ? current.processedRefundIds.filter((id: unknown) => typeof id === "string") : [];
      const keptRefundedPayments = Array.isArray(current?.refundedPaymentIds) ? current.refundedPaymentIds.filter((id: unknown) => typeof id === "string") : [];
      const expires = new Date(planned.expiresAt);
      const next: PublishingEntitlementDocument = {
        uid: payment.uid,
        portfolioId: payment.portfolioId,
        status: "active",
        source: "payment",
        paymentId: payment.paymentId,
        providerReference: payment.reference,
        productId: payment.productId,
        planName: ANNUAL_PUBLISHING_PLAN.plan,
        planDuration: ANNUAL_PUBLISHING_PLAN.duration,
        priceLabel: ANNUAL_PUBLISHING_PLAN.priceLabel,
        termMonths: 12,
        grantReason: "verified-payment",
        grantedAt: typeof current?.grantedAt === "string" ? current.grantedAt : payment.verifiedAt,
        verifiedAt: payment.verifiedAt,
        expiresAt: Timestamp.fromDate(expires),
        gracePeriodEndsAt: Timestamp.fromDate(gracePeriodEndsAt(expires)),
        appliedPaymentIds: [...applied, payment.paymentId],
        paymentHistory: planned.history,
        runtimeMode: "live",
        renewalBasis: planned.basis,
        schemaVersion: 1,
        processedRefundIds: keptRefunds,
        refundedPaymentIds: keptRefundedPayments,
      };
      transaction.set(entitlementRef, next);
      return { kind: "granted", expiresAt: planned.expiresAt };
    });
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
}

function conclusiveRefund(input: {
  refundId: string;
  refund: RetrievedRefund;
  payment: PaymentResponse;
  ledger: PublishingLedgerDocument;
}): boolean {
  if (input.refund.refund_id !== input.refundId || input.refund.charge_id !== input.ledger.paymentId) return false;
  if (input.payment.payment_id !== input.ledger.paymentId) return false;
  if (input.refund.status !== "success") return false;
  if (input.payment.status !== "refunded" && input.payment.status !== "auto_refunded") return false;
  const requested = typeof input.refund.requested_amount === "string" ? input.refund.requested_amount : null;
  const decision = decidePublishingRefund({
    tax: serverPublishingTaxConfiguration(),
    paymentStatus: input.payment.status,
    refundStatus: "success",
    requestedAmount: requested,
  });
  return decision.action === "revoke";
}

async function defaultRefund(env: NodeJS.ProcessEnv, refundId: string): Promise<RetrievedRefund> {
  const client = publishingBachsClient(env);
  const base = client.environment === "production" ? "https://api.bachs.io" : "https://sandbox-api.bachs.io";
  const key = env.BACHS_API_KEY?.trim() ?? "";
  let response: Response;
  try {
    response = await fetch(`${base}/v1/refunds/${encodeURIComponent(refundId)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
    });
  } catch {
    throw new PublishingLedgerError("unavailable");
  }
  if (response.status >= 500) throw new PublishingLedgerError("unavailable");
  if (!response.ok) throw new PublishingLedgerError("not-verified");
  return await response.json() as RetrievedRefund;
}

/**
 * Revokes one portfolio only when the retrieved refund and payment both say
 * the recorded charge was fully refunded. Event status is not consulted.
 */
export async function settleRefundEvent(input: {
  event: WebhookEvent;
  env: NodeJS.ProcessEnv;
  db?: Firestore | null;
  now?: Date;
  getRefund?: (refundId: string) => Promise<RetrievedRefund>;
  getPayment?: (paymentId: string) => Promise<PaymentResponse>;
}): Promise<PublishingSettlement> {
  // A customer asking for a refund is not a reversal. Only refund.paid is considered,
  // and only after the provider record confirms the money was returned.
  if (input.event.type !== "refund.paid") return { kind: "kept", expiresAt: null };
  const data = input.event.data;
  const refundId = typeof data.refund_id === "string" ? data.refund_id : "";
  const chargeId = typeof data.charge_id === "string" ? data.charge_id : "";
  if (!REFUND_ID.test(refundId) || !REFUND_ID.test(chargeId)) return { kind: "mismatch", expiresAt: null };
  let productId = "";
  try {
    assertBachsApiKeyForRuntime(input.env);
    productId = assertBachsProductForRuntime(input.env);
  } catch (error) {
    if (error instanceof BachsRuntimeError) throw new PublishingLedgerError("unavailable");
    throw error;
  }
  if (firebaseRuntime(input.env) !== "production") return { kind: "skipped", expiresAt: null };
  const client = input.getPayment ? null : publishingBachsClient(input.env);
  const getRefund = input.getRefund ?? ((id: string) => defaultRefund(input.env, id));
  const getPayment = input.getPayment ?? ((id: string) => client!.payments.get(id));
  let refund: RetrievedRefund;
  let payment: PaymentResponse;
  try {
    refund = await getRefund(refundId);
    payment = await getPayment(chargeId);
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
  const db = database(input);
  const paymentRef = db.collection(PAYMENT_COLLECTION).doc(chargeId);
  try {
    return await db.runTransaction(async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists) {
        transaction.set(db.collection(REFUND_HOLD_COLLECTION).doc(chargeId), {
          refundId,
          chargeId,
          recordedAt: (input.now ?? new Date()).toISOString(),
        });
        return { kind: "held", expiresAt: null };
      }
      const ledger = liveLedger(paymentSnap.data());
      if (!ledger || ledger.runtimeMode !== "live" || ledger.productId !== productId) {
        return { kind: "skipped", expiresAt: null };
      }
      if (ledger.uid !== paymentSnap.data()?.uid || ledger.portfolioId !== paymentSnap.data()?.portfolioId) {
        return { kind: "mismatch", expiresAt: null };
      }
      if (!ledger.reference.startsWith(`publishing:${ledger.portfolioId}:`)) return { kind: "mismatch", expiresAt: null };
      const entitlementRef = db.collection(PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION).doc(ledger.portfolioId);
      const entitlementSnap = await transaction.get(entitlementRef);
      if (!conclusiveRefund({ refundId, refund, payment, ledger })) return { kind: "kept", expiresAt: null };
      const current = entitlementSnap.exists ? entitlementSnap.data() ?? {} : null;
      if (current && (current.uid !== ledger.uid || current.portfolioId !== ledger.portfolioId || current.runtimeMode !== "live")) {
        return { kind: "mismatch", expiresAt: null };
      }
      const seen = Array.isArray(current?.processedRefundIds) ? current.processedRefundIds : [];
      if (current && (seen.includes(refundId) || current.refundId === refundId)) {
        const millis = firestoreExpiryMillis(current.expiresAt);
        return { kind: "duplicate", expiresAt: millis == null ? null : new Date(millis).toISOString() };
      }
      transaction.set(paymentRef, { refundId }, { merge: true });
      if (!current) return { kind: "held", expiresAt: null };
      const refundedPayments = Array.isArray(current.refundedPaymentIds) ? current.refundedPaymentIds.filter((id: unknown) => typeof id === "string") : [];
      const nextRefunds = [...seen.filter((id: unknown) => typeof id === "string"), refundId];
      if (current.paymentId !== ledger.paymentId) {
        transaction.set(entitlementRef, {
          refundedPaymentIds: [...refundedPayments, ledger.paymentId],
          processedRefundIds: nextRefunds,
        }, { merge: true });
        return { kind: "kept", expiresAt: null };
      }
      transaction.set(entitlementRef, {
        status: "revoked",
        revokedAt: Timestamp.fromDate(input.now ?? new Date()),
        refundId,
        refundedPaymentIds: [...refundedPayments, ledger.paymentId],
        processedRefundIds: nextRefunds,
      }, { merge: true });
      const millis = firestoreExpiryMillis(current.expiresAt);
      return { kind: "revoked", expiresAt: millis == null ? null : new Date(millis).toISOString() };
    });
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
}
