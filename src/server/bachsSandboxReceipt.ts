/**
 * Records a webhook that verified with the sandbox signing secret.
 * This module does not grant publishing, revoke an entitlement, register a
 * domain, or call the live Bachs API.
 */
import type { WebhookEvent } from "@bachs/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { BACHS_SANDBOX_PRODUCT_ID } from "./bachsRuntime";

export const SANDBOX_WEBHOOK_RECEIPT_COLLECTION = "sandboxWebhookReceipts";

export type SandboxReceipt = {
  eventId: string;
  type: string;
  reference: string;
  purpose: "publishing" | "domain" | "other";
  paymentId: string | null;
  amount: string | null;
  currency: string | null;
  productId: string | null;
  status: string | null;
  environment: "sandbox";
  fulfilment: "not-run";
  receivedAt: string;
};

export type SandboxReceiptStore = {
  read(eventId: string): Promise<SandboxReceipt | null> | SandboxReceipt | null;
  save(receipt: SandboxReceipt): Promise<"created" | "duplicate"> | "created" | "duplicate";
};

export type SandboxPaymentRecord = {
  payment_id?: string;
  amount?: string;
  currency?: string;
  status?: string;
  reference?: string;
  product_id?: string;
};

function text(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function purpose(reference: string): SandboxReceipt["purpose"] {
  if (reference.startsWith("publishing:")) return "publishing";
  if (reference.startsWith("domain:")) return "domain";
  return "other";
}

function sameReceipt(stored: SandboxReceipt, next: SandboxReceipt): boolean {
  return stored.type === next.type
    && stored.reference === next.reference
    && stored.paymentId === next.paymentId
    && stored.amount === next.amount
    && stored.currency === next.currency
    && stored.productId === next.productId
    && stored.status === next.status;
}

export function firestoreSandboxReceiptStore(db: Firestore): SandboxReceiptStore {
  const collection = db.collection(SANDBOX_WEBHOOK_RECEIPT_COLLECTION);
  return {
    async read(eventId: string) {
      const snap = await collection.doc(eventId).get();
      return snap.exists ? snap.data() as SandboxReceipt : null;
    },
    async save(receipt: SandboxReceipt) {
      const ref = collection.doc(receipt.eventId);
      const existing = await ref.get();
      if (existing.exists) return "duplicate";
      await ref.create(receipt);
      return "created";
    },
  };
}

export function sandboxSecretSeparate(env: NodeJS.ProcessEnv): { live: string; sandbox: string } | "same-secret" | "missing-live" {
  const live = env.BACHS_WEBHOOK_SECRET?.trim() ?? "";
  const sandbox = env.BACHS_SANDBOX_WEBHOOK_SECRET?.trim() ?? "";
  if (!live) return "missing-live";
  if (sandbox && sandbox === live) return "same-secret";
  return { live, sandbox };
}

/**
 * Accepts one sandbox-signed event after the payment is read from the sandbox API.
 * A production publishing or domain product id is rejected.
 */
export async function recordSandboxWebhook(input: {
  event: WebhookEvent;
  env: NodeJS.ProcessEnv;
  now?: Date;
  store: SandboxReceiptStore;
  getPayment?: (paymentId: string) => Promise<SandboxPaymentRecord | null>;
}): Promise<"recorded" | "duplicate" | "mismatch" | "unavailable"> {
  const data = input.event.data;
  const reference = text(data, "reference") ?? "";
  const eventAmount = text(data, "amount");
  const eventCurrency = text(data, "currency");
  const eventProduct = text(data, "product_id");
  const eventStatus = text(data, "status");
  const paymentId = text(data, "charge_id") ?? text(data, "payment_id");
  let amount = eventAmount;
  let currency = eventCurrency;
  let productId = eventProduct;
  let status = eventStatus;
  if (input.event.type === "collection.succeeded") {
    if (!paymentId) return "mismatch";
    const key = input.env.BACHS_SANDBOX_API_KEY?.trim() ?? "";
    const getter = input.getPayment ?? (key.startsWith("sk_sandbox_") && key !== input.env.BACHS_API_KEY?.trim()
      ? (id: string) => sandboxPayment(key, id)
      : null);
    if (!getter) return "unavailable";
    let payment: SandboxPaymentRecord | null;
    try {
      payment = await getter(paymentId);
    } catch {
      return "unavailable";
    }
    if (!payment || payment.payment_id !== paymentId) return "mismatch";
    if (payment.currency !== "NGN" || payment.status !== "succeeded" || payment.amount !== eventAmount) return "mismatch";
    if (eventCurrency && payment.currency !== eventCurrency) return "mismatch";
    if (payment.reference !== reference) return "mismatch";
    if (!payment.product_id || (eventProduct && payment.product_id !== eventProduct)) return "mismatch";
    const livePublishing = input.env.BACHS_PUBLISHING_PRODUCT_ID?.trim() ?? "";
    const liveDomain = input.env.BACHS_DOMAIN_PRODUCT_ID?.trim() ?? "";
    if (payment.product_id === livePublishing || payment.product_id === liveDomain) return "mismatch";
    const kind = purpose(reference);
    if (kind === "publishing" && payment.product_id !== BACHS_SANDBOX_PRODUCT_ID) return "mismatch";
    if (kind === "domain") {
      const sandboxDomain = input.env.BACHS_SANDBOX_DOMAIN_PRODUCT_ID?.trim() ?? "";
      if (!sandboxDomain || payment.product_id !== sandboxDomain) return "mismatch";
    }
    amount = payment.amount ?? null;
    currency = payment.currency ?? null;
    productId = payment.product_id;
    status = payment.status ?? null;
  }
  const receipt: SandboxReceipt = {
    eventId: input.event.id,
    type: input.event.type,
    reference,
    purpose: purpose(reference),
    paymentId,
    amount,
    currency,
    productId,
    status,
    environment: "sandbox",
    fulfilment: "not-run",
    receivedAt: (input.now ?? new Date()).toISOString(),
  };
  const existing = await input.store.read(input.event.id);
  if (existing) return sameReceipt(existing, receipt) ? "duplicate" : "mismatch";
  await input.store.save(receipt);
  return "recorded";
}

async function sandboxPayment(key: string, paymentId: string): Promise<SandboxPaymentRecord | null> {
  const response = await fetch(`https://sandbox-api.bachs.io/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
  });
  if (response.status >= 500) throw new Error("unavailable");
  if (!response.ok) return null;
  return await response.json() as SandboxPaymentRecord;
}
