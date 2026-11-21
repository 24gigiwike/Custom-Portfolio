/**
 * Domain search for a signed-in owner.
 * The response contains availability and price only. It does not register a domain.
 */
import { fetchUsdNgnRate, lockDomainCheckoutQuote, readExchangeRateSettings } from "./domainExchange";
import { readDomainNameApiConfig, createDomainNameApi } from "./domainNameApi";
import { quoteDomain } from "./domainLifecycle";
import { readMarkupBasisPoints } from "./domainPricing";

type HeaderValue = string | string[] | undefined;

export type DomainSearchRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};

export type DomainSearchResponse = {
  status: (code: number) => DomainSearchResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

function header(headers: Record<string, HeaderValue>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function json(res: DomainSearchResponse, status: number, body: Record<string, unknown>) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export async function handleDomainSearch(
  req: DomainSearchRequest,
  res: DomainSearchResponse,
  options: {
    env: NodeJS.ProcessEnv;
    verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
    search?: (domainName: string) => Promise<{ available: boolean; status: string; checkoutReady?: boolean; registrarCurrency?: string | null; registrarAmount?: string | null; exchangeRate?: string | null; quote: { currency: string; customerAmount: string; period: number } | null }>;
  },
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Domain search is not available right now.", code: "method" });
    return;
  }
  const token = header(req.headers, "authorization").replace(/^Bearer\s+/i, "").trim();
  const projectId = options.env.FIREBASE_PROJECT_ID?.trim() || options.env.VITE_FIREBASE_PROJECT_ID?.trim() || "";
  if (!token || !projectId || !options.verify) {
    json(res, 401, { error: "Domain search is not available right now.", code: "auth" });
    return;
  }
  try {
    await options.verify(token, projectId);
  } catch {
    json(res, 401, { error: "Domain search is not available right now.", code: "auth" });
    return;
  }
  const raw = typeof req.body === "string" ? req.body : req.body instanceof Uint8Array ? Buffer.from(req.body).toString("utf8") : req.body;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      json(res, 400, { error: "The domain request is not valid.", code: "invalid-request" });
      return;
    }
  }
  const domainName = parsed && typeof parsed === "object" && typeof (parsed as { domainName?: unknown }).domainName === "string"
    ? (parsed as { domainName: string }).domainName
    : "";
  if (!domainName) {
    json(res, 400, { error: "The domain request is not valid.", code: "invalid-request" });
    return;
  }
  const search = options.search ?? (async (name: string) => {
    const config = readDomainNameApiConfig(options.env);
    const markup = readMarkupBasisPoints(options.env);
    if (!config || !Number.isInteger(markup)) {
      return { available: false, status: "not-configured", quote: null, checkoutReady: false, registrarCurrency: null, registrarAmount: null, exchangeRate: null };
    }
    const priced = await quoteDomain({
      api: createDomainNameApi(config, async (url, init) => {
        const response = await fetch(url, init);
        return { status: response.status, body: await response.json() };
      }),
      domainName: name,
      markupBasisPoints: markup,
    });
    const settings = readExchangeRateSettings(options.env);
    const rate = priced.quote?.currency === "USD"
      ? await fetchUsdNgnRate(options.env, async (url) => {
        const response = await fetch(url);
        return { status: response.status, body: await response.json() };
      }, Date.now())
      : null;
    const locked = priced.quote ? lockDomainCheckoutQuote({
      quote: priced.quote,
      rate,
      now: new Date().toISOString(),
      maxAgeSeconds: settings.maxAgeSeconds,
      ttlSeconds: settings.quoteTtlSeconds,
    }) : null;
    return {
      ...priced,
      quote: locked ?? priced.quote,
      checkoutReady: locked !== null,
      registrarCurrency: priced.quote?.currency ?? null,
      registrarAmount: priced.quote?.wholesaleAmount ?? null,
      exchangeRate: locked?.exchangeRate ?? null,
    };
  });
  const result = await search(domainName);
  if (result.status === "not-configured") {
    json(res, 503, { error: "Domain search is not available right now.", code: "not-configured" });
    return;
  }
  json(res, 200, {
    domainName,
    available: result.available,
    status: result.status,
    currency: result.quote?.currency ?? null,
    customerAmount: result.quote?.customerAmount ?? null,
    period: result.quote?.period ?? null,
    checkoutReady: result.checkoutReady === true,
    registrarCurrency: result.registrarCurrency ?? null,
    registrarAmount: result.registrarAmount ?? null,
    exchangeRate: result.exchangeRate ?? null,
  });
}
