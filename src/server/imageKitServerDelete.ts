import { FirebaseIdTokenError, firebaseProjectId, verifyFirebaseIdToken } from "./firebaseIdToken.js";
import { FirebaseProjectIsolationError } from "../lib/firebaseEnvironment.js";
import { assertFirebaseAdminForRuntime, firebaseAdminFirestore } from "./firebaseAdmin.js";
import {
  createFirestoreImageKitQuotaStore,
  imageKitDefaultQuotaBytes,
  imageKitDeleteFile,
  type ImageKitCleanupResult,
  type ImageKitQuotaStore,
} from "./imageKitQuota.js";
import { imageKitUploadAllowUids, type ImageKitUploadResponse } from "./imageKitServerUpload.js";
import { portfolioIdFromImageKitPath, readImageKitServerConfig } from "./imageKitUploadAuth.js";

/**
 * Server-mediated ImageKit delete.
 *
 * The browser sends a file id or the exact file path returned by an earlier upload.
 * This handler deletes only a quota record owned by the verified uid, and only after
 * the portfolio owner matches when the path names a portfolio. Production stays closed
 * unless IMAGEKIT_UPLOAD_ALLOW_UIDS lists the uid. This file does not set developmentProof.
 */

export const IMAGEKIT_MAX_DELETE_BODY_BYTES = 8 * 1024;
const IMAGEKIT_UNAVAILABLE = "Image upload storage is not configured.";

type HeaderValue = string | string[] | undefined;

export type ImageKitDeleteRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
  bodyTooLarge?: boolean;
};

export type ImageKitServerDeleteOptions = {
  env?: NodeJS.ProcessEnv;
  developmentProof?: boolean;
  verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
  quotaStore?: ImageKitQuotaStore | null;
  deleteFile?: (fileId: string) => Promise<void>;
  loadPortfolio?: (portfolioId: string) => Promise<{ ownerId: string } | null | "unconfigured">;
};

function headerValue(headers: Record<string, HeaderValue>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value : "";
}

function bearerToken(headers: Record<string, HeaderValue>): string | null {
  const match = /^Bearer\s+(\S+)$/.exec(headerValue(headers, "authorization").trim());
  return match?.[1] ?? null;
}

function send(res: ImageKitUploadResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-robots-tag", "noindex");
  res.end(JSON.stringify(payload));
}

function readDeleteBody(body: unknown): { fileId: string; filePath: string } | { error: string } {
  let value: unknown = body;
  if (Buffer.isBuffer(body)) value = body.toString("utf8");
  else if (body instanceof Uint8Array) value = Buffer.from(body).toString("utf8");
  if (typeof value === "string") {
    if (value.length > IMAGEKIT_MAX_DELETE_BODY_BYTES) return { error: "This removal request is not valid." };
    try {
      value = JSON.parse(value);
    } catch {
      return { error: "This removal request is not valid." };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "This removal request is not valid." };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "fileId" && key !== "filePath")) {
    return { error: "This upload field is not available." };
  }
  const fileId = typeof record.fileId === "string" ? record.fileId.trim() : "";
  const filePath = typeof record.filePath === "string" ? record.filePath.trim() : "";
  if (Boolean(fileId) === Boolean(filePath)) return { error: "This removal request is not valid." };
  if (fileId.length > 128 || filePath.length > 512 || filePath.includes("..")) {
    return { error: "This removal request is not valid." };
  }
  return { fileId, filePath };
}

async function adminLoadPortfolio(
  portfolioId: string,
  env: NodeJS.ProcessEnv,
): Promise<{ ownerId: string } | null | "unconfigured"> {
  const db = firebaseAdminFirestore(env);
  if (!db) return "unconfigured";
  const snap = await db.collection("portfolios").doc(portfolioId).get();
  if (!snap.exists) return null;
  const ownerId = snap.get("ownerId");
  if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.includes("/") || ownerId.length > 128) return null;
  return { ownerId };
}

function failureStatus(result: ImageKitCleanupResult): { status: number; error: string } {
  if (!("reason" in result)) return { status: 200, error: "" };
  if (
    result.reason === "referenced-by-account" ||
    result.reason === "referenced-by-saved-portfolio" ||
    result.reason === "referenced-by-published-portfolio"
  ) {
    return { status: 409, error: "This image is still used." };
  }
  if (result.reason === "delete-failed" || result.reason === "reference-check-failed") {
    return { status: 502, error: "We couldn't remove the stored image file." };
  }
  return { status: 403, error: "This image cannot be removed." };
}

export async function handleImageKitServerDelete(
  req: ImageKitDeleteRequest,
  res: ImageKitUploadResponse,
  options: ImageKitServerDeleteOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to remove an image." });
    return;
  }
  if (req.bodyTooLarge) {
    send(res, 413, { error: "This removal request is not valid." });
    return;
  }

  const token = bearerToken(req.headers);
  if (!token) {
    send(res, 401, { error: "Sign in to upload an image." });
    return;
  }

  const env = options.env ?? process.env;
  let tokenProject = "";
  try {
    tokenProject = firebaseProjectId(env);
    assertFirebaseAdminForRuntime(env);
  } catch (error) {
    if (error instanceof FirebaseProjectIsolationError) {
      send(res, 503, { error: IMAGEKIT_UNAVAILABLE });
      return;
    }
    throw error;
  }
  let uid = "";
  try {
    const verified = await (options.verify ?? verifyFirebaseIdToken)(token, tokenProject);
    uid = verified.uid;
  } catch (error) {
    const message = error instanceof FirebaseIdTokenError ? error.message : "Sign in to upload an image.";
    send(res, 401, { error: message });
    return;
  }

  const allowed = options.developmentProof === true || imageKitUploadAllowUids(env).has(uid);
  if (!allowed) {
    send(res, 403, { error: "Image upload is not available." });
    return;
  }

  const parsed = readDeleteBody(req.body);
  if ("error" in parsed) {
    send(res, 400, { error: parsed.error });
    return;
  }

  const quotaStore = options.quotaStore === undefined
    ? (() => {
        const db = firebaseAdminFirestore(env);
        return db ? createFirestoreImageKitQuotaStore(db, { defaultLimitBytes: imageKitDefaultQuotaBytes(env) }) : null;
      })()
    : options.quotaStore;
  if (!quotaStore) {
    send(res, 503, { error: IMAGEKIT_UNAVAILABLE });
    return;
  }

  const owned = await quotaStore.findOwnedUpload({
    uid,
    fileId: parsed.fileId || undefined,
    filePath: parsed.filePath || undefined,
  });
  const filePath = owned?.filePath ?? "";
  if (!owned || owned.uid !== uid || !filePath.startsWith(`/custom-portfolio/${uid}/`) || filePath.includes("..")) {
    send(res, 403, { error: "This image cannot be removed." });
    return;
  }

  const portfolioId = portfolioIdFromImageKitPath(filePath, uid);
  if (portfolioId) {
    let portfolio: { ownerId: string } | null | "unconfigured";
    try {
      portfolio = await (options.loadPortfolio ?? ((id: string) => adminLoadPortfolio(id, env)))(portfolioId);
    } catch {
      send(res, 503, { error: IMAGEKIT_UNAVAILABLE });
      return;
    }
    if (portfolio === "unconfigured") {
      send(res, 503, { error: IMAGEKIT_UNAVAILABLE });
      return;
    }
    if (portfolio && portfolio.ownerId !== uid) {
      send(res, 403, { error: "This image cannot be removed." });
      return;
    }
  }

  const config = readImageKitServerConfig(env);
  if (!config) {
    send(res, 503, { error: IMAGEKIT_UNAVAILABLE });
    return;
  }

  let result: ImageKitCleanupResult;
  try {
    result = await quotaStore.safeDeleteUpload({
      uid,
      uploadId: owned.uploadId,
      deleteFile: options.deleteFile ?? imageKitDeleteFile(config.privateKey),
    });
  } catch {
    send(res, 502, { error: "We couldn't remove the stored image file." });
    return;
  }
  if (result.deleted) {
    send(res, 200, { deleted: true });
    return;
  }
  const failure = failureStatus(result);
  send(res, failure.status, { error: failure.error });
}
