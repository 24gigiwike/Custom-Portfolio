import { BachsApiError, type CreateCheckoutSessionRequest } from "@bachs/sdk";
import { publishingBachsClient } from "./bachsRuntime";
import { FirebaseIdTokenError, firebaseProjectId, verifyFirebaseIdToken } from "./firebaseIdToken";
import { FirebaseProjectIsolationError } from "../lib/firebaseEnvironment";
import { firebaseAdminFirestore } from "./firebaseAdmin";
import { PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION } from "../lib/publishingEntitlement";
import {
  executePublishingCheckout,
  firestorePublishingCheckoutStore,
  PublishingCheckoutGatewayError,
  type PublishingCheckoutStore,
} from "./publishingCheckout";

type HeaderValue = string | string[] | undefined;

export type PublishingCheckoutNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};

export type PublishingCheckoutNodeResponse = {
  status: (code: number) => PublishingCheckoutNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export type PublishingCheckoutHandlerOptions = {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
  store?: PublishingCheckoutStore;
  loadPortfolio?: (portfolioId: string) => Promise<{ ownerId: string; selectedTemplate: string } | null>;
  loadEntitlement?: (portfolioId: string) => Promise<unknown>;
  getProduct?: (productId: string) => Promise<{
    id?: string;
    price?: { currency?: string; amount?: string; price_type?: string };
    billing_cycle?: { interval?: string; frequency?: number } | null;
    status?: string;
    archived_at?: string | null;
  }>;
  createCheckout?: (request: CreateCheckoutSessionRequest, idempotencyKey: string) => Promise<{ checkout_id: string; checkout_url: string; expires_at?: string }>;
};

function headerValue(headers: Record<string, HeaderValue>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value : "";
}

function bearerToken(headers: Record<string, HeaderValue>): string | null {
  const match = /^Bearer\s+(\S+)$/.exec(headerValue(headers, "authorization").trim());
  return match?.[1] ?? null;
}

function send(res: PublishingCheckoutNodeResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

function jsonBody(body: unknown): unknown {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return JSON.parse(Buffer.from(body).toString("utf8"));
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

function gateway(env: NodeJS.ProcessEnv) {
  const bachs = publishingBachsClient(env);
  return {
    async getProduct(productId: string) {
      try {
        return await bachs.products.get(productId);
      } catch (error) {
        throw new PublishingCheckoutGatewayError(
          "The publishing product could not be read.",
          Boolean(error && typeof error === "object" && "outcomeUnknown" in error && (error as { outcomeUnknown?: boolean }).outcomeUnknown),
          error instanceof BachsApiError ? error.statusCode : null,
        );
      }
    },
    async createCheckout(request: CreateCheckoutSessionRequest, idempotencyKey: string) {
      try {
        const created = await bachs.checkoutSessions.create(request, { idempotencyKey });
        return { checkout_id: created.checkout_id, checkout_url: created.checkout_url, expires_at: created.expires_at };
      } catch (error) {
        throw new PublishingCheckoutGatewayError(
          "The payment page could not be opened.",
          Boolean(error && typeof error === "object" && "outcomeUnknown" in error && (error as { outcomeUnknown?: boolean }).outcomeUnknown),
          error instanceof BachsApiError ? error.statusCode : null,
        );
      }
    },
  };
}

/**
 * Authenticated checkout for one portfolio.
 * The browser is sent a hosted payment URL. That return does not grant publishing.
 */
export async function handlePublishingCheckout(
  req: PublishingCheckoutNodeRequest,
  res: PublishingCheckoutNodeResponse,
  options: PublishingCheckoutHandlerOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to open publishing payment.", code: "method" });
    return;
  }
  const token = bearerToken(req.headers);
  if (!token) {
    send(res, 401, { error: "Sign in to publish a portfolio.", code: "unauthenticated" });
    return;
  }
  const env = options.env ?? process.env;
  let projectId = "";
  try {
    projectId = firebaseProjectId(env);
  } catch (error) {
    if (error instanceof FirebaseProjectIsolationError) {
      send(res, 503, { error: "Publishing payment is not available right now.", code: "unavailable" });
      return;
    }
    throw error;
  }
  let uid = "";
  try {
    uid = (await (options.verify ?? verifyFirebaseIdToken)(token, projectId)).uid;
  } catch (error) {
    if (error instanceof FirebaseIdTokenError) {
      send(res, 401, { error: "Sign in to publish a portfolio.", code: "unauthenticated" });
      return;
    }
    throw error;
  }
  if (!uid) {
    send(res, 401, { error: "Sign in to publish a portfolio.", code: "unauthenticated" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = jsonBody(req.body);
  } catch {
    send(res, 400, { error: "The publishing request is not valid.", code: "invalid-request" });
    return;
  }

  let db: ReturnType<typeof firebaseAdminFirestore> = null;
  if (!options.store) {
    try {
      db = firebaseAdminFirestore(env);
    } catch (error) {
      if (error instanceof FirebaseProjectIsolationError) {
        send(res, 503, { error: "Publishing payment is not available right now.", code: "unavailable" });
        return;
      }
      throw error;
    }
  }
  const store = options.store ?? (db ? firestorePublishingCheckoutStore(db) : null);
  if (!store) {
    send(res, 503, { error: "Publishing payment is not available right now.", code: "unavailable" });
    return;
  }
  const loadPortfolio = options.loadPortfolio ?? (async (portfolioId: string) => {
    if (!db) return null;
    const snap = await db.collection("portfolios").doc(portfolioId).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return {
      ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
      selectedTemplate: typeof data.selectedTemplate === "string" ? data.selectedTemplate : "",
    };
  });
  const loadEntitlement = options.loadEntitlement ?? (async (portfolioId: string) => {
    if (!db) return null;
    const snap = await db.collection(PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION).doc(portfolioId).get();
    return snap.exists ? snap.data() : null;
  });
  let remote: ReturnType<typeof gateway> | null = null;
  const remoteGateway = () => {
    remote ??= gateway(env);
    return remote;
  };
  const result = await executePublishingCheckout({
    uid,
    body: parsed,
    env,
    now: options.now ?? new Date(),
    loadPortfolio,
    loadEntitlement,
    store,
    getProduct: options.getProduct ?? ((productId) => remoteGateway().getProduct(productId)),
    createCheckout: options.createCheckout ?? ((request, key) => remoteGateway().createCheckout(request, key)),
  });
  send(res, result.status, result.body);
}
