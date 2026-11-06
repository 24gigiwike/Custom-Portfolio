import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PUBLISHING_PRICE_AMOUNT,
  PUBLISHING_PRICE_CURRENCY,
  accountHasPermanentPublishingRight,
  classifyPublicationForGrandfathering,
  grandfatherEntitlementDocument,
  isPublishingGateEnabled,
  isValidActiveEntitlement,
  planGrandfatherEntitlements,
  type PublishingEntitlement,
} from "../lib/publishingEntitlement";
import {
  applyReviewedGrandfatherGrants,
  grandfatherEntitlementPath,
  isEntitlementAlreadyPresentError,
  reviewGrandfatherEntitlements,
} from "./grandfatherPublishingEntitlements";

const grantedAt = "2026-11-06T10:00:00.000Z";

assert.equal(isPublishingGateEnabled(null), false);
assert.equal(isPublishingGateEnabled(undefined), false);
assert.equal(isPublishingGateEnabled({ enabled: false }), false);
assert.equal(isPublishingGateEnabled({ enabled: true }), true);
assert.equal(PUBLISHING_PRICE_AMOUNT, 10_000);
assert.equal(PUBLISHING_PRICE_CURRENCY, "NGN");

const published = { publishing: { status: "published", publishedAt: grantedAt }, published: true };
const draft = { publishing: { status: "draft" }, published: false };
const legacyPublished = { published: true };
const explicitDraft = { publishing: { status: "draft" }, published: true };
const malformedPublishing = { publishing: "published", published: true };
const emptyPublishing = { publishing: {}, published: true };

assert.equal(classifyPublicationForGrandfathering(published), "published");
assert.equal(classifyPublicationForGrandfathering(legacyPublished), "published");
assert.equal(classifyPublicationForGrandfathering(explicitDraft), "not-published");
assert.equal(classifyPublicationForGrandfathering(draft), "not-published");
assert.equal(classifyPublicationForGrandfathering(malformedPublishing), "ambiguous");
assert.equal(classifyPublicationForGrandfathering(emptyPublishing), "ambiguous");

const paymentEntitlement: PublishingEntitlement = {
  uid: "paid-user",
  status: "active",
  source: "payment",
  paymentId: "pay-1",
  providerReference: "provider-ref-1",
  grantedAt,
  grantReason: "verified-payment",
  schemaVersion: 1,
};

const plan = planGrandfatherEntitlements({
  grantedAt,
  existingByUid: new Map<string, unknown>([
    ["paid-user", paymentEntitlement],
    ["broken-user", { uid: "someone-else", status: "active", source: "grandfathered", schemaVersion: 1 }],
    ["inactive-user", { uid: "inactive-user", status: "inactive", source: "grandfathered", schemaVersion: 1 }],
    ["noschema-user", { uid: "noschema-user", status: "active", source: "grandfathered" }],
  ]),
  portfolios: [
    { portfolioId: "published-port", ownerId: "grandfather-user", data: published },
    { portfolioId: "draft-port", ownerId: "draft-user", data: draft },
    { portfolioId: "legacy-port", ownerId: "legacy-user", data: legacyPublished },
    { portfolioId: "explicit-draft", ownerId: "explicit-draft-user", data: explicitDraft },
    { portfolioId: "second-published", ownerId: "grandfather-user", data: published },
    { portfolioId: "paid-port", ownerId: "paid-user", data: published },
    { portfolioId: "broken-port", ownerId: "broken-user", data: published },
    { portfolioId: "inactive-port", ownerId: "inactive-user", data: published },
    { portfolioId: "noschema-port", ownerId: "noschema-user", data: published },
    { portfolioId: "orphan", ownerId: "  ", data: published },
    { portfolioId: "missing-owner", ownerId: undefined, data: published },
    { portfolioId: "numeric-owner", ownerId: 404, data: published },
    { portfolioId: "malformed-publishing", ownerId: "malformed-user", data: malformedPublishing },
    { portfolioId: "empty-publishing", ownerId: "empty-publishing-user", data: emptyPublishing },
  ],
});

assert.deepEqual(plan.grants.map((grant) => grant.uid), ["grandfather-user", "legacy-user"]);
assert.equal(plan.grants.every((grant) => grant.source === "grandfathered" && grant.paymentId === null), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "draft-user" && skip.reason === "not-published"), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "explicit-draft-user" && skip.reason === "not-published"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "second-published" && skip.uid === "grandfather-user" && skip.reason === "additional-published-portfolio"), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "paid-user" && skip.reason === "already-entitled"), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "broken-user" && skip.reason === "existing-record-needs-review"), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "inactive-user" && skip.reason === "existing-record-needs-review"), true);
assert.equal(plan.skipped.some((skip) => skip.uid === "noschema-user" && skip.reason === "existing-record-needs-review"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "orphan" && skip.reason === "missing-owner"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "missing-owner" && skip.reason === "missing-owner"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "numeric-owner" && skip.reason === "invalid-owner"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "malformed-publishing" && skip.reason === "ambiguous-publishing"), true);
assert.equal(plan.skipped.some((skip) => skip.portfolioId === "empty-publishing" && skip.reason === "ambiguous-publishing"), true);
assert.equal(plan.grants.some((grant) => grant.uid === "paid-user" || grant.uid === "malformed-user" || grant.uid === "empty-publishing-user"), false);
assert.equal(accountHasPermanentPublishingRight(plan.grants[0]), true);

const reviewed = await reviewGrandfatherEntitlements({
  async listPortfolios() {
    return [
      { portfolioId: "published-port", ownerId: "grandfather-user", data: published },
      { portfolioId: "draft-port", ownerId: "draft-user", data: draft },
    ];
  },
  async readEntitlements() {
    return new Map();
  },
}, grantedAt);
assert.deepEqual(reviewed.grants.map((grant) => grant.uid), ["grandfather-user"]);

const reviewedWithBadOwner = await reviewGrandfatherEntitlements({
  async listPortfolios() {
    return [
      { portfolioId: "numeric-owner", ownerId: 404, data: published },
      { portfolioId: "legacy-port", ownerId: "legacy-user", data: legacyPublished },
    ];
  },
  async readEntitlements(uids) {
    assert.deepEqual(uids, ["legacy-user"]);
    return new Map();
  },
}, grantedAt);
assert.deepEqual(reviewedWithBadOwner.grants.map((grant) => grant.uid), ["legacy-user"]);
assert.equal(reviewedWithBadOwner.skipped.some((skip) => skip.portfolioId === "numeric-owner" && skip.reason === "invalid-owner"), true);

const stored = new Map<string, PublishingEntitlement>();
const applied = await applyReviewedGrandfatherGrants(reviewed.grants, {
  async createEntitlement(uid, record) {
    if (stored.has(uid)) return "already-present";
    stored.set(uid, record);
    return "created";
  },
});
assert.deepEqual(applied.created, ["grandfather-user"]);
const again = await applyReviewedGrandfatherGrants(reviewed.grants, {
  async createEntitlement(uid) {
    return stored.has(uid) ? "already-present" : "created";
  },
});
assert.deepEqual(again.leftInPlace, ["grandfather-user"]);
assert.equal(stored.get("grandfather-user")?.source, "grandfathered");
assert.equal(grandfatherEntitlementPath("grandfather-user"), "publishingEntitlements/grandfather-user");
assert.deepEqual(stored.get("grandfather-user"), grandfatherEntitlementDocument("grandfather-user", grantedAt));

await assert.rejects(
  () => applyReviewedGrandfatherGrants([paymentEntitlement], {
    async createEntitlement() {
      throw new Error("must not be called");
    },
  }),
  /grandfather grant/,
);

const conflict = Object.assign(new Error("6 ALREADY_EXISTS: document already exists"), { code: 6 });
assert.equal(isEntitlementAlreadyPresentError(conflict), true);
assert.equal(isEntitlementAlreadyPresentError(new Error("permission denied")), false);
const conflictResult = await applyReviewedGrandfatherGrants([
  grandfatherEntitlementDocument("syn-present", grantedAt),
  grandfatherEntitlementDocument("syn-new", grantedAt),
], {
  async createEntitlement(uid) {
    if (uid === "syn-present") throw conflict;
    return "created";
  },
});
assert.deepEqual(conflictResult.leftInPlace, ["syn-present"]);
assert.deepEqual(conflictResult.created, ["syn-new"]);
await assert.rejects(
  () => applyReviewedGrandfatherGrants([grandfatherEntitlementDocument("syn-broken", grantedAt)], {
    async createEntitlement() {
      throw new Error("permission denied");
    },
  }),
  /permission denied/,
);

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
assert.match(rules, /publishingControls\/gate/);
assert.match(rules, /enabled == true/);
assert.match(rules, /match \/publishingEntitlements\/\{uid\}/);
assert.match(rules, /match \/payments\/\{paymentId\}/);
assert.match(rules, /allow create, update, delete: if false;/);
assert.equal(isValidActiveEntitlement(paymentEntitlement, "paid-user"), true);
assert.equal(isValidActiveEntitlement(paymentEntitlement, "other-user"), false);

console.log("publishing entitlement checks passed");
