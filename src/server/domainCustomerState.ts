import type { DomainRecordSet } from "./domainRecords";
import { certificateReady } from "./cloudflareProvisioning";
import { DOMAIN_CUSTOMER_LABELS, type DomainCustomerState } from "../lib/domainProgress";

export { DOMAIN_CUSTOMER_LABELS, type DomainCustomerState };

const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function expiryPhase(expiration: string | null, now: Date): "expired" | "due" | "current" {
  if (!expiration) return "current";
  const time = Date.parse(expiration);
  if (!Number.isFinite(time)) return "current";
  if (time <= now.getTime()) return "expired";
  if (time - now.getTime() <= RENEWAL_WINDOW_MS) return "due";
  return "current";
}

export function domainCustomerState(records: DomainRecordSet, now = new Date()): DomainCustomerState {
  const { order, registration, provisioning } = records;
  if (order.paymentStatus !== "verified") return "awaiting-payment";
  if (registration.status === "failed") return "registration-failed";
  if (expiryPhase(registration.expirationDate, now) === "expired" && registration.status === "confirmed") return "expired";
  if (registration.status === "not-requested") return "payment-verified";
  if (registration.status === "requested") return "registration-processing";
  if (registration.status !== "confirmed" || registration.providerStatus !== "Active") {
    return registration.providerStatus === "WaitingForDocument" || registration.providerStatus === "WaitingForRegistration"
      ? "registration-pending"
      : "registration-processing";
  }
  if (provisioning.nameserverUpdate === "rejected" || provisioning.zoneStatus === "failed" || provisioning.hostnameStatus === "blocked") {
    return "provisioning-failed";
  }
  if (provisioning.mode === null || provisioning.nameserverUpdate === "not-proven" || (provisioning.nameserverUpdate === "not-requested" && provisioning.mode === "cloudflare-zone")) {
    return "registered";
  }
  const delegated = provisioning.mode === "cloudflare-zone"
    ? provisioning.zoneStatus === "active" && provisioning.nameserverUpdate === "accepted"
    : provisioning.hostnameStatus === "active";
  if (!delegated) {
    return provisioning.nameserverUpdate === "accepted" ? "verifying-nameservers" : "configuring-dns";
  }
  if (!certificateReady(provisioning.certificateStatus)) return "provisioning-ssl";
  if (expiryPhase(registration.expirationDate, now) === "due") return "renewal-due";
  return "connected";
}

export function domainIsConnected(records: DomainRecordSet, now = new Date()): boolean {
  return domainCustomerState(records, now) === "connected";
}

export function domainRoutesPublicly(records: DomainRecordSet, now = new Date()): boolean {
  const state = domainCustomerState(records, now);
  return (state === "connected" || state === "renewal-due")
    && records.order.portfolioPublished
    && records.order.portfolioEntitled;
}
