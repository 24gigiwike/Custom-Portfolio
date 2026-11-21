import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publishingPaymentReturnOutcome } from "../components/portfolio-publish/publishingReturnPath";
import { BACHS_SANDBOX_PRODUCT_ID, assertBachsApiKeyForRuntime, assertBachsProductForRuntime, BachsRuntimeError } from "./bachsRuntime";
import { applyLedgerCommit, type VerifiedPaymentDraft } from "./publishingPaymentLedger";

const draft: VerifiedPaymentDraft = {
  paymentId: "pay_sandbox_1",
  checkoutId: "chk_sandbox_1",
  reference: "publishing:portfolio1234:11111111-1111-1111-1111-111111111111",
  portfolioId: "portfolio1234",
  uid: "owner-1",
  productId: BACHS_SANDBOX_PRODUCT_ID,
  amount: "10000.00",
  amountPaid: "10000.00",
  currency: "NGN",
  billingReason: "purchase",
  status: "succeeded",
  runtimeMode: "sandbox",
  eventId: "evt_success",
  verifiedAt: "2026-11-21T00:00:00.000Z",
  ledgerEnvironment: "local",
};

const attempt = {
  portfolioId: draft.portfolioId,
  uid: draft.uid,
  attemptId: "11111111-1111-1111-1111-111111111111",
  reference: draft.reference,
  checkoutId: draft.checkoutId,
  productId: draft.productId,
  quantity: 1,
};

const created = applyLedgerCommit({ current: null, attempt, draft });
assert.equal(created.kind, "created");
const duplicate = applyLedgerCommit({ current: created.kind === "created" ? created.document : null, attempt, draft });
assert.equal(duplicate.kind, "duplicate");
if (duplicate.kind === "duplicate") assert.equal(duplicate.document.processedEventIds.length, 1);

assert.equal(publishingPaymentReturnOutcome("/portfolio/publish/return"), "success");
assert.equal(publishingPaymentReturnOutcome("/portfolio/publish/cancelled"), "cancelled");
assert.equal(publishingPaymentReturnOutcome("/portfolio/publish/return?checkout_id=chk_sandbox_1"), "success");

const sandboxEnv = { BACHS_API_KEY: "sk_sandbox_testsecret", BACHS_PUBLISHING_PRODUCT_ID: BACHS_SANDBOX_PRODUCT_ID, VERCEL_ENV: "" };
assert.doesNotThrow(() => assertBachsApiKeyForRuntime(sandboxEnv));
assert.equal(assertBachsProductForRuntime(sandboxEnv), BACHS_SANDBOX_PRODUCT_ID);
assert.throws(() => assertBachsApiKeyForRuntime({ ...sandboxEnv, VERCEL_ENV: "production" }), BachsRuntimeError);
assert.throws(() => assertBachsProductForRuntime({ ...sandboxEnv, VERCEL_ENV: "production" }), BachsRuntimeError);

const mismatched = applyLedgerCommit({ current: null, attempt: { ...attempt, checkoutId: "chk_other" }, draft });
assert.equal(mismatched.kind, "not-verified");

const grant = readFileSync(new URL("./publishingEntitlementGrant.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
assert.match(grant, /runtimeMode === "sandbox"/);
assert.match(grant, /firebaseRuntime\(input\.env\) !== "production"/);

console.log("bachs sandbox case checks passed");
