/**
 * Records one verified Bachs collection in the server-only payments ledger.
 * The webhook payload is not the payment record. The stored checkout attempt,
 * the retrieved checkout session, and payments.get must agree.
 * This module does not grant or revoke a publishing entitlement.
 */
import type { CheckoutSessionResponse, PaymentResponse, WebhookEvent } from "@bachs/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { firebaseRuntime } from "../lib/firebaseEnvironment";
import { PAYMENT_COLLECTION } from "../lib/publishingEntitlement";
import { firebaseAdminFirestore } from "./firebaseAdmin";
import { assertBachsApiKeyForRuntime, assertBachsProductForRuntime, BachsRuntimeError, publishingBachsClient } from "./bachsRuntime";
import { PUBLISHING_CHECKOUT_COLLECTION } from "./publishingCheckout";
import { decidePublishingCharge, serverPublishingTaxConfiguration } from "./publishingPaymentDecision";

const REFERENCE = /^publishing:([A-Za-z0-9]{10,80}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const EVENT_LIMIT = 32;

export type PublishingRuntimeMode = "live" | "sandbox";

export type PublishingLedgerDocument = {
  paymentId: string;
  checkoutId: string;
  reference: string;
  portfolioId: string;
  uid: string;
  productId: string;
  quantity: 1;
  amount: string;
  amountPaid: string;
  currency: "NGN";
  billingReason: "purchase";
  status: "succeeded";
  runtimeMode: PublishingRuntimeMode;
  originalEventId: string;
  processedEventIds: string[];
  verifiedAt: string;
  schemaVersion: 1;
  ledgerEnvironment?: "production" | "preview" | "local";
  renewalBasis?: "extend" | "fresh";
  anchoredExpiresAt?: string | null;
  initiatedAt?: string;
  refundId?: string;
};

export type VerifiedPaymentDraft = {
  paymentId: string;
  checkoutId: string;
  reference: string;
  portfolioId: string;
  uid: string;
  productId: string;
  amount: string;
  amountPaid: string;
  currency: "NGN";
  billingReason: "purchase";
  status: "succeeded";
  runtimeMode: PublishingRuntimeMode;
  eventId: string;
  verifiedAt: string;
  ledgerEnvironment?: "production" | "preview" | "local";
  renewalBasis?: "extend" | "fresh";
  anchoredExpiresAt?: string | null;
  initiatedAt?: string;
};

export type LedgerWrite =
  | { kind: "created" | "attached" | "duplicate"; document: PublishingLedgerDocument }
  | { kind: "not-verified" | "conflict" };

export class PublishingLedgerError extends Error {
  readonly name = "PublishingLedgerError";

  constructor(readonly outcome: "not-verified" | "unidentified" | "conflict" | "unavailable") {
    super("Publishing payment was not recorded.");
  }
}

type StoredAttempt = {
  portfolioId: string;
  uid: string;
  attemptId: string;
  reference: string;
  checkoutId: string;
  productId: string;
  quantity: 1;
};

export type PaymentLedgerStore = {
  commit(draft: VerifiedPaymentDraft): Promise<LedgerWrite>;
};

export type CollectionLedgerPorts = {
  loadAttempt?: (portfolioId: string) => Promise<unknown>;
  getCheckout?: (checkoutId: string) => Promise<CheckoutSessionResponse>;
  getPayment?: (paymentId: string) => Promise<PaymentResponse>;
  store?: PaymentLedgerStore;
};

function usableId(value: string): boolean {
  return value.length > 0 && value.length <= 200 && !/[\s/]/.test(value);
}

function storedAttempt(value: unknown): StoredAttempt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.portfolioId !== "string" || typeof record.uid !== "string" || !record.uid.trim()) return null;
  if (typeof record.attemptId !== "string" || typeof record.reference !== "string") return null;
  if (typeof record.checkoutId !== "string" || !usableId(record.checkoutId)) return null;
  if (typeof record.productId !== "string" || record.quantity !== 1) return null;
  return {
    portfolioId: record.portfolioId,
    uid: record.uid,
    attemptId: record.attemptId,
    reference: record.reference,
    checkoutId: record.checkoutId,
    productId: record.productId,
    quantity: 1,
  };
}

function attemptMatches(attempt: StoredAttempt, draft: VerifiedPaymentDraft): boolean {
  return attempt.portfolioId === draft.portfolioId
    && attempt.uid === draft.uid
    && attempt.reference === draft.reference
    && attempt.checkoutId === draft.checkoutId
    && attempt.productId === draft.productId
    && attempt.quantity === 1;
}

function readLedgerDocument(value: unknown): PublishingLedgerDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<PublishingLedgerDocument>;
  if (record.schemaVersion !== 1 || record.quantity !== 1 || record.status !== "succeeded") return null;
  if (record.currency !== "NGN" || record.billingReason !== "purchase") return null;
  if (record.runtimeMode !== "live" && record.runtimeMode !== "sandbox") return null;
  if (typeof record.paymentId !== "string" || typeof record.checkoutId !== "string") return null;
  if (typeof record.reference !== "string" || typeof record.portfolioId !== "string" || typeof record.uid !== "string") return null;
  if (typeof record.productId !== "string" || typeof record.amount !== "string" || typeof record.amountPaid !== "string") return null;
  if (typeof record.originalEventId !== "string" || typeof record.verifiedAt !== "string") return null;
  if (!Array.isArray(record.processedEventIds) || !record.processedEventIds.every((id) => typeof id === "string")) return null;
  return record as PublishingLedgerDocument;
}

/** Pure ledger decision used inside one Firestore transaction. */
export function applyLedgerCommit(input: {
  current: unknown;
  attempt: unknown;
  draft: VerifiedPaymentDraft;
}): LedgerWrite {
  const attempt = storedAttempt(input.attempt);
  if (!attempt || !attemptMatches(attempt, input.draft)) return { kind: "not-verified" };
  if (!input.current) {
    return {
      kind: "created",
      document: {
        paymentId: input.draft.paymentId,
        checkoutId: input.draft.checkoutId,
        reference: input.draft.reference,
        portfolioId: input.draft.portfolioId,
        uid: input.draft.uid,
        productId: input.draft.productId,
        quantity: 1,
        amount: input.draft.amount,
        amountPaid: input.draft.amountPaid,
        currency: "NGN",
        billingReason: "purchase",
        status: "succeeded",
        runtimeMode: input.draft.runtimeMode,
        originalEventId: input.draft.eventId,
        processedEventIds: [input.draft.eventId],
        verifiedAt: input.draft.verifiedAt,
        schemaVersion: 1,
        ...(input.draft.ledgerEnvironment ? { ledgerEnvironment: input.draft.ledgerEnvironment } : {}),
        ...(input.draft.renewalBasis ? { renewalBasis: input.draft.renewalBasis } : {}),
        ...(input.draft.anchoredExpiresAt ? { anchoredExpiresAt: input.draft.anchoredExpiresAt } : {}),
        ...(input.draft.initiatedAt ? { initiatedAt: input.draft.initiatedAt } : {}),
      },
    };
  }
  const current = readLedgerDocument(input.current);
  if (!current || current.runtimeMode !== input.draft.runtimeMode) return { kind: "conflict" };
  if (current.ledgerEnvironment && input.draft.ledgerEnvironment && current.ledgerEnvironment !== input.draft.ledgerEnvironment) {
    return { kind: "conflict" };
  }
  const same = current.paymentId === input.draft.paymentId
    && current.checkoutId === input.draft.checkoutId
    && current.reference === input.draft.reference
    && current.portfolioId === input.draft.portfolioId
    && current.uid === input.draft.uid
    && current.productId === input.draft.productId
    && current.amount === input.draft.amount
    && current.amountPaid === input.draft.amountPaid;
  if (!same) return { kind: "conflict" };
  if (current.processedEventIds.includes(input.draft.eventId) || current.processedEventIds.length >= EVENT_LIMIT) {
    return { kind: "duplicate", document: current };
  }
  return {
    kind: "attached",
    document: { ...current, processedEventIds: [...current.processedEventIds, input.draft.eventId] },
  };
}

function finishCommit(outcome: LedgerWrite): Extract<LedgerWrite, { document: PublishingLedgerDocument }> {
  if (outcome.kind === "created" || outcome.kind === "attached" || outcome.kind === "duplicate") return outcome;
  throw new PublishingLedgerError(outcome.kind);
}

export function memoryPaymentLedgerStore(readAttempt: (portfolioId: string) => unknown): PaymentLedgerStore & {
  payments: Map<string, PublishingLedgerDocument>;
} {
  const payments = new Map<string, PublishingLedgerDocument>();
  let queue = Promise.resolve();
  return {
    payments,
    commit(draft) {
      const run = queue.then(() => {
        const outcome = finishCommit(applyLedgerCommit({
          current: payments.get(draft.paymentId) ?? null,
          attempt: readAttempt(draft.portfolioId),
          draft,
        }));
        if (outcome.kind !== "duplicate") payments.set(draft.paymentId, outcome.document);
        return outcome;
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

export function firestorePaymentLedgerStore(db: Firestore): PaymentLedgerStore {
  return {
    async commit(draft) {
      const paymentRef = db.collection(PAYMENT_COLLECTION).doc(draft.paymentId);
      const attemptRef = db.collection(PUBLISHING_CHECKOUT_COLLECTION).doc(draft.portfolioId);
      try {
        const outcome = await db.runTransaction(async (transaction) => {
          const paymentSnap = await transaction.get(paymentRef);
          const attemptSnap = await transaction.get(attemptRef);
          const next = applyLedgerCommit({
            current: paymentSnap.exists ? paymentSnap.data() : null,
            attempt: attemptSnap.exists ? attemptSnap.data() : null,
            draft,
          });
          if (next.kind === "created" || next.kind === "attached") transaction.set(paymentRef, next.document);
          return next;
        });
        return finishCommit(outcome);
      } catch (error) {
        if (error instanceof PublishingLedgerError) throw error;
        throw new PublishingLedgerError("unavailable");
      }
    },
  };
}

function pointers(data: unknown): { checkoutId: string; reference: string; chargeId: string | null } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.checkout_id !== "string" || typeof record.reference !== "string") return null;
  if (record.charge_id == null) return { checkoutId: record.checkout_id, reference: record.reference, chargeId: null };
  if (typeof record.charge_id !== "string") return null;
  return { checkoutId: record.checkout_id, reference: record.reference, chargeId: record.charge_id };
}

function metadataMatches(metadata: unknown, attempt: StoredAttempt): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  return record.uid === attempt.uid
    && record.portfolioId === attempt.portfolioId
    && record.purpose === "annual-publishing";
}

function productLine(value: unknown, productId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.product_id !== productId || record.quantity !== 1) return false;
  if (record.unit_amount !== undefined && record.unit_amount !== "10000.00") return false;
  if (record.line_total !== undefined && record.line_total !== "10000.00") return false;
  if (record.amount !== undefined && record.amount !== "10000.00") return false;
  return true;
}

function productLines(value: unknown, productId: string): boolean {
  return Array.isArray(value) && value.length === 1 && productLine(value[0], productId);
}

function sessionChargeId(session: CheckoutSessionResponse): string | null {
  const charge = session.charge;
  if (!charge || typeof charge !== "object") return null;
  const paymentId = charge.payment_id;
  return typeof paymentId === "string" ? paymentId : null;
}

async function loadDefaultAttempt(env: NodeJS.ProcessEnv, portfolioId: string): Promise<unknown> {
  const db = firebaseAdminFirestore(env);
  if (!db) throw new PublishingLedgerError("unavailable");
  const snap = await db.collection(PUBLISHING_CHECKOUT_COLLECTION).doc(portfolioId).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Verifies one collection.succeeded event and commits the ledger.
 * A returned write means the transaction finished. Callers acknowledge only then.
 */
export async function ingestVerifiedCollection(input: {
  event: WebhookEvent;
  env: NodeJS.ProcessEnv;
  now?: Date;
} & CollectionLedgerPorts): Promise<LedgerWrite> {
  if (input.event.type !== "collection.succeeded" || !usableId(input.event.id)) {
    throw new PublishingLedgerError("not-verified");
  }
  let productId = "";
  try {
    assertBachsApiKeyForRuntime(input.env);
    productId = assertBachsProductForRuntime(input.env);
  } catch (error) {
    if (error instanceof BachsRuntimeError) throw new PublishingLedgerError("unavailable");
    throw error;
  }
  const runtimeMode: PublishingRuntimeMode = firebaseRuntime(input.env) === "production" ? "live" : "sandbox";
  const fields = pointers(input.event.data);
  if (!fields) throw new PublishingLedgerError("not-verified");
  const referenced = REFERENCE.exec(fields.reference);
  if (!referenced) throw new PublishingLedgerError("not-verified");
  const portfolioId = referenced[1] ?? "";
  const attemptId = referenced[2] ?? "";
  const db = firebaseAdminFirestore(input.env);
  const loadAttempt = input.loadAttempt ?? ((id: string) => loadDefaultAttempt(input.env, id));
  const store = input.store ?? (db ? firestorePaymentLedgerStore(db) : null);
  if (!store) throw new PublishingLedgerError("unavailable");
  let loaded: unknown;
  try {
    loaded = await loadAttempt(portfolioId);
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
  const attempt = storedAttempt(loaded);
  if (!attempt || attempt.portfolioId !== portfolioId || attempt.attemptId.toLowerCase() !== attemptId.toLowerCase()) {
    throw new PublishingLedgerError("not-verified");
  }
  if (attempt.reference !== fields.reference || attempt.checkoutId !== fields.checkoutId || attempt.productId !== productId) {
    throw new PublishingLedgerError("not-verified");
  }

  const client = input.getCheckout && input.getPayment ? null : publishingBachsClient(input.env);
  if (client && client.environment !== (runtimeMode === "live" ? "production" : "sandbox")) {
    throw new PublishingLedgerError("unavailable");
  }
  const getCheckout = input.getCheckout ?? ((checkoutId: string) => client!.checkoutSessions.get(checkoutId));
  const getPayment = input.getPayment ?? ((paymentId: string) => client!.payments.get(paymentId));
  let session: CheckoutSessionResponse;
  try {
    session = await getCheckout(attempt.checkoutId);
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
  if (session.checkout_id !== attempt.checkoutId || session.reference !== attempt.reference) {
    throw new PublishingLedgerError("not-verified");
  }
  if (!metadataMatches(session.metadata, attempt) || !productLines(session.products, productId)) {
    throw new PublishingLedgerError("not-verified");
  }

  let paymentId: string;
  const linkedChargeId = sessionChargeId(session);
  if (fields.chargeId !== null) {
    if (!usableId(fields.chargeId)) throw new PublishingLedgerError("unidentified");
    if (linkedChargeId && linkedChargeId !== fields.chargeId) throw new PublishingLedgerError("not-verified");
    paymentId = fields.chargeId;
  } else if (linkedChargeId && usableId(linkedChargeId)) {
    paymentId = linkedChargeId;
  } else {
    throw new PublishingLedgerError("unidentified");
  }

  let payment: PaymentResponse;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
  if (payment.payment_id !== paymentId || typeof payment.checkout_id !== "string" || payment.checkout_id !== attempt.checkoutId) {
    throw new PublishingLedgerError("not-verified");
  }
  if (payment.reference !== attempt.reference) throw new PublishingLedgerError("not-verified");
  if (payment.line_items != null && !productLines(payment.line_items, productId)) {
    throw new PublishingLedgerError("not-verified");
  }
  if (typeof payment.status !== "string" || typeof payment.amount !== "string" || typeof payment.currency !== "string") {
    throw new PublishingLedgerError("not-verified");
  }
  if (typeof payment.amount_paid !== "string" || typeof payment.billing_reason !== "string") {
    throw new PublishingLedgerError("not-verified");
  }
  const decision = decidePublishingCharge({
    tax: serverPublishingTaxConfiguration(),
    charge: {
      chargeId: payment.payment_id,
      checkoutId: payment.checkout_id,
      status: payment.status,
      currency: payment.currency,
      amount: payment.amount,
      amountPaid: payment.amount_paid,
      settlementAmount: null,
      processingFee: null,
      billingReason: payment.billing_reason,
    },
    checkout: {
      checkoutId: attempt.checkoutId,
      ownerId: attempt.uid,
      portfolioId: attempt.portfolioId,
      productId: attempt.productId,
      quantity: 1,
    },
    priorFullRefund: false,
  });
  if (decision.action !== "grant") throw new PublishingLedgerError("not-verified");

  const draft: VerifiedPaymentDraft = {
    paymentId,
    checkoutId: attempt.checkoutId,
    reference: attempt.reference,
    portfolioId: attempt.portfolioId,
    uid: attempt.uid,
    productId: attempt.productId,
    amount: payment.amount,
    amountPaid: payment.amount_paid,
    currency: "NGN",
    billingReason: "purchase",
    status: "succeeded",
    runtimeMode,
    eventId: input.event.id,
    verifiedAt: (input.now ?? new Date()).toISOString(),
    ledgerEnvironment: firebaseRuntime(input.env),
    renewalBasis: loaded && typeof loaded === "object" && (loaded as { renewalBasis?: unknown }).renewalBasis === "extend" ? "extend" : "fresh",
    anchoredExpiresAt: loaded && typeof loaded === "object" && typeof (loaded as { anchoredExpiresAt?: unknown }).anchoredExpiresAt === "string"
      ? (loaded as { anchoredExpiresAt: string }).anchoredExpiresAt
      : null,
    initiatedAt: loaded && typeof loaded === "object" && typeof (loaded as { initiatedAt?: unknown }).initiatedAt === "string"
      ? (loaded as { initiatedAt: string }).initiatedAt
      : null,
  };
  try {
    return await store.commit(draft);
  } catch (error) {
    if (error instanceof PublishingLedgerError) throw error;
    throw new PublishingLedgerError("unavailable");
  }
}
