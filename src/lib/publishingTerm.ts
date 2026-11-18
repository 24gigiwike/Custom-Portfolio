/**
 * Twelve-month publishing period for one portfolio.
 * Bachs takes a one-time charge. This module decides the period and the
 * payment history. It does not call Bachs or write Firestore.
 *
 * Adding twelve months keeps the UTC calendar day and time. 29 February
 * moves to 28 February in the following year, because that year has no
 * 29 February. No other month changes length across a one-year step.
 */

export const PUBLISHING_TERM_MONTHS = 12;

export type PublishingAccess = "entitled" | "payment-required" | "renewal-required";

export type PublishingRenewalBasis = "first" | "early" | "late";

export type PublishingPaymentHistoryEntry = {
  paymentId: string;
  portfolioId: string;
  uid: string;
  verifiedAt: string;
  amount: string;
  currency: "NGN";
  providerReference: string;
};

const ACCESS_MESSAGES: Record<Exclude<PublishingAccess, "entitled">, string> = {
  "payment-required": "Publishing this portfolio requires the Annual Publishing plan.",
  "renewal-required": "This portfolio's publishing period has ended. Renew it to publish again.",
};

export function publishingAccessMessage(access: Exclude<PublishingAccess, "entitled">): string {
  return ACCESS_MESSAGES[access];
}

function instant(value: string): Date | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Twelve UTC months after an instant. 29 February lands on 28 February next year. */
export function addPublishingTerm(from: Date): Date {
  const year = from.getUTCFullYear() + 1;
  const month = from.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDay);
  return new Date(Date.UTC(
    year,
    month,
    day,
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  ));
}

/**
 * An active portfolio entitlement with no expiry stays valid.
 * Those records are the historical grants and are not rewritten here.
 * A stored expiry in the past requires renewal. Another portfolio's record
 * does not grant this portfolio.
 */
export function classifyPortfolioPublishingAccess(input: {
  uid: string;
  portfolioId: string;
  record: unknown;
  now: Date;
}): PublishingAccess {
  if (!input.record || typeof input.record !== "object") return "payment-required";
  const data = input.record as Record<string, unknown>;
  if (data.uid !== input.uid || data.portfolioId !== input.portfolioId || data.status !== "active") {
    return "payment-required";
  }
  if (!Object.prototype.hasOwnProperty.call(data, "expiresAt") || data.expiresAt == null) return "entitled";
  if (typeof data.expiresAt !== "string") return "renewal-required";
  const expiry = instant(data.expiresAt);
  if (!expiry) return "renewal-required";
  return expiry.getTime() > input.now.getTime() ? "entitled" : "renewal-required";
}

/**
 * First payment runs twelve months from the verified timestamp.
 * A payment verified while the current expiry is still ahead adds twelve
 * months to that expiry. A payment verified after expiry starts again from
 * the verified timestamp. The same payment id does not extend the period twice.
 * Earlier payment records stay in the returned history.
 */
export function planPublishingRenewal(input: {
  verifiedAt: string;
  currentExpiresAt: string | null;
  history: readonly PublishingPaymentHistoryEntry[];
  payment: PublishingPaymentHistoryEntry;
}): { basis: PublishingRenewalBasis; expiresAt: string; history: PublishingPaymentHistoryEntry[] } | { ok: false; reason: "invalid-timestamp" } {
  const verified = instant(input.verifiedAt);
  if (!verified || input.payment.verifiedAt !== input.verifiedAt) return { ok: false, reason: "invalid-timestamp" };
  const existing = input.history.find((entry) => entry.paymentId === input.payment.paymentId);
  if (existing) {
    const current = input.currentExpiresAt && instant(input.currentExpiresAt);
    return {
      basis: "first",
      expiresAt: current ? current.toISOString() : addPublishingTerm(verified).toISOString(),
      history: [...input.history],
    };
  }
  const current = input.currentExpiresAt ? instant(input.currentExpiresAt) : null;
  if (input.currentExpiresAt && !current) return { ok: false, reason: "invalid-timestamp" };
  const early = current !== null && current.getTime() > verified.getTime();
  const expiresAt = addPublishingTerm(early ? current : verified).toISOString();
  return {
    basis: early ? "early" : input.currentExpiresAt ? "late" : "first",
    expiresAt,
    history: [...input.history, input.payment],
  };
}
