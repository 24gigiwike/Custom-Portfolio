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
export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  let body: unknown = req.body;
  if (body == null && req[Symbol.asyncIterator]) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
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
