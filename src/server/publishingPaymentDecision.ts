/**
 * Pure publishing-payment decisions.
 * The base price is the existing ₦10,000 constant. Applicable tax is added
 * only from an approved server configuration. Bachs processing fees are not
 * part of the customer total. This module does not call Bachs, write payments,
 * or grant entitlements.
 */
import { PUBLISHING_PRICE_AMOUNT, PUBLISHING_PRICE_CURRENCY } from "../lib/publishingEntitlement";

const approvedTax = Symbol("approved-publishing-tax");

/** Whole naira. Customer payment is this base plus any approved tax. */
export const PUBLISHING_BASE_AMOUNT = PUBLISHING_PRICE_AMOUNT;

export type PublishingTaxConfiguration =
  | { applicable: false }
  | {
      applicable: true;
      name: "VAT";
      rateNumerator: number;
      rateDenominator: number;
    };

export type ApprovedPublishingTax = PublishingTaxConfiguration & {
  readonly [approvedTax]: true;
};

export type PublishingPriceQuote = {
  currency: typeof PUBLISHING_PRICE_CURRENCY;
  baseAmount: string;
  taxName: "VAT" | null;
  taxAmount: string;
  expectedCustomerAmount: string;
  processingFeeIncluded: false;
};

export type RetrievedPublishingCharge = {
  chargeId: string | null;
  checkoutId: string | null;
  status: string;
  currency: string;
  amount: string;
  amountPaid: string | null;
  settlementAmount: string | null;
  processingFee: string | null;
  billingReason: string | null;
};

export type BoundPublishingCheckout = {
  checkoutId: string;
  ownerId: string;
  portfolioId: string;
  productId: string;
  quantity: 1;
};

export type PublishingPaymentDecision =
  | {
      action: "grant";
      ownerId: string;
      portfolioId: string;
      baseAmount: string;
      taxAmount: string;
      expectedCustomerAmount: string;
    }
  | {
      action: "ignore";
      reason:
        | "unapproved-tax"
        | "invalid-tax"
        | "missing-charge"
        | "status"
        | "currency"
        | "amount"
        | "billing-reason"
        | "unbound-checkout"
        | "prior-refund";
      expectedCustomerAmount: string | null;
    };

export type PublishingRefundDecision =
  | { action: "revoke"; expectedCustomerAmount: string }
  | {
      action: "keep";
      reason: "unapproved-tax" | "invalid-tax" | "processing" | "failed" | "partial" | "amount-mismatch" | "not-refunded";
      expectedCustomerAmount: string | null;
    };

/**
 * Tax stays off until a later server-owned configuration approves a rate.
 * The argument is discarded so a client payload cannot set the rate.
 */
export function serverPublishingTaxConfiguration(_clientSubmitted?: unknown): ApprovedPublishingTax {
  return brandTax({ applicable: false });
}

export function approvePublishingTax(configuration: PublishingTaxConfiguration): ApprovedPublishingTax | null {
  if (!isValidTaxConfiguration(configuration)) return null;
  return brandTax(configuration);
}

export function serverPublishingPriceQuote(clientSubmitted?: unknown): PublishingPriceQuote {
  void clientSubmitted;
  const quote = quotePublishingPayment(serverPublishingTaxConfiguration());
  if (quote.ok === false) throw new Error("The default publishing price is not configured.");
  return quote.quote;
}

/** True only for tax this server approved. A client-shaped object is not approved. */
export function isApprovedPublishingTax(value: unknown): value is ApprovedPublishingTax {
  return isApprovedTax(value);
}

export function quotePublishingPayment(
  tax: ApprovedPublishingTax,
): { ok: true; quote: PublishingPriceQuote } | { ok: false; reason: "unapproved-tax" | "invalid-tax" } {
  if (!isApprovedPublishingTax(tax)) return { ok: false, reason: "unapproved-tax" };
  const parts = priceParts(tax);
  if (parts === null) return { ok: false, reason: "invalid-tax" };
  return {
    ok: true,
    quote: {
      currency: PUBLISHING_PRICE_CURRENCY,
      baseAmount: formatKobo(parts.baseKobo),
      taxName: tax.applicable ? "VAT" : null,
      taxAmount: formatKobo(parts.taxKobo),
      expectedCustomerAmount: formatKobo(parts.expectedKobo),
      processingFeeIncluded: false,
    },
  };
}

export function decidePublishingCharge(input: {
  tax: ApprovedPublishingTax;
  charge: RetrievedPublishingCharge;
  checkout: BoundPublishingCheckout | null;
  priorFullRefund: boolean;
}): PublishingPaymentDecision {
  const quoted = quotePublishingPayment(input.tax);
  if (quoted.ok === false) {
    return { action: "ignore", reason: quoted.reason, expectedCustomerAmount: null };
  }
  const expected = quoted.quote.expectedCustomerAmount;
  const charge = input.charge;
  if (!charge.chargeId) return ignore("missing-charge", expected);
  if (charge.status !== "succeeded") return ignore("status", expected);
  if (charge.currency !== PUBLISHING_PRICE_CURRENCY) return ignore("currency", expected);
  if (charge.amount !== expected || charge.amountPaid !== expected) return ignore("amount", expected);
  if (charge.settlementAmount !== null) {
    const settlementCompared = compareMoney(charge.settlementAmount, expected);
    if (!Number.isFinite(settlementCompared) || settlementCompared > 0) return ignore("amount", expected);
  }
  if (charge.billingReason !== "purchase") return ignore("billing-reason", expected);
  if (input.priorFullRefund) return ignore("prior-refund", expected);
  const checkout = input.checkout;
  if (!checkout || checkout.checkoutId !== charge.checkoutId || checkout.quantity !== 1) {
    return ignore("unbound-checkout", expected);
  }
  if (!checkout.ownerId.trim() || !checkout.portfolioId.trim()) {
    return ignore("unbound-checkout", expected);
  }
  return {
    action: "grant",
    ownerId: checkout.ownerId,
    portfolioId: checkout.portfolioId,
    baseAmount: quoted.quote.baseAmount,
    taxAmount: quoted.quote.taxAmount,
    expectedCustomerAmount: expected,
  };
}

/** A request from the customer is not a completed reversal and does not change publishing access. */
export function customerRefundRequestChangesEntitlement(): false {
  return false;
}

export function decidePublishingRefund(input: {
  tax: ApprovedPublishingTax;
  paymentStatus: string;
  refundStatus: string;
  requestedAmount: string | null;
}): PublishingRefundDecision {
  const quoted = quotePublishingPayment(input.tax);
  if (quoted.ok === false) {
    return { action: "keep", reason: quoted.reason, expectedCustomerAmount: null };
  }
  const expected = quoted.quote.expectedCustomerAmount;
  if (input.refundStatus === "processing") return { action: "keep", reason: "processing", expectedCustomerAmount: expected };
  if (input.refundStatus === "failed") return { action: "keep", reason: "failed", expectedCustomerAmount: expected };
  if (input.paymentStatus === "partially_refunded") {
    return { action: "keep", reason: "partial", expectedCustomerAmount: expected };
  }
  const refundCompleted = input.refundStatus === "success" || input.refundStatus === "paid";
  const fullyRefunded = input.paymentStatus === "refunded" || input.paymentStatus === "auto_refunded";
  if (!refundCompleted || !fullyRefunded) {
    return { action: "keep", reason: "not-refunded", expectedCustomerAmount: expected };
  }
  if (input.requestedAmount !== expected) {
    return { action: "keep", reason: "amount-mismatch", expectedCustomerAmount: expected };
  }
  return { action: "revoke", expectedCustomerAmount: expected };
}

function ignore(reason: Extract<PublishingPaymentDecision, { action: "ignore" }>["reason"], expected: string): PublishingPaymentDecision {
  return { action: "ignore", reason, expectedCustomerAmount: expected };
}

function brandTax(configuration: PublishingTaxConfiguration): ApprovedPublishingTax {
  return { ...configuration, [approvedTax]: true };
}

function isApprovedTax(value: unknown): value is ApprovedPublishingTax {
  return Boolean(value) && typeof value === "object" && (value as { [approvedTax]?: unknown })[approvedTax] === true;
}

function isValidTaxConfiguration(configuration: PublishingTaxConfiguration): boolean {
  if (configuration.applicable === false) return true;
  if (configuration.applicable !== true || configuration.name !== "VAT") return false;
  return safeRate(configuration.rateNumerator, configuration.rateDenominator);
}

function priceParts(tax: ApprovedPublishingTax): { baseKobo: number; taxKobo: number; expectedKobo: number } | null {
  const baseKobo = PUBLISHING_BASE_AMOUNT * 100;
  if (!Number.isSafeInteger(baseKobo)) return null;
  if (tax.applicable === false) {
    return { baseKobo, taxKobo: 0, expectedKobo: baseKobo };
  }
  if (!safeRate(tax.rateNumerator, tax.rateDenominator)) return null;
  const product = baseKobo * tax.rateNumerator;
  if (!Number.isSafeInteger(product)) return null;
  const taxKobo = roundDivHalfUp(product, tax.rateDenominator);
  const expectedKobo = baseKobo + taxKobo;
  if (!Number.isSafeInteger(expectedKobo)) return null;
  return { baseKobo, taxKobo, expectedKobo };
}

function safeRate(numerator: number, denominator: number): boolean {
  return Number.isSafeInteger(numerator)
    && Number.isSafeInteger(denominator)
    && numerator >= 0
    && denominator > 0;
}

/** Positive integer division, half up. */
function roundDivHalfUp(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

function formatKobo(kobo: number): string {
  const whole = Math.floor(kobo / 100);
  const fraction = kobo % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

function compareMoney(left: string, right: string): number {
  const parsedLeft = parseKobo(left);
  const parsedRight = parseKobo(right);
  if (parsedLeft === null || parsedRight === null) return Number.NaN;
  return parsedLeft - parsedRight;
}

function parseKobo(value: string): number | null {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) return null;
  const kobo = Number(match[1]) * 100 + Number(match[2]);
  return Number.isSafeInteger(kobo) ? kobo : null;
}
