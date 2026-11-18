import assert from "node:assert/strict";
import {
  addPublishingTerm,
  classifyPortfolioPublishingAccess,
  planPublishingRenewal,
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
  verifiedAt: "2026-06-01T00:00:00.000Z",
  currentExpiresAt: "2027-01-01T00:00:00.000Z",
  history: [payment("2026-01-01T00:00:00.000Z", "pay-0")],
  payment: payment("2026-06-01T00:00:00.000Z", "pay-1"),
});
if ("expiresAt" in early) {
  assert.equal(early.basis, "early");
  assert.equal(early.expiresAt, "2028-01-01T00:00:00.000Z");
  assert.deepEqual(early.history.map((entry) => entry.paymentId), ["pay-0", "pay-1"]);
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
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: null, now: new Date("2026-11-17T00:00:00.000Z") }), "payment-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, portfolioId: "portfolio02" }, now: new Date("2026-11-17T00:00:00.000Z") }), "payment-required");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: active, now: new Date("2026-11-17T00:00:00.000Z") }), "entitled");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: "2027-01-01T00:00:00.000Z" }, now: new Date("2026-11-17T00:00:00.000Z") }), "entitled");
assert.equal(classifyPortfolioPublishingAccess({ uid: "owner-1", portfolioId: "portfolio01", record: { ...active, expiresAt: "2026-01-01T00:00:00.000Z" }, now: new Date("2026-11-17T00:00:00.000Z") }), "renewal-required");

console.log("publishing term checks passed");
