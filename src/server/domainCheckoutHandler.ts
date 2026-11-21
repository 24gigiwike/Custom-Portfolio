/**
 * Domain checkout uses the stored NGN quote and a separate Bachs product.
 * The return URL does not register a domain or verify the payment.
 */
import { randomBytes } from "node:crypto";
import { fetchUsdNgnRate, lockDomainCheckoutQuote, readExchangeRateSettings } from "./domainExchange";
import { domainCheckoutReadiness, domainCheckoutCart, domainCheckoutEchoMatches, domainCheckoutReturnUrl, domainChargeCurrency, domainPaymentReference, readDomainProductId, sandboxFirestoreBlocked, DOMAIN_PAYMENT_PURPOSE } from "./domainPayment";
import { publishingReturnUrlProblem } from "./publishingCheckout";
import { openDomainOrder, quoteDomain } from "./domainLifecycle";
import { createDomainNameApi, readDomainNameApiConfig } from "./domainNameApi";
import { readMarkupBasisPoints } from "./domainPricing";
import { domainFirestore, firestoreDomainStore, validateRegistrant, type DomainRegistrant } from "./domainRecords";
import { domainCustomerState } from "./domainCustomerState";

type HeaderValue = string | string[] | undefined;

export type DomainNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  url?: string;
};

export type DomainNodeResponse = {
  status: (code: number) => DomainNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

function header(headers: Record<string, HeaderValue>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function send(res: DomainNodeResponse, status: number, body: Record<string, unknown>) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function readJson(body: unknown): Record<string, unknown> | null {
  const raw = typeof body === "string" ? body : body instanceof Uint8Array ? Buffer.from(body).toString("utf8") : body;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
}

async function ownerUid(req: DomainNodeRequest, env: NodeJS.ProcessEnv, verify?: (token: string, projectId: string) => Promise<{ uid: string }>): Promise<string | null> {
  const token = header(req.headers, "authorization").replace(/^Bearer\s+/i, "").trim();
  const projectId = env.FIREBASE_PROJECT_ID?.trim() || env.VITE_FIREBASE_PROJECT_ID?.trim() || "";
  if (!token || !projectId || !verify) return null;
  try {
    return (await verify(token, projectId)).uid;
  } catch {
    return null;
  }
}

function registrantFrom(value: unknown): DomainRegistrant | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const fields = ["firstName", "lastName", "email", "address", "city", "state", "postalCode", "country", "phoneCountryCode", "phone"] as const;
  const registrant = {} as DomainRegistrant;
  for (const field of fields) {
    if (typeof row[field] !== "string") return null;
    registrant[field] = row[field];
  }
  return registrant;
}

export async function handleDomainOrder(
  req: DomainNodeRequest,
  res: DomainNodeResponse,
  options: {
    env: NodeJS.ProcessEnv;
    verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
    ownsPortfolio?: (uid: string, portfolioId: string) => Promise<boolean>;
    quote?: (domainName: string) => Promise<{ available: boolean; currency: string; customerAmount: string; wholesaleAmount: string; period: number; premium: boolean; checkoutReady?: boolean; registrarCurrency?: string; registrarAmount?: string; exchangeRate?: string | null; exchangeRateTimestamp?: string | null; exchangeRateSource?: string | null; convertedAmount?: string | null; quoteExpiresAt?: string; markupBasisPoints?: number } | null>;
    createOrder?: (input: { uid: string; portfolioId: string; domainName: string; registrant: DomainRegistrant; quote: { currency: string; customerAmount: string; wholesaleAmount: string; period: number; premium: boolean } }) => Promise<{ orderId: string; state: string } | { error: string }>;
    readState?: (orderId: string, uid: string) => Promise<{ state: string; domainName: string } | null>;
  },
): Promise<void> {
  const uid = await ownerUid(req, options.env, options.verify);
  if (!uid) {
    send(res, 401, { error: "Domain ordering is not available right now.", code: "auth" });
    return;
  }
  if ((req.method ?? "").toUpperCase() === "GET") {
    const orderId = new URL(req.url ?? "/", "https://custom-portfolio-ebon.vercel.app").searchParams.get("orderId") ?? "";
    const state = options.readState ? await options.readState(orderId, uid) : null;
    if (!state) {
      send(res, 404, { error: "The domain order was not found.", code: "missing-order" });
      return;
    }
    send(res, 200, state);
    return;
  }
  if ((req.method ?? "").toUpperCase() !== "POST") {
    send(res, 405, { error: "Domain ordering is not available right now.", code: "method" });
    return;
  }
  const body = readJson(req.body);
  const portfolioId = typeof body?.portfolioId === "string" ? body.portfolioId : "";
  const domainName = typeof body?.domainName === "string" ? body.domainName : "";
  const registrant = registrantFrom(body?.registrant);
  if (!portfolioId || !domainName || !registrant || !options.ownsPortfolio || !options.quote || !options.createOrder) {
    send(res, 400, { error: "The domain request is not valid.", code: "invalid-request" });
    return;
  }
  if (!await options.ownsPortfolio(uid, portfolioId)) {
    send(res, 403, { error: "Domain ordering is not available right now.", code: "owner" });
    return;
  }
  const quote = await options.quote(domainName);
  if (!quote?.available) {
    send(res, 409, { error: "That domain is not available.", code: "unavailable-domain" });
    return;
  }
  if (quote.currency !== "NGN" || quote.checkoutReady === false) {
    send(res, 409, { error: "A current naira quote is not available, so the order was not saved.", code: "currency" });
    return;
  }
  const created = await options.createOrder({ uid, portfolioId, domainName, registrant, quote });
  if ("error" in created) {
    send(res, 400, { error: "The domain request is not valid.", code: created.error });
    return;
  }
  send(res, 200, { orderId: created.orderId, state: created.state, currency: quote.currency, customerAmount: quote.customerAmount, purpose: DOMAIN_PAYMENT_PURPOSE });
}

export async function handleDomainCheckout(
  req: DomainNodeRequest,
  res: DomainNodeResponse,
  options: {
    env: NodeJS.ProcessEnv;
    verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
    readOrder?: (orderId: string, uid: string) => Promise<{ orderId: string; paymentId: string; currency: string; customerAmount: string; paymentStatus: string; quoteExpiresAt?: string } | null>;
    createCheckout?: (request: { product_cart: ReturnType<typeof domainCheckoutCart>[]; reference: string }) => Promise<{ checkout_id: string; checkout_url: string; amount?: string; currency?: string; reference?: string | null } | null>;
  },
): Promise<void> {
  if ((req.method ?? "").toUpperCase() !== "POST") {
    send(res, 405, { error: "Domain payment is not available right now.", code: "method" });
    return;
  }
  const uid = await ownerUid(req, options.env, options.verify);
  if (!uid) {
    send(res, 401, { error: "Domain payment is not available right now.", code: "auth" });
    return;
  }
  const readiness = domainCheckoutReadiness(options.env);
  if (!readiness.ready) {
    send(res, 503, { error: "Domain payment is not available right now.", code: "product-not-configured" });
    return;
  }
  const success = options.env.BACHS_DOMAIN_SUCCESS_URL?.trim() ?? "";
  const cancel = options.env.BACHS_DOMAIN_CANCEL_URL?.trim() ?? "";
  if (!success || !cancel || publishingReturnUrlProblem(success) || publishingReturnUrlProblem(cancel)) {
    send(res, 503, { error: "Domain payment is not available right now.", code: "return-url" });
    return;
  }
  const body = readJson(req.body);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const order = options.readOrder ? await options.readOrder(orderId, uid) : null;
  if (!order) {
    send(res, 404, { error: "The domain order was not found.", code: "missing-order" });
    return;
  }
  if (domainChargeCurrency(order.currency) !== "NGN") {
    send(res, 409, { error: "The registrar quote is not in naira, so checkout was not opened.", code: "currency" });
    return;
  }
  const quoteExpires = Date.parse(order.quoteExpiresAt ?? "");
  if (Number.isNaN(quoteExpires) || quoteExpires <= Date.now()) {
    send(res, 409, { error: "The domain quote has expired. Search again before opening checkout.", code: "quote-expired" });
    return;
  }
  const productId = readDomainProductId(options.env) ?? "";
  const cart = domainCheckoutCart(productId, order.customerAmount);
  if (!cart || !options.createCheckout) {
    send(res, 503, { error: "Domain payment is not available right now.", code: "amount" });
    return;
  }
  const created = await options.createCheckout({
    product_cart: [cart],
    reference: domainPaymentReference(order.orderId, order.paymentId),
  });
  const reference = domainPaymentReference(order.orderId, order.paymentId);
  if (!created?.checkout_url.startsWith("https://") || !domainCheckoutEchoMatches({ orderAmount: order.customerAmount, reference, session: created })) {
    send(res, 502, { error: "The payment page could not be opened.", code: "checkout-failed" });
    return;
  }
  send(res, 200, { outcome: "checkout", purpose: DOMAIN_PAYMENT_PURPOSE, checkoutId: created.checkout_id, checkoutUrl: created.checkout_url });
}

export async function domainPurchaseOptions(env: NodeJS.ProcessEnv, verify: (token: string, projectId: string) => Promise<{ uid: string }>) {
  const db = await domainFirestore(env);
  const store = db ? firestoreDomainStore(db) : null;
  return {
    order: {
      env,
      verify,
      ownsPortfolio: async (uid: string, portfolioId: string) => {
        if (!db) return false;
        const snap = await db.collection("portfolios").doc(portfolioId).get();
        return snap.data()?.ownerId === uid;
      },
      quote: async (domainName: string) => {
        const config = readDomainNameApiConfig(env);
        const markup = readMarkupBasisPoints(env);
        if (!config || !Number.isInteger(markup)) return null;
        const result = await quoteDomain({
          api: createDomainNameApi(config, async (url, init) => {
            const response = await fetch(url, init);
            return { status: response.status, body: await response.json() };
          }),
          domainName,
          markupBasisPoints: markup,
        });
        if (!result.quote) return null;
        const settings = readExchangeRateSettings(env);
        const rate = result.quote.currency === "USD"
          ? await fetchUsdNgnRate(env, async (url) => {
            const response = await fetch(url);
            return { status: response.status, body: await response.json() };
          }, Date.now())
          : null;
        const locked = lockDomainCheckoutQuote({
          quote: result.quote,
          rate,
          now: new Date().toISOString(),
          maxAgeSeconds: settings.maxAgeSeconds,
          ttlSeconds: settings.quoteTtlSeconds,
        });
        const quote = locked ?? result.quote;
        return {
          available: result.available,
          currency: quote.currency,
          customerAmount: quote.customerAmount,
          wholesaleAmount: quote.wholesaleAmount,
          period: quote.period,
          premium: quote.premium,
          checkoutReady: locked !== null,
          registrarCurrency: quote.registrarCurrency ?? result.quote.currency,
          registrarAmount: quote.registrarAmount ?? result.quote.wholesaleAmount,
          exchangeRate: quote.exchangeRate ?? null,
          exchangeRateTimestamp: quote.exchangeRateTimestamp ?? null,
          exchangeRateSource: quote.exchangeRateSource ?? null,
          convertedAmount: quote.convertedAmount ?? null,
          quoteExpiresAt: quote.quoteExpiresAt,
          markupBasisPoints: quote.markupBasisPoints,
        };
      },
      createOrder: async (input: { uid: string; portfolioId: string; domainName: string; registrant: DomainRegistrant; quote: { currency: string; customerAmount: string; wholesaleAmount: string; period: number; premium: boolean } }) => {
        if (!store || sandboxFirestoreBlocked(env) || !validateRegistrant(input.registrant)) return { error: "invalid-request" };
        const markup = readMarkupBasisPoints(env);
        const orderId = `ord${randomBytes(8).toString("hex")}`;
        const paymentId = `pay${randomBytes(8).toString("hex")}`;
        const opened = openDomainOrder({
          orderId,
          paymentId,
          paymentPurpose: DOMAIN_PAYMENT_PURPOSE,
          paymentReference: domainPaymentReference(orderId, paymentId),
          paymentStatus: "pending",
          uid: input.uid,
          portfolioId: input.portfolioId,
          domainName: input.domainName,
          quote: { ...input.quote, markupBasisPoints: Number.isInteger(markup) ? markup : 0 },
          registrant: input.registrant,
          runtimeMode: (env.BACHS_API_KEY ?? "").startsWith("sk_live_") ? "live" : "sandbox",
          at: new Date().toISOString(),
        });
        if ("ok" in opened) return { error: opened.reason };
        await store.save(opened, { role: "server" });
        return { orderId, state: domainCustomerState(opened) };
      },
      readState: async (orderId: string, uid: string) => {
        if (!store) return null;
        try {
          const found = await store.read(orderId, { role: "owner", uid });
          if (!found) return null;
          return { state: domainCustomerState(found), domainName: found.order.domainName };
        } catch {
          return null;
        }
      },
    },
    checkout: {
      env,
      verify,
      readOrder: async (orderId: string, uid: string) => {
        if (!store) return null;
        try {
          const found = await store.read(orderId, { role: "owner", uid });
          return found?.order ?? null;
        } catch {
          return null;
        }
      },
      createCheckout: async (request: { product_cart: unknown[]; reference: string }) => {
        const key = env.BACHS_API_KEY?.trim() ?? "";
        if (sandboxFirestoreBlocked(env)) return null;
        if (!key.startsWith("sk_sandbox_") && !key.startsWith("sk_live_")) return null;
        const successUrl = domainCheckoutReturnUrl(env.BACHS_DOMAIN_SUCCESS_URL?.trim() ?? "");
        const cancelUrl = domainCheckoutReturnUrl(env.BACHS_DOMAIN_CANCEL_URL?.trim() ?? "");
        if (!successUrl || !cancelUrl) return null;
        const origin = key.startsWith("sk_sandbox_") ? "https://sandbox-api.bachs.io" : "https://api.bachs.io";
        const response = await fetch(`${origin}/v1/checkout-sessions`, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            product_cart: request.product_cart,
            billing_currency: "NGN",
            reference: request.reference,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { purpose: DOMAIN_PAYMENT_PURPOSE },
          }),
        });
        if (!response.ok) return null;
        const body = await response.json() as { checkout_id?: unknown; checkout_url?: unknown; amount?: unknown; currency?: unknown; reference?: unknown };
        if (typeof body.checkout_id !== "string" || typeof body.checkout_url !== "string") return null;
        const amount = typeof body.amount === "string" ? body.amount : undefined;
        const currency = typeof body.currency === "string" ? body.currency : undefined;
        const reference = typeof body.reference === "string" ? body.reference : null;
        return { checkout_id: body.checkout_id, checkout_url: body.checkout_url, amount, currency, reference };
      },
    },
  };
}
