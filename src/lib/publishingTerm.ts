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

/** Firestore Timestamp millis. Strings and other values are not a timestamp. */
export function firestoreExpiryMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const stamp = value as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: unknown;
    nanoseconds?: unknown;
    _seconds?: unknown;
    _nanoseconds?: unknown;
  };
  if (typeof stamp.toMillis === "function") {
    const millis = stamp.toMillis();
    if (typeof millis === "number" && Number.isFinite(millis)) return millis;
  }
  if (typeof stamp.toDate === "function") {
    const date = stamp.toDate();
    const millis = date instanceof Date ? date.getTime() : Number.NaN;
    if (Number.isFinite(millis)) return millis;
  }
  const seconds = typeof stamp.seconds === "number"
    ? stamp.seconds
    : typeof stamp._seconds === "number"
      ? stamp._seconds
      : null;
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const nanos = typeof stamp.nanoseconds === "number"
    ? stamp.nanoseconds
    : typeof stamp._nanoseconds === "number"
      ? stamp._nanoseconds
      : 0;
  if (!Number.isFinite(nanos)) return null;
  return Math.trunc(seconds * 1000 + nanos / 1e6);
}

function activePortfolioRecord(record: unknown, uid: string, portfolioId: string): Record<string, unknown> | null {
  if (!record || typeof record !== "object") return null;
  const data = record as Record<string, unknown>;
  if (data.uid !== uid || data.portfolioId !== portfolioId || data.status !== "active") return null;
  return data;
}

/**
 * An active portfolio entitlement with no expiresAt field stays valid.
 * A Firestore Timestamp is compared with the supplied instant.
 * Null, a string, or any other value does not authorize publication.
 * Another portfolio's record does not grant this portfolio.
 */
export function classifyPortfolioPublishingAccess(input: {
  uid: string;
  portfolioId: string;
  record: unknown;
  now: Date;
}): PublishingAccess {
  const data = activePortfolioRecord(input.record, input.uid, input.portfolioId);
  if (!data) return "payment-required";
  if (!Object.prototype.hasOwnProperty.call(data, "expiresAt")) return "entitled";
  const millis = firestoreExpiryMillis(data.expiresAt);
  if (millis == null) return "renewal-required";
  return millis > input.now.getTime() ? "entitled" : "renewal-required";
}

/**
 * Whether the client may attempt a new publication.
 * A Firestore Timestamp is left to security rules and request.time.
 * This function does not read the browser clock.
 */
export function publicationAttemptAccess(input: {
  uid: string;
  portfolioId: string;
  record: unknown;
}): PublishingAccess {
  const data = activePortfolioRecord(input.record, input.uid, input.portfolioId);
  if (!data) return "payment-required";
  if (!Object.prototype.hasOwnProperty.call(data, "expiresAt")) return "entitled";
  if (firestoreExpiryMillis(data.expiresAt) == null) return "renewal-required";
  return "entitled";
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
