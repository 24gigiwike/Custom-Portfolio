/**
 * DomainNameAPI reseller client.
 * Calls are server-only and pinned to the OTE host. This module does not
 * register a domain unless the caller passes an explicit OTE allowance.
 * Registry answers are not treated as production facts.
 */

export const DNA_OTE_ORIGIN = "https://ote.domainresellerapi.com";
export const DNA_LIVE_ORIGIN = "https://api.domainresellerapi.com";

/** The nameserver operation is implemented. It has not been executed against OTE. */
export const NAMESERVER_UPDATE_PROVEN_AGAINST_OTE = false;

/** Mock tests are not provider confirmation. No OTE or live call is made by this module on import. */
export const DOMAIN_NAME_API_EVIDENCE = {
  authentication: "implemented-not-called",
  catalogue: "mock-tested",
  availability: "mock-tested",
  price: "mock-tested",
  registration: "implemented-not-called",
  registrationStatus: "mock-tested",
  nameserverUpdate: "implemented-not-ote-tested",
  ote: "not-called",
  live: "not-called",
} as const;

export type DnaSearchStatus = "AVAILABLE" | "NOTAVAILABLE" | "UNSUPPORTEDTLD" | "INVALIDDOMAINNAME" | "ERROR" | "NONE";

export type DnaSearchInfo = {
  domainName: string;
  tld: string;
  status: DnaSearchStatus;
  isPremium: boolean;
  isDocumentRequired: boolean;
  price: number;
  currency: string;
  period: number;
};

export type DnaTld = {
  name: string;
  registrationPeriods: number[];
  renewalPeriods: number[];
  availableInTestEnvironment: boolean;
  registryDnsCheck: boolean;
  minNameServers: number;
  maxNameServers: number;
};

export type DnaRegistration = {
  accepted: boolean;
  domainId: string | null;
  status: string;
  expirationDate: string | null;
  code: string | null;
};

export type DnaDomainInfo = {
  domainName: string;
  status: string;
  expirationDate: string | null;
  remainingDay: number | null;
  nameservers: string[];
  renewalMode: string | null;
};

export type DnaFailure = {
  ok: false;
  code: string;
  retryable: boolean;
};

export class DomainNameApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super("Domain registration is not available right now.");
    this.name = "DomainNameApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

const NEVER_RETRY = new Set([
  "Dna.DomainService:Domain:10004",
  "Dna.DomainService:Domain:10005",
  "Dna.DomainService:Domain:10044",
  "Dna.DomainService:Domain:1026",
  "Dna.DomainService:Domain:10023",
  "Dna.DomainService:Domain:10049",
  "Dna.DomainService:Domain:10070",
  "Dna.DomainService:Domain:10071",
  "Dna.DomainService:Domain:10072",
  "Dna.DomainService:Domain:10073",
  "Dna.DomainService:Contact:10018",
  "Dna.DomainService:Deposit:10001",
  "DnaValidationError",
]);

export type DomainNameApiConfig = {
  baseOrigin: string;
  apiKey: string;
  resellerId: string;
  allowRegistration: boolean;
};

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

/**
 * DNA_* remains the application name. DOMAINNAMEAPI_* and the OTE-specific
 * names are accepted when DNA_* is empty. An explicit DNA_API_BASE still
 * wins, including when it is the live host and must be rejected.
 */
export function readDomainNameApiConfig(env: NodeJS.ProcessEnv): DomainNameApiConfig | null {
  const explicitBase = envValue(env, "DNA_API_BASE");
  const baseOrigin = (explicitBase || envValue(env, "DOMAINNAMEAPI_ENV")).replace(/\/$/, "");
  const explicitKey = envValue(env, "DNA_API_KEY");
  const oteKey = envValue(env, "DOMAIN_NAME_API_OTE_KEY");
  const namedKey = baseOrigin === DNA_OTE_ORIGIN ? envValue(env, "DOMAINNAMEAPI_API_KEY") : "";
  const apiKey = explicitKey || oteKey || namedKey;
  const resellerId = envValue(env, "DNA_RESELLER_ID") || envValue(env, "DOMAIN_NAME_API_OTE_RESELLER_ID");
  if (!baseOrigin || !apiKey || !resellerId) return null;
  if (baseOrigin !== DNA_OTE_ORIGIN) return null;
  if (apiKey.length < 8 || resellerId.length < 8) return null;
  return {
    baseOrigin,
    apiKey,
    resellerId,
    allowRegistration: env.DNA_ALLOW_REGISTRATION === "ote",
  };
}

export function nigerianTldSupport(tlds: readonly DnaTld[]): {
  ng: "supported-in-test" | "listed-not-in-test" | "not-listed";
  comNg: "supported-in-test" | "listed-not-in-test" | "not-listed";
} {
  const support = (name: string) => {
    const found = tlds.find((item) => item.name === name);
    if (!found) return "not-listed" as const;
    return found.availableInTestEnvironment ? "supported-in-test" as const : "listed-not-in-test" as const;
  };
  return { ng: support("ng"), comNg: support("com.ng") };
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; body: unknown }>;

function retryable(code: string, status: number): boolean {
  if (status === 429 || code === "Dna.DomainService:Domain:10017") return true;
  return !NEVER_RETRY.has(code);
}

function errorCode(body: unknown): string {
  if (!body || typeof body !== "object") return "unknown";
  const record = body as { error?: { code?: unknown }; code?: unknown };
  if (typeof record.error?.code === "string") return record.error.code;
  if (typeof record.code === "string" && record.code !== "1000") return record.code;
  return "unknown";
}

async function dnaFetch(
  config: DomainNameApiConfig,
  fetchImpl: FetchLike,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return fetchImpl(`${config.baseOrigin}/api/v1/${path}`, {
    method,
    headers: {
      "X-API-KEY": config.apiKey,
      __reseller: config.resellerId,
      "content-type": "application/json",
      "X-Correlation-ID": `cp-${Date.now().toString(36)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function readSearchInfo(value: unknown): DnaSearchInfo | null {
  if (!value || typeof value !== "object") return null;
  const info = value as Record<string, unknown>;
  const status = info.status;
  if (typeof info.domainName !== "string" || typeof info.tld !== "string") return null;
  if (status !== "AVAILABLE" && status !== "NOTAVAILABLE" && status !== "UNSUPPORTEDTLD" && status !== "INVALIDDOMAINNAME" && status !== "ERROR" && status !== "NONE") {
    return null;
  }
  if (typeof info.price !== "number" || typeof info.currency !== "string" || typeof info.period !== "number") return null;
  return {
    domainName: info.domainName,
    tld: info.tld,
    status,
    isPremium: info.isPremium === true,
    isDocumentRequired: info.isDocumentRequired === true,
    price: info.price,
    currency: info.currency,
    period: info.period,
  };
}

export function createDomainNameApi(config: DomainNameApiConfig, fetchImpl: FetchLike) {
  return {
    async search(domainName: string): Promise<DnaSearchInfo | DnaFailure> {
      const response = await dnaFetch(config, fetchImpl, "domains/search", "POST", { domainName });
      const info = response.body && typeof response.body === "object" ? readSearchInfo((response.body as { info?: unknown }).info) : null;
      if (response.status === 200 && info) return info;
      const code = errorCode(response.body);
      return { ok: false, code, retryable: retryable(code, response.status) };
    },

    async listTlds(filterText: string): Promise<DnaTld[] | DnaFailure> {
      const query = new URLSearchParams({ filterText, maxResultCount: "20", currency: "USD" });
      const response = await dnaFetch(config, fetchImpl, `products/tlds?${query.toString()}`, "GET");
      if (response.status !== 200 || !response.body || typeof response.body !== "object") {
        const code = errorCode(response.body);
        return { ok: false, code, retryable: retryable(code, response.status) };
      }
      const items = (response.body as { items?: unknown }).items;
      if (!Array.isArray(items)) return { ok: false, code: "invalid-catalogue", retryable: false };
      return items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        if (typeof row.name !== "string" || !Array.isArray(row.registrationPeriods) || !Array.isArray(row.renewalPeriods)) return [];
        const registrationPeriods = row.registrationPeriods.filter((period): period is number => typeof period === "number");
        const renewalPeriods = row.renewalPeriods.filter((period): period is number => typeof period === "number");
        return [{
          name: row.name,
          registrationPeriods,
          renewalPeriods,
          availableInTestEnvironment: row.availableInTestEnvironment === true,
          registryDnsCheck: row.registryDnsCheck === true,
          minNameServers: typeof row.minNameServerCount === "number" ? row.minNameServerCount : 2,
          maxNameServers: typeof row.maxNameServerCount === "number" ? row.maxNameServerCount : 13,
        }];
      });
    },

    async register(input: {
      domainName: string;
      period: number;
      nameServers: string[];
      contact: {
        firstName: string;
        lastName: string;
        email: string;
        address: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phoneCountryCode: string;
        phone: string;
      };
    }): Promise<DnaRegistration | DnaFailure> {
      if (!config.allowRegistration) return { ok: false, code: "registration-not-allowed", retryable: false };
      const response = await dnaFetch(config, fetchImpl, "domains/register-with-contacts", "POST", {
        domainName: input.domainName,
        period: input.period,
        nameServers: input.nameServers,
        contacts: [{
          contactType: "Registrant",
          firstName: input.contact.firstName,
          lastName: input.contact.lastName,
          eMail: input.contact.email,
          address: input.contact.address,
          city: input.contact.city,
          state: input.contact.state,
          postalCode: input.contact.postalCode,
          country: input.contact.country,
          phoneCountryCode: input.contact.phoneCountryCode,
          phone: input.contact.phone,
        }],
      });
      if (response.status !== 200 || !response.body || typeof response.body !== "object") {
        const code = errorCode(response.body);
        return { ok: false, code, retryable: retryable(code, response.status) };
      }
      const body = response.body as { success?: unknown; domainId?: unknown; status?: unknown; expirationDate?: unknown };
      return {
        accepted: body.success === true,
        domainId: typeof body.domainId === "string" ? body.domainId : null,
        status: typeof body.status === "string" ? body.status : "",
        expirationDate: typeof body.expirationDate === "string" ? body.expirationDate : null,
        code: null,
      };
    },

    async readDomain(domainName: string): Promise<DnaDomainInfo | DnaFailure> {
      const response = await dnaFetch(config, fetchImpl, `domains/info?domainName=${encodeURIComponent(domainName)}`, "GET");
      if (response.status !== 200 || !response.body || typeof response.body !== "object") {
        const code = errorCode(response.body);
        return { ok: false, code, retryable: retryable(code, response.status) };
      }
      const body = response.body as Record<string, unknown>;
      const nameservers = Array.isArray(body.nameservers) ? body.nameservers.filter((item): item is string => typeof item === "string") : [];
      return {
        domainName: typeof body.domainName === "string" ? body.domainName : domainName,
        status: typeof body.status === "string" ? body.status : "",
        expirationDate: typeof body.expirationDate === "string" ? body.expirationDate : null,
        remainingDay: typeof body.remainingDay === "number" ? body.remainingDay : null,
        nameservers,
        renewalMode: typeof body.renewalMode === "string" ? body.renewalMode : null,
      };
    },

    async replaceNameServers(domainName: string, nameServers: string[]): Promise<{ ok: true } | DnaFailure> {
      if (!config.allowRegistration) return { ok: false, code: "registration-not-allowed", retryable: false };
      const response = await dnaFetch(config, fetchImpl, "domains/dns/name-server", "PUT", {
        domainName,
        nameServers,
        dnssecMode: 2,
      });
      if (response.status === 204) return { ok: true };
      const code = errorCode(response.body);
      return { ok: false, code, retryable: retryable(code, response.status) };
    },
  };
}

export type DomainNameApi = ReturnType<typeof createDomainNameApi>;
