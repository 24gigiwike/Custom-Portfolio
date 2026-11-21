import { handlePortfolioCreate } from "../src/server/portfolioCreateHandler.js";

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
 * Trusted portfolio creation for the signed-in Firebase user.
 * The request body cannot supply owner id, account age, or publishing state.
 */
export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  let body: unknown = req.body;
  const iterate = req[Symbol.asyncIterator]?.bind(req);
  if (body == null && iterate) {
    const chunks: Buffer[] = [];
    for await (const chunk of { [Symbol.asyncIterator]: iterate }) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
      if (chunks.reduce((total, item) => total + item.length, 0) > 32_768) {
        res.status(413);
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ error: "The portfolio request is not valid.", code: "invalid-request" }));
        return;
      }
    }
    body = Buffer.concat(chunks);
  }
  await handlePortfolioCreate({ method: req.method, headers: req.headers, body }, res);
}
