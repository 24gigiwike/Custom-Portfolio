import { handleBachsWebhook, readRawWebhookBody, BACHS_WEBHOOK_MAX_BODY_BYTES } from "../src/server/bachsWebhookHandler.js";
import { settleStoredDomainPayment } from "../src/server/domainPayment.js";

type HeaderValue = string | string[] | undefined;

type NodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
};

type NodeResponse = {
  status: (code: number) => NodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

/**
 * Vercel must not parse this body before signature verification.
 * A parsed object is rejected because the original bytes are gone.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

function rawBytes(body: unknown): Uint8Array | string | "parsed" | undefined {
  if (body == null) return undefined;
  if (typeof body === "string" || body instanceof Uint8Array) return body;
  if (Buffer.isBuffer(body)) return new Uint8Array(body);
  return "parsed";
}

/**
 * Receives a Bachs webhook. Verification uses the raw body and this
 * runtime's webhook secret. Nothing is granted here.
 */
export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  const supplied = rawBytes(req.body);
  if (supplied === "parsed") {
    res.status(400);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: "The publishing webhook is not valid.", code: "invalid-request" }));
    return;
  }
  let body = supplied;
  let bodyTooLarge = false;
  if (body === undefined && req[Symbol.asyncIterator]) {
    const read = await readRawWebhookBody(req as AsyncIterable<Uint8Array | string>, BACHS_WEBHOOK_MAX_BODY_BYTES);
    if (read === "too-large") bodyTooLarge = true;
    else body = new Uint8Array(read);
  }
  await handleBachsWebhook({ method: req.method, headers: req.headers, body, bodyTooLarge }, res, {
    settleDomainPayment: settleStoredDomainPayment,
  });
}
