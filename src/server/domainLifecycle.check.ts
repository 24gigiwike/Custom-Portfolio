import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hostnameCoverage, readCloudflareConfig, selectProvisioningMode, createCloudflareClient } from "./cloudflareProvisioning";
import { domainCustomerState, domainIsConnected } from "./domainCustomerState";
import { portfolioIdForHostname, resolveRequestHostname } from "./domainHostname";
import { markDomainPaymentVerified, readDomainProductId } from "./domainPayment";
import { nameserverAutomationStatus, nameserverDelegation } from "./cloudflareProvisioning";
import { advanceDomainOrder, openDomainOrder, quoteDomain } from "./domainLifecycle";
import { DNA_LIVE_ORIGIN, DNA_OTE_ORIGIN, NAMESERVER_UPDATE_PROVEN_AGAINST_OTE, createDomainNameApi, nigerianTldSupport, readDomainNameApiConfig, type DomainNameApi } from "./domainNameApi";
import { handleDomainSearch, type DomainSearchResponse } from "./domainOrderHandler";
import { quoteDomainPrice, readMarkupBasisPoints } from "./domainPricing";
import { DomainAccessError, memoryDomainStore, publicPortfolioProjection, type DomainRegistrant, type DomainRecordSet } from "./domainRecords";
import type { CloudflareClient } from "./cloudflareProvisioning";

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

function quote() {
  const priced = quoteDomainPrice({ price: 11.4, currency: "USD", period: 1, premium: false, markupBasisPoints: 0 });
  if (!priced) throw new Error("quote");
  return priced;
}

function order(paymentStatus: "pending" | "verified" | "failed" = "verified"): DomainRecordSet {
  const opened = openDomainOrder({
    orderId: "order-1",
    paymentId: "pay-1",
    paymentPurpose: "domain-registration",
    paymentReference: "domain:order-1",
    paymentStatus,
    uid: "owner-1",
    portfolioId: "portfolio1234",
    domainName: "Ada.COM.ng",
    quote: quote(),
    registrant,
    runtimeMode: "sandbox",
    at: "2026-11-21T00:00:00.000Z",
  });
  if ("ok" in opened) throw new Error(opened.reason);
  opened.order.portfolioPublished = true;
  opened.order.portfolioEntitled = true;
  return opened;
}

function api(overrides: Partial<{ status: string; registerStatus: string; registerCode: string | null; infoStatus: string }> = {}): { client: DomainNameApi; calls: { search: number; register: number; nameservers: number } } {
  const calls = { search: 0, register: 0, nameservers: 0 };
  const client = createDomainNameApi({
    baseOrigin: DNA_OTE_ORIGIN,
    apiKey: "ote-test-key",
    resellerId: "reseller-test",
    allowRegistration: true,
  }, async (url, init) => {
    if (url.endsWith("/domains/search")) {
      calls.search += 1;
      return { status: 200, body: { success: true, info: { domainName: "ada.com.ng", tld: "com.ng", status: overrides.status ?? "AVAILABLE", isPremium: false, isDocumentRequired: false, price: 11.4, currency: "USD", period: 1 } } };
    }
    if (url.endsWith("/domains/register-with-contacts")) {
      calls.register += 1;
      const body = JSON.parse(init.body ?? "{}") as { nameServers?: string[] };
      assert.ok(Array.isArray(body.nameServers) && body.nameServers.length >= 2);
      if (overrides.registerCode) return { status: 400, body: { error: { code: overrides.registerCode } } };
      return { status: 200, body: { success: true, domainId: "domain-1", status: overrides.registerStatus ?? "Active", expirationDate: "2027-11-21T00:00:00" } };
    }
    if (url.includes("/domains/info")) {
      if (overrides.infoStatus === "missing") return { status: 404, body: { error: { code: "Dna.DomainService:Domain:10007" } } };
      return { status: 200, body: { domainName: "ada.com.ng", status: overrides.infoStatus ?? "Active", expirationDate: "2027-11-21T00:00:00", remainingDay: 365, nameservers: [], renewalMode: "AutoExpire" } };
    }
    if (url.endsWith("/domains/dns/name-server")) {
      calls.nameservers += 1;
      const body = JSON.parse(init.body ?? "{}") as { dnssecMode?: number; nameServers?: string[] };
      assert.equal(body.dnssecMode, 2);
      assert.equal(init.method, "PUT");
      return { status: 204, body: null };
    }
    return { status: 404, body: { error: { code: "missing" } } };
  });
  return { client, calls };
}

function cloud(status = "active", certificate = "active"): { client: CloudflareClient; calls: { zone: number; hostname: number } } {
  const calls = { zone: 0, hostname: 0 };
  return {
    calls,
    client: {
      async findZone() { return null; },
      async ensureZone(domainName: string) {
        calls.zone += 1;
        return { id: "zone-1", name: domainName, status, nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] };
      },
      async ensureZoneRecords() { return undefined; },
      async readZoneCertificate() { return certificate; },
      async ensureCustomHostname(hostname: string) {
        calls.hostname += 1;
        return { id: "host-1", hostname, status: "pending", certificateStatus: "pending_validation" };
      },
      async readCustomHostname() { return null; },
    },
  };
}

assert.equal(readDomainNameApiConfig({ DNA_API_BASE: DNA_LIVE_ORIGIN, DNA_API_KEY: "live-key-value", DNA_RESELLER_ID: "reseller-1" }), null);
const mappedOte = readDomainNameApiConfig({
  DOMAINNAMEAPI_ENV: DNA_OTE_ORIGIN,
  DOMAIN_NAME_API_OTE_KEY: "ote-key-value",
  DOMAIN_NAME_API_OTE_RESELLER_ID: "reseller-1",
});
assert.equal(mappedOte?.baseOrigin, DNA_OTE_ORIGIN);
assert.equal(mappedOte?.allowRegistration, false);
assert.equal(readDomainNameApiConfig({
  DOMAINNAMEAPI_ENV: DNA_LIVE_ORIGIN,
  DOMAIN_NAME_API_OTE_KEY: "ote-key-value",
  DOMAIN_NAME_API_OTE_RESELLER_ID: "reseller-1",
}), null);
assert.equal(readDomainNameApiConfig({
  DNA_API_BASE: DNA_OTE_ORIGIN,
  DNA_API_KEY: "explicit-key",
  DNA_RESELLER_ID: "reseller-1",
  DOMAIN_NAME_API_OTE_KEY: "other-ote-key",
})?.apiKey, "explicit-key");
assert.equal(NAMESERVER_UPDATE_PROVEN_AGAINST_OTE, false);
assert.equal(quoteDomainPrice({ price: 11.4, currency: "USD", period: 1, premium: false, markupBasisPoints: 250 })?.customerAmount, "11.69");
assert.equal(readMarkupBasisPoints({}), 0);

const catalogue = createDomainNameApi({
  baseOrigin: DNA_OTE_ORIGIN,
  apiKey: "ote-test-key",
  resellerId: "reseller-test",
  allowRegistration: false,
}, async (url) => {
  if (url.includes("/products/tlds")) {
    return { status: 200, body: { items: [
      { name: "ng", registrationPeriods: [1, 5], renewalPeriods: [1], availableInTestEnvironment: true, registryDnsCheck: false },
      { name: "com.ng", registrationPeriods: [1, 5], renewalPeriods: [1], availableInTestEnvironment: true, registryDnsCheck: false },
    ] } };
  }
  return { status: 403, body: { error: { code: "registration-not-allowed" } } };
});
const tlds = await catalogue.listTlds("ng");
if ("ok" in tlds) throw new Error(tlds.code);
assert.deepEqual(nigerianTldSupport(tlds), { ng: "supported-in-test", comNg: "supported-in-test" });
assert.deepEqual(nigerianTldSupport([]), { ng: "not-listed", comNg: "not-listed" });
const blocked = await catalogue.register({ domainName: "ada.ng", period: 1, nameServers: ["ns1.cloudflare.com", "ns2.cloudflare.com"], contact: registrant });
assert.equal("ok" in blocked && blocked.code, "registration-not-allowed");

assert.equal(selectProvisioningMode({ preferSaas: false, apexProxying: false }), "cloudflare-zone");
assert.equal(hostnameCoverage("cloudflare-zone", false).apex, "supported");
assert.equal(hostnameCoverage("cloudflare-zone", false).www, "supported");
assert.equal(hostnameCoverage("cloudflare-saas", false).apex, "unsupported");
assert.equal(hostnameCoverage("cloudflare-saas", false).www, "supported");
assert.equal(hostnameCoverage("cloudflare-saas", true).apex, "supported");
assert.equal(readCloudflareConfig({
  CLOUDFLARE_API_TOKEN: "token",
  CLOUDFLARE_ACCOUNT_ID: "account",
  CLOUDFLARE_SAAS_ZONE_ID: "zone",
  CLOUDFLARE_FALLBACK_ORIGIN: "customportfolio.broadbrand.com.ng",
}), null);

const store = memoryDomainStore();
const ready = api();
const dns = cloud();
const connected = await advanceDomainOrder({
  records: order(),
  api: ready.client,
  cloudflare: dns.client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1, 2, 3, 4, 5],
  at: "2026-11-21T00:01:00.000Z",
  store,
});
assert.equal(domainCustomerState(connected), "connected");
assert.equal(connected.registration.autoRenew, false);
assert.equal(connected.order.paymentStatus, "verified");
assert.deepEqual(portfolioIdForHostname("ada.com.ng", [connected]), "portfolio1234");
assert.equal(portfolioIdForHostname("www.ada.com.ng", [connected]), "portfolio1234");
assert.equal(dns.calls.hostname, 0);
assert.equal(ready.calls.register, 1);
assert.equal(ready.calls.nameservers, 1);
const again = await advanceDomainOrder({
  records: connected,
  api: ready.client,
  cloudflare: dns.client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:02:00.000Z",
  store,
});
assert.equal(ready.calls.register, 1);
assert.equal(domainIsConnected(again), true);

const pendingCert = cloud("active", "pending_validation");
const ssl = await advanceDomainOrder({
  records: order(),
  api: api().client,
  cloudflare: pendingCert.client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:03:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(domainCustomerState(ssl), "provisioning-ssl");
assert.equal(portfolioIdForHostname("ada.com.ng", [ssl]), null);

const waitingApi = api({ registerStatus: "WaitingForDocument" });
const waiting = await advanceDomainOrder({
  records: order(),
  api: waitingApi.client,
  cloudflare: cloud().client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:04:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(domainCustomerState(waiting), "registration-pending");
assert.equal(waitingApi.calls.nameservers, 0);
assert.equal(domainIsConnected(waiting), false);

const lost = api({ status: "NOTAVAILABLE", infoStatus: "missing" });
const unavailable = await advanceDomainOrder({
  records: order(),
  api: lost.client,
  cloudflare: cloud().client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:05:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(unavailable.registration.status, "failed");
assert.equal(unavailable.order.paymentStatus, "verified");
assert.equal(lost.calls.register, 0);

const unpaid = api();
const pending = await advanceDomainOrder({
  records: order("pending"),
  api: unpaid.client,
  cloudflare: cloud().client,
  preferSaas: false,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:06:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(domainCustomerState(pending), "awaiting-payment");
assert.equal(unpaid.calls.search, 0);

const publishing = openDomainOrder({
  orderId: "order-2",
  paymentId: "pay-2",
  paymentPurpose: "annual-publishing",
  paymentReference: "publishing:portfolio1234:11111111-1111-1111-1111-111111111111",
  paymentStatus: "verified",
  uid: "owner-1",
  portfolioId: "portfolio1234",
  domainName: "ada.ng",
  quote: quote(),
  registrant,
  runtimeMode: "sandbox",
  at: "2026-11-21T00:00:00.000Z",
});
assert.equal("ok" in publishing && publishing.reason, "publishing-payment");

assert.throws(() => store.save(connected, { role: "owner", uid: "owner-1" }), DomainAccessError);
assert.throws(() => store.read(connected.order.orderId, { role: "owner", uid: "other-user" }), DomainAccessError);
const projected = publicPortfolioProjection({ title: "Ada", email: registrant.email, registrant }, connected);
assert.equal("email" in projected, false);
assert.equal(projected.customDomain, "ada.com.ng");

const saasRecord = order();
saasRecord.provisioning.nameservers = ["ns1.example.net", "ns2.example.net"];
const saasDns = cloud();
const saasApi = api();
const saas = await advanceDomainOrder({
  records: saasRecord,
  api: saasApi.client,
  cloudflare: saasDns.client,
  preferSaas: true,
  apexProxying: false,
  fallbackOrigin: "portfolios.example.net",
  renewalPeriods: [1],
  at: "2026-11-21T00:07:00.000Z",
  store: memoryDomainStore(),
});
assert.equal(saasDns.calls.zone, 0);
assert.equal(saasDns.calls.hostname, 1);
assert.equal(saas.provisioning.apexSupported, false);
assert.equal(portfolioIdForHostname("ada.com.ng", [saas]), null);

let postedZones = 0;
const cf = createCloudflareClient({
  token: "token",
  accountId: "account",
  saasZoneId: "saas-zone",
  fallbackOrigin: "portfolios.example.net",
  apexIpv4: "216.198.79.1",
  cnameTarget: "abcd1234.vercel-dns-017.com",
  apexProxying: false,
  writesEnabled: true,
}, async (url, init) => {
  if (init.method === "GET" && url.includes("/zones?")) {
    return { status: 200, body: { success: true, result: postedZones === 0 ? [] : [{ id: "zone-1", name: "ada.com.ng", status: "pending", name_servers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] }] } };
  }
  if (init.method === "POST" && url.endsWith("/zones")) {
    postedZones += 1;
    return { status: 200, body: { success: true, result: { id: "zone-1", name: "ada.com.ng", status: "pending", name_servers: ["ns1.cloudflare.com", "ns2.cloudflare.com"] } } };
  }
  return { status: 200, body: { success: true, result: [] } };
});
assert.equal((await cf.ensureZone("ada.com.ng")).id, "zone-1");
assert.equal((await cf.ensureZone("ada.com.ng")).id, "zone-1");
assert.equal(postedZones, 1);
await assert.rejects(createCloudflareClient({ ...{
  token: "token", accountId: "account", saasZoneId: "saas-zone", fallbackOrigin: "portfolios.example.net", apexIpv4: "216.198.79.1", cnameTarget: "abcd1234.vercel-dns-017.com", apexProxying: false, writesEnabled: false,
} }, async () => ({ status: 200, body: { success: true, result: [] } })).ensureZone("ada.com.ng"));

const responses: Array<{ status: number; body: string }> = [];
let statusCode = 0;
const searchResponse: DomainSearchResponse = {
  status(code: number) {
    statusCode = code;
    return searchResponse;
  },
  setHeader() {},
  end(body: string) { responses.push({ status: statusCode, body }); },
};
await handleDomainSearch({
  method: "POST",
  headers: { authorization: "Bearer token" },
  body: JSON.stringify({ domainName: "ada.com.ng" }),
}, searchResponse, {
  env: { FIREBASE_PROJECT_ID: "demo-custom-portfolio" },
  verify: async () => ({ uid: "owner-1" }),
  search: async () => ({ available: true, status: "AVAILABLE", quote: { currency: "USD", customerAmount: "11.40", period: 1 } }),
});
assert.equal(responses[0]?.status, 200);
assert.equal(responses[0]?.body.includes("ada@example.com"), false);
assert.equal(responses[0]?.body.includes("11.40"), true);

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
assert.equal(rules.includes("match /domainOrders/{orderId}"), true);
assert.equal(rules.includes("match /domainRegistrants/{orderId}"), true);

const searched = await quoteDomain({ api: ready.client, domainName: "ada.com.ng", markupBasisPoints: 0 });
assert.equal(searched.available, true);
assert.equal(searched.quote?.customerAmount, "11.40");

assert.equal(resolveRequestHostname({ host: "ada.com.ng", "x-forwarded-host": "ada.com.ng" }, [connected]), "portfolio1234");
assert.equal(resolveRequestHostname({ host: "customportfolio.broadbrand.com.ng", "x-forwarded-host": "ada.com.ng" }, [connected]), null);
assert.equal(resolveRequestHostname({ host: "ada.com.ng", "x-forwarded-host": "other.example.com" }, [connected]), null);
const hidden = { ...connected, order: { ...connected.order, portfolioPublished: false } };
assert.equal(portfolioIdForHostname("ada.com.ng", [hidden]), null);
const unentitled = { ...connected, order: { ...connected.order, portfolioEntitled: false } };
assert.equal(portfolioIdForHostname("www.ada.com.ng", [unentitled]), null);
const expired = { ...connected, registration: { ...connected.registration, expirationDate: "2020-01-01T00:00:00.000Z" } };
assert.equal(domainCustomerState(expired, new Date("2026-11-21T00:00:00.000Z")), "expired");
assert.equal(portfolioIdForHostname("ada.com.ng", [expired]), null);

const paid = markDomainPaymentVerified({
  records: order("pending"),
  purpose: "domain-registration",
  reference: "domain:order-1:pay-1",
  paymentId: "pay-1",
  at: "2026-11-21T00:08:00.000Z",
});
assert.equal(paid.result.kind, "verified");
const againPaid = markDomainPaymentVerified({
  records: paid.records,
  purpose: "domain-registration",
  reference: "domain:order-1:pay-1",
  paymentId: "pay-1",
  at: "2026-11-21T00:09:00.000Z",
});
assert.equal(againPaid.result.kind, "duplicate");
const publishingPayment = markDomainPaymentVerified({
  records: order("pending"),
  purpose: "annual-publishing",
  reference: "publishing:portfolio1234:11111111-1111-1111-1111-111111111111",
  paymentId: "pay-1",
  at: "2026-11-21T00:10:00.000Z",
});
assert.equal(publishingPayment.result.kind, "rejected");
assert.equal(readDomainProductId({}), null);
assert.equal(readDomainProductId({ BACHS_DOMAIN_PRODUCT_ID: "prod_d8c0e88a960141ac884b" }), null);
assert.equal(readDomainProductId({ BACHS_DOMAIN_PRODUCT_ID: "prod_domain1", BACHS_PUBLISHING_PRODUCT_ID: "prod_domain1" }), null);
assert.equal(nameserverDelegation(["ns2.cloudflare.com", "ns1.cloudflare.com"], ["ns1.cloudflare.com", "ns2.cloudflare.com"]), "matched");
assert.equal(nameserverDelegation(["ns1.cloudflare.com", "ns2.cloudflare.com"], []), "pending");
assert.equal(nameserverAutomationStatus().proven, false);

console.log("domain lifecycle checks passed");
