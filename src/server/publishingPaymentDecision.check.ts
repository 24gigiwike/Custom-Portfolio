import assert from "node:assert/strict";
import { PUBLISHING_PRICE_AMOUNT } from "../lib/publishingEntitlement";
import {
  PUBLISHING_BASE_AMOUNT,
  approvePublishingTax,
  decidePublishingCharge,
  decidePublishingRefund,
  quotePublishingPayment,
  serverPublishingPriceQuote,
  isApprovedPublishingTax,
  serverPublishingTaxConfiguration,
  type BoundPublishingCheckout,
  type RetrievedPublishingCharge,
} from "./publishingPaymentDecision";

assert.equal(PUBLISHING_BASE_AMOUNT, 10_000);
assert.equal(PUBLISHING_BASE_AMOUNT, PUBLISHING_PRICE_AMOUNT);

const untaxed = serverPublishingPriceQuote({
  amount: "1.00",
  currency: "USD",
  vatRate: "0.50",
  processingFee: "150.00",
});
assert.equal(untaxed.baseAmount, "10000.00");
assert.equal(untaxed.taxName, null);
assert.equal(untaxed.taxAmount, "0.00");
assert.equal(untaxed.expectedCustomerAmount, "10000.00");
assert.equal(untaxed.processingFeeIncluded, false);
assert.equal(untaxed.currency, "NGN");

const clientShaped = {
  applicable: true,
  name: "VAT",
  rateNumerator: 75,
  rateDenominator: 1000,
  amount: "1.00",
};
assert.equal(isApprovedPublishingTax(clientShaped), false);

const syntheticVat = approvePublishingTax({
  applicable: true,
  name: "VAT",
  rateNumerator: 75,
  rateDenominator: 1000,
});
assert.ok(syntheticVat);
const taxed = quotePublishingPayment(syntheticVat);
assert.equal(taxed.ok, true);
if (taxed.ok) {
  assert.equal(taxed.quote.baseAmount, "10000.00");
  assert.equal(taxed.quote.taxName, "VAT");
  assert.equal(taxed.quote.taxAmount, "750.00");
  assert.equal(taxed.quote.expectedCustomerAmount, "10750.00");
  assert.equal(taxed.quote.processingFeeIncluded, false);
}

const uneven = approvePublishingTax({
  applicable: true,
  name: "VAT",
  rateNumerator: 1,
  rateDenominator: 3,
});
assert.ok(uneven);
const rounded = quotePublishingPayment(uneven);
assert.equal(rounded.ok, true);
if (rounded.ok) {
  assert.equal(rounded.quote.baseAmount, "10000.00");
  assert.equal(rounded.quote.taxAmount, "3333.33");
  assert.equal(rounded.quote.expectedCustomerAmount, "13333.33");
}

assert.equal(approvePublishingTax({ applicable: true, name: "VAT", rateNumerator: -1, rateDenominator: 100 }), null);
assert.equal(approvePublishingTax({ applicable: true, name: "VAT", rateNumerator: 1.5, rateDenominator: 100 }), null);
assert.equal(serverPublishingTaxConfiguration({ applicable: true, rateNumerator: 75, rateDenominator: 1000 }).applicable, false);

const checkout: BoundPublishingCheckout = {
  checkoutId: "chk-synthetic",
  ownerId: "owner-synthetic",
  portfolioId: "portfolio-synthetic",
  productId: "prod-synthetic",
  quantity: 1,
};

function charge(overrides: Partial<RetrievedPublishingCharge> = {}): RetrievedPublishingCharge {
  return {
    chargeId: "ch-synthetic",
    checkoutId: checkout.checkoutId,
    status: "succeeded",
    currency: "NGN",
    amount: "10000.00",
    amountPaid: "10000.00",
    settlementAmount: "9850.00",
    processingFee: "150.00",
    billingReason: "purchase",
    ...overrides,
  };
}

const absorbedFee = decidePublishingCharge({
  tax: serverPublishingTaxConfiguration(),
  charge: charge(),
  checkout,
  priorFullRefund: false,
});
assert.equal(absorbedFee.action, "grant");
if (absorbedFee.action === "grant") {
  assert.equal(absorbedFee.ownerId, "owner-synthetic");
  assert.equal(absorbedFee.portfolioId, "portfolio-synthetic");
  assert.equal(absorbedFee.baseAmount, "10000.00");
  assert.equal(absorbedFee.taxAmount, "0.00");
  assert.equal(absorbedFee.expectedCustomerAmount, "10000.00");
}

const surcharge = decidePublishingCharge({
  tax: serverPublishingTaxConfiguration(),
  charge: charge({ amount: "10150.00", amountPaid: "10150.00", settlementAmount: "10150.00", processingFee: "150.00" }),
  checkout,
  priorFullRefund: false,
});
assert.deepEqual(surcharge, { action: "ignore", reason: "amount", expectedCustomerAmount: "10000.00" });

assert.equal(syntheticVat && decidePublishingCharge({
  tax: syntheticVat,
  charge: charge({ amount: "10000.00", amountPaid: "10000.00" }),
  checkout,
  priorFullRefund: false,
}).action, "ignore");

const taxedGrant = syntheticVat && decidePublishingCharge({
  tax: syntheticVat,
  charge: charge({
    amount: "10750.00",
    amountPaid: "10750.00",
    settlementAmount: "10600.00",
    processingFee: "150.00",
  }),
  checkout,
  priorFullRefund: false,
});
assert.equal(taxedGrant && taxedGrant.action, "grant");
if (taxedGrant && taxedGrant.action === "grant") {
  assert.equal(taxedGrant.portfolioId, "portfolio-synthetic");
  assert.equal(taxedGrant.expectedCustomerAmount, "10750.00");
  assert.equal(taxedGrant.taxAmount, "750.00");
}

for (const status of ["SUCCEEDED", "accepted", "overpaid", "underpaid", "processing", "created", "failed"]) {
  const decision = decidePublishingCharge({
    tax: serverPublishingTaxConfiguration(),
    charge: charge({ status }),
    checkout,
    priorFullRefund: false,
  });
  assert.equal(decision.action, "ignore");
  if (decision.action === "ignore") assert.equal(decision.reason, "status");
}

const fullRefund = decidePublishingRefund({
  tax: serverPublishingTaxConfiguration(),
  paymentStatus: "refunded",
  refundStatus: "paid",
  requestedAmount: "10000.00",
});
assert.deepEqual(fullRefund, { action: "revoke", expectedCustomerAmount: "10000.00" });

const feeOnlyRefund = decidePublishingRefund({
  tax: serverPublishingTaxConfiguration(),
  paymentStatus: "refunded",
  refundStatus: "success",
  requestedAmount: "9850.00",
});
assert.equal(feeOnlyRefund.action, "keep");
if (feeOnlyRefund.action === "keep") assert.equal(feeOnlyRefund.reason, "amount-mismatch");

const partial = decidePublishingRefund({
  tax: serverPublishingTaxConfiguration(),
  paymentStatus: "partially_refunded",
  refundStatus: "paid",
  requestedAmount: "1000.00",
});
assert.equal(partial.action, "keep");
if (partial.action === "keep") assert.equal(partial.reason, "partial");

const processingRefund = decidePublishingRefund({
  tax: serverPublishingTaxConfiguration(),
  paymentStatus: "succeeded",
  refundStatus: "processing",
  requestedAmount: "10000.00",
});
assert.equal(processingRefund.action, "keep");
if (processingRefund.action === "keep") assert.equal(processingRefund.reason, "processing");

const taxedRefund = syntheticVat && decidePublishingRefund({
  tax: syntheticVat,
  paymentStatus: "auto_refunded",
  refundStatus: "success",
  requestedAmount: "10750.00",
});
assert.equal(taxedRefund && taxedRefund.action, "revoke");

console.log("publishing payment decision checks passed");
