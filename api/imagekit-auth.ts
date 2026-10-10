import { handleImageKitAuth } from "../src/server/imageKitUploadAuth.js";

type HeaderValue = string | string[] | undefined;

type AuthNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
};

type AuthNodeResponse = {
  status: (code: number) => AuthNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

const BODY_MAX_BYTES = 2048;

async function unreadBody(req: AuthNodeRequest): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  if (!req[Symbol.asyncIterator]) return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buf.length;
    if (size > BODY_MAX_BYTES) return new Uint8Array(size);
    chunks.push(buf);
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Issues a short-lived ImageKit browser-upload signature for a signed-in Firebase user.
 * Vercel matches this file before the SPA rewrite, same as api/site.ts.
 */
export default async function handler(req: AuthNodeRequest, res: AuthNodeResponse): Promise<void> {
  const body = await unreadBody(req);
  await handleImageKitAuth({ method: req.method, headers: req.headers, body }, res);
}
