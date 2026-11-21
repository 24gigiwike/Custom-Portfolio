/** Customer price is the registrar quote plus a configured markup. Markup never changes the registrar request. */

export type DomainPriceQuote = {
  currency: string;
  wholesaleAmount: string;
  markupBasisPoints: number;
  customerAmount: string;
  period: number;
  premium: boolean;
  registrarCurrency?: string;
  registrarAmount?: string;
  exchangeRate?: string | null;
  exchangeRateTimestamp?: string | null;
  exchangeRateSource?: string | null;
  convertedAmount?: string | null;
  quoteExpiresAt?: string;
};

function cents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return null;
  const scaled = Math.round(amount * 100);
  if (Math.abs(amount * 100 - scaled) > 0.001) return null;
  return scaled;
}

export function formatMoney(centsValue: number, currency: string): string {
  const whole = Math.trunc(centsValue / 100);
  const fraction = String(Math.abs(centsValue % 100)).padStart(2, "0");
  return `${currency} ${whole}.${fraction}`;
}

export function quoteDomainPrice(input: {
  price: number;
  currency: string;
  period: number;
  premium: boolean;
  markupBasisPoints: number;
}): DomainPriceQuote | null {
  const wholesale = cents(input.price);
  if (wholesale === null) return null;
  if (!/^[A-Z]{3}$/.test(input.currency)) return null;
  if (!Number.isInteger(input.period) || input.period < 1 || input.period > 10) return null;
  if (!Number.isInteger(input.markupBasisPoints) || input.markupBasisPoints < 0 || input.markupBasisPoints > 10_000) return null;
  const customer = Math.round((wholesale * (10_000 + input.markupBasisPoints)) / 10_000);
  if (!Number.isSafeInteger(customer)) return null;
  return {
    currency: input.currency,
    wholesaleAmount: (wholesale / 100).toFixed(2),
    markupBasisPoints: input.markupBasisPoints,
    customerAmount: (customer / 100).toFixed(2),
    period: input.period,
    premium: input.premium,
  };
}

export function readMarkupBasisPoints(env: NodeJS.ProcessEnv): number {
  const raw = env.DOMAIN_MARKUP_BASIS_POINTS?.trim() ?? "";
  if (raw === "") return 0;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}
