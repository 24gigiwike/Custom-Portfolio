import { handlePortfolioCreateTrace } from "../src/server/portfolioCreateTrace.js";

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
  end: (body?: string) => void;
};

/**
 * Same-origin diagnostic sink for portfolio creation.
 * It does not read Firebase credentials and does not create a portfolio.
 */
export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  let body: unknown = req.body;
  const iterate = req[Symbol.asyncIterator]?.bind(req);
  if (body == null && iterate) {
    const chunks: Buffer[] = [];
    for await (const chunk of { [Symbol.asyncIterator]: iterate }) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
      if (chunks.reduce((total, item) => total + item.length, 0) > 2_048) {
        res.status(413);
        res.setHeader("cache-control", "no-store");
        res.end();
        return;
      }
    }
    body = Buffer.concat(chunks);
  }
  await handlePortfolioCreateTrace({ method: req.method, body }, res);
}
