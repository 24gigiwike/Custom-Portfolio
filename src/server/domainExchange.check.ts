import assert from "node:assert/strict";
import { decideDomainCollection } from "./domainPayment";
import { quoteDomainPrice } from "./domainPricing";
import { fetchUsdNgnRate, lockDomainCheckoutQuote, parseOpenExchangeRate, readExchangeRateSettings } from "./domainExchange";

const now = "2026-11-21T03:00:00.000Z";
const nowMs = Date.parse(now);
const fresh = { timestamp: nowMs / 1000, base: "USD", rates: { NGN: 1500 } };
const rate = parseOpenExchangeRate(fresh, nowMs, 6 * 60 * 60);
if (!rate) throw new Error("rate");
assert.equal(rate.rate, "1500");
assert.equal(rate.source, "openexchangerates");
assert.equal(parseOpenExchangeRate({ timestamp: nowMs / 1000 - 6 * 60 * 60 - 1, base: "USD", rates: { NGN: 1500 } }, nowMs, 6 * 60 * 60), null);
assert.equal(parseOpenExchangeRate({ timestamp: nowMs / 1000, base: "EUR", rates: { NGN: 1500 } }, nowMs, 6 * 60 * 60), null);
assert.equal(parseOpenExchangeRate({ base: "USD", rates: { NGN: 1500 } }, nowMs, 6 * 60 * 60), null);

const usd = quoteDomainPrice({ price: 11.99, currency: "USD", period: 1, premium: false, markupBasisPoints: 0 });
if (!usd) throw new Error("usd");
const locked = lockDomainCheckoutQuote({ quote: usd, rate, now, maxAgeSeconds: 6 * 60 * 60, ttlSeconds: 900 });
if (!locked) throw new Error("locked");
assert.equal(locked.registrarCurrency, "USD");
assert.equal(locked.registrarAmount, "11.99");
assert.equal(locked.currency, "NGN");
assert.equal(locked.convertedAmount, "17985.00");
assert.equal(locked.customerAmount, "17985.00");
assert.equal(locked.exchangeRate, "1500");
assert.equal(locked.exchangeRateSource, "openexchangerates");
assert.equal(locked.quoteExpiresAt, "2026-11-21T03:15:00.000Z");

const marked = quoteDomainPrice({ price: 11.99, currency: "USD", period: 1, premium: false, markupBasisPoints: 250 });
const markedLock = marked ? lockDomainCheckoutQuote({ quote: marked, rate, now, maxAgeSeconds: 6 * 60 * 60, ttlSeconds: 900 }) : null;
assert.equal(markedLock?.registrarAmount, "11.99");
assert.equal(markedLock?.convertedAmount, "17985.00");
assert.equal(markedLock?.customerAmount, "18434.63");
assert.equal(lockDomainCheckoutQuote({ quote: usd, rate: null, now, maxAgeSeconds: 6 * 60 * 60, ttlSeconds: 900 }), null);

const naira = quoteDomainPrice({ price: 15000, currency: "NGN", period: 1, premium: false, markupBasisPoints: 0 });
if (!naira) throw new Error("naira");
const nairaLock = lockDomainCheckoutQuote({ quote: naira, rate: null, now, maxAgeSeconds: 6 * 60 * 60, ttlSeconds: 900 });
assert.equal(nairaLock?.currency, "NGN");
assert.equal(nairaLock?.customerAmount, "15000.00");
assert.equal(nairaLock?.registrarAmount, "15000.00");
assert.equal(nairaLock?.exchangeRate, null);

assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "NGN",
  amount: locked.customerAmount,
  amountPaid: locked.customerAmount,
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: locked.customerAmount,
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "verify");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "USD",
  amount: locked.registrarAmount,
  amountPaid: locked.registrarAmount,
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: locked.customerAmount,
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "currency");

const settings = readExchangeRateSettings({});
assert.equal(settings.configured, false);
let requests = 0;
const missing = await fetchUsdNgnRate({}, async () => {
  requests += 1;
  return { status: 200, body: fresh };
}, nowMs);
assert.equal(missing, null);
assert.equal(requests, 0);

console.log("domain exchange checks passed");
