/**
 * Opens one Bachs checkout for one portfolio.
 * The price, product, and return URLs come from the server.
 * A return URL does not grant publishing. This module does not write an entitlement.
 */
import type { Firestore } from "firebase-admin/firestore";
import type { CreateCheckoutSessionRequest } from "@bachs/sdk";
import { serverPublishingPriceQuote } from "./publishingPaymentDecision";
import { publishingCheckoutEligibility } from "../lib/publishingTerm";
import { firebaseRuntime } from "../lib/firebaseEnvironment";
import { assertBachsApiKeyForRuntime, assertBachsProductForRuntime, BachsRuntimeError } from "./bachsRuntime";

export const PUBLISHING_CHECKOUT_COLLECTION = "publishingCheckoutAttempts";
export const PUBLISHING_SUCCESS_URL_ENV = "BACHS_PUBLISHING_SUCCESS_URL";
export const PUBLISHING_CANCEL_URL_ENV = "BACHS_PUBLISHING_CANCEL_URL";

const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PORTFOLIO_ID = /^[A-Za-z0-9]{10,80}$/;

export type PublishingCheckoutAttempt = {
  portfolioId: string;
  uid: string;
  attemptId: string;
  reference: string;
  idempotencyKey: string;
  productId: string;
  quantity: 1;
  currency: "NGN";
  baseAmount: string;
  taxAmount: string;
  expectedCustomerAmount: string;
  successUrl: string;
  cancelUrl: string;
  status: "creating" | "open" | "uncertain";
  checkoutId: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  createdAt: string;
  renewalBasis: "extend" | "fresh";
  anchoredExpiresAt: string | null;
  initiatedAt: string;
  ledgerEnvironment: "production" | "preview" | "local";
};

export type PublishingCheckoutStore = {
  mutate(
    portfolioId: string,
    change: (current: PublishingCheckoutAttempt | null) => PublishingCheckoutAttempt | null,
  ): Promise<PublishingCheckoutAttempt | null>;
};

export class PublishingCheckoutGatewayError extends Error {
  readonly outcomeUnknown: boolean;
  readonly statusCode: number | null;

  constructor(message: string, outcomeUnknown: boolean, statusCode: number | null = null) {
    super(message);
    this.name = "PublishingCheckoutGatewayError";
    this.outcomeUnknown = outcomeUnknown;
    this.statusCode = statusCode;
  }
}

export type PublishingCheckoutResult = {
  status: number;
  body: Record<string, unknown>;
};

type PortfolioRecord = { ownerId: string; selectedTemplate: string } | null;

type ProductRecord = {
  id?: string;
  price?: { currency?: string; amount?: string; price_type?: string };
  billing_cycle?: { interval?: string; frequency?: number } | null;
  status?: string;
  archived_at?: string | null;
};

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Public https URL only. Localhost, private addresses, and credentials are rejected. */
export function publishingReturnUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:" || url.username || url.password || isPrivateHost(url.hostname)) return "invalid";
  return null;
}

export function readPublishingReturnUrls(env: NodeJS.ProcessEnv):
  | { ok: true; successUrl: string; cancelUrl: string }
  | { ok: false; missing: string[]; invalid: string[] } {
  const names = [PUBLISHING_SUCCESS_URL_ENV, PUBLISHING_CANCEL_URL_ENV] as const;
  const missing = names.filter((name) => !(env[name]?.trim()));
  const invalid = names.filter((name) => {
    const value = env[name]?.trim() ?? "";
    return value !== "" && publishingReturnUrlProblem(value) !== null;
  });
  if (missing.length > 0 || invalid.length > 0) return { ok: false, missing, invalid };
  return {
    ok: true,
    successUrl: env[PUBLISHING_SUCCESS_URL_ENV]!.trim(),
    cancelUrl: env[PUBLISHING_CANCEL_URL_ENV]!.trim(),
  };
}

function pending(attempt: PublishingCheckoutAttempt, now: Date): boolean {
  return Date.parse(attempt.expiresAt) > now.getTime();
}

function checkoutRequest(attempt: PublishingCheckoutAttempt): CreateCheckoutSessionRequest {
  return {
    product_cart: [{ product_id: attempt.productId, quantity: 1 }],
    billing_currency: "NGN",
    payment_method_types: ["NGN_CARD", "NGN_BANK_TRANSFER"],
    success_url: attempt.successUrl,
    cancel_url: attempt.cancelUrl,
    reference: attempt.reference,
    metadata: {
      uid: attempt.uid,
      portfolioId: attempt.portfolioId,
      purpose: "annual-publishing",
    },
    expires_in_minutes: 60,
  };
}

function productMatches(product: ProductRecord, productId: string, amount: string): boolean {
  return product.id === productId
    && product.price?.currency === "NGN"
    && product.price.amount === amount
    && (product.price.price_type === undefined || product.price.price_type === "fixed")
    && (product.billing_cycle == null)
    && (product.archived_at == null)
    && (product.status === undefined || product.status === "active");
}

function checkoutBody(attempt: PublishingCheckoutAttempt, purpose: "publish" | "renew"): PublishingCheckoutResult {
  if (!attempt.checkoutId || !attempt.checkoutUrl?.startsWith("https://")) {
    return { status: 502, body: { error: "The payment page could not be opened.", code: "checkout-failed" } };
  }
  return {
    status: 200,
    body: {
      outcome: "checkout",
      purpose,
      checkoutId: attempt.checkoutId,
      checkoutUrl: attempt.checkoutUrl,
    },
  };
}

export async function executePublishingCheckout(input: {
  uid: string;
  body: unknown;
  env: NodeJS.ProcessEnv;
  now: Date;
  loadPortfolio: (portfolioId: string) => Promise<PortfolioRecord>;
  loadEntitlement: (portfolioId: string) => Promise<unknown>;
  store: PublishingCheckoutStore;
  getProduct: (productId: string) => Promise<ProductRecord>;
  createCheckout: (request: CreateCheckoutSessionRequest, idempotencyKey: string) => Promise<{ checkout_id: string; checkout_url: string; expires_at?: string }>;
}): Promise<PublishingCheckoutResult> {
  const quote = serverPublishingPriceQuote(input.body);
  const body = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : null;
  const portfolioId = typeof body?.portfolioId === "string" ? body.portfolioId.trim() : "";
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
  if (!PORTFOLIO_ID.test(portfolioId) || !ATTEMPT_ID.test(attemptId)) {
    return { status: 400, body: { error: "The publishing request is not valid.", code: "invalid-request" } };
  }

  const portfolio = await input.loadPortfolio(portfolioId);
  if (!portfolio) return { status: 404, body: { error: "That portfolio could not be found.", code: "missing" } };
  if (portfolio.ownerId !== input.uid) {
    return { status: 403, body: { error: "You don't have permission to publish this portfolio.", code: "wrong-owner" } };
  }
  if (!portfolio.selectedTemplate.trim()) {
    return { status: 409, body: { error: "Choose a template before publishing this portfolio.", code: "choose-template" } };
  }

  const entitlement = await input.loadEntitlement(portfolioId);
  const eligibility = publishingCheckoutEligibility({ record: entitlement, now: input.now });
  if (!eligibility.allowed) return { status: 200, body: { outcome: "entitled" } };
  const purpose = eligibility.purpose;

  const urls = readPublishingReturnUrls(input.env);
  if (urls.ok === false) {
    return { status: 503, body: { error: "Publishing payment is not available right now.", code: "return-url", missing: urls.missing, invalid: urls.invalid } };
  }
  let productId = "";
  try {
    assertBachsApiKeyForRuntime(input.env);
    productId = assertBachsProductForRuntime(input.env);
  } catch (error) {
    if (error instanceof BachsRuntimeError) {
      return { status: 503, body: { error: "Publishing payment is not available right now.", code: "unavailable" } };
    }
    throw error;
  }

  let product: ProductRecord;
  try {
    product = await input.getProduct(productId);
  } catch (error) {
    if (error instanceof PublishingCheckoutGatewayError && error.outcomeUnknown) {
      return { status: 503, body: { error: "Publishing payment is not available right now.", code: "product-uncertain" } };
    }
    return { status: 502, body: { error: "Publishing payment is not available right now.", code: "product-unavailable" } };
  }
  if (!productMatches(product, productId, quote.expectedCustomerAmount)) {
    return { status: 503, body: { error: "Publishing payment is not available right now.", code: "product-mismatch" } };
  }

  const createdAt = input.now.toISOString();
  const draft: PublishingCheckoutAttempt = {
    portfolioId,
    uid: input.uid,
    attemptId,
    reference: `publishing:${portfolioId}:${attemptId}`,
    idempotencyKey: `publishing-checkout:${portfolioId}:${attemptId}`,
    productId,
    quantity: 1,
    currency: quote.currency,
    baseAmount: quote.baseAmount,
    taxAmount: quote.taxAmount,
    expectedCustomerAmount: quote.expectedCustomerAmount,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
    status: "creating",
    checkoutId: null,
    checkoutUrl: null,
    expiresAt: new Date(input.now.getTime() + 60 * 60 * 1000).toISOString(),
    createdAt,
    renewalBasis: eligibility.renewalBasis,
    anchoredExpiresAt: eligibility.anchoredExpiresAt,
    initiatedAt: createdAt,
    ledgerEnvironment: firebaseRuntime(input.env),
  };
  if (draft.reference.length > 128 || draft.idempotencyKey.length > 128) {
    return { status: 400, body: { error: "The publishing request is not valid.", code: "invalid-request" } };
  }

  const stored = await input.store.mutate(portfolioId, (current) => {
    if (!current || !pending(current, input.now)) return draft;
    if (current.uid !== input.uid || current.portfolioId !== portfolioId) return current;
    return current;
  });
  if (!stored || stored.portfolioId !== portfolioId || stored.uid !== input.uid) {
    return { status: 409, body: { error: "A payment is already open for this portfolio.", code: "checkout-pending" } };
  }
  if (stored.attemptId !== attemptId) {
    if (stored.status === "open" && stored.checkoutUrl) return checkoutBody(stored, purpose);
    return { status: 409, body: { error: "A payment is already open for this portfolio.", code: "checkout-pending" } };
  }
  if (stored.status === "open" && stored.checkoutUrl) return checkoutBody(stored, purpose);

  let created: { checkout_id: string; checkout_url: string; expires_at?: string };
  try {
    created = await input.createCheckout(checkoutRequest(stored), stored.idempotencyKey);
  } catch (error) {
    const uncertain = error instanceof PublishingCheckoutGatewayError && error.outcomeUnknown;
    await input.store.mutate(portfolioId, (current) => {
      if (!current || current.attemptId !== attemptId) return current;
      return { ...current, status: uncertain ? "uncertain" : "creating" };
    });
    return {
      status: uncertain ? 503 : 502,
      body: { error: "The payment page could not be opened.", code: uncertain ? "checkout-uncertain" : "checkout-failed" },
    };
  }
  if (!created.checkout_id || !created.checkout_url.startsWith("https://")) {
    return { status: 502, body: { error: "The payment page could not be opened.", code: "checkout-failed" } };
  }
  const opened = await input.store.mutate(portfolioId, (current) => {
    if (!current || current.attemptId !== attemptId || current.portfolioId !== portfolioId) return current;
    return {
      ...current,
      status: "open",
      checkoutId: created.checkout_id,
      checkoutUrl: created.checkout_url,
      expiresAt: created.expires_at && !Number.isNaN(Date.parse(created.expires_at)) ? created.expires_at : current.expiresAt,
    };
  });
  if (!opened) return { status: 502, body: { error: "The payment page could not be opened.", code: "checkout-failed" } };
  return checkoutBody(opened, purpose);
}

export function memoryPublishingCheckoutStore(): PublishingCheckoutStore {
  const docs = new Map<string, PublishingCheckoutAttempt>();
  return {
    async mutate(portfolioId, change) {
      const current = docs.get(portfolioId) ?? null;
      const next = change(current);
      if (!next) {
        docs.delete(portfolioId);
        return null;
      }
      if (next.portfolioId !== portfolioId) return current;
      if (current && current.attemptId !== next.attemptId) {
        const prior = docs.get(`${portfolioId}/attempts/${current.attemptId}`) ?? current;
        docs.set(`${portfolioId}/attempts/${current.attemptId}`, prior);
      }
      docs.set(portfolioId, next);
      return next;
    },
  };
}

export function firestorePublishingCheckoutStore(db: Firestore): PublishingCheckoutStore {
  return {
    async mutate(portfolioId, change) {
      const ref = db.collection(PUBLISHING_CHECKOUT_COLLECTION).doc(portfolioId);
      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.exists ? snap.data() as PublishingCheckoutAttempt : null;
        const next = change(current);
        if (!next) {
          transaction.delete(ref);
          return null;
        }
        if (next.portfolioId !== portfolioId) return current;
        if (current && current.attemptId !== next.attemptId) {
          transaction.set(ref.collection("attempts").doc(current.attemptId), current);
        }
        transaction.set(ref, next);
        return next;
      });
    },
  };
}
