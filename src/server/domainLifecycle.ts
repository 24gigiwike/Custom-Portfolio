/**
 * Domain purchase fulfilment.
 * A checkout return does not register a domain. Registration starts only after
 * a verified domain-registration payment. A failed registration keeps that payment.
 * Publishing payments are rejected here and never create a domain order.
 */
import { hostnameCoverage, selectProvisioningMode, type CloudflareClient } from "./cloudflareProvisioning";
import { NAMESERVER_UPDATE_PROVEN_AGAINST_OTE, type DomainNameApi } from "./domainNameApi";
import { quoteDomainPrice, type DomainPriceQuote } from "./domainPricing";
import {
  memoryDomainStore,
  normalizeDomainName,
  validateRegistrant,
  type DomainActor,
  type DomainOrder,
  type DomainRecordSet,
  type DomainRegistrant,
} from "./domainRecords";

const PUBLISHING_REFERENCE = /^publishing:/i;

export type DomainStore = {
  read(orderId: string, actor: DomainActor): Promise<DomainRecordSet | null> | DomainRecordSet | null;
  save(next: DomainRecordSet, actor: DomainActor): Promise<DomainRecordSet> | DomainRecordSet;
};

function event(orderId: string, at: string, kind: string, code: string | null) {
  return { orderId, at, kind, code };
}

function blankProvisioning(orderId: string): DomainRecordSet["provisioning"] {
  return {
    orderId,
    mode: null,
    zoneId: null,
    hostnameId: null,
    nameservers: [],
    nameserverUpdate: "not-requested",
    zoneStatus: null,
    hostnameStatus: null,
    certificateStatus: null,
    fallbackOrigin: null,
    apexSupported: false,
  };
}

export function openDomainOrder(input: {
  orderId: string;
  paymentId: string;
  paymentPurpose: string;
  paymentReference: string;
  paymentStatus: DomainOrder["paymentStatus"];
  uid: string;
  portfolioId: string;
  domainName: string;
  quote: DomainPriceQuote;
  registrant: DomainRegistrant;
  runtimeMode: "sandbox" | "live";
  at: string;
  portfolioPublished?: boolean;
  portfolioEntitled?: boolean;
}): DomainRecordSet | { ok: false; reason: "publishing-payment" | "invalid-domain" | "invalid-registrant" } {
  if (input.paymentPurpose !== "domain-registration" || PUBLISHING_REFERENCE.test(input.paymentReference)) {
    return { ok: false, reason: "publishing-payment" };
  }
  const domainName = normalizeDomainName(input.domainName);
  if (!domainName || !validateRegistrant(input.registrant)) {
    return { ok: false, reason: domainName ? "invalid-registrant" : "invalid-domain" };
  }
  return {
    order: {
      orderId: input.orderId,
      paymentId: input.paymentId,
      paymentPurpose: "domain-registration",
      paymentStatus: input.paymentStatus,
      uid: input.uid,
      portfolioId: input.portfolioId,
      domainName,
      currency: input.quote.currency,
      customerAmount: input.quote.customerAmount,
      wholesaleAmount: input.quote.wholesaleAmount,
      registrarCurrency: input.quote.registrarCurrency ?? input.quote.currency,
      registrarAmount: input.quote.registrarAmount ?? input.quote.wholesaleAmount,
      exchangeRate: input.quote.exchangeRate ?? null,
      exchangeRateTimestamp: input.quote.exchangeRateTimestamp ?? null,
      exchangeRateSource: input.quote.exchangeRateSource ?? null,
      convertedAmount: input.quote.convertedAmount ?? null,
      quoteExpiresAt: input.quote.quoteExpiresAt ?? new Date(Date.parse(input.at) + 15 * 60 * 1000).toISOString(),
      markupBasisPoints: input.quote.markupBasisPoints,
      period: input.quote.period,
      runtimeMode: input.runtimeMode,
      createdAt: input.at,
      portfolioPublished: input.portfolioPublished === true,
      portfolioEntitled: input.portfolioEntitled === true,
    },
    registrant: input.registrant,
    registration: {
      orderId: input.orderId,
      uid: input.uid,
      portfolioId: input.portfolioId,
      domainName,
      provider: "domainnameapi",
      providerDomainId: null,
      providerReference: null,
      status: "not-requested",
      providerStatus: null,
      expirationDate: null,
      renewalPeriods: [],
      autoRenew: false,
      idempotencyKey: `domain-register:${input.paymentId}`,
      attemptCount: 0,
    },
    provisioning: blankProvisioning(input.orderId),
    events: [event(input.orderId, input.at, "order-opened", null)],
  };
}

export async function quoteDomain(input: {
  api: DomainNameApi;
  domainName: string;
  markupBasisPoints: number;
}): Promise<{ available: boolean; quote: DomainPriceQuote | null; status: string; tld: string | null }> {
  const domainName = normalizeDomainName(input.domainName);
  if (!domainName) return { available: false, quote: null, status: "INVALIDDOMAINNAME", tld: null };
  const found = await input.api.search(domainName);
  if ("ok" in found) return { available: false, quote: null, status: found.code, tld: null };
  const quote = found.status === "AVAILABLE"
    ? quoteDomainPrice({
      price: found.price,
      currency: found.currency,
      period: found.period,
      premium: found.isPremium,
      markupBasisPoints: input.markupBasisPoints,
    })
    : null;
  return { available: found.status === "AVAILABLE" && quote !== null, quote, status: found.status, tld: found.tld };
}

export async function advanceDomainOrder(input: {
  records: DomainRecordSet;
  api: DomainNameApi;
  cloudflare: CloudflareClient | null;
  preferSaas: boolean;
  apexProxying: boolean;
  fallbackOrigin: string | null;
  renewalPeriods: number[];
  at: string;
  store: DomainStore;
  visitorCertificate?: (domainName: string) => Promise<string>;
}): Promise<DomainRecordSet> {
  const actor: DomainActor = { role: "server" };
  const current = input.records;
  if (current.order.paymentStatus !== "verified") {
    current.events.push(event(current.order.orderId, input.at, "payment-not-verified", current.order.paymentStatus));
    return await input.store.save(current, actor);
  }
  if (current.registration.status !== "confirmed" && current.registration.providerDomainId === null) {
    const latest = await input.api.search(current.order.domainName);
    if ("ok" in latest || latest.status !== "AVAILABLE") {
      if (!("ok" in latest) && latest.status === "NOTAVAILABLE") {
        const owned = await input.api.readDomain(current.order.domainName);
        if (!("ok" in owned) && owned.status === "Active") {
          current.registration.status = "confirmed";
          current.registration.providerStatus = "Active";
          current.registration.expirationDate = owned.expirationDate;
          current.registration.renewalPeriods = input.renewalPeriods;
        } else {
          current.registration.status = "failed";
          current.order.paymentStatus = "verified";
          current.events.push(event(current.order.orderId, input.at, "registration-failed", "unavailable"));
          return await input.store.save(current, actor);
        }
      } else {
        current.registration.status = "failed";
        current.order.paymentStatus = "verified";
        current.events.push(event(current.order.orderId, input.at, "registration-failed", "ok" in latest ? latest.code : latest.status));
        return await input.store.save(current, actor);
      }
    }
  }
  const mode = selectProvisioningMode({ preferSaas: input.preferSaas, apexProxying: input.apexProxying });
  if (current.registration.status !== "confirmed" && current.registration.providerDomainId === null) {
    if (mode === "cloudflare-zone" && input.cloudflare) {
      const zone = await input.cloudflare.ensureZone(current.order.domainName);
      current.provisioning.zoneId = zone.id;
      current.provisioning.nameservers = zone.nameServers;
      current.provisioning.zoneStatus = zone.status;
    }
    if (current.provisioning.nameservers.length < 2) {
      current.provisioning.nameserverUpdate = "not-proven";
      current.events.push(event(current.order.orderId, input.at, "registration-waiting", "nameservers"));
      return await input.store.save(current, actor);
    }
    if (current.registration.attemptCount > 0) {
      const owned = await input.api.readDomain(current.order.domainName);
      if (!("ok" in owned) && owned.status === "Active") {
        current.registration.status = "confirmed";
        current.registration.providerStatus = "Active";
        current.registration.expirationDate = owned.expirationDate;
        current.registration.renewalPeriods = input.renewalPeriods;
      }
    }
  }
  if (current.registration.status !== "confirmed" && current.registration.providerDomainId === null && current.registration.attemptCount === 0) {
    current.registration.attemptCount += 1;
    current.registration.status = "requested";
    const registered = await input.api.register({
      domainName: current.order.domainName,
      period: current.order.period,
      nameServers: current.provisioning.nameservers,
      contact: current.registrant,
    });
    if ("ok" in registered) {
      if (registered.code === "Dna.DomainService:Domain:1026") {
        const owned = await input.api.readDomain(current.order.domainName);
        if (!("ok" in owned) && owned.status === "Active") {
          current.registration.status = "confirmed";
          current.registration.providerStatus = owned.status;
          current.registration.expirationDate = owned.expirationDate;
          current.registration.renewalPeriods = input.renewalPeriods;
        } else {
          current.registration.status = "failed";
          current.order.paymentStatus = "verified";
          current.events.push(event(current.order.orderId, input.at, "registration-failed", registered.code));
          return await input.store.save(current, actor);
        }
      } else {
        current.registration.status = "failed";
        current.order.paymentStatus = "verified";
        current.events.push(event(current.order.orderId, input.at, "registration-failed", registered.code));
        return await input.store.save(current, actor);
      }
    } else if (registered.status === "Active" && registered.domainId) {
      current.registration.status = "confirmed";
      current.registration.providerDomainId = registered.domainId;
      current.registration.providerReference = registered.domainId;
      current.registration.providerStatus = "Active";
      current.registration.expirationDate = registered.expirationDate;
      current.registration.renewalPeriods = input.renewalPeriods;
      current.events.push(event(current.order.orderId, input.at, "registration-confirmed", registered.domainId));
    } else {
      current.registration.status = "pending-provider";
      current.registration.providerDomainId = registered.domainId;
      current.registration.providerStatus = registered.status || "pending";
      current.events.push(event(current.order.orderId, input.at, "registration-pending", registered.status || null));
      return await input.store.save(current, actor);
    }
  }

  const coverage = hostnameCoverage(mode, input.apexProxying);
  current.provisioning.mode = mode;
  current.provisioning.apexSupported = coverage.apex === "supported";
  current.provisioning.fallbackOrigin = mode === "cloudflare-zone" ? null : input.fallbackOrigin;
  if (!input.cloudflare) {
    current.provisioning.nameserverUpdate = NAMESERVER_UPDATE_PROVEN_AGAINST_OTE ? "accepted" : "not-proven";
    current.events.push(event(current.order.orderId, input.at, "provisioning-waiting", "cloudflare-not-configured"));
    return await input.store.save(current, actor);
  }
  try {
    if (mode === "cloudflare-zone") {
      const zone = await input.cloudflare.ensureZone(current.order.domainName);
      current.provisioning.zoneId = zone.id;
      current.provisioning.nameservers = zone.nameServers;
      current.provisioning.zoneStatus = zone.status;
      if (current.registration.providerStatus === "Active" && zone.nameServers.length >= 2) {
        const updated = await input.api.replaceNameServers(current.order.domainName, zone.nameServers);
        if ("code" in updated) {
          current.provisioning.nameserverUpdate = "rejected";
          current.events.push(event(current.order.orderId, input.at, "provisioning-failed", updated.code));
          return await input.store.save(current, actor);
        }
        current.provisioning.nameserverUpdate = "accepted";
        current.events.push(event(current.order.orderId, input.at, "nameservers-submitted", null));
      }
      if (current.provisioning.zoneStatus === "active") {
        await input.cloudflare.ensureZoneRecords(zone.id, current.order.domainName);
        current.provisioning.certificateStatus = input.visitorCertificate
          ? await input.visitorCertificate(current.order.domainName)
          : await input.cloudflare.readZoneCertificate(zone.id);
      }
    } else {
      const hostname = coverage.apex === "supported" ? current.order.domainName : `www.${current.order.domainName}`;
      const created = await input.cloudflare.ensureCustomHostname(hostname);
      current.provisioning.hostnameId = created.id;
      current.provisioning.hostnameStatus = created.status;
      current.provisioning.certificateStatus = created.certificateStatus;
      current.provisioning.nameserverUpdate = "not-requested";
    }
  } catch {
    current.events.push(event(current.order.orderId, input.at, "provisioning-failed", "cloudflare"));
  }
  return await input.store.save(current, actor);
}
