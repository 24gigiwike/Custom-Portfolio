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
export const PUBLISHING_RENEWAL_WINDOW_DAYS = 7;
export const PUBLISHING_GRACE_PERIOD_DAYS = 7;
const PUBLISHING_WINDOW_MS = PUBLISHING_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type PublishingAccess = "entitled" | "payment-required" | "renewal-required";

export type PublishingRenewalBasis = "first" | "early" | "grace" | "late";

export type PublishingLifecyclePhase =
  | "none"
  | "grandfather"
  | "active"
  | "renewal-window"
  | "grace"
  | "lapsed"
  | "revoked";

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

export function renewalWindowOpensAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - PUBLISHING_WINDOW_MS);
}

export function gracePeriodEndsAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() + PUBLISHING_WINDOW_MS);
}

/** One current term. Renewal is closed until seven days before expiry. Public access lasts through the grace period. */
export function describePublishingLifecycle(input: {
  record: unknown;
  now: Date;
}): {
  phase: PublishingLifecyclePhase;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  renewalOpensAt: string | null;
} {
  if (!input.record || typeof input.record !== "object") {
    return { phase: "none", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null };
  }
  const data = input.record as Record<string, unknown>;
  if (data.status === "revoked") {
    return { phase: "revoked", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null };
  }
  if (data.status !== "active") {
    return { phase: "none", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null };
  }
  if (!Object.prototype.hasOwnProperty.call(data, "expiresAt")) {
    return { phase: "grandfather", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null };
  }
  const millis = firestoreExpiryMillis(data.expiresAt);
  if (millis == null) return { phase: "lapsed", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null };
  const expires = new Date(millis);
  const opens = renewalWindowOpensAt(expires);
  const graceEnds = gracePeriodEndsAt(expires);
  const now = input.now.getTime();
  const phase: PublishingLifecyclePhase = now < opens.getTime()
    ? "active"
    : now < expires.getTime()
      ? "renewal-window"
      : now < graceEnds.getTime()
        ? "grace"
        : "lapsed";
  return {
    phase,
    expiresAt: expires.toISOString(),
    gracePeriodEndsAt: graceEnds.toISOString(),
    renewalOpensAt: opens.toISOString(),
  };
}

/**
 * Checkout opens for a first purchase, the final seven days, the grace period,
 * and any time after grace. It stays closed while the current term has more than seven days left.
 */
export function publishingCheckoutEligibility(input: {
  record: unknown;
  now: Date;
}): { allowed: false; reason: "not-due" } | {
  allowed: true;
  purpose: "publish" | "renew";
  renewalBasis: "extend" | "fresh";
  anchoredExpiresAt: string | null;
} {
  const lifecycle = describePublishingLifecycle(input);
  if (lifecycle.phase === "grandfather" || lifecycle.phase === "active") {
    return { allowed: false, reason: "not-due" };
  }
  if (lifecycle.phase === "renewal-window" || lifecycle.phase === "grace") {
    return {
      allowed: true,
      purpose: "renew",
      renewalBasis: "extend",
      anchoredExpiresAt: lifecycle.expiresAt,
    };
  }
  return {
    allowed: true,
    purpose: lifecycle.phase === "none" ? "publish" : "renew",
    renewalBasis: "fresh",
    anchoredExpiresAt: null,
  };
}

export type PublishingDashboardNotice = {
  title: string;
  body: string;
  renewalAvailable: boolean;
  describesPublic: boolean;
};

function utcDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function daysUntil(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((Date.parse(iso) - now.getTime()) / 86_400_000));
}

/**
 * Customer-facing publishing state. A draft is never described as publicly available.
 * Renewal does not by itself publish a portfolio the owner has unpublished.
 */
export function publishingDashboardNotice(input: {
  phase: PublishingLifecyclePhase;
  published: boolean;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  renewalOpensAt: string | null;
  renewed: boolean;
  now: Date;
}): PublishingDashboardNotice {
  const expiry = utcDate(input.expiresAt);
  const grace = utcDate(input.gracePeriodEndsAt);
  const opens = utcDate(input.renewalOpensAt);
  const renewalAvailable = input.phase === "renewal-window" || input.phase === "grace" || input.phase === "lapsed" || input.phase === "revoked";
  if (!input.published) {
    const refunded = input.phase === "revoked";
    return {
      title: refunded ? "Publishing refunded" : "Unpublished",
      body: refunded
        ? "A refund ended this publishing period. This portfolio is not on its public address. Your content, projects, and images are still saved. Publishing it again is a separate step after you renew."
        : "This portfolio is not on its public address. Your content, projects, and images are still saved. A renewal keeps the publishing period, and the page stays unpublished until you choose to publish it.",
      renewalAvailable,
      describesPublic: false,
    };
  }
  if (input.phase === "grandfather") {
    return {
      title: "Published",
      body: "This portfolio is on its public address. It was published before annual publishing payments, so no payment is due for its current availability.",
      renewalAvailable: false,
      describesPublic: true,
    };
  }
  if (input.phase === "revoked") {
    return {
      title: "Publishing refunded",
      body: "A refund ended this publishing period, so the public page is not available. Your content, projects, and images are still saved.",
      renewalAvailable: true,
      describesPublic: false,
    };
  }
  if (input.phase === "lapsed") {
    return {
      title: "Public page paused",
      body: `The publishing period ended on ${expiry}, and the grace period ended on ${grace}. The public page is not available. Your content is still saved. Renewing for ₦10,000 can bring the public page back, because you had published it.`,
      renewalAvailable: true,
      describesPublic: false,
    };
  }
  if (input.phase === "grace") {
    return {
      title: "Grace period",
      body: `Your publishing period ended on ${expiry}. The public page stays available through ${grace}. ${daysUntil(input.gracePeriodEndsAt, input.now)} days remain in this grace period. You can renew for ₦10,000.`,
      renewalAvailable: true,
      describesPublic: true,
    };
  }
  if (input.phase === "renewal-window") {
    return {
      title: "Renewal available",
      body: `Publishing expires on ${expiry}. ${daysUntil(input.expiresAt, input.now)} days remaining. You can renew now for ₦10,000. The public page stays available.`,
      renewalAvailable: true,
      describesPublic: true,
    };
  }
  if (input.renewed) {
    return {
      title: "Renewed",
      body: `Your renewal is active through ${expiry}. The public page stays available. The renewal price remains ₦10,000, and there are no automatic charges.`,
      renewalAvailable: false,
      describesPublic: true,
    };
  }
  return {
    title: "Active",
    body: `Your portfolio is published through ${expiry}. Renewal opens on ${opens}. Your portfolio stays saved here.`,
    renewalAvailable: false,
    describesPublic: true,
  };
}

/** Public visitors can open the portfolio through the paid term and the seven-day grace period. */
export function publishingPubliclyVisible(record: unknown, now: Date): boolean {
  const lifecycle = describePublishingLifecycle({ record, now });
  return lifecycle.phase === "grandfather" || lifecycle.phase === "active" || lifecycle.phase === "renewal-window" || lifecycle.phase === "grace";
}

/**
 * First payment runs twelve months from the verified timestamp.
 * A renewal in the final seven days, during grace, or from a checkout opened in that covered period
 * adds twelve months to the existing expiry. A renewal after grace starts from the verified timestamp.
 * The same payment id does not extend the period twice.
 */
export function planPublishingRenewal(input: {
  verifiedAt: string;
  currentExpiresAt: string | null;
  history: readonly PublishingPaymentHistoryEntry[];
  payment: PublishingPaymentHistoryEntry;
  honorAnchor?: boolean;
  anchoredExpiresAt?: string | null;
}): { basis: PublishingRenewalBasis; expiresAt: string; history: PublishingPaymentHistoryEntry[] } | { ok: false; reason: "invalid-timestamp" | "too-early" } {
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
  const anchor = input.anchoredExpiresAt ? instant(input.anchoredExpiresAt) : null;
  if (input.anchoredExpiresAt && !anchor) return { ok: false, reason: "invalid-timestamp" };
  if (input.honorAnchor && anchor) {
    return {
      basis: verified.getTime() < anchor.getTime() ? "early" : "grace",
      expiresAt: addPublishingTerm(anchor).toISOString(),
      history: [...input.history, input.payment],
    };
  }
  if (!current) {
    return {
      basis: "first",
      expiresAt: addPublishingTerm(verified).toISOString(),
      history: [...input.history, input.payment],
    };
  }
  const verifiedAt = verified.getTime();
  if (verifiedAt < renewalWindowOpensAt(current).getTime()) return { ok: false, reason: "too-early" };
  if (verifiedAt < gracePeriodEndsAt(current).getTime()) {
    return {
      basis: verifiedAt < current.getTime() ? "early" : "grace",
      expiresAt: addPublishingTerm(current).toISOString(),
      history: [...input.history, input.payment],
    };
  }
  return {
    basis: "late",
    expiresAt: addPublishingTerm(verified).toISOString(),
    history: [...input.history, input.payment],
  };
}
