import assert from "node:assert/strict";
import { readCloudflareConfig, createCloudflareClient, vercelCnameTarget } from "./cloudflareProvisioning";
import { openDomainOrder } from "./domainLifecycle";
import { classifyRequestHost, isPlatformHost, siteRoutePlan, ROUTING_ARCHITECTURE, type HostDecision } from "./domainHostname";
import { quoteDomainPrice } from "./domainPricing";
import { readVercelCertificateStatus } from "./vercelDomainAttachment";
import type { DomainRecordSet, DomainRegistrant } from "./domainRecords";

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

function records(patch: (value: DomainRecordSet) => void, domainName = "ada.com.ng"): DomainRecordSet {
  const quote = quoteDomainPrice({ price: 15000, currency: "NGN", period: 1, premium: false, markupBasisPoints: 0 });
  if (!quote) throw new Error("quote");
  const opened = openDomainOrder({
    orderId: `order-${domainName.replaceAll(".", "")}`,
    paymentId: "pay-routing1",
    paymentPurpose: "domain-registration",
    paymentReference: "domain:order-routing:pay-routing1",
    paymentStatus: "verified",
    uid: "owner-1",
    portfolioId: "portfolio1234",
    domainName,
    quote,
    registrant,
    runtimeMode: "sandbox",
    at: "2026-11-21T00:00:00.000Z",
    portfolioPublished: true,
    portfolioEntitled: true,
  });
  if ("ok" in opened) throw new Error(opened.reason);
  opened.registration.status = "confirmed";
  opened.registration.providerStatus = "Active";
  opened.registration.providerDomainId = "domain-1";
  opened.registration.expirationDate = "2027-11-21T00:00:00.000Z";
  opened.provisioning.mode = "cloudflare-zone";
  opened.provisioning.zoneId = "zone-1";
  opened.provisioning.zoneStatus = "active";
  opened.provisioning.nameserverUpdate = "accepted";
  opened.provisioning.nameservers = ["ns1.cloudflare.com", "ns2.cloudflare.com"];
  opened.provisioning.certificateStatus = "active";
  opened.provisioning.apexSupported = true;
  opened.provisioning.fallbackOrigin = null;
  patch(opened);
  return opened;
}

function reason(decision: HostDecision): string {
  return decision.kind === "unavailable" ? decision.reason : decision.kind;
}

const connected = records(() => undefined);
const headers = { host: "ada.com.ng", "x-forwarded-host": "ada.com.ng" };
assert.equal(ROUTING_ARCHITECTURE.selected, "vercel-project-domain-dns-only");
assert.equal(ROUTING_ARCHITECTURE.fallbackOriginRequired, false);
assert.equal(classifyRequestHost(headers, [connected]).kind, "portfolio");
assert.equal(reason(classifyRequestHost({ host: "ada.com.ng", "x-forwarded-host": "ada.com.ng" }, [connected])), "portfolio");
assert.equal(reason(classifyRequestHost({ host: "www.ada.com.ng", "x-forwarded-host": "www.ada.com.ng" }, [connected])), "portfolio");
assert.equal(reason(classifyRequestHost({ host: "missing.example", "x-forwarded-host": "missing.example" }, [connected])), "unknown");
assert.equal(reason(classifyRequestHost({ host: "custom-portfolio-ebon.vercel.app" }, [connected])), "platform");
assert.equal(reason(classifyRequestHost({ host: "customportfolio.broadbrand.com.ng" }, [connected])), "platform");
assert.equal(isPlatformHost("preview-name.vercel.app"), true);
assert.equal(reason(classifyRequestHost({ host: "ada.com.ng", "x-forwarded-host": "evil.example" }, [connected])), "spoofed");
assert.equal(reason(classifyRequestHost({ host: "custom-portfolio-ebon.vercel.app", "x-forwarded-host": "ada.com.ng" }, [connected])), "spoofed");

const other = records((value) => {
  value.order.orderId = "order-other";
  value.order.portfolioId = "portfolio9999";
}, "ada.com.ng");
assert.equal(reason(classifyRequestHost(headers, [connected, other])), "conflict");

const unverified = records((value) => {
  value.registration.status = "not-requested";
  value.registration.providerStatus = null;
  value.registration.providerDomainId = null;
});
assert.equal(reason(classifyRequestHost(headers, [unverified])), "unverified");

const expired = records((value) => {
  value.registration.expirationDate = "2020-01-01T00:00:00.000Z";
});
assert.equal(reason(classifyRequestHost(headers, [expired], new Date("2026-11-21T00:00:00.000Z"))), "expired");

const unpublished = records((value) => {
  value.order.portfolioPublished = false;
});
assert.equal(reason(classifyRequestHost(headers, [unpublished])), "unpublished");

const unentitled = records((value) => {
  value.order.portfolioEntitled = false;
});
assert.equal(reason(classifyRequestHost(headers, [unentitled])), "unentitled");

const pendingSsl = records((value) => {
  value.provisioning.certificateStatus = "pending";
});
assert.equal(reason(classifyRequestHost(headers, [pendingSsl])), "disconnected");

const unmapped = records((value) => {
  value.provisioning.zoneId = null;
  value.provisioning.hostnameId = null;
  value.provisioning.certificateStatus = null;
  value.provisioning.nameserverUpdate = "not-proven";
});
assert.equal(reason(classifyRequestHost(headers, [unmapped])), "missing-mapping");

const url = new URL("https://ada.com.ng/api/site?kind=portfolio&publicId=portfolio1234&ref=keep");
assert.equal(url.searchParams.get("ref"), "keep");
assert.deepEqual(siteRoutePlan(url, headers, [connected]), { action: "portfolio-path", publicId: "portfolio1234" });
assert.deepEqual(siteRoutePlan(new URL("https://ada.com.ng/api/site?kind=home&ref=keep"), headers, [connected]), {
  action: "custom-portfolio",
  portfolioId: "portfolio1234",
});
assert.equal(siteRoutePlan(new URL("https://custom-portfolio-ebon.vercel.app/api/site?kind=home"), { host: "custom-portfolio-ebon.vercel.app" }, [connected]).action, "home");

assert.equal(readVercelCertificateStatus({ verified: true }), "pending");
assert.equal(readVercelCertificateStatus({ verified: true, cert: { status: "active" } }), "active");
assert.equal(vercelCnameTarget("custom-portfolio-ebon.vercel.app"), false);
assert.equal(readCloudflareConfig({
  CLOUDFLARE_API_TOKEN: "token",
  CLOUDFLARE_ACCOUNT_ID: "account",
  VERCEL_APEX_IPV4: "216.198.79.1",
  VERCEL_CNAME_TARGET: "custom-portfolio-ebon.vercel.app",
}), null);
assert.equal(readCloudflareConfig({ CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_FALLBACK_ORIGIN: "portfolios.example.net" }), null);

const posted: unknown[] = [];
const cloudflare = createCloudflareClient({
  token: "token",
  accountId: "account",
  saasZoneId: "",
  fallbackOrigin: "",
  apexIpv4: "216.198.79.1",
  cnameTarget: "abcd1234.vercel-dns-017.com",
  apexProxying: false,
  writesEnabled: true,
}, async (url, init) => {
  if (init.method === "POST" && url.includes("/dns_records")) posted.push(JSON.parse(init.body ?? "{}"));
  return { status: 200, body: { success: true, result: [] } };
});
await cloudflare.ensureZoneRecords("zone-1", "ada.com.ng");
assert.deepEqual(posted, [
  { type: "A", name: "ada.com.ng", content: "216.198.79.1", proxied: false },
  { type: "CNAME", name: "www.ada.com.ng", content: "abcd1234.vercel-dns-017.com", proxied: false },
]);

console.log("domain routing checks passed");
