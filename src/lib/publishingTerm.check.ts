import assert from "node:assert/strict";
import {
  addPublishingTerm,
  classifyPortfolioPublishingAccess,
  describePublishingLifecycle,
  gracePeriodEndsAt,
  planPublishingRenewal,
  publicationAttemptAccess,
  publishingCheckoutEligibility,
  publishingDashboardNotice,
  publishingPubliclyVisible,
  renewalWindowOpensAt,
  type PublishingPaymentHistoryEntry,
} from "./publishingTerm";

const payment = (verifiedAt: string, paymentId = "pay-1"): PublishingPaymentHistoryEntry => ({
  paymentId,
  portfolioId: "portfolio01",
  uid: "owner-1",
  verifiedAt,
  amount: "10000.00",
  currency: "NGN",
  providerReference: "chk-1",
});

const leap = addPublishingTerm(new Date("2024-02-29T15:04:05.006Z"));
assert.equal(leap.toISOString(), "2025-02-28T15:04:05.006Z");
assert.equal(addPublishingTerm(new Date("2026-03-17T08:00:00.000Z")).toISOString(), "2027-03-17T08:00:00.000Z");

const first = planPublishingRenewal({
  verifiedAt: "2026-03-17T08:00:00.000Z",
  currentExpiresAt: null,
  history: [],
  payment: payment("2026-03-17T08:00:00.000Z"),
});
if ("expiresAt" in first) {
  assert.equal(first.basis, "first");
  assert.equal(first.expiresAt, "2027-03-17T08:00:00.000Z");
  assert.equal(first.history.length, 1);
}

const early = planPublishingRenewal({
  verifiedAt: "2026-12-28T00:00:00.000Z",
  currentExpiresAt: "2027-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2026-12-28T00:00:00.000Z", "pay-1"),
});
if ("expiresAt" in early) {
  assert.equal(early.basis, "early");
  assert.equal(early.expiresAt, "2028-01-01T00:00:00.000Z");
  assert.deepEqual(early.history.map((entry) => entry.paymentId), ["pay-0", "pay-1"]);
}

const tooEarly = planPublishingRenewal({
  verifiedAt: "2026-06-01T00:00:00.000Z",
  currentExpiresAt: "2027-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2026-06-01T00:00:00.000Z", "pay-1"),
});
assert.equal("ok" in tooEarly && tooEarly.ok === false && tooEarly.reason === "too-early", true);

const graceRenewal = planPublishingRenewal({
  verifiedAt: "2027-01-03T00:00:00.000Z",
  currentExpiresAt: "2027-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2027-01-03T00:00:00.000Z", "pay-2"),
});
if ("expiresAt" in graceRenewal) {
  assert.equal(graceRenewal.basis, "grace");
  assert.equal(graceRenewal.expiresAt, "2028-01-01T00:00:00.000Z");
}

const anchored = planPublishingRenewal({
  verifiedAt: "2027-01-20T00:00:00.000Z",
  currentExpiresAt: "2027-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2027-01-20T00:00:00.000Z", "pay-3"),
  honorAnchor: true,
  anchoredExpiresAt: "2027-01-01T00:00:00.000Z",
});
if ("expiresAt" in anchored) {
  assert.equal(anchored.expiresAt, "2028-01-01T00:00:00.000Z");
}

const late = planPublishingRenewal({
  verifiedAt: "2026-06-01T00:00:00.000Z",
  currentExpiresAt: "2026-01-01T00:00:00.000Z",
  history: [payment("2025-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2026-06-01T00:00:00.000Z", "pay-1"),
});
if ("expiresAt" in late) {
  assert.equal(late.basis, "late");
  assert.equal(late.expiresAt, "2027-06-01T00:00:00.000Z");
  assert.equal(late.history[0]?.paymentId, "pay-0");
}

const replay = planPublishingRenewal({
  verifiedAt: "2026-06-01T00:00:00.000Z",
  currentExpiresAt: "2028-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0"), payment("2026-06-01T00:00:00.000Z", "pay-1")],
  payment: payment("2026-06-01T00:00:00.000Z", "pay-1"),
});
if ("expiresAt" in replay) {
  assert.equal(replay.expiresAt, "2028-01-01T00:00:00.000Z");
  assert.equal(replay.history.length, 2);
}

const active = { uid: "owner-1", portfolioId: "portfolio01", status: "active" };
const now = new Date("2026-11-17T00:00:00.000Z");
const futureStamp = { seconds: Math.floor(Date.parse("2027-01-01T00:00:00.000Z") / 1000), nanoseconds: 0 };
const pastStamp = { toMillis: () => Date.parse("2026-01-01T00:00:00.000Z") };
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: null, now }), "payment-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, portfolioId: "portfolio02" }, now }), "payment-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: active, now }), "entitled");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: futureStamp }, now }), "entitled");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: pastStamp }, now }), "renewal-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: "2027-01-01T00:00:00.000Z" }, now }), "renewal-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: null }, now }), "renewal-required");
assert.equal(publicationAttemptAccess({ uid: "owner-1", portfolioId: "portfolio01", record: active }), "entitled");
assert.equal(publicationAttemptAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: pastStamp } }), "entitled");
assert.equal(publicationAttemptAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: "2027-01-01T00:00:00.000Z" } }), "renewal-required");

const expiry = new Date("2027-01-08T00:00:00.000Z");
assert.equal(renewalWindowOpensAt(expiry).toISOString(), "2027-01-01T00:00:00.000Z");
assert.equal(gracePeriodEndsAt(expiry).toISOString(), "2027-01-15T00:00:00.000Z");
const stampFor = (iso: string) => ({ toMillis: () => Date.parse(iso) });
const term = (expiresAt: string) => ({ ...active, expiresAt: stampFor(expiresAt) });
assert.equal(describePublishingLifecycle({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2026-12-31T00:00:00.000Z") }).phase, "active");
assert.equal(describePublishingLifecycle({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2027-01-01T00:00:00.000Z") }).phase, "renewal-window");
assert.equal(describePublishingLifecycle({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2027-01-08T00:00:00.000Z") }).phase, "grace");
assert.equal(describePublishingLifecycle({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2027-01-14T00:00:00.000Z") }).phase, "grace");
assert.equal(describePublishingLifecycle({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2027-01-15T00:00:00.000Z") }).phase, "lapsed");
assert.equal(publishingCheckoutEligibility({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2026-12-31T00:00:00.000Z") }).allowed, false);
assert.equal(publishingCheckoutEligibility({ record: term("2027-01-08T00:00:00.000Z"), now: new Date("2027-01-01T00:00:00.000Z") }).allowed, true);
assert.equal(publishingPubliclyVisible(term("2027-01-08T00:00:00.000Z"), new Date("2027-01-14T00:00:00.000Z")), true);
assert.equal(publishingPubliclyVisible(term("2027-01-08T00:00:00.000Z"), new Date("2027-01-15T00:00:00.000Z")), false);
assert.equal(publishingPubliclyVisible({ ...active, status: "revoked", expiresAt: stampFor("2027-06-01T00:00:00.000Z") }, new Date("2027-01-01T00:00:00.000Z")), false);

const noticeNow = new Date("2027-01-10T00:00:00.000Z");
const noticeBase = {
  expiresAt: "2027-01-08T00:00:00.000Z",
  gracePeriodEndsAt: "2027-01-15T00:00:00.000Z",
  renewalOpensAt: "2027-01-01T00:00:00.000Z",
  renewed: false,
  now: noticeNow,
};
const activeNotice = publishingDashboardNotice({
  ...noticeBase,
  phase: "active",
  published: true,
  expiresAt: "2027-06-01T00:00:00.000Z",
  renewalOpensAt: "2027-05-25T00:00:00.000Z",
  now: new Date("2027-01-01T00:00:00.000Z"),
});
assert.equal(activeNotice.title, "Active");
assert.equal(activeNotice.describesPublic, true);
assert.match(activeNotice.body, /published through/);
const graceNotice = publishingDashboardNotice({ ...noticeBase, phase: "grace", published: true });
assert.equal(graceNotice.title, "Grace period");
assert.equal(graceNotice.describesPublic, true);
assert.match(graceNotice.body, /stays available through/);
const pausedNotice = publishingDashboardNotice({ ...noticeBase, phase: "lapsed", published: true });
assert.equal(pausedNotice.title, "Public page paused");
assert.equal(pausedNotice.describesPublic, false);
assert.match(pausedNotice.body, /not available/);
assert.match(pausedNotice.body, /bring the public page back/);
const manualNotice = publishingDashboardNotice({ ...noticeBase, phase: "grace", published: false });
assert.equal(manualNotice.title, "Unpublished");
assert.equal(manualNotice.describesPublic, false);
assert.equal(manualNotice.renewalAvailable, true);
assert.equal(/public page stays available|is on its public address/i.test(manualNotice.body), false);
assert.match(manualNotice.body, /stays unpublished until you choose to publish/);
const refundedNotice = publishingDashboardNotice({ ...noticeBase, phase: "revoked", published: true });
assert.equal(refundedNotice.title, "Publishing refunded");
assert.equal(refundedNotice.describesPublic, false);
assert.match(refundedNotice.body, /refund ended/);
const legacyNotice = publishingDashboardNotice({
  phase: "grandfather",
  published: true,
  expiresAt: null,
  gracePeriodEndsAt: null,
  renewalOpensAt: null,
  renewed: false,
  now: noticeNow,
});
assert.equal(legacyNotice.title, "Published");
assert.equal(legacyNotice.describesPublic, true);
assert.equal(legacyNotice.renewalAvailable, false);
assert.match(legacyNotice.body, /before annual publishing/);
assert.match(legacyNotice.body, /no payment is due/);

console.log("publishing term checks passed");
