/**
 * Server-managed publishing right for the current one-portfolio account.
 * Clients cannot create, change, or delete these documents.
 * The publishing gate stays off until publishingControls/gate is set to
 * { enabled: true } by the Admin SDK. A missing control document does not lock publishing.
 */

export const PUBLISHING_ENTITLEMENT_COLLECTION = "publishingEntitlements";
export const PAYMENT_COLLECTION = "payments";
export const PUBLISHING_GATE_COLLECTION = "publishingControls";
export const PUBLISHING_GATE_DOCUMENT_ID = "gate";

/** One-time Custom Portfolio publishing price. Stored as whole naira, not kobo. */
export const PUBLISHING_PRICE_AMOUNT = 10_000;
export const PUBLISHING_PRICE_CURRENCY = "NGN" as const;

export type PublishingEntitlementStatus = "active";
export type PublishingEntitlementSource = "grandfathered" | "payment";

export interface PublishingEntitlement {
  uid: string;
  status: PublishingEntitlementStatus;
  source: PublishingEntitlementSource;
  /** payments/{paymentId} when the source is payment. Null for a grandfathered grant. */
  paymentId: string | null;
  /** Provider reference copied from the verified payment. Null when there is no payment. */
  providerReference: string | null;
  grantedAt: string;
  grantReason: "published-before-payment-gate" | "verified-payment";
  schemaVersion: 1;
}

export type PaymentStatus = "pending" | "failed" | "verified";

/**
 * Foundation for a later verified charge.
 * This task does not create payments and does not mark any payment verified.
 */
export interface PublishingPaymentRecord {
  paymentId: string;
  uid: string;
  provider: string;
  amount: number;
  currency: typeof PUBLISHING_PRICE_CURRENCY;
  providerReference: string;
  status: PaymentStatus;
  verifiedAt: string | null;
  createdAt: string;
  schemaVersion: 1;
}

export interface PublishingGateDocument {
  enabled: boolean;
}

export function isPublishingGateEnabled(document: PublishingGateDocument | null | undefined): boolean {
  return document?.enabled === true;
}

export function isValidActiveEntitlement(record: unknown, uid: string): record is PublishingEntitlement {
  if (!record || typeof record !== "object") return false;
  const data = record as Partial<PublishingEntitlement>;
  return data.uid === uid
    && data.status === "active"
    && (data.source === "grandfathered" || data.source === "payment")
    && data.schemaVersion === 1;
}

export function accountHasPermanentPublishingRight(record: PublishingEntitlement | null | undefined): boolean {
  return Boolean(record && record.status === "active");
}

/**
 * Positive publication test used for an automatic grandfather grant.
 * It matches firestore.rules portfolioIsPublished:
 * a publishing map whose status is "published", or no publishing field and published == true.
 * An explicit "draft" status is not published, even when the legacy boolean is still true.
 */
export type GrandfatherPublicationClass = "published" | "not-published" | "ambiguous";

export function classifyPublicationForGrandfathering(data: unknown): GrandfatherPublicationClass {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "ambiguous";
  const record = data as Record<string, unknown>;
  const hasPublishing = Object.prototype.hasOwnProperty.call(record, "publishing");
  if (!hasPublishing) return record.published === true ? "published" : "not-published";

  const publishing = record.publishing;
  const publishingIsMap = typeof publishing === "object" && publishing !== null && !Array.isArray(publishing);
  if (!publishingIsMap) return "ambiguous";
  const status = (publishing as Record<string, unknown>).status;
  if (status === "published") return "published";
  if (status === "draft") return "not-published";
  return record.published === true ? "ambiguous" : "not-published";
}

/** True only when the Firestore rules recognize the portfolio as published. */
export function isGrandfatherPublication(data: Record<string, unknown>): boolean {
  return classifyPublicationForGrandfathering(data) === "published";
}

export function classifyGrandfatherOwnerId(ownerId: unknown):
  | { ok: true; uid: string }
  | { ok: false; reason: "missing-owner" | "invalid-owner" } {
  if (ownerId == null) return { ok: false, reason: "missing-owner" };
  if (typeof ownerId !== "string") return { ok: false, reason: "invalid-owner" };
  const uid = ownerId.trim();
  if (!uid) return { ok: false, reason: "missing-owner" };
  return { ok: true, uid };
}

export function grandfatherEntitlementDocument(uid: string, grantedAt: string): PublishingEntitlement {
  return {
    uid,
    status: "active",
    source: "grandfathered",
    paymentId: null,
    providerReference: null,
    grantedAt,
    grantReason: "published-before-payment-gate",
    schemaVersion: 1,
  };
}

export interface GrandfatherPortfolio {
  portfolioId: string;
  ownerId: unknown;
  data: Record<string, unknown>;
}

export interface GrandfatherSkip {
  uid: string;
  portfolioId: string;
  reason:
    | "already-entitled"
    | "existing-record-needs-review"
    | "missing-owner"
    | "invalid-owner"
    | "not-published"
    | "ambiguous-publishing"
    | "additional-published-portfolio";
}

export interface GrandfatherPlan {
  grants: PublishingEntitlement[];
  skipped: GrandfatherSkip[];
}

/**
 * Decide grandfather grants without writing.
 * One entitlement per account. An existing document is never replaced.
 * Every portfolio stays in either grants' account set or skipped.
 * A second published portfolio for an account already decided is skipped as
 * additional-published-portfolio rather than omitted.
 */
export function planGrandfatherEntitlements(input: {
  portfolios: GrandfatherPortfolio[];
  existingByUid: ReadonlyMap<string, unknown>;
  grantedAt: string;
}): GrandfatherPlan {
  const grants: PublishingEntitlement[] = [];
  const skipped: GrandfatherSkip[] = [];
  const decided = new Set<string>();

  for (const portfolio of input.portfolios) {
    const owner = classifyGrandfatherOwnerId(portfolio.ownerId);
    if (owner.ok === false) {
      skipped.push({ uid: "", portfolioId: portfolio.portfolioId, reason: owner.reason });
      continue;
    }
    const publication = classifyPublicationForGrandfathering(portfolio.data);
    if (publication === "ambiguous") {
      skipped.push({ uid: owner.uid, portfolioId: portfolio.portfolioId, reason: "ambiguous-publishing" });
      continue;
    }
    if (publication !== "published") {
      skipped.push({ uid: owner.uid, portfolioId: portfolio.portfolioId, reason: "not-published" });
      continue;
    }
    if (decided.has(owner.uid)) {
      skipped.push({
        uid: owner.uid,
        portfolioId: portfolio.portfolioId,
        reason: "additional-published-portfolio",
      });
      continue;
    }
    decided.add(owner.uid);

    if (input.existingByUid.has(owner.uid)) {
      const existing = input.existingByUid.get(owner.uid);
      skipped.push({
        uid: owner.uid,
        portfolioId: portfolio.portfolioId,
        reason: isValidActiveEntitlement(existing, owner.uid) ? "already-entitled" : "existing-record-needs-review",
      });
      continue;
    }

    grants.push(grandfatherEntitlementDocument(owner.uid, input.grantedAt));
  }

  return { grants, skipped };
}
