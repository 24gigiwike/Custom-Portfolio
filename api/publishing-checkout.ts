import { handlePublishingCheckout } from "../src/server/publishingCheckoutHandler.js";

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
 * Opens Bachs hosted checkout for one owned portfolio.
 * The success redirect does not grant publishing access.
 */
function requestBodyStream(req: NodeRequest): AsyncIterable<Uint8Array | string> | null {
  const iterate = req[Symbol.asyncIterator];
  if (!iterate) return null;
  return {
    [Symbol.asyncIterator]() {
      return iterate.call(req);
    },
  };
}

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  let body: unknown = req.body;
  const stream = body == null ? requestBodyStream(req) : null;
  if (stream) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
      if (chunks.reduce((total, item) => total + item.length, 0) > 16_384) {
        res.status(413);
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ error: "The publishing request is not valid.", code: "invalid-request" }));
        return;
      }
    }
    body = Buffer.concat(chunks);
  }
  await handlePublishingCheckout({ method: req.method, headers: req.headers, body }, res);
}
