/**
 * USD registrar prices become a locked NGN checkout quote only when a fresh
 * provider rate is available. No rate is hardcoded, and a failed lookup does
 * not reuse an older rate.
 */
import { type DomainPriceQuote } from "./domainPricing";

export const OPEN_EXCHANGE_RATES_LATEST = "https://openexchangerates.org/api/latest.json";
export const DEFAULT_EXCHANGE_RATE_MAX_AGE_SECONDS = 6 * 60 * 60;
export const MAX_EXCHANGE_RATE_MAX_AGE_SECONDS = 24 * 60 * 60;
export const DEFAULT_DOMAIN_QUOTE_TTL_SECONDS = 15 * 60;
export const MAX_DOMAIN_QUOTE_TTL_SECONDS = 60 * 60;

export type UsdNgnRate = {
  base: "USD";
  quote: "NGN";
  rate: string;
  timestamp: string;
  source: "openexchangerates";
};

export type ExchangeRateSettings = {
  provider: "openexchangerates" | "";
  configured: boolean;
  appId: string;
  maxAgeSeconds: number;
  quoteTtlSeconds: number;
};

function boundedInteger(raw: string, fallback: number, max: number): number {
  if (raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  const value = Number(raw);
  if (value < 1 || value > max) return Number.NaN;
  return value;
}

export function readExchangeRateSettings(env: NodeJS.ProcessEnv): ExchangeRateSettings {
  const provider = (env.EXCHANGE_RATE_PROVIDER ?? "").trim();
  const appId = (env.OPEN_EXCHANGE_RATES_APP_ID ?? "").trim();
  const selected = provider === "openexchangerates" ? provider : "";
  return {
    provider: selected,
    configured: selected === "openexchangerates" && appId.length >= 8,
    appId,
    maxAgeSeconds: boundedInteger(env.EXCHANGE_RATE_MAX_AGE_SECONDS?.trim() ?? "", DEFAULT_EXCHANGE_RATE_MAX_AGE_SECONDS, MAX_EXCHANGE_RATE_MAX_AGE_SECONDS),
    quoteTtlSeconds: boundedInteger(env.DOMAIN_QUOTE_TTL_SECONDS?.trim() ?? "", DEFAULT_DOMAIN_QUOTE_TTL_SECONDS, MAX_DOMAIN_QUOTE_TTL_SECONDS),
  };
}

function scaled(value: string, maxFraction: number): { scale: bigint; amount: bigint } | null {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > maxFraction) return null;
  const scale = 10n ** BigInt(fraction.length);
  return { scale, amount: BigInt(whole) * scale + BigInt(fraction || "0") };
}

function money(cents: bigint): string | null {
  if (cents < 0n || cents > 100_000_000_000n) return null;
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function parseOpenExchangeRate(body: unknown, nowMs: number, maxAgeSeconds: number): UsdNgnRate | null {
  if (!body || typeof body !== "object" || !Number.isFinite(nowMs) || !Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) return null;
  const record = body as { timestamp?: unknown; base?: unknown; rates?: { NGN?: unknown } };
  if (record.base !== "USD" || typeof record.timestamp !== "number" || !Number.isFinite(record.timestamp)) return null;
  const ageMs = nowMs - record.timestamp * 1000;
  if (ageMs < -5 * 60 * 1000 || ageMs > maxAgeSeconds * 1000) return null;
  const rate = record.rates?.NGN;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const rateText = String(rate);
  if (!scaled(rateText, 8) || rateText.includes("e")) return null;
  return {
    base: "USD",
    quote: "NGN",
    rate: rateText,
    timestamp: new Date(record.timestamp * 1000).toISOString(),
    source: "openexchangerates",
  };
}

export async function fetchUsdNgnRate(
  env: NodeJS.ProcessEnv,
  fetchImpl: (url: string) => Promise<{ status: number; body: unknown }>,
  nowMs: number,
): Promise<UsdNgnRate | null> {
  const settings = readExchangeRateSettings(env);
  if (!settings.configured || !Number.isInteger(settings.maxAgeSeconds)) return null;
  const url = new URL(OPEN_EXCHANGE_RATES_LATEST);
  url.searchParams.set("app_id", settings.appId);
  url.searchParams.set("base", "USD");
  url.searchParams.set("symbols", "NGN");
  const response = await fetchImpl(url.toString());
  if (response.status !== 200) return null;
  return parseOpenExchangeRate(response.body, nowMs, settings.maxAgeSeconds);
}

export function lockDomainCheckoutQuote(input: {
  quote: DomainPriceQuote;
  rate: UsdNgnRate | null;
  now: string;
  maxAgeSeconds: number;
  ttlSeconds: number;
}): DomainPriceQuote | null {
  const nowMs = Date.parse(input.now);
  if (Number.isNaN(nowMs) || !Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 1) return null;
  const expires = new Date(nowMs + input.ttlSeconds * 1000).toISOString();
  if (input.quote.currency === "NGN") {
    return {
      ...input.quote,
      registrarCurrency: "NGN",
      registrarAmount: input.quote.wholesaleAmount,
      exchangeRate: null,
      exchangeRateTimestamp: null,
      exchangeRateSource: null,
      convertedAmount: null,
      quoteExpiresAt: expires,
    };
  }
  if (input.quote.currency !== "USD" || !input.rate || !Number.isInteger(input.maxAgeSeconds) || input.maxAgeSeconds < 1) return null;
  const rateAge = nowMs - Date.parse(input.rate.timestamp);
  if (input.rate.base !== "USD" || input.rate.quote !== "NGN" || rateAge < -5 * 60 * 1000 || rateAge > input.maxAgeSeconds * 1000) return null;
  const usd = scaled(input.quote.wholesaleAmount, 2);
  const rate = scaled(input.rate.rate, 8);
  if (!usd || !rate || usd.scale !== 100n || rate.amount <= 0n) return null;
  const converted = (usd.amount * rate.amount + rate.scale / 2n) / rate.scale;
  const markup = input.quote.markupBasisPoints;
  if (!Number.isInteger(markup) || markup < 0 || markup > 10_000) return null;
  const customer = (converted * BigInt(10_000 + markup) + 5_000n) / 10_000n;
  if (customer < 10_000n) return null;
  const convertedAmount = money(converted);
  const customerAmount = money(customer);
  if (!convertedAmount || !customerAmount) return null;
  return {
    ...input.quote,
    currency: "NGN",
    wholesaleAmount: convertedAmount,
    customerAmount,
    registrarCurrency: "USD",
    registrarAmount: input.quote.wholesaleAmount,
    exchangeRate: input.rate.rate,
    exchangeRateTimestamp: input.rate.timestamp,
    exchangeRateSource: input.rate.source,
    convertedAmount,
    quoteExpiresAt: expires,
  };
}
