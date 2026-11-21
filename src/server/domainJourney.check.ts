import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { advanceDomainOrder, openDomainOrder } from "./domainLifecycle";
import { decideDomainCollection, domainCheckoutCart, domainCheckoutReturnUrl, markDomainPaymentVerified, readDomainProductId, sandboxFirestoreBlocked } from "./domainPayment";
import { handleDomainCheckout, handleDomainOrder } from "./domainCheckoutHandler";
import { handleBachsWebhook } from "./bachsWebhookHandler";
import { DOMAIN_NAME_API_EVIDENCE, NAMESERVER_UPDATE_PROVEN_AGAINST_OTE } from "./domainNameApi";
import { memoryDomainStore, type DomainRegistrant } from "./domainRecords";
import { quoteDomainPrice } from "./domainPricing";
import { domainCustomerState } from "./domainCustomerState";
import { classifyRequestHost } from "./domainHostname";
import type { CloudflareClient } from "./cloudflareProvisioning";
import type { DomainNameApi } from "./domainNameApi";

assert.equal(DOMAIN_NAME_API_EVIDENCE.ote, "not-called");
assert.equal(DOMAIN_NAME_API_EVIDENCE.live, "not-called");
assert.equal(NAMESERVER_UPDATE_PROVEN_AGAINST_OTE, false);
assert.equal(readDomainProductId({ BACHS_DOMAIN_PRODUCT_ID: "prod_d8c0e88a960141ac884b" }), null);
assert.equal(readDomainProductId({ BACHS_DOMAIN_PRODUCT_ID: "prod_domain1", BACHS_PUBLISHING_PRODUCT_ID: "prod_domain1" }), null);
assert.equal(sandboxFirestoreBlocked({ BACHS_API_KEY: "sk_sandbox_test", FIREBASE_PROJECT_ID: "custom-portfolio-2026", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }), true);
assert.equal(sandboxFirestoreBlocked({ BACHS_API_KEY: "sk_sandbox_test", FIREBASE_PROJECT_ID: "custom-by-broadbrand", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }), true);

const quote = quoteDomainPrice({ price: 15000, currency: "NGN", period: 1, premium: false, markupBasisPoints: 0 });
if (!quote) throw new Error("quote");
assert.equal(quote.customerAmount, "15000.00");
const cart = domainCheckoutCart("prod_domain1", quote.customerAmount);
const otherQuote = quoteDomainPrice({ price: 20000, currency: "NGN", period: 1, premium: false, markupBasisPoints: 1250 });
const otherCart = otherQuote ? domainCheckoutCart("prod_domain1", otherQuote.customerAmount) : null;
assert.equal(cart?.pricing?.amount, "15000.00");
assert.equal(otherCart?.pricing?.amount, "22500.00");
assert.equal(cart?.product_id, otherCart?.product_id);
assert.equal(cart?.pricing?.price_type, "fixed");
assert.equal("amount" in (cart ?? {}), false);
assert.equal(domainCheckoutCart("prod_domain1", "11.40"), null);
const domainReturn = domainCheckoutReturnUrl("https://tunnel.example/portfolio/publish/return");
assert.equal(domainReturn, "https://tunnel.example/portfolio/publish/return?purpose=domain-registration");
assert.equal(domainCheckoutReturnUrl("https://tunnel.example/portfolio/publish/return?paid=1"), null);

const registrant: DomainRegistrant = {
  firstName: "Ada",
  lastName: "Okoye",
  email: "ada@example.com",
  address: "12 Broad Street",
  city: "Lagos",
  state: "Lagos",
  postalCode: "100001",
  country: "NG",
  phoneCountryCode: "234",
  phone: "8012345678",
};
const opened = openDomainOrder({
  orderId: "orderjourney1",
  paymentId: "payjourney1",
  paymentPurpose: "domain-registration",
  paymentReference: "domain:orderjourney1:payjourney1",
  paymentStatus: "pending",
  uid: "owner-1",
  portfolioId: "portfolio1234",
  domainName: "ada.com.ng",
  quote,
  registrant,
  runtimeMode: "sandbox",
  at: "2026-11-21T00:00:00.000Z",
});
if ("ok" in opened) throw new Error(opened.reason);
opened.order.quoteExpiresAt = "2099-01-01T00:00:00.000Z";
assert.equal(opened.order.portfolioPublished, false);
assert.equal(opened.order.registrarCurrency, "NGN");
assert.equal(opened.order.registrarAmount, "15000.00");
assert.equal(opened.order.portfolioEntitled, false);
const store = memoryDomainStore();
await store.save(opened, { role: "server" });

const env = {
  BACHS_API_KEY: "sk_sandbox_test",
  BACHS_WEBHOOK_SECRET: "sandbox-webhook-secret",
  BACHS_DOMAIN_PRODUCT_ID: "prod_domain1",
  BACHS_PUBLISHING_PRODUCT_ID: "prod_publish1",
  BACHS_DOMAIN_SUCCESS_URL: "https://tunnel.example/portfolio/publish/return",
  BACHS_DOMAIN_CANCEL_URL: "https://tunnel.example/portfolio/publish/cancelled",
  FIREBASE_PROJECT_ID: "demo-custom-portfolio",
  VITE_FIREBASE_PROJECT_ID: "demo-custom-portfolio",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
};

let checkoutAmount = "";
const checkoutResponse = { status: 0, body: {} as Record<string, unknown> };
await handleDomainCheckout({
  method: "POST",
  headers: { authorization: "Bearer token" },
  body: JSON.stringify({ orderId: opened.order.orderId }),
}, {
  status(code: number) { checkoutResponse.status = code; return this; },
  setHeader() {},
  end(value: string) { checkoutResponse.body = JSON.parse(value) as Record<string, unknown>; },
}, {
  env,
  verify: async () => ({ uid: "owner-1" }),
  readOrder: async (orderId, uid) => {
    const found = await store.read(orderId, { role: "server" });
    if (!found || found.order.uid !== uid) return null;
    return found.order;
  },
  createCheckout: async (request) => {
    const item = request.product_cart[0];
    checkoutAmount = item && "pricing" in item && item ? item.pricing.amount : "";
    return {
      checkout_id: "chk_domain_1",
      checkout_url: "https://checkout.bachs.io/c/domain",
      amount: item && "pricing" in item && item?.pricing?.amount ? item.pricing.amount : "",
      currency: "NGN",
      reference: request.reference,
    };
  },
});
assert.equal(checkoutResponse.status, 200);
assert.equal(checkoutAmount, "15000.00");
assert.equal(checkoutResponse.body.purpose, "domain-registration");

const echoed = { status: 0 };
await handleDomainCheckout({
  method: "POST",
  headers: { authorization: "Bearer token" },
  body: JSON.stringify({ orderId: opened.order.orderId }),
}, {
  status(code: number) { echoed.status = code; return this; },
  setHeader() {},
  end() {},
}, {
  env,
  verify: async () => ({ uid: "owner-1" }),
  readOrder: async () => opened.order,
  createCheckout: async (request) => ({
    checkout_id: "chk_domain_2",
    checkout_url: "https://checkout.bachs.io/c/other",
    amount: "10000.00",
    currency: "NGN",
    reference: request.reference,
  }),
});
assert.equal(echoed.status, 502);

const expired = { status: 0, body: {} as Record<string, unknown> };
let expiredCheckoutCalls = 0;
await handleDomainCheckout({
  method: "POST",
  headers: { authorization: "Bearer token" },
  body: JSON.stringify({ orderId: opened.order.orderId }),
}, {
  status(code: number) { expired.status = code; return this; },
  setHeader() {},
  end(value: string) { expired.body = JSON.parse(value) as Record<string, unknown>; },
}, {
  env,
  verify: async () => ({ uid: "owner-1" }),
  readOrder: async () => ({ ...opened.order, quoteExpiresAt: "2000-01-01T00:00:00.000Z" }),
  createCheckout: async () => {
    expiredCheckoutCalls += 1;
    return null;
  },
});
assert.equal(expired.status, 409);
assert.equal(expired.body.code, "quote-expired");
assert.equal(expiredCheckoutCalls, 0);

assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "NGN",
  amount: "14999.99",
  amountPaid: "14999.99",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "underpaid");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "NGN",
  amount: "15000.01",
  amountPaid: "15000.01",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "overpaid");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "USD",
  amount: "15000.00",
  amountPaid: "15000.00",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "currency");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_other",
  currency: "NGN",
  amount: "15000.00",
  amountPaid: "15000.00",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "wrong-product");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "NGN",
  amount: "15000.00",
  amountPaid: "15000.00",
  status: "failed",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "failed");
assert.equal(decideDomainCollection({
  eventType: "collection.succeeded",
  purpose: "annual-publishing",
  productId: "prod_publish1",
  currency: "NGN",
  amount: "10000.00",
  amountPaid: "10000.00",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: false,
}), "publishing");
assert.equal(decideDomainCollection({
  eventType: "refund.paid",
  purpose: "domain-registration",
  productId: "prod_domain1",
  currency: "NGN",
  amount: "15000.00",
  amountPaid: "15000.00",
  status: "succeeded",
  configuredProductId: "prod_domain1",
  publishingProductId: "prod_publish1",
  orderAmount: "15000.00",
  orderCurrency: "NGN",
  alreadyVerified: true,
}), "refund");

const mismatched = markDomainPaymentVerified({
  records: opened,
  purpose: "domain-registration",
  reference: "domain:orderjourney1:payother01",
  paymentId: "payjourney1",
  at: "2026-11-21T00:01:00.000Z",
});
assert.equal(mismatched.result.kind, "rejected");
const verified = markDomainPaymentVerified({
  records: opened,
  purpose: "domain-registration",
  reference: "domain:orderjourney1:payjourney1",
  paymentId: "payjourney1",
  at: "2026-11-21T00:01:00.000Z",
});
assert.equal(verified.result.kind, "verified");
const duplicate = markDomainPaymentVerified({
  records: verified.records,
  purpose: "domain-registration",
  reference: "domain:orderjourney1:payjourney1",
  paymentId: "payjourney1",
  at: "2026-11-21T00:02:00.000Z",
});
assert.equal(duplicate.result.kind, "duplicate");
if (!verified.records) throw new Error("missing");
verified.records.order.portfolioPublished = true;
verified.records.order.portfolioEntitled = true;

let registrations = 0;
let nameserverFailures = 0;
function api(mode: "ok" | "taken" | "register-fail" | "nameserver-fail"): DomainNameApi {
  return {
    async search() {
      if (mode === "taken") return { domainName: "ada.com.ng", tld: "com.ng", status: "NOTAVAILABLE", isPremium: false, isDocumentRequired: false, price: 15000, currency: "NGN", period: 1 };
      return { domainName: "ada.com.ng", tld: "com.ng", status: "AVAILABLE", isPremium: false, isDocumentRequired: false, price: 15000, currency: "NGN", period: 1 };
    },
    async listTlds() { return []; },
    async register() {
      registrations += 1;
      if (mode === "register-fail") return { ok: false, code: "Dna.DomainService:Domain:10017", retryable: true };
      return { accepted: true, domainId: "domain-1", status: "Active", expirationDate: "2027-11-21T00:00:00.000Z", code: null };
    },
    async readDomain() {
      return { ok: false, code: "missing", retryable: false };
    },
    async replaceNameServers() {
      if (mode === "nameserver-fail") {
        nameserverFailures += 1;
        return { ok: false, code: "nameserver-rejected", retryable: false };
      }
      return { ok: true };
    },
  };
}
function cloud(zoneStatus = "active"): CloudflareClient {
  return {
    async findZone() { return null; },
    async ensureZone() { return { id: "zone-1", name: "ada.com.ng", status: zoneStatus, nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] }; },
    async ensureZoneRecords() { return undefined; },
    async readZoneCertificate() { return "pending"; },
    async ensureCustomHostname() { return { id: "host", hostname: "ada.com.ng", status: "pending", certificateStatus: "pending" }; },
    async readCustomHostname() { return null; },
  };
}

const taken = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("taken"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:03:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(taken.registration.status, "failed");
assert.equal(taken.order.paymentStatus, "verified");

const failedRegistration = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("register-fail"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:04:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(failedRegistration.order.paymentStatus, "verified");
assert.equal(domainCustomerState(failedRegistration), "registration-failed");

const nameserverFailed = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("nameserver-fail"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:05:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(domainCustomerState(nameserverFailed), "provisioning-failed");
assert.equal(nameserverFailed.order.paymentStatus, "verified");

const dnsFailed = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("ok"),
  cloudflare: { ...cloud(), async ensureZoneRecords() { throw new Error("dns"); } },
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:06:00.000Z",
  store: memoryDomainStore(),
  visitorCertificate: async () => "active",
});
assert.equal(dnsFailed.events.some((event) => event.kind === "provisioning-failed"), true);

const sslPending = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("ok"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:07:00.000Z",
  store: memoryDomainStore(),
  visitorCertificate: async () => "pending",
});
assert.equal(domainCustomerState(sslPending), "provisioning-ssl");
assert.equal(sslPending.provisioning.fallbackOrigin, null);

const before = registrations;
const connected = await advanceDomainOrder({
  records: structuredClone(verified.records),
  api: api("ok"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:08:00.000Z",
  store: memoryDomainStore(),
  visitorCertificate: async () => "active",
});
assert.equal(domainCustomerState(connected), "connected");
const repeated = await advanceDomainOrder({
  records: connected,
  api: api("ok"),
  cloudflare: cloud(),
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: null,
  renewalPeriods: [1],
  at: "2026-11-21T00:09:00.000Z",
  store: memoryDomainStore(),
  visitorCertificate: async () => "active",
});
assert.equal(registrations, before + 1);
assert.equal(domainCustomerState(repeated), "connected");
assert.equal(classifyRequestHost({ host: "ada.com.ng", "x-forwarded-host": "ada.com.ng" }, [repeated]).kind, "portfolio");
assert.equal(classifyRequestHost({ host: "www.ada.com.ng", "x-forwarded-host": "www.ada.com.ng" }, [repeated]).kind, "portfolio");

let publishingRefunds = 0;
const invalidBody = JSON.stringify({ id: "evt_bad", type: "collection.succeeded", created_at: "2026-11-21T00:00:00.000Z", organization_id: "org", data: { reference: "domain:orderjourney1:payjourney1" } });
const invalidStamp = Math.floor(Date.now() / 1000);
const invalidDigest = createHmac("sha256", "wrong-secret").update(`${invalidStamp}.`).update(invalidBody).digest("hex");
const invalid = { status: 0 };
await handleBachsWebhook({
  method: "POST",
  headers: { "x-bachs-signature-v2": `t=${invalidStamp},v1=${invalidDigest}` },
  body: invalidBody,
}, {
  status(code: number) { invalid.status = code; return this; },
  setHeader() {},
  end() {},
}, { env });
assert.equal(invalid.status, 400);

const refund = { status: 0 };
await handleBachsWebhook({
  method: "POST",
  headers: {},
  body: "{}",
}, {
  status(code: number) { refund.status = code; return this; },
  setHeader() {},
  end() {},
}, {
  env,
  constructEvent: () => ({ id: "evt_refund", type: "refund.paid", created_at: "2026-11-21T00:00:00.000Z", organization_id: "org", data: { reference: "domain:orderjourney1:payjourney1" } }) as never,
  settleDomainPayment: async () => "held",
  settleRefund: async () => {
    publishingRefunds += 1;
    return { kind: "revoked", expiresAt: null };
  },
});
assert.equal(refund.status, 200);
assert.equal(publishingRefunds, 0);

const orderResponse = { status: 0, body: {} as Record<string, unknown> };
await handleDomainOrder({
  method: "POST",
  headers: { authorization: "Bearer token" },
  body: JSON.stringify({ portfolioId: "portfolio1234", domainName: "ada.com.ng", registrant }),
}, {
  status(code: number) { orderResponse.status = code; return this; },
  setHeader() {},
  end(value: string) { orderResponse.body = JSON.parse(value) as Record<string, unknown>; },
}, {
  env,
  verify: async () => ({ uid: "owner-1" }),
  ownsPortfolio: async (uid, portfolioId) => uid === "owner-1" && portfolioId === "portfolio1234",
  quote: async () => ({ available: true, currency: "NGN", customerAmount: "15000.00", wholesaleAmount: "15000.00", period: 1, premium: false }),
  createOrder: async () => ({ orderId: "orderjourney1", state: "awaiting-payment" }),
});
assert.equal(orderResponse.status, 200);
assert.equal(orderResponse.body.customerAmount, "15000.00");
assert.equal(JSON.stringify(orderResponse.body).includes("ada@example.com"), false);
assert.equal(nameserverFailures, 1);

console.log("domain journey checks passed");
