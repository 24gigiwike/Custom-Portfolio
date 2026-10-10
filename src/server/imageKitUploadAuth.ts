import { randomUUID } from "node:crypto";
import ImageKit from "@imagekit/nodejs";
import { IMAGEKIT_UPLOAD_PURPOSE } from "../lib/imageKitUploadPurpose.js";
import { FirebaseIdTokenError, firebaseProjectId, verifyFirebaseIdToken } from "./firebaseIdToken.js";

/**
 * ImageKit signs only `token + expire` with HMAC-SHA1 and the private key.
 * A browser that holds a valid signature can change every other upload field
 * until that signature expires. The signature does not enforce:
 * - file bytes or MIME type
 * - fileName
 * - folder (including the user-scoped folder returned here)
 * - useUniqueFileName, overwriteFile, isPrivateFile
 * - tags, customMetadata, customCoordinates
 * - checks (size, type, or dimension rules)
 * - webhookUrl, extensions, transformation
 *
 * This endpoint therefore only decides who may receive a short-lived signature.
 * It does not cryptographically bind the upload to one folder, quota, or file type.
 * Per-user folders below are a convention the honest client follows.
 * In-memory rate limits reset when an isolate cold-starts and are not shared across instances.
 * A disabled Firebase user can still present an unexpired ID token until it lapses.
 */

export const IMAGEKIT_SIGNATURE_TTL_SECONDS = 5 * 60;
const BODY_MAX_CHARS = 2048;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_MAX_PER_UID = 12;
const FAILURE_WINDOW_MS = 60 * 1000;
const FAILURE_MAX_PER_IP = 20;

type HeaderValue = string | string[] | undefined;

export type ImageKitAuthRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};

export type ImageKitAuthResponse = {
  status: (code: number) => ImageKitAuthResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

type LimitBucket = number[];

const limitBuckets = new Map<string, LimitBucket>();

export function resetImageKitAuthLimits(): void {
  limitBuckets.clear();
}

export function imageKitFolderForUser(uid: string): string {
  if (!UID_PATTERN.test(uid)) {
    throw new Error("This account cannot use image upload yet.");
  }
  return `/custom-portfolio/${uid}/${IMAGEKIT_UPLOAD_PURPOSE}`;
}

function headerValue(headers: Record<string, HeaderValue>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value : "";
}

function clientAddress(headers: Record<string, HeaderValue>): string {
  const forwarded = headerValue(headers, "x-forwarded-for").split(",")[0]?.trim();
  return forwarded || "unknown";
}

function allow(key: string, limit: number, windowMs: number, now: number): boolean {
  const recent = (limitBuckets.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    limitBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  limitBuckets.set(key, recent);
  return true;
}

function send(res: ImageKitAuthResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-robots-tag", "noindex");
  res.end(JSON.stringify(payload));
}

export function readImageKitServerConfig(env: NodeJS.ProcessEnv = process.env): {
  privateKey: string;
  publicKey: string;
  urlEndpoint: string;
} | null {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY?.trim() ?? "";
  const publicKey = env.IMAGEKIT_PUBLIC_KEY?.trim() ?? "";
  const urlEndpoint = env.IMAGEKIT_URL_ENDPOINT?.trim().replace(/\/+$/, "") ?? "";
  if (!privateKey || !publicKey || !urlEndpoint) return null;
  if (privateKey.length > 500 || publicKey.length > 200) return null;
  try {
    const url = new URL(urlEndpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  } catch {
    return null;
  }
  return { privateKey, publicKey, urlEndpoint };
}

function parsePurpose(body: unknown): "poc" | "invalid" | "too-large" {
  if (typeof body === "string") {
    if (body.length > BODY_MAX_CHARS) return "too-large";
    try {
      return parsePurpose(JSON.parse(body));
    } catch {
      return "invalid";
    }
  }
  if (body instanceof Uint8Array) {
    if (body.byteLength > BODY_MAX_CHARS) return "too-large";
    return parsePurpose(Buffer.from(body).toString("utf8"));
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return "invalid";
  const purpose = (body as { purpose?: unknown }).purpose;
  if (purpose !== IMAGEKIT_UPLOAD_PURPOSE) return "invalid";
  return "poc";
}

function bearerToken(headers: Record<string, HeaderValue>): string | null {
  const value = headerValue(headers, "authorization").trim();
  const match = /^Bearer\s+(\S+)$/.exec(value);
  return match?.[1] ?? null;
}

export type IssueImageKitAuthOptions = {
  now?: () => number;
  token?: string;
  verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
  env?: NodeJS.ProcessEnv;
};

export async function handleImageKitAuth(
  req: ImageKitAuthRequest,
  res: ImageKitAuthResponse,
  options: IssueImageKitAuthOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to request upload authorization." });
    return;
  }

  const contentType = headerValue(req.headers, "content-type").toLowerCase();
  if (!contentType.includes("application/json")) {
    send(res, 415, { error: "Send a JSON request." });
    return;
  }

  const purpose = parsePurpose(req.body);
  if (purpose === "too-large") {
    send(res, 413, { error: "Request is too large." });
    return;
  }
  if (purpose !== "poc") {
    send(res, 400, { error: "This upload purpose is not available." });
    return;
  }

  const now = options.now ?? Date.now;
  const address = clientAddress(req.headers);
  const token = bearerToken(req.headers);
  if (!token) {
    if (!allow(`fail:${address}`, FAILURE_MAX_PER_IP, FAILURE_WINDOW_MS, now())) {
      send(res, 429, { error: "Too many upload attempts. Wait a moment and try again." });
      return;
    }
    send(res, 401, { error: "Sign in to upload an image." });
    return;
  }

  let uid = "";
  try {
    const verified = await (options.verify ?? verifyFirebaseIdToken)(token, firebaseProjectId());
    uid = verified.uid;
  } catch (error) {
    if (!allow(`fail:${address}`, FAILURE_MAX_PER_IP, FAILURE_WINDOW_MS, now())) {
      send(res, 429, { error: "Too many upload attempts. Wait a moment and try again." });
      return;
    }
    const message = error instanceof FirebaseIdTokenError ? error.message : "Sign in to upload an image.";
    send(res, 401, { error: message });
    return;
  }

  if (!allow(`uid:${uid}`, AUTH_MAX_PER_UID, AUTH_WINDOW_MS, now())) {
    send(res, 429, { error: "Too many upload attempts. Wait a moment and try again." });
    return;
  }

  const config = readImageKitServerConfig(options.env);
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

  const expire = Math.floor(now() / 1000) + IMAGEKIT_SIGNATURE_TTL_SECONDS;
  const uploadToken = options.token ?? randomUUID();
  let signed: { token: string; expire: number; signature: string };
  try {
    const client = new ImageKit({ privateKey: config.privateKey });
    signed = client.helper.getAuthenticationParameters(uploadToken, expire);
  } catch {
    send(res, 503, { error: "Image upload storage is not configured." });
    return;
  }

  send(res, 200, {
    token: signed.token,
    expire: signed.expire,
    signature: signed.signature,
    publicKey: config.publicKey,
    urlEndpoint: config.urlEndpoint,
    folder,
    purpose: IMAGEKIT_UPLOAD_PURPOSE,
  });
}
