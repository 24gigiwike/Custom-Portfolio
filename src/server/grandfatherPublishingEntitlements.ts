import {
  classifyGrandfatherOwnerId,
  grandfatherEntitlementDocument,
  planGrandfatherEntitlements,
  PUBLISHING_ENTITLEMENT_COLLECTION,
  type GrandfatherPlan,
  type GrandfatherPortfolio,
  type PublishingEntitlement,
} from "../lib/publishingEntitlement";

/**
 * Review-only grandfather migration.
 *
 * This module is not imported by the application, the Vite build, or any API route.
 * It does not connect to Firestore and it does not run at startup.
 *
 * Before publishingControls/gate is set to { enabled: true }, an operator reviews
 * this plan and writes only the returned grants with the Admin SDK:
 *
 *   publishingEntitlements/{uid} = grant
 *
 * The write must use create(), not set() or update(). If create() reports that
 * the document already exists, that account is left in place and later grants
 * still run. Re-running the plan is idempotent: accounts that already have a
 * document are skipped.
 *
 * Unpublished portfolios are not granted a right. Unpublishing later does not
 * delete the entitlement, so a grandfathered account can publish again.
 */

export interface GrandfatherSource {
  listPortfolios(): Promise<GrandfatherPortfolio[]>;
  readEntitlements(uids: string[]): Promise<Map<string, unknown>>;
}

export async function reviewGrandfatherEntitlements(
  source: GrandfatherSource,
  grantedAt: string,
): Promise<GrandfatherPlan> {
  const portfolios = await source.listPortfolios();
  const owners = [...new Set(portfolios.flatMap((portfolio) => {
    const owner = classifyGrandfatherOwnerId(portfolio.ownerId);
    return owner.ok === true ? [owner.uid] : [];
  }))];
  const existingByUid = await source.readEntitlements(owners);
  return planGrandfatherEntitlements({ portfolios, existingByUid, grantedAt });
}

export interface GrandfatherWriter {
  createEntitlement(uid: string, record: PublishingEntitlement): Promise<"created" | "already-present">;
}

/** Admin SDK create() uses gRPC code 6 and the already-exists status. */
export function isEntitlementAlreadyPresentError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === 6 || record.code === "6" || record.code === "already-exists" || record.code === "ALREADY_EXISTS") {
    return true;
  }
  return typeof record.message === "string" && /already[- ]exists/i.test(record.message);
}

export async function applyReviewedGrandfatherGrants(
  grants: readonly PublishingEntitlement[],
  writer: GrandfatherWriter,
): Promise<{ created: string[]; leftInPlace: string[] }> {
  const created: string[] = [];
  const leftInPlace: string[] = [];
  for (const grant of grants) {
    if (grant.source !== "grandfathered" || grant.paymentId !== null) {
      throw new Error("Only a grandfather grant can be applied by this migration.");
    }
    try {
      const result = await writer.createEntitlement(grant.uid, grant);
      if (result === "created") created.push(grant.uid);
      else leftInPlace.push(grant.uid);
    } catch (error) {
      if (!isEntitlementAlreadyPresentError(error)) throw error;
      leftInPlace.push(grant.uid);
    }
  }
  return { created, leftInPlace };
}

export function grandfatherEntitlementPath(uid: string): string {
  return `${PUBLISHING_ENTITLEMENT_COLLECTION}/${uid}`;
}

export function grandfatherEntitlementForReview(uid: string, grantedAt: string): PublishingEntitlement {
  return grandfatherEntitlementDocument(uid, grantedAt);
}
