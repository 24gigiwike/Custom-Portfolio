/**
 * Cloudflare provisioning for a domain Custom Portfolio registers.
 * Zone delegation and Cloudflare for SaaS are separate modes.
 * This module does not call Cloudflare unless writes are explicitly enabled
 * for the local sandbox, and it does not edit an existing production zone.
 */

export const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com/client/v4";

export type ProvisioningMode = "cloudflare-zone" | "cloudflare-saas";

export type HostnameCoverage = {
  apex: "supported" | "unsupported";
  www: "supported" | "unsupported";
  reason: string;
};

export type CloudflareZone = {
  id: string;
  name: string;
  status: string;
  nameServers: string[];
};

export type CloudflareHostname = {
  id: string;
  hostname: string;
  status: string;
  certificateStatus: string;
};

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; body: unknown }>;

export type CloudflareConfig = {
  token: string;
  accountId: string;
  saasZoneId: string;
  fallbackOrigin: string;
  apexIpv4: string;
  cnameTarget: string;
  apexProxying: boolean;
  writesEnabled: boolean;
};

function publicIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255 || String(part) !== String(Number(part)))) return false;
  const [first, second] = numbers;
  if (first === 0 || first === 10 || first === 127 || first === 255) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 168) return false;
  return true;
}

/** Project-specific Vercel DNS target. A vercel.app hostname is not a DNS target. */
export function vercelCnameTarget(value: string): boolean {
  return /^[a-z0-9]+\.vercel-dns(?:-\d+)?\.com$/.test(value);
}

export function readCloudflareConfig(env: NodeJS.ProcessEnv): CloudflareConfig | null {
  const token = env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apexIpv4 = env.VERCEL_APEX_IPV4?.trim() ?? "";
  const cnameTarget = (env.VERCEL_CNAME_TARGET?.trim() ?? "").toLowerCase().replace(/\.$/, "");
  if (!token || !accountId || !publicIpv4(apexIpv4) || !vercelCnameTarget(cnameTarget)) return null;
  return {
    token,
    accountId,
    saasZoneId: "",
    fallbackOrigin: "",
    apexIpv4,
    cnameTarget,
    apexProxying: false,
    writesEnabled: env.CLOUDFLARE_DNS_WRITES === "local-sandbox",
  };
}

/**
 * Zone delegation is the default. The zone is authoritative DNS only.
 * Apex is a grey-cloud A record and www is a grey-cloud CNAME, both aimed at
 * the Vercel project targets. Visitors connect to Vercel, which sees the
 * customer Host header because the domain is attached to the project.
 * SaaS custom hostnames are a separate mode and are not combined with a zone.
 */
export function selectProvisioningMode(input: { preferSaas: boolean; apexProxying: boolean }): ProvisioningMode {
  if (input.preferSaas) return "cloudflare-saas";
  return "cloudflare-zone";
}

export function hostnameCoverage(mode: ProvisioningMode, apexProxying: boolean): HostnameCoverage {
  if (mode === "cloudflare-zone") {
    return {
      apex: "supported",
      www: "supported",
      reason: "The domain uses its own Cloudflare zone for DNS only. Apex is an A record and www is a CNAME, both unproxied, using the Vercel project's own targets.",
    };
  }
  if (apexProxying) {
    return {
      apex: "supported",
      www: "supported",
      reason: "Cloudflare for SaaS apex proxying is enabled for this account.",
    };
  }
  return {
    apex: "unsupported",
    www: "supported",
    reason: "Cloudflare for SaaS on a non-Enterprise plan expects a customer CNAME. Apex proxying is an Enterprise add-on, so the apex is not promised in this mode.",
  };
}

export function certificateReady(status: string | null): boolean {
  return status === "active";
}

export function nameserverDelegation(expected: readonly string[], observed: readonly string[]): "matched" | "pending" | "mismatch" {
  const wanted = [...new Set(expected.map((item) => item.toLowerCase()))].sort();
  const seen = [...new Set(observed.map((item) => item.toLowerCase()))].sort();
  if (wanted.length < 2) return "pending";
  if (seen.length === 0) return "pending";
  return wanted.length === seen.length && wanted.every((item, index) => item === seen[index]) ? "matched" : "mismatch";
}

/** The nameserver call is implemented. OTE has not confirmed it, and OTE DNS-record calls fail. */
export function nameserverAutomationStatus(): { proven: false; limitation: string } {
  return {
    proven: false,
    limitation: "PUT /api/v1/domains/dns/name-server is implemented with dnssecMode 2. It has not been confirmed by the DomainNameAPI OTE environment. OTE DNS record endpoints return HTTP 500, so delegation cannot be rehearsed there.",
  };
}

function resultOf<T>(body: unknown, read: (value: unknown) => T | null): T | null {
  if (!body || typeof body !== "object") return null;
  const envelope = body as { success?: unknown; result?: unknown };
  if (envelope.success !== true) return null;
  return read(envelope.result);
}

export function createCloudflareClient(config: CloudflareConfig, fetchImpl: FetchLike) {
  const headers = { authorization: `Bearer ${config.token}`, "content-type": "application/json" };
  const refuse = () => {
    if (!config.writesEnabled) throw new Error("Cloudflare writes are disabled.");
  };

  return {
    async findZone(domainName: string): Promise<CloudflareZone | null> {
      const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones?name=${encodeURIComponent(domainName)}&account.id=${encodeURIComponent(config.accountId)}`, {
        method: "GET",
        headers,
      });
      const zones = resultOf(response.body, (result) => {
        if (!Array.isArray(result)) return null;
        return result.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const zone = item as { id?: unknown; name?: unknown; status?: unknown; name_servers?: unknown };
          if (typeof zone.id !== "string" || zone.name !== domainName || typeof zone.status !== "string") return [];
          const nameServers = Array.isArray(zone.name_servers) ? zone.name_servers.filter((server): server is string => typeof server === "string") : [];
          return [{ id: zone.id, name: domainName, status: zone.status, nameServers }];
        });
      });
      return zones?.[0] ?? null;
    },

    async ensureZone(domainName: string): Promise<CloudflareZone> {
      refuse();
      const existing = await this.findZone(domainName);
      if (existing) return existing;
      const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: domainName, account: { id: config.accountId }, type: "full" }),
      });
      const created = resultOf(response.body, (result) => {
        if (!result || typeof result !== "object") return null;
        const zone = result as { id?: unknown; name?: unknown; status?: unknown; name_servers?: unknown };
        if (typeof zone.id !== "string" || typeof zone.status !== "string") return null;
        const nameServers = Array.isArray(zone.name_servers) ? zone.name_servers.filter((server): server is string => typeof server === "string") : [];
        return { id: zone.id, name: domainName, status: zone.status, nameServers };
      });
      if (!created) throw new Error("Cloudflare did not return a zone.");
      return created;
    },

    async ensureZoneRecords(zoneId: string, domainName: string): Promise<void> {
      refuse();
      if (!config.apexIpv4 || !config.cnameTarget) throw new Error("The Vercel DNS targets are not configured.");
      const desired = [
        { type: "A", name: domainName, content: config.apexIpv4, proxied: false },
        { type: "CNAME", name: `www.${domainName}`, content: config.cnameTarget, proxied: false },
      ];
      for (const record of desired) {
        const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers,
          body: JSON.stringify(record),
        });
        const duplicate = response.status === 409 || (response.body && typeof response.body === "object" && (response.body as { errors?: { code?: number }[] }).errors?.some((error) => error.code === 81057));
        if (response.status !== 200 || !response.body || typeof response.body !== "object" || (response.body as { success?: unknown }).success !== true) {
          if (!duplicate) throw new Error("Cloudflare did not save the DNS record.");
        }
      }
    },

    async readZoneCertificate(zoneId: string): Promise<string> {
      const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones/${zoneId}/ssl/certificate_packs`, { method: "GET", headers });
      const status = resultOf(response.body, (result) => {
        if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") return null;
        const pack = result[0] as { status?: unknown };
        return typeof pack.status === "string" ? pack.status : null;
      });
      return status ?? "missing";
    },

    async ensureCustomHostname(hostname: string): Promise<CloudflareHostname> {
      refuse();
      const listed = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones/${config.saasZoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`, {
        method: "GET",
        headers,
      });
      const existing = resultOf(listed.body, (result) => {
        if (!Array.isArray(result)) return null;
        const match = result.find((item) => item && typeof item === "object" && (item as { hostname?: unknown }).hostname === hostname) as { id?: unknown; status?: unknown; ssl?: { status?: unknown } } | undefined;
        if (!match || typeof match.id !== "string" || typeof match.status !== "string") return null;
        return { id: match.id, hostname, status: match.status, certificateStatus: typeof match.ssl?.status === "string" ? match.ssl.status : "missing" };
      });
      if (existing) return existing;
      const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones/${config.saasZoneId}/custom_hostnames`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          hostname,
          custom_origin_server: config.fallbackOrigin,
          ssl: { method: "http", type: "dv" },
        }),
      });
      const created = resultOf(response.body, (result) => {
        if (!result || typeof result !== "object") return null;
        const row = result as { id?: unknown; status?: unknown; ssl?: { status?: unknown } };
        if (typeof row.id !== "string" || typeof row.status !== "string") return null;
        return { id: row.id, hostname, status: row.status, certificateStatus: typeof row.ssl?.status === "string" ? row.ssl.status : "missing" };
      });
      if (!created) throw new Error("Cloudflare did not return a custom hostname.");
      return created;
    },

    async readCustomHostname(hostnameId: string): Promise<CloudflareHostname | null> {
      const response = await fetchImpl(`${CLOUDFLARE_API_ORIGIN}/zones/${config.saasZoneId}/custom_hostnames/${hostnameId}`, { method: "GET", headers });
      return resultOf(response.body, (result) => {
        if (!result || typeof result !== "object") return null;
        const row = result as { id?: unknown; hostname?: unknown; status?: unknown; ssl?: { status?: unknown } };
        if (typeof row.id !== "string" || typeof row.hostname !== "string" || typeof row.status !== "string") return null;
        return { id: row.id, hostname: row.hostname, status: row.status, certificateStatus: typeof row.ssl?.status === "string" ? row.ssl.status : "missing" };
      });
    },
  };
}

export type CloudflareClient = ReturnType<typeof createCloudflareClient>;
