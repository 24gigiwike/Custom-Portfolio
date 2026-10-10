import {
  handleImageKitServerUpload,
  IMAGEKIT_MAX_BODY_BYTES,
  readBoundedRequestBody,
} from "../src/server/imageKitServerUpload.js";

type HeaderValue = string | string[] | undefined;

type UploadNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
};

type UploadNodeResponse = {
  status: (code: number) => UploadNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

/**
 * Authenticated server-side ImageKit upload.
 * Fail closed: a uid must be listed in the server-only IMAGEKIT_UPLOAD_ALLOW_UIDS
 * variable. This file does not enable the development proof gate.
 */
export default async function handler(req: UploadNodeRequest, res: UploadNodeResponse): Promise<void> {
  let body: Buffer | "too-large" | undefined;
  let bodyTooLarge = false;
  if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array || typeof req.body === "string") {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === "string"
        ? Buffer.from(req.body)
        : Buffer.from(req.body);
    if (raw.length > IMAGEKIT_MAX_BODY_BYTES) bodyTooLarge = true;
    else body = raw;
  } else if (req[Symbol.asyncIterator]) {
    const read = await readBoundedRequestBody(req as AsyncIterable<Uint8Array | string>, IMAGEKIT_MAX_BODY_BYTES);
    if (read === "too-large") bodyTooLarge = true;
    else body = read;
  }
  await handleImageKitServerUpload(
    { method: req.method, headers: req.headers, body, bodyTooLarge },
    res,
  );
}
