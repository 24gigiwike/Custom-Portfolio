import { domainCustomerState, domainRoutesPublicly } from "./domainCustomerState";
import type { DomainRecordSet } from "./domainRecords";
import { PRODUCTION_ORIGIN } from "../lib/portfolioSeo";

export type HostnameMapping = {
  hostname: string;
  portfolioId: string;
  orderId: string;
};

export class HostnameConflictError extends Error {
  constructor() {
    super("This hostname is already connected to another portfolio.");
    this.name = "HostnameConflictError";
  }
}

const PLATFORM_HOSTS = new Set([
  new URL(PRODUCTION_ORIGIN).host,
  "custom-portfolio-ebon.vercel.app",
]);

export const ROUTING_ARCHITECTURE = {
  selected: "vercel-project-domain-dns-only",
  worker: "not-used",
  reverseProxy: "not-used",
  fallbackOriginRequired: false,
} as const;

function bareHost(value: string): string {
  return value.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "") ?? "";
}

export function isPlatformHost(value: string | undefined): boolean {
  const host = bareHost(value ?? "");
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || PLATFORM_HOSTS.has(host);
}

function hostnamesFor(records: DomainRecordSet): string[] {
  if (!domainRoutesPublicly(records)) return [];
  const apex = records.registration.domainName;
  return records.provisioning.apexSupported ? [apex, `www.${apex}`] : [`www.${apex}`];
}

export function hostnameMappings(records: readonly DomainRecordSet[]): HostnameMapping[] {
  const claimed = new Map<string, HostnameMapping>();
  for (const record of records) {
    for (const hostname of hostnamesFor(record)) {
      const mapping = { hostname, portfolioId: record.order.portfolioId, orderId: record.order.orderId };
      const current = claimed.get(hostname);
      if (current && current.portfolioId !== mapping.portfolioId) throw new HostnameConflictError();
      claimed.set(hostname, mapping);
    }
  }
  return [...claimed.values()];
}

export function normalizeRequestHost(value: string | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || /[\s@\\/]/.test(first)) return null;
  const host = first.replace(/:\d+$/, "").replace(/\.$/, "");
  if (isPlatformHost(host)) return null;
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return null;
  return host;
}

export function resolveRequestHostname(
  headers: { host?: string | string[]; "x-forwarded-host"?: string | string[] },
  records: readonly DomainRecordSet[],
): string | null {
  const hostValue = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  const forwardedValue = Array.isArray(headers["x-forwarded-host"]) ? headers["x-forwarded-host"][0] : headers["x-forwarded-host"];
  const host = normalizeRequestHost(hostValue);
  if (!host) return null;
  if (forwardedValue !== undefined) {
    const forwarded = normalizeRequestHost(forwardedValue);
    if (!forwarded || forwarded !== host) return null;
  }
  return hostnameMappings(records).find((item) => item.hostname === host)?.portfolioId ?? null;
}

export function portfolioIdForHostname(host: string, records: readonly DomainRecordSet[]): string | null {
  const name = normalizeRequestHost(host);
  if (!name) return null;
  return hostnameMappings(records).find((item) => item.hostname === name)?.portfolioId ?? null;
}

export type HostDecision =
  | { kind: "platform" }
  | { kind: "portfolio"; portfolioId: string }
  | { kind: "unknown" }
  | { kind: "unavailable"; reason: "spoofed" | "conflict" | "invalid" | "unverified" | "expired" | "unpublished" | "unentitled" | "disconnected" | "missing-mapping" };

function claimedHostnames(records: DomainRecordSet): string[] {
  const apex = records.order.domainName;
  if (!apex) return [];
  if (records.provisioning.mode === "cloudflare-saas" && !records.provisioning.apexSupported) return [`www.${apex}`];
  return [apex, `www.${apex}`];
}

export function classifyRequestHost(
  headers: { host?: string | string[]; "x-forwarded-host"?: string | string[] },
  records: readonly DomainRecordSet[],
  now = new Date(),
): HostDecision {
  const hostValue = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  if (!hostValue) return { kind: "platform" };
  const rawHost = bareHost(hostValue);
  const forwardedValue = Array.isArray(headers["x-forwarded-host"]) ? headers["x-forwarded-host"][0] : headers["x-forwarded-host"];
  if (isPlatformHost(rawHost)) {
    if (forwardedValue !== undefined && bareHost(forwardedValue) !== rawHost) return { kind: "unavailable", reason: "spoofed" };
    return { kind: "platform" };
  }
  const host = normalizeRequestHost(hostValue);
  if (!host) return { kind: "unavailable", reason: "invalid" };
  if (forwardedValue !== undefined && normalizeRequestHost(forwardedValue) !== host) return { kind: "unavailable", reason: "spoofed" };
  let mappings: HostnameMapping[];
  try {
    mappings = hostnameMappings(records);
  } catch (error) {
    if (error instanceof HostnameConflictError) return { kind: "unavailable", reason: "conflict" };
    throw error;
  }
  const mapped = mappings.find((item) => item.hostname === host);
  if (mapped) return { kind: "portfolio", portfolioId: mapped.portfolioId };
  const owners = records.filter((item) => claimedHostnames(item).includes(host));
  if (owners.length > 1) return { kind: "unavailable", reason: "conflict" };
  const owner = owners[0];
  if (!owner) return { kind: "unknown" };
  if (!owner.registration.providerDomainId && owner.registration.status !== "confirmed") return { kind: "unavailable", reason: "unverified" };
  if (!owner.order.portfolioPublished) return { kind: "unavailable", reason: "unpublished" };
  if (!owner.order.portfolioEntitled) return { kind: "unavailable", reason: "unentitled" };
  if (domainCustomerState(owner, now) === "expired") return { kind: "unavailable", reason: "expired" };
  if (!owner.provisioning.zoneId && !owner.provisioning.hostnameId) return { kind: "unavailable", reason: "missing-mapping" };
  return { kind: "unavailable", reason: "disconnected" };
}

export type SiteRoutePlan =
  | { action: "robots" }
  | { action: "sitemap" }
  | { action: "portfolio-path"; publicId: string }
  | { action: "custom-portfolio"; portfolioId: string }
  | { action: "home" }
  | { action: "unavailable" };

/** The original query string stays on the request. It is never used as a hostname. */
export function siteRoutePlan(url: URL, headers: { host?: string | string[]; "x-forwarded-host"?: string | string[] }, records: readonly DomainRecordSet[]): SiteRoutePlan {
  const kind = url.searchParams.get("kind");
  if (kind === "robots") return { action: "robots" };
  if (kind === "sitemap") return { action: "sitemap" };
  if (kind === "portfolio") return { action: "portfolio-path", publicId: url.searchParams.get("publicId") ?? "" };
  const decision = classifyRequestHost(headers, records);
  if ((kind === "home" || !kind) && decision.kind === "portfolio") return { action: "custom-portfolio", portfolioId: decision.portfolioId };
  if (decision.kind === "unknown" || decision.kind === "unavailable") return { action: "unavailable" };
  return { action: "home" };
}
