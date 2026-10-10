import { createHash, randomUUID } from "node:crypto";
import ImageKit from "@imagekit/nodejs";
import { FirebaseIdTokenError, firebaseProjectId, verifyFirebaseIdToken } from "./firebaseIdToken.js";
import { firebaseAdminFirestore } from "./firebaseAdmin.js";
import {
  createFirestoreImageKitQuotaStore,
  imageKitDefaultQuotaBytes,
  ImageKitQuotaError,
  type ImageKitQuotaStore,
} from "./imageKitQuota.js";
import { imageKitFolderForUser, readImageKitServerConfig } from "./imageKitUploadAuth.js";

/**
 * Server-mediated ImageKit upload.
 *
 * The browser never receives a signing key or an upload signature. This handler
 * checks the Firebase ID token, the file bytes, and the size, then chooses the
 * folder and file name itself.
 *
 * Durable quotas are enforced with server-only Firestore records. Production still
 * stays closed unless IMAGEKIT_UPLOAD_ALLOW_UIDS lists the Firebase uid.
 * That variable is server-only.
 * The Vite dev server passes developmentProof in code. A request header or body
 * cannot turn it on.
 *
 * In-memory function counters are not a quota. They reset on every cold start.
 */

/** Largest file the current optimizer can emit: GIF passthrough and safeOriginalMaxBytes. */
export const IMAGEKIT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Multipart boundaries and part headers sit above the file bytes. Still under Vercel's 4.5 MB body cap. */
export const IMAGEKIT_MAX_BODY_BYTES = IMAGEKIT_MAX_UPLOAD_BYTES + 64 * 1024;

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

type HeaderValue = string | string[] | undefined;

export type ImageKitUploadRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  bodyTooLarge?: boolean;
};

export type ImageKitUploadResponse = {
  status: (code: number) => ImageKitUploadResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export type ImageKitStoredUpload = {
  url?: string;
  fileId?: string;
  filePath?: string;
};

export type ImageKitServerUploadOptions = {
  env?: NodeJS.ProcessEnv;
  /** Set only by the Vite dev plugin. Production api/imagekit-upload.ts must not set this. */
  developmentProof?: boolean;
  verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
  quotaStore?: ImageKitQuotaStore | null;
  uploadKey?: () => string;
  uploadFile?: (input: {
    bytes: Uint8Array;
    fileName: string;
    contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    folder: string;
    privateKey: string;
  }) => Promise<ImageKitStoredUpload>;
};

type ParsedFile = {
  data: Buffer;
  declaredType: string;
};

export async function readBoundedRequestBody(
  req: AsyncIterable<Uint8Array | string>,
  maxBytes: number,
): Promise<Buffer | "too-large"> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      const destroyable = req as { destroy?: () => void };
      destroyable.destroy?.();
      return "too-large";
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export function imageTypeFromMagic(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function extensionFor(type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "gif";
}

export function imageKitUploadAllowUids(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    (env.IMAGEKIT_UPLOAD_ALLOW_UIDS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => FILE_ID_PATTERN.test(item)),
  );
}

function headerValue(headers: Record<string, HeaderValue>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value : "";
}

function bearerToken(headers: Record<string, HeaderValue>): string | null {
  const match = /^Bearer\s+(\S+)$/.exec(headerValue(headers, "authorization").trim());
  return match?.[1] ?? null;
}

function idempotencyKey(headers: Record<string, HeaderValue>, createKey: () => string): string {
  return headerValue(headers, "x-imagekit-upload-id").trim() || createKey();
}

function send(res: ImageKitUploadResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-robots-tag", "noindex");
  res.end(JSON.stringify(payload));
}

function parseSingleFile(body: Buffer, contentType: string):
  | { ok: true; file: ParsedFile }
  | { ok: false; status: number; error: string } {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2] || "";
  if (!boundary || boundary.length > 200 || boundary.includes("\r") || boundary.includes("\n")) {
    return { ok: false, status: 400, error: "Send the image as multipart form data." };
  }
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(delimiter);
  if (cursor < 0) return { ok: false, status: 400, error: "Send the image as multipart form data." };
  cursor += delimiter.length;
  const parts: Buffer[] = [];
  while (cursor < body.length) {
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;
    const next = body.indexOf(delimiter, cursor);
    if (next < 0) break;
    let part = body.subarray(cursor, next);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    parts.push(part);
    cursor = next + delimiter.length;
  }
  if (parts.length === 0) return { ok: false, status: 400, error: "Choose an image file." };
  let file: ParsedFile | null = null;
  for (const part of parts) {
    const split = part.indexOf("\r\n\r\n");
    if (split < 0) return { ok: false, status: 400, error: "Send the image as multipart form data." };
    const headerText = part.subarray(0, split).toString("utf8");
    const name = /name="([^"]*)"/.exec(headerText)?.[1] ?? "";
    if (name !== "file") return { ok: false, status: 400, error: "This upload field is not available." };
    if (file) return { ok: false, status: 400, error: "Send one image file." };
    const declaredType = /content-type:\s*([^\r\n;]+)/i.exec(headerText)?.[1]?.trim().toLowerCase() ?? "";
    file = { data: part.subarray(split + 4), declaredType };
  }
  if (!file || file.data.length === 0) return { ok: false, status: 400, error: "Choose an image file." };
  return { ok: true, file };
}

function bodyBuffer(body: unknown): Buffer | "too-large" | "missing" {
  if (body === "too-large") return "too-large";
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  return "missing";
}

function safeResult(
  endpoint: string,
  folder: string,
  uploaded: ImageKitStoredUpload,
): { url: string; fileId: string; filePath: string } | null {
  const fileId = uploaded.fileId?.trim() ?? "";
  const filePath = uploaded.filePath?.trim() ?? "";
  const urlValue = uploaded.url?.trim() ?? "";
  if (!FILE_ID_PATTERN.test(fileId)) return null;
  if (!filePath.startsWith(`${folder}/`) || filePath.includes("..")) return null;
  let delivery: URL;
  let expected: URL;
  try {
    delivery = new URL(urlValue);
    expected = new URL(endpoint);
  } catch {
    return null;
  }
  if (delivery.protocol !== "https:" || delivery.username || delivery.password || delivery.search || delivery.hash) return null;
  if (delivery.origin !== expected.origin) return null;
  const path = decodeURIComponent(delivery.pathname);
  if (!path.startsWith(expected.pathname) || !path.includes(`${folder}/`)) return null;
  return { url: `${delivery.origin}${delivery.pathname}`, fileId, filePath };
}

function quotaStoreForEnv(env: NodeJS.ProcessEnv): ImageKitQuotaStore | null {
  const db = firebaseAdminFirestore(env);
  if (!db) return null;
  return createFirestoreImageKitQuotaStore(db, { defaultLimitBytes: imageKitDefaultQuotaBytes(env) });
}

async function uploadWithSdk(input: {
  bytes: Uint8Array;
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  folder: string;
  privateKey: string;
}): Promise<ImageKitStoredUpload> {
  const client = new ImageKit({ privateKey: input.privateKey });
  const uploaded = await client.files.upload({
    file: new File([input.bytes], input.fileName, { type: input.contentType }),
    fileName: input.fileName,
    folder: input.folder,
    useUniqueFileName: true,
    overwriteFile: false,
    isPrivateFile: false,
  });
  return { url: uploaded.url, fileId: uploaded.fileId, filePath: uploaded.filePath };
}

export async function handleImageKitServerUpload(
  req: ImageKitUploadRequest,
  res: ImageKitUploadResponse,
  options: ImageKitServerUploadOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to upload an image." });
    return;
  }
  if (req.bodyTooLarge) {
    send(res, 413, { error: "This image is too large to process. Please choose another image." });
    return;
  }

  const token = bearerToken(req.headers);
  if (!token) {
    send(res, 401, { error: "Sign in to upload an image." });
    return;
  }

  let uid = "";
  try {
    const verified = await (options.verify ?? verifyFirebaseIdToken)(token, firebaseProjectId());
    uid = verified.uid;
  } catch (error) {
    const message = error instanceof FirebaseIdTokenError ? error.message : "Sign in to upload an image.";
    send(res, 401, { error: message });
    return;
  }

  const env = options.env ?? process.env;
  const allowed = options.developmentProof === true || imageKitUploadAllowUids(env).has(uid);
  if (!allowed) {
    send(res, 403, { error: "Image upload is not available." });
    return;
  }

  const contentType = headerValue(req.headers, "content-type");
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    send(res, 415, { error: "Send the image as multipart form data." });
    return;
  }
  const raw = bodyBuffer(req.body);
  if (raw === "too-large") {
    send(res, 413, { error: "This image is too large to process. Please choose another image." });
    return;
  }
  if (raw === "missing") {
    send(res, 400, { error: "Choose an image file." });
    return;
  }
  if (raw.length > IMAGEKIT_MAX_BODY_BYTES) {
    send(res, 413, { error: "This image is too large to process. Please choose another image." });
    return;
  }

  const parsed = parseSingleFile(raw, contentType);
  if (parsed.ok === false) {
    send(res, parsed.status, { error: parsed.error });
    return;
  }
  if (parsed.file.data.length > IMAGEKIT_MAX_UPLOAD_BYTES) {
    send(res, 413, { error: "This image is too large to process. Please choose another image." });
    return;
  }
  const detected = imageTypeFromMagic(parsed.file.data);
  if (!detected) {
    send(res, 415, { error: "This image format isn't supported. Please use JPG, PNG, WEBP, or GIF." });
    return;
  }

  const config = readImageKitServerConfig(env);
  if (!config) {
    send(res, 503, { error: "Image upload storage is not configured." });
    return;
  }

  let folder = "";
  try {
    folder = imageKitFolderForUser(uid);
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : "This account cannot use image upload yet." });
    return;
  }

  const fileName = `${randomUUID()}.${extensionFor(detected)}`;
  const contentSha256 = createHash("sha256").update(parsed.file.data).digest("hex");
  const uploadKey = idempotencyKey(req.headers, options.uploadKey ?? randomUUID);
  const quotaStore = options.quotaStore === undefined ? quotaStoreForEnv(env) : options.quotaStore;
  if (!quotaStore) {
    send(res, 503, { error: "Image upload storage is not configured." });
    return;
  }

  let uploadId = "";
  try {
    const reservation = await quotaStore.reserveUpload({
      uid,
      uploadKey,
      sizeBytes: parsed.file.data.length,
      contentSha256,
      contentType: detected,
      folder,
      fileName,
    });
    if (reservation.kind === "already-uploaded") {
      const stored = reservation.upload;
      send(res, 200, {
        url: stored.url,
        fileId: stored.fileId,
        filePath: stored.filePath,
        contentType: stored.contentType,
        bytes: stored.sizeBytes,
      });
      return;
    }
    if (reservation.kind === "in-progress" || reservation.kind === "recoverable") {
      send(res, 409, { error: "This upload is already being processed. Try again." });
      return;
    }
    uploadId = reservation.uploadId;
  } catch (error) {
    if (error instanceof ImageKitQuotaError && error.reason === "quota-exceeded") {
      send(res, 409, { error: "You have reached your image storage limit." });
      return;
    }
    if (error instanceof ImageKitQuotaError && error.reason === "invalid-upload-key") {
      send(res, 400, { error: "This upload request is not valid." });
      return;
    }
    send(res, 503, { error: "Image upload storage is not configured." });
    return;
  }

  let uploaded: ImageKitStoredUpload;
  try {
    uploaded = await (options.uploadFile ?? uploadWithSdk)({
      bytes: parsed.file.data,
      fileName,
      contentType: detected,
      folder,
      privateKey: config.privateKey,
    });
  } catch {
    await quotaStore.markUploadRecoverable({
      uid,
      uploadId,
      sizeBytes: parsed.file.data.length,
      reason: "imagekit-upload-failed",
    }).catch(() => {});
    send(res, 502, { error: "Image upload failed. Try again." });
    return;
  }

  const safe = safeResult(config.urlEndpoint, folder, uploaded);
  if (!safe) {
    await quotaStore.markUploadRecoverable({
      uid,
      uploadId,
      sizeBytes: parsed.file.data.length,
      reason: "imagekit-unsafe-result",
    }).catch(() => {});
    send(res, 502, { error: "Image upload failed. Try again." });
    return;
  }

  try {
    await quotaStore.completeUpload({
      uid,
      uploadId,
      sizeBytes: parsed.file.data.length,
      uploaded: safe,
    });
  } catch {
    await quotaStore.markUploadRecoverable({
      uid,
      uploadId,
      sizeBytes: parsed.file.data.length,
      uploaded: safe,
      reason: "firestore-completion-failed",
    }).catch(() => {});
    send(res, 502, { error: "Image upload failed. Try again." });
    return;
  }

  send(res, 200, {
    url: safe.url,
    fileId: safe.fileId,
    filePath: safe.filePath,
    contentType: detected,
    bytes: parsed.file.data.length,
  });
}
