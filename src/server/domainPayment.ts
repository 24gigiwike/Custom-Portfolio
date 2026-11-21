/**
 * Domain checkout is a separate payment from annual publishing.
 * A return URL does not register a domain. The publishing product id is never reused.
 * No domain product id is invented here. Checkout stays unavailable until one is configured.
 */
import type { CheckoutCartItem } from "@bachs/sdk";
import { BACHS_SANDBOX_PRODUCT_ID } from "./bachsRuntime";
import { PRODUCTION_FIREBASE_PROJECT_ID, STAGING_FIREBASE_PROJECT_ID } from "../lib/firebaseEnvironment";
import { domainFirestore, firestoreDomainStore, type DomainRecordSet } from "./domainRecords";

export const BACHS_DOMAIN_PRODUCT_ENV = "BACHS_DOMAIN_PRODUCT_ID";
export const DOMAIN_PAYMENT_PURPOSE = "domain-registration";

export function readDomainProductId(env: NodeJS.ProcessEnv): string | null {
  const productId = env[BACHS_DOMAIN_PRODUCT_ENV]?.trim() ?? "";
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) return null;
  if (productId === BACHS_SANDBOX_PRODUCT_ID) return null;
  const publishing = env.BACHS_PUBLISHING_PRODUCT_ID?.trim() ?? "";
  if (publishing && productId === publishing) return null;
  return productId;
}

export function domainCheckoutReadiness(env: NodeJS.ProcessEnv): { ready: boolean; missing: string[] } {
  return readDomainProductId(env)
    ? { ready: true, missing: [] }
    : { ready: false, missing: [BACHS_DOMAIN_PRODUCT_ENV] };
}

export function sandboxFirestoreBlocked(env: NodeJS.ProcessEnv): boolean {
  const sandbox = (env.BACHS_API_KEY ?? "").trim().startsWith("sk_sandbox_");
  if (!sandbox) return false;
  const project = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  if (project === PRODUCTION_FIREBASE_PROJECT_ID || project === STAGING_FIREBASE_PROJECT_ID) return true;
  return !env.FIRESTORE_EMULATOR_HOST?.trim().startsWith("127.0.0.1:");
}

export function domainPaymentReference(orderId: string, paymentId: string): string {
  return `domain:${orderId}:${paymentId}`;
}

export function parseDomainPaymentReference(reference: string): { orderId: string; paymentId: string } | null {
  const match = /^domain:([A-Za-z0-9_-]{4,80}):([A-Za-z0-9_-]{4,80})$/.exec(reference);
  if (!match) return null;
  return { orderId: match[1] ?? "", paymentId: match[2] ?? "" };
}

export type DomainPaymentResult =
  | { kind: "verified" | "duplicate" }
  | { kind: "rejected"; reason: "publishing-payment" | "mismatch" | "missing-order" };

/** Marks a stored order paid. It does not call the registrar. */
export function markDomainPaymentVerified(input: {
  records: DomainRecordSet | null;
  purpose: string;
  reference: string;
  paymentId: string;
  at: string;
}): { records: DomainRecordSet | null; result: DomainPaymentResult } {
  if (input.purpose !== DOMAIN_PAYMENT_PURPOSE || input.reference.startsWith("publishing:")) {
    return { records: input.records, result: { kind: "rejected", reason: "publishing-payment" } };
  }
  const parsed = parseDomainPaymentReference(input.reference);
  if (!input.records || !parsed || parsed.orderId !== input.records.order.orderId || parsed.paymentId !== input.paymentId) {
    return { records: input.records, result: { kind: "rejected", reason: input.records ? "mismatch" : "missing-order" } };
  }
  if (input.records.order.paymentStatus === "verified" && input.records.order.paymentId === input.paymentId) {
    return { records: input.records, result: { kind: "duplicate" } };
  }
  const next: DomainRecordSet = {
    ...input.records,
    order: { ...input.records.order, paymentStatus: "verified", paymentId: input.paymentId },
    events: [...input.records.events, { orderId: input.records.order.orderId, at: input.at, kind: "payment-verified", code: input.paymentId }],
  };
  return { records: next, result: { kind: "verified" } };
}

/**
 * Bachs charges a one-off amount with product_cart[].pricing.
 * The documented shape is price_type "fixed" and pricing.amount, in the
 * product's primary currency. The line-item amount field is not sent:
 * Bachs rejects that field on a fixed catalog price.
 * A pay-what-you-want price is not used, because the buyer could change it.
 * A product-less checkout is not used, because it would drop the domain product.
 */
export function domainCheckoutCart(productId: string, amount: string): CheckoutCartItem | null {
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) return null;
  if (!/^\d+\.\d{2}$/.test(amount)) return null;
  const major = Number(amount);
  if (!Number.isFinite(major) || major < 100) return null;
  return { product_id: productId, quantity: 1, pricing: { price_type: "fixed", amount } };
}

export function domainCheckoutEchoMatches(input: {
  orderAmount: string;
  reference: string;
  session: { amount?: string; currency?: string; reference?: string | null };
}): boolean {
  return input.session.amount === input.orderAmount
    && input.session.currency === "NGN"
    && input.session.reference === input.reference;
}

/** Adds the domain purpose to a validated return URL. The stored URL itself stays unchanged. */
export function domainCheckoutReturnUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  url.searchParams.set("purpose", DOMAIN_PAYMENT_PURPOSE);
  return url.toString();
}

export function domainChargeCurrency(currency: string): "NGN" | null {
  return currency === "NGN" ? "NGN" : null;
}

function moneyCents(value: string | null): number | null {
  if (!value || !/^\d+\.\d{2}$/.test(value)) return null;
  const [whole, fraction] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

export type DomainCollectionDecision =
  | "verify"
  | "duplicate"
  | "underpaid"
  | "overpaid"
  | "currency"
  | "failed"
  | "wrong-product"
  | "publishing"
  | "hold"
  | "refund";

export function decideDomainCollection(input: {
  eventType: string;
  purpose: string | null;
  productId: string | null;
  currency: string | null;
  amount: string | null;
  amountPaid: string | null;
  status: string | null;
  configuredProductId: string | null;
  publishingProductId: string | null;
  orderAmount: string | null;
  orderCurrency: string | null;
  alreadyVerified: boolean;
}): DomainCollectionDecision {
  if (input.eventType === "refund.paid" || input.eventType === "refund.created" || input.eventType === "refund.failed") return "refund";
  if (input.purpose === "annual-publishing" || (input.publishingProductId !== null && input.productId === input.publishingProductId)) return "publishing";
  if (input.eventType !== "collection.succeeded") return "failed";
  if (!input.configuredProductId || input.productId !== input.configuredProductId) return "wrong-product";
  if (input.status !== "succeeded") return "failed";
  if (input.currency !== "NGN" || input.orderCurrency !== "NGN") return "currency";
  const expected = moneyCents(input.orderAmount);
  const charged = moneyCents(input.amount);
  const paid = moneyCents(input.amountPaid);
  if (expected === null || charged === null || paid === null) return "hold";
  if (charged !== expected || paid !== expected) return charged > expected || paid > expected ? "overpaid" : "underpaid";
  if (input.alreadyVerified) return "duplicate";
  return "verify";
}

function textField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export async function settleStoredDomainPayment(event: { type?: string; data?: unknown }, env: NodeJS.ProcessEnv): Promise<"verified" | "duplicate" | "held" | "unavailable"> {
  if (sandboxFirestoreBlocked(env)) return "unavailable";
  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const nested = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : {};
  const reference = textField(data, "reference") ?? textField(nested, "reference") ?? "";
  const parsed = parseDomainPaymentReference(reference);
  const db = await domainFirestore(env);
  if (!parsed || !db) return "unavailable";
  const line = Array.isArray(data.line_items) ? data.line_items[0] : null;
  const lineProduct = line && typeof line === "object" ? textField(line as Record<string, unknown>, "product_id") : null;
  const store = firestoreDomainStore(db);
  const current = await store.read(parsed.orderId, { role: "server" });
  const decision = decideDomainCollection({
    eventType: event.type ?? "",
    purpose: textField(data, "purpose") ?? textField(nested, "purpose"),
    productId: textField(data, "product_id") ?? lineProduct,
    currency: textField(data, "currency"),
    amount: textField(data, "amount"),
    amountPaid: textField(data, "amount_paid"),
    status: textField(data, "status"),
    configuredProductId: readDomainProductId(env),
    publishingProductId: env.BACHS_PUBLISHING_PRODUCT_ID?.trim() || null,
    orderAmount: current?.order.customerAmount ?? null,
    orderCurrency: current?.order.currency ?? null,
    alreadyVerified: current?.order.paymentStatus === "verified" && current.order.paymentId === parsed.paymentId,
  });
  if (decision === "verify") {
    const marked = markDomainPaymentVerified({
      records: current,
      purpose: DOMAIN_PAYMENT_PURPOSE,
      reference,
      paymentId: parsed.paymentId,
      at: new Date().toISOString(),
    });
    if (marked.records && marked.result.kind !== "rejected") {
      await store.save(marked.records, { role: "server" });
      return marked.result.kind;
    }
  }
  if (decision === "duplicate") return "duplicate";
  await db.collection("domainPaymentHolds").doc(parsed.paymentId).set({
    paymentId: parsed.paymentId,
    reference,
    status: decision,
    at: new Date().toISOString(),
  });
  return "held";
}
