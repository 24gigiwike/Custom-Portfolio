import {
  emitPortfolioCreateTrace,
  sanitizePortfolioCreateTrace,
} from "../lib/portfolioCreateTrace.js";

type HeaderValue = string | string[] | undefined;

type TraceRequest = {
  method?: string;
  body?: unknown;
};

type TraceResponse = {
  status: (code: number) => TraceResponse;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

function send(res: TraceResponse, status: number): void {
  res.status(status);
  res.setHeader("cache-control", "no-store");
  res.end();
}

function jsonBody(body: unknown): unknown {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return JSON.parse(Buffer.from(body).toString("utf8"));
  }
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

/**
 * Accept one sanitized client diagnostic.
 * The recorded source is always client, and the body is not echoed.
 */
export async function handlePortfolioCreateTrace(req: TraceRequest, res: TraceResponse): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405);
    return;
  }
  let parsed: unknown;
  try {
    parsed = jsonBody(req.body);
  } catch {
    send(res, 400);
    return;
  }
  const event = sanitizePortfolioCreateTrace(parsed);
  if (!event) {
    send(res, 400);
    return;
  }
  emitPortfolioCreateTrace(event, "client");
  send(res, 204);
}
