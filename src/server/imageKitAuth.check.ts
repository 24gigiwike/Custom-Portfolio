import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { imageKitDevServerEnv } from "./imageKitDevPlugin";
import { ImageUploadCancelled } from "../lib/imageAttempt";
import {
  IMAGEKIT_UPLOAD_FAILED,
  ImageKitTransferError,
  uploadOptimizedFileToImageKit,
} from "../lib/imageKitStorage";
import { accountPhotoImageStorageProvider, activeImageStorageProvider, configuredImageStorageProvider } from "../lib/imageStorageProvider";
import { proveImageKitUpload } from "../dev/imageKitUploadProof";
import { verifyFirebaseIdToken } from "./firebaseIdToken";
import { imageKitFolderForUser } from "./imageKitUploadAuth";
import {
  handleImageKitServerUpload,
  IMAGEKIT_MAX_UPLOAD_BYTES,
  imageTypeFromMagic,
  type ImageKitStoredUpload,
  type ImageKitUploadResponse,
} from "./imageKitServerUpload";
import { readFirebaseAdminCredentials } from "./firebaseAdmin";
import {
  IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES,
  ImageKitQuotaError,
  containsExactImageReference,
  type ImageKitCleanupResult,
  type ImageKitQuotaReservation,
  type ImageKitQuotaStore,
  type ImageKitReservationReconciliation,
  type ImageKitTrackedUpload,
} from "./imageKitQuota";
import retiredAuth from "../../api/imagekit-auth";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const certificate = publicKey.export({ type: "spki", format: "pem" }).toString();
const signingKey = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const projectId = "custom-portfolio-2026";
const nowMs = 1_700_000_000_000;
const privateApiKey = "private-test-key-value";
const defaultQuotaBytes = IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES;

function b64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signToken(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", typ: "JWT", kid: "test-key" }): string {
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return `${data}.${signer.sign(signingKey).toString("base64url")}`;
}

function validPayload(uid = "user123"): Record<string, unknown> {
  const seconds = Math.floor(nowMs / 1000);
  return {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    auth_time: seconds - 30,
    user_id: uid,
    sub: uid,
    iat: seconds - 30,
    exp: seconds + 3600,
  };
}

async function verify(token: string): Promise<{ uid: string }> {
  return verifyFirebaseIdToken(token, projectId, {
    now: () => nowMs,
    loadCerts: async () => ({ "test-key": certificate }),
  });
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.alloc(12);
WEBP.write("RIFF", 0);
WEBP.writeUInt32LE(4, 4);
WEBP.write("WEBP", 8);

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

class MemoryQuotaStore implements ImageKitQuotaStore {
  readonly uploads = new Map<string, ImageKitTrackedUpload>();
  readonly quotas = new Map<string, { usedBytes: number; reservedBytes: number; limitBytes: number }>();
  accountReference: unknown = null;
  savedReferences: unknown[] = [];
  publishedReferences: unknown[] = [];
  failComplete = false;

  constructor(readonly limitBytes = defaultQuotaBytes) {}

  quota(uid: string) {
    const existing = this.quotas.get(uid);
    if (existing) return existing;
    const created = { usedBytes: 0, reservedBytes: 0, limitBytes: this.limitBytes };
    this.quotas.set(uid, created);
    return created;
  }

  uploadId(uid: string, uploadKey: string): string {
    return `${uid}:${uploadKey}`;
  }

  async reserveUpload(input: Parameters<ImageKitQuotaStore["reserveUpload"]>[0]): Promise<ImageKitQuotaReservation> {
    const uploadId = this.uploadId(input.uid, input.uploadKey);
    const existing = this.uploads.get(uploadId);
    if (existing) {
      assert.equal(existing.uid, input.uid);
      assert.equal(existing.sizeBytes, input.sizeBytes);
      assert.equal(existing.contentSha256, input.contentSha256);
      assert.equal(existing.contentType, input.contentType);
      assert.equal(existing.folder, input.folder);
      if (existing.status === "uploaded") return { kind: "already-uploaded", upload: existing };
      if (existing.status === "recoverable") return { kind: "recoverable", uploadId, upload: existing.url && existing.fileId && existing.filePath ? existing : undefined };
      return { kind: "in-progress", uploadId };
    }
    const quota = this.quota(input.uid);
    if (input.sizeBytes > quota.limitBytes - quota.usedBytes - quota.reservedBytes) {
      throw new ImageKitQuotaError("quota-exceeded");
    }
    const startedAt = input.nowMs ?? nowMs;
    quota.reservedBytes += input.sizeBytes;
    this.uploads.set(uploadId, {
      uploadId,
      uid: input.uid,
      status: "reserved",
      sizeBytes: input.sizeBytes,
      contentSha256: input.contentSha256,
      contentType: input.contentType,
      folder: input.folder,
      fileName: input.fileName,
      leaseExpiresAtMs: startedAt + 15 * 60 * 1000,
      createdAtMs: startedAt,
      updatedAtMs: startedAt,
    });
    return { kind: "reserved", uploadId };
  }

  async completeUpload(input: Parameters<ImageKitQuotaStore["completeUpload"]>[0]): Promise<ImageKitTrackedUpload> {
    if (this.failComplete) throw new Error("commit failed");
    const existing = this.uploads.get(input.uploadId);
    assert(existing, "upload must be reserved");
    if (existing.status === "uploaded") return existing;
    assert.ok(["reserved", "uploading", "recoverable"].includes(existing.status));
    const quota = this.quota(input.uid);
    quota.reservedBytes = Math.max(0, quota.reservedBytes - input.sizeBytes);
    quota.usedBytes += input.sizeBytes;
    const completed = {
      ...existing,
      status: "uploaded" as const,
      url: input.uploaded.url,
      fileId: input.uploaded.fileId,
      filePath: input.uploaded.filePath,
      updatedAtMs: nowMs,
    };
    this.uploads.set(input.uploadId, completed);
    return completed;
  }

  async markUploadAttemptStarted(input: Parameters<ImageKitQuotaStore["markUploadAttemptStarted"]>[0]): Promise<void> {
    const existing = this.uploads.get(input.uploadId);
    assert(existing, "upload must be reserved");
    if (existing.status === "uploaded" || existing.status === "deleted") return;
    assert.ok(["reserved", "uploading"].includes(existing.status));
    this.uploads.set(input.uploadId, {
      ...existing,
      status: "uploading",
      imageKitAttemptedAtMs: existing.imageKitAttemptedAtMs ?? nowMs,
      leaseExpiresAtMs: (input.nowMs ?? nowMs) + 15 * 60 * 1000,
      updatedAtMs: input.nowMs ?? nowMs,
    });
  }

  async markUploadRecoverable(input: Parameters<ImageKitQuotaStore["markUploadRecoverable"]>[0]): Promise<void> {
    const existing = this.uploads.get(input.uploadId);
    if (!existing || existing.status === "uploaded" || existing.status === "deleted") return;
    this.uploads.set(input.uploadId, {
      ...existing,
      ...(input.uploaded ?? {}),
      status: "recoverable",
      leaseExpiresAtMs: (input.nowMs ?? nowMs) + 15 * 60 * 1000,
      updatedAtMs: input.nowMs ?? nowMs,
    });
  }

  async reconcileStaleReservations(input: Parameters<ImageKitQuotaStore["reconcileStaleReservations"]>[0]): Promise<ImageKitReservationReconciliation[]> {
    const now = input.nowMs ?? nowMs;
    const results: ImageKitReservationReconciliation[] = [];
    for (const upload of this.uploads.values()) {
      if (upload.uid !== input.uid || upload.quotaReleasedAtMs) continue;
      if (!["reserved", "uploading"].includes(upload.status)) continue;
      if (!upload.leaseExpiresAtMs || upload.leaseExpiresAtMs > now) continue;
      const quota = this.quota(input.uid);
      if (upload.status === "reserved" && !upload.imageKitAttemptedAtMs) {
        quota.reservedBytes = Math.max(0, quota.reservedBytes - upload.sizeBytes);
        this.uploads.set(upload.uploadId, {
          ...upload,
          status: "expired",
          quotaReleasedAtMs: now,
          updatedAtMs: now,
        });
        results.push({ uploadId: upload.uploadId, action: "released-unattempted" });
      } else {
        this.uploads.set(upload.uploadId, {
          ...upload,
          status: "recoverable",
          leaseExpiresAtMs: now + 15 * 60 * 1000,
          updatedAtMs: now,
        });
        results.push({ uploadId: upload.uploadId, action: "held-for-manual-recovery" });
      }
      if (results.length >= (input.limit ?? 25)) break;
    }
    return results;
  }

  async releaseVerifiedUnstoredUpload(input: Parameters<ImageKitQuotaStore["releaseVerifiedUnstoredUpload"]>[0]): Promise<boolean> {
    const existing = this.uploads.get(input.uploadId);
    if (!existing || existing.uid !== input.uid) return false;
    if (existing.quotaReleasedAtMs) return true;
    if (existing.url || existing.fileId || existing.filePath) return false;
    if (!["recoverable", "expired"].includes(existing.status)) return false;
    const quota = this.quota(input.uid);
    quota.reservedBytes = Math.max(0, quota.reservedBytes - existing.sizeBytes);
    this.uploads.set(input.uploadId, {
      ...existing,
      status: "expired",
      quotaReleasedAtMs: input.nowMs ?? nowMs,
      updatedAtMs: input.nowMs ?? nowMs,
    });
    return true;
  }

  async safeDeleteUpload(input: Parameters<ImageKitQuotaStore["safeDeleteUpload"]>[0]): Promise<ImageKitCleanupResult> {
    const existing = this.uploads.get(input.uploadId);
    if (!existing) return { deleted: false, uploadId: input.uploadId, reason: "not-found" as const };
    if (existing.uid !== input.uid) return { deleted: false, uploadId: input.uploadId, reason: "wrong-owner" as const };
    if (existing.status === "deleted") return { deleted: true, uploadId: input.uploadId };
    if (!["uploaded", "recoverable"].includes(existing.status)) return { deleted: false, uploadId: input.uploadId, reason: "not-cleanable" as const };
    if (!existing.url || !existing.fileId || !existing.filePath) {
      return { deleted: false, uploadId: input.uploadId, reason: "missing-imagekit-file" as const };
    }
    if (this.accountReference && containsExactImageReference(this.accountReference, existing)) {
      return { deleted: false, uploadId: input.uploadId, reason: "referenced-by-account" as const };
    }
    if (this.savedReferences.some((value) => containsExactImageReference(value, existing))) {
      return { deleted: false, uploadId: input.uploadId, reason: "referenced-by-saved-portfolio" as const };
    }
    if (this.publishedReferences.some((value) => containsExactImageReference(value, existing))) {
      return { deleted: false, uploadId: input.uploadId, reason: "referenced-by-published-portfolio" as const };
    }
    this.uploads.set(input.uploadId, { ...existing, status: "delete-pending", updatedAtMs: nowMs });
    try {
      await input.deleteFile(existing.fileId);
    } catch {
      this.uploads.set(input.uploadId, existing);
      return { deleted: false, uploadId: input.uploadId, reason: "delete-failed" as const };
    }
    const quota = this.quota(input.uid);
    if (existing.status === "uploaded") quota.usedBytes = Math.max(0, quota.usedBytes - existing.sizeBytes);
    else quota.reservedBytes = Math.max(0, quota.reservedBytes - existing.sizeBytes);
    this.uploads.set(input.uploadId, { ...existing, status: "deleted", quotaReleasedAtMs: nowMs, updatedAtMs: nowMs });
    return { deleted: true, uploadId: input.uploadId };
  }
}

function multipart(parts: Array<{ name: string; filename?: string; type?: string; data: Buffer }>, boundary = "----CustomBoundary7"): { body: Buffer; contentType: string } {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`
      : `Content-Disposition: form-data; name="${part.name}"`;
    const type = part.type ? `Content-Type: ${part.type}\r\n` : "";
    chunks.push(Buffer.from(`--${boundary}\r\n${disposition}\r\n${type}\r\n`));
    chunks.push(part.data);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function call(input: {
  method?: string;
  token?: string | null;
  body?: Buffer | string;
  contentType?: string;
  bodyTooLarge?: boolean;
  developmentProof?: boolean;
  allowUids?: string;
  headers?: Record<string, string>;
  quotaStore?: ImageKitQuotaStore | null;
  useHandlerDefaultQuotaStore?: boolean;
  uploadFile?: (input: {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
    folder: string;
    privateKey: string;
  }) => Promise<ImageKitStoredUpload>;
}) {
  const quotaStore = input.useHandlerDefaultQuotaStore ? undefined : input.quotaStore ?? new MemoryQuotaStore();
  let status = 0;
  let body = "";
  const headers: Record<string, string> = {};
  const res: ImageKitUploadResponse = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(value: string) {
      body = value;
    },
  };
  const requestHeaders: Record<string, string> = { ...(input.headers ?? {}) };
  if (input.contentType !== "") requestHeaders["content-type"] = input.contentType ?? "multipart/form-data; boundary=none";
  if (input.token) requestHeaders.authorization = `Bearer ${input.token}`;
  return handleImageKitServerUpload(
    {
      method: input.method ?? "POST",
      headers: requestHeaders,
      body: input.body,
      bodyTooLarge: input.bodyTooLarge,
    },
    res,
    {
      developmentProof: input.developmentProof,
      verify,
      ...(input.useHandlerDefaultQuotaStore ? {} : { quotaStore }),
      uploadFile: input.uploadFile,
      env: {
        IMAGEKIT_PRIVATE_KEY: privateApiKey,
        IMAGEKIT_PUBLIC_KEY: "public_test_key",
        IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/example",
        IMAGEKIT_UPLOAD_ALLOW_UIDS: input.allowUids,
      },
    },
  ).then(() => ({ status, body, headers, json: body ? JSON.parse(body) as Record<string, unknown> : {} }));
}

function acceptingUpload(expectedType: string) {
  return async (upload: {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
    folder: string;
    privateKey: string;
  }) => {
    assert.equal(upload.folder, imageKitFolderForUser("user123"));
    assert.equal(upload.contentType, expectedType);
    assert.match(upload.fileName, new RegExp(`^[0-9a-f-]{36}\\.${expectedType === "image/jpeg" ? "jpg" : expectedType.split("/")[1]}$`));
    assert.equal(upload.privateKey, privateApiKey);
    assert.equal(imageTypeFromMagic(upload.bytes), expectedType);
    return {
      url: `https://ik.imagekit.io/example${upload.folder}/${upload.fileName}`,
      fileId: "file_123",
      filePath: `${upload.folder}/${upload.fileName}`,
    };
  };
}

const authSource = read("src/server/imageKitUploadAuth.ts");
assert.equal(authSource.includes("getAuthenticationParameters"), false);
assert.equal(authSource.includes("VITE_"), false);
const uploadSource = read("src/server/imageKitServerUpload.ts");
assert.match(uploadSource, /imageTypeFromMagic/);
assert.match(uploadSource, /useUniqueFileName: true/);
assert.match(uploadSource, /overwriteFile: false/);
assert.equal(uploadSource.includes("transformation"), false);
assert.equal(uploadSource.includes("webhookUrl"), false);

const clientSource = read("src/lib/imageKitStorage.ts");
assert.equal(clientSource.includes("IMAGEKIT_PRIVATE_KEY"), false);
assert.equal(clientSource.includes("@imagekit/javascript"), false);
assert.equal(clientSource.includes("/api/imagekit-auth"), false);
assert.match(clientSource, /\/api\/imagekit-upload/);
assert.equal(clientSource.includes("imageOptimizer"), false);

const proofSource = read("src/dev/imageKitUploadProof.ts");
assert.match(proofSource, /optimizeImageForUpload/);
assert.match(proofSource, /uploadOptimizedFileToImageKit/);
assert.equal(proofSource.includes("requestImageKitUploadAuthorization"), false);
assert.equal(proofSource.includes("signature"), false);
const optimizeAt = proofSource.indexOf("optimizeImageForUpload");
const uploadAt = proofSource.indexOf("uploadOptimizedFileToImageKit");
assert.ok(optimizeAt > 0 && optimizeAt < uploadAt);

assert.equal(read("src/App.tsx").includes("imagekit-proof"), false);
assert.equal(read("src/App.tsx").includes("imageKit"), false);
const storageSource = read("src/lib/storage.ts");
assert.match(storageSource, /uploadBytesResumable/);
const projectUploadSource = storageSource.slice(
  storageSource.indexOf("export function beginProjectImageUpload"),
  storageSource.indexOf("/**\n * Adaptively optimize and upload a project image"),
);
assert.equal(projectUploadSource.toLowerCase().includes("imagekit"), false);
const portfolioUploadSource = storageSource.slice(
  storageSource.indexOf("export function beginPortfolioImageUpload"),
  storageSource.indexOf("/**\n * Upload the portfolio portrait"),
);
assert.equal(portfolioUploadSource.toLowerCase().includes("imagekit"), false);
const accountUploadSource = storageSource.slice(
  storageSource.indexOf("export function beginAccountProfileImageUpload"),
  storageSource.indexOf("export async function uploadAccountProfileImage"),
);
assert.match(accountUploadSource, /accountPhotoImageStorageProvider\(\) === "imagekit"/);
assert.match(read("vercel.json"), /api\/imagekit-upload\.ts/);
assert.equal(read("vercel.json").includes("imagekit-auth"), false);
const retired = read("api/imagekit-auth.ts");
assert.equal(retired.includes("getAuthenticationParameters"), false);
assert.equal(retired.includes("ImageKit"), false);
assert.equal(retired.includes("IMAGEKIT_PRIVATE_KEY"), false);
assert.match(retired, /410/);
const productionUpload = read("api/imagekit-upload.ts");
assert.equal(productionUpload.includes("developmentProof"), false);
assert.equal(productionUpload.includes("getAuthenticationParameters"), false);
const pluginSource = read("src/server/imageKitDevPlugin.ts");
assert.match(pluginSource, /apply: "serve"/);
assert.match(pluginSource, /loadEnv\(mode, envDir, ""\)/);
assert.match(pluginSource, /developmentProof: true/);
assert.match(pluginSource, /\/api\/imagekit-upload/);
assert.equal(pluginSource.includes("handleImageKitAuth"), false);
assert.equal(pluginSource.includes("getAuthenticationParameters"), false);
assert.equal(pluginSource.includes("console."), false);
assert.equal(read("api/imagekit-upload.ts").includes("loadEnv"), false);

const savedImageKitEnv = {
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
  IMAGEKIT_UPLOAD_ALLOW_UIDS: process.env.IMAGEKIT_UPLOAD_ALLOW_UIDS,
};
delete process.env.IMAGEKIT_PRIVATE_KEY;
delete process.env.IMAGEKIT_PUBLIC_KEY;
delete process.env.IMAGEKIT_URL_ENDPOINT;
delete process.env.IMAGEKIT_UPLOAD_ALLOW_UIDS;
const envDir = mkdtempSync(join(tmpdir(), "imagekit-env-"));
try {
  writeFileSync(join(envDir, ".env.local"), [
    "IMAGEKIT_PRIVATE_KEY=private-from-file",
    "IMAGEKIT_PUBLIC_KEY=public-from-file",
    "IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/example/",
  ].join("\n"));
  const fromFile = imageKitDevServerEnv("development", envDir);
  assert.equal(fromFile.IMAGEKIT_PRIVATE_KEY, "private-from-file");
  assert.equal(fromFile.IMAGEKIT_PUBLIC_KEY, "public-from-file");
  assert.equal(fromFile.IMAGEKIT_URL_ENDPOINT, "https://ik.imagekit.io/example/");
  process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/from-process";
  const fromProcess = imageKitDevServerEnv("development", envDir);
  assert.equal(fromProcess.IMAGEKIT_URL_ENDPOINT, "https://ik.imagekit.io/from-process");
  assert.equal(fromProcess.IMAGEKIT_PRIVATE_KEY, "private-from-file");
} finally {
  rmSync(envDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedImageKitEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
assert.equal(activeImageStorageProvider(), "firebase");
assert.equal(configuredImageStorageProvider(), "firebase");
assert.equal(accountPhotoImageStorageProvider(), "firebase");

const jpegForm = multipart([{ name: "file", filename: "client-chosen.jpg", type: "image/jpeg", data: JPEG }]);
const missingAuth = await call({ token: null, body: jpegForm.body, contentType: jpegForm.contentType, developmentProof: true });
assert.equal(missingAuth.status, 401);
assert.equal(missingAuth.json.error, "Sign in to upload an image.");
assert.equal(JSON.stringify(missingAuth.json).includes(privateApiKey), false);

const invalidToken = await call({
  token: "not-a-firebase-token",
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(invalidToken.status, 401);

const expired = await call({
  token: signToken({ ...validPayload(), exp: Math.floor(nowMs / 1000) - 120 }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(expired.status, 401);
assert.match(String(expired.json.error), /session expired/i);

const wrongAudience = await call({
  token: signToken({ ...validPayload(), aud: "other-project" }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(wrongAudience.status, 401);

const noneAlg = await call({
  token: signToken(validPayload(), { alg: "none", kid: "test-key" }),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
});
assert.equal(noneAlg.status, 401);

const closed = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  uploadFile: async () => {
    throw new Error("closed gate must not upload");
  },
});
assert.equal(closed.status, 403);
assert.equal(closed.json.error, "Image upload is not available.");

const missingAdmin = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  useHandlerDefaultQuotaStore: true,
  uploadFile: async () => {
    throw new Error("missing admin credentials must not upload");
  },
});
assert.equal(readFirebaseAdminCredentials({}), null);
assert.equal(missingAdmin.status, 503);
assert.equal(missingAdmin.json.error, "Image upload storage is not configured.");

const headerBypass = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  headers: { "x-development-proof": "true" },
  uploadFile: async () => {
    throw new Error("request header must not open the gate");
  },
});
assert.equal(headerBypass.status, 403);

const emptyFile = multipart([{ name: "file", filename: "empty.jpg", type: "image/jpeg", data: Buffer.alloc(0) }]);
const missingFile = await call({
  token: signToken(validPayload()),
  body: emptyFile.body,
  contentType: emptyFile.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("missing file must not upload");
  },
});
assert.equal(missingFile.status, 400);

const spoofed = multipart([{ name: "file", filename: "photo.jpg", type: "image/jpeg", data: Buffer.from("%PDF-1.7 spoofed") }]);
const spoofedResult = await call({
  token: signToken(validPayload()),
  body: spoofed.body,
  contentType: spoofed.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("spoofed mime must not upload");
  },
});
assert.equal(spoofedResult.status, 415);

const tooBig = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(IMAGEKIT_MAX_UPLOAD_BYTES)]);
const oversized = multipart([{ name: "file", filename: "big.jpg", type: "image/jpeg", data: tooBig }]);
const oversizedResult = await call({
  token: signToken(validPayload()),
  body: oversized.body,
  contentType: oversized.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("oversized file must not upload");
  },
});
assert.equal(oversizedResult.status, 413);

const capped = await call({
  token: signToken(validPayload()),
  bodyTooLarge: true,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("capped body must not upload");
  },
});
assert.equal(capped.status, 413);

const folderOverride = multipart([
  { name: "file", filename: "photo.jpg", type: "image/jpeg", data: JPEG },
  { name: "folder", data: Buffer.from("/another-user/private") },
]);
const folderResult = await call({
  token: signToken(validPayload()),
  body: folderOverride.body,
  contentType: folderOverride.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("client folder must not upload");
  },
});
assert.equal(folderResult.status, 400);
assert.equal(folderResult.json.error, "This upload field is not available.");

const overwrite = multipart([
  { name: "file", filename: "photo.jpg", type: "image/jpeg", data: JPEG },
  { name: "overwriteFile", data: Buffer.from("true") },
]);
const overwriteResult = await call({
  token: signToken(validPayload()),
  body: overwrite.body,
  contentType: overwrite.contentType,
  developmentProof: true,
  uploadFile: async () => {
    throw new Error("client overwrite must not upload");
  },
});
assert.equal(overwriteResult.status, 400);

const jpeg = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(jpeg.status, 200);
assert.equal(jpeg.headers["cache-control"], "no-store");
assert.equal(jpeg.json.fileId, "file_123");
assert.equal(jpeg.json.contentType, "image/jpeg");
assert.equal(typeof jpeg.json.url, "string");
assert.equal(String(jpeg.json.url).startsWith("https://ik.imagekit.io/example/custom-portfolio/user123/proof/"), true);
assert.equal(String(jpeg.json.filePath).startsWith("/custom-portfolio/user123/proof/"), true);
assert.equal("privateKey" in jpeg.json, false);
assert.equal("signature" in jpeg.json, false);
assert.equal("token" in jpeg.json, false);
assert.equal("publicKey" in jpeg.json, false);
assert.equal(JSON.stringify(jpeg.json).includes(privateApiKey), false);

const quotaStore = new MemoryQuotaStore(JPEG.length);
const quotaOk = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "quota-one" },
  quotaStore,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(quotaOk.status, 200);
assert.equal(quotaStore.quota("user123").usedBytes, JPEG.length);
assert.equal(quotaStore.quota("user123").reservedBytes, 0);
const quotaExceeded = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "quota-two" },
  quotaStore,
  uploadFile: async () => {
    throw new Error("quota exhaustion must not upload");
  },
});
assert.equal(quotaExceeded.status, 409);
assert.equal(quotaExceeded.json.error, "You have reached your image storage limit.");

const concurrentStore = new MemoryQuotaStore(JPEG.length);
let releaseFirstUpload: (() => void) | null = null;
let noteFirstUploadStarted: (() => void) | null = null;
const firstUploadStarted = new Promise<void>((resolve) => {
  noteFirstUploadStarted = resolve;
});
const firstConcurrent = call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "concurrent-a" },
  quotaStore: concurrentStore,
  uploadFile: async (upload) => {
    noteFirstUploadStarted?.();
    await new Promise<void>((resolve) => {
      releaseFirstUpload = resolve;
    });
    return acceptingUpload("image/jpeg")(upload);
  },
});
await firstUploadStarted;
const secondConcurrent = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "concurrent-b" },
  quotaStore: concurrentStore,
  uploadFile: async () => {
    throw new Error("concurrent quota exhaustion must not upload");
  },
});
assert.equal(secondConcurrent.status, 409);
releaseFirstUpload?.();
assert.equal((await firstConcurrent).status, 200);
assert.equal(concurrentStore.quota("user123").usedBytes, JPEG.length);

const duplicateStore = new MemoryQuotaStore();
let duplicateUploads = 0;
const duplicateFirst = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "same-request" },
  quotaStore: duplicateStore,
  uploadFile: async (upload) => {
    duplicateUploads += 1;
    return acceptingUpload("image/jpeg")(upload);
  },
});
const duplicateSecond = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "same-request" },
  quotaStore: duplicateStore,
  uploadFile: async () => {
    throw new Error("duplicate retry must not upload twice");
  },
});
assert.equal(duplicateFirst.status, 200);
assert.equal(duplicateSecond.status, 200);
assert.equal(duplicateSecond.json.url, duplicateFirst.json.url);
assert.equal(duplicateUploads, 1);

const failedStore = new MemoryQuotaStore();
const failed = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "ambiguous-failure" },
  quotaStore: failedStore,
  uploadFile: async () => {
    throw new Error("ambiguous ImageKit failure");
  },
});
assert.equal(failed.status, 502);
assert.equal(failedStore.quota("user123").reservedBytes, JPEG.length);
assert.equal(failedStore.uploads.get("user123:ambiguous-failure")?.status, "recoverable");

const commitFailedStore = new MemoryQuotaStore(JPEG.length);
commitFailedStore.failComplete = true;
const commitFailed = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "commit-failure" },
  quotaStore: commitFailedStore,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(commitFailed.status, 502);
assert.equal(commitFailedStore.quota("user123").reservedBytes, JPEG.length);
assert.equal(commitFailedStore.uploads.get("user123:commit-failure")?.status, "recoverable");
assert.equal(commitFailedStore.uploads.get("user123:commit-failure")?.fileId, "file_123");
const blockedByRecoverable = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "new-key-while-recoverable" },
  quotaStore: commitFailedStore,
  uploadFile: async () => {
    throw new Error("recoverable quota must block new uploads");
  },
});
assert.equal(blockedByRecoverable.status, 409);
commitFailedStore.failComplete = false;
const recoveredSameKey = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "commit-failure" },
  quotaStore: commitFailedStore,
  uploadFile: async () => {
    throw new Error("same-key recoverable retry must not upload twice");
  },
});
assert.equal(recoveredSameKey.status, 200);
assert.equal(commitFailedStore.quota("user123").usedBytes, JPEG.length);
assert.equal(commitFailedStore.quota("user123").reservedBytes, 0);

const mismatchStore = new MemoryQuotaStore();
const mismatchFirst = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "mismatch" },
  quotaStore: mismatchStore,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(mismatchFirst.status, 200);
const mismatchPngForm = multipart([{ name: "file", filename: "named.png", type: "image/jpeg", data: PNG }]);
const mismatchPng = await call({
  token: signToken(validPayload()),
  body: mismatchPngForm.body,
  contentType: mismatchPngForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "mismatch" },
  quotaStore: mismatchStore,
  uploadFile: async () => {
    throw new Error("mismatched duplicate key must not upload");
  },
});
assert.notEqual(mismatchPng.status, 200);

const crossUserStore = new MemoryQuotaStore(JPEG.length);
const sameKeyUserOne = await call({
  token: signToken(validPayload("user123")),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "shared-key" },
  quotaStore: crossUserStore,
  uploadFile: acceptingUpload("image/jpeg"),
});
const sameKeyUserTwo = await call({
  token: signToken(validPayload("other-user")),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "shared-key" },
  quotaStore: crossUserStore,
  uploadFile: async (upload) => ({
    url: `https://ik.imagekit.io/example${upload.folder}/${upload.fileName}`,
    fileId: "file_456",
    filePath: `${upload.folder}/${upload.fileName}`,
  }),
});
assert.equal(sameKeyUserOne.status, 200);
assert.equal(sameKeyUserTwo.status, 200);
assert.equal(crossUserStore.quota("user123").usedBytes, JPEG.length);
assert.equal(crossUserStore.quota("other-user").usedBytes, JPEG.length);

const unavailableStore: ImageKitQuotaStore = {
  reserveUpload: async () => { throw new Error("firestore unavailable"); },
  completeUpload: async () => { throw new Error("firestore unavailable"); },
  markUploadAttemptStarted: async () => { throw new Error("firestore unavailable"); },
  markUploadRecoverable: async () => { throw new Error("firestore unavailable"); },
  reconcileStaleReservations: async () => { throw new Error("firestore unavailable"); },
  releaseVerifiedUnstoredUpload: async () => false,
  safeDeleteUpload: async () => ({ deleted: false, uploadId: "x", reason: "reference-check-failed" }),
};
const unavailable = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  quotaStore: unavailableStore,
  uploadFile: async () => {
    throw new Error("Firestore unavailable must fail before ImageKit upload");
  },
});
assert.equal(unavailable.status, 503);

const interruptedStore = new MemoryQuotaStore(JPEG.length);
await interruptedStore.reserveUpload({
  uid: "user123",
  uploadKey: "interrupted-before-attempt",
  sizeBytes: JPEG.length,
  contentSha256: sha256(JPEG),
  contentType: "image/jpeg",
  folder: imageKitFolderForUser("user123"),
  fileName: "interrupted.jpg",
  nowMs: nowMs - 60 * 60 * 1000,
});
assert.equal(interruptedStore.quota("user123").reservedBytes, JPEG.length);
const releasedUnattempted = await interruptedStore.reconcileStaleReservations({ uid: "user123", nowMs });
assert.deepEqual(releasedUnattempted, [{ uploadId: "user123:interrupted-before-attempt", action: "released-unattempted" }]);
assert.equal(interruptedStore.quota("user123").reservedBytes, 0);
assert.equal(interruptedStore.uploads.get("user123:interrupted-before-attempt")?.status, "expired");
assert.deepEqual(await interruptedStore.reconcileStaleReservations({ uid: "user123", nowMs }), []);

const attemptedStore = new MemoryQuotaStore(JPEG.length);
const attempted = await attemptedStore.reserveUpload({
  uid: "user123",
  uploadKey: "interrupted-after-attempt",
  sizeBytes: JPEG.length,
  contentSha256: sha256(JPEG),
  contentType: "image/jpeg",
  folder: imageKitFolderForUser("user123"),
  fileName: "attempted.jpg",
  nowMs: nowMs - 60 * 60 * 1000,
});
assert.equal(attempted.kind, "reserved");
await attemptedStore.markUploadAttemptStarted({
  uid: "user123",
  uploadId: "user123:interrupted-after-attempt",
  sizeBytes: JPEG.length,
  nowMs: nowMs - 60 * 60 * 1000,
});
const heldUnknown = await attemptedStore.reconcileStaleReservations({ uid: "user123", nowMs });
assert.deepEqual(heldUnknown, [{ uploadId: "user123:interrupted-after-attempt", action: "held-for-manual-recovery" }]);
assert.equal(attemptedStore.quota("user123").reservedBytes, JPEG.length);
assert.equal(attemptedStore.uploads.get("user123:interrupted-after-attempt")?.status, "recoverable");
assert.equal(await attemptedStore.releaseVerifiedUnstoredUpload({
  uid: "user123",
  uploadId: "user123:interrupted-after-attempt",
  nowMs,
}), true);
assert.equal(attemptedStore.quota("user123").reservedBytes, 0);
assert.equal(await attemptedStore.releaseVerifiedUnstoredUpload({
  uid: "user123",
  uploadId: "user123:interrupted-after-attempt",
  nowMs,
}), true);

const activeStore = new MemoryQuotaStore(JPEG.length);
await activeStore.reserveUpload({
  uid: "user123",
  uploadKey: "active-upload",
  sizeBytes: JPEG.length,
  contentSha256: sha256(JPEG),
  contentType: "image/jpeg",
  folder: imageKitFolderForUser("user123"),
  fileName: "active.jpg",
});
await activeStore.markUploadAttemptStarted({
  uid: "user123",
  uploadId: "user123:active-upload",
  sizeBytes: JPEG.length,
});
assert.deepEqual(await activeStore.reconcileStaleReservations({ uid: "user123", nowMs }), []);
assert.equal(activeStore.quota("user123").reservedBytes, JPEG.length);

const cleanupStore = new MemoryQuotaStore();
const cleanupUpload = await call({
  token: signToken(validPayload()),
  body: jpegForm.body,
  contentType: jpegForm.contentType,
  developmentProof: true,
  headers: { "x-imagekit-upload-id": "cleanup" },
  quotaStore: cleanupStore,
  uploadFile: acceptingUpload("image/jpeg"),
});
assert.equal(cleanupUpload.status, 200);
cleanupStore.accountReference = { professionalProfile: { photoURL: cleanupUpload.json.url } };
const accountProtected = await cleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:cleanup",
  deleteFile: async () => {
    throw new Error("account references must not be deleted");
  },
});
assert.deepEqual(accountProtected, { deleted: false, uploadId: "user123:cleanup", reason: "referenced-by-account" });
cleanupStore.accountReference = null;
cleanupStore.savedReferences = [{ profile: { heroImage: cleanupUpload.json.url } }];
const savedProtected = await cleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:cleanup",
  deleteFile: async () => {
    throw new Error("saved references must not be deleted");
  },
});
assert.deepEqual(savedProtected, { deleted: false, uploadId: "user123:cleanup", reason: "referenced-by-saved-portfolio" });
cleanupStore.savedReferences = [];
cleanupStore.publishedReferences = [{ seo: { ogImage: cleanupUpload.json.url } }];
const publishedProtected = await cleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:cleanup",
  deleteFile: async () => {
    throw new Error("published references must not be deleted");
  },
});
assert.deepEqual(publishedProtected, { deleted: false, uploadId: "user123:cleanup", reason: "referenced-by-published-portfolio" });
cleanupStore.publishedReferences = [];
const wrongOwner = await cleanupStore.safeDeleteUpload({
  uid: "other-user",
  uploadId: "user123:cleanup",
  deleteFile: async () => {
    throw new Error("wrong owner must not delete");
  },
});
assert.deepEqual(wrongOwner, { deleted: false, uploadId: "user123:cleanup", reason: "wrong-owner" });
let deletedFileId = "";
const deleted = await cleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:cleanup",
  deleteFile: async (fileId) => {
    deletedFileId = fileId;
  },
});
assert.deepEqual(deleted, { deleted: true, uploadId: "user123:cleanup" });
assert.equal(deletedFileId, "file_123");
assert.equal(cleanupStore.uploads.get("user123:cleanup")?.status, "deleted");
assert.equal(cleanupStore.quota("user123").usedBytes, 0);
assert.deepEqual(await cleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:cleanup",
  deleteFile: async () => {
    throw new Error("deleted cleanup retry must be idempotent");
  },
}), { deleted: true, uploadId: "user123:cleanup" });

const recoverableCleanupStore = new MemoryQuotaStore(JPEG.length);
await recoverableCleanupStore.reserveUpload({
  uid: "user123",
  uploadKey: "recoverable-cleanup",
  sizeBytes: JPEG.length,
  contentSha256: sha256(JPEG),
  contentType: "image/jpeg",
  folder: imageKitFolderForUser("user123"),
  fileName: "recoverable.jpg",
});
await recoverableCleanupStore.markUploadAttemptStarted({
  uid: "user123",
  uploadId: "user123:recoverable-cleanup",
  sizeBytes: JPEG.length,
});
await recoverableCleanupStore.markUploadRecoverable({
  uid: "user123",
  uploadId: "user123:recoverable-cleanup",
  sizeBytes: JPEG.length,
  uploaded: {
    url: "https://ik.imagekit.io/example/custom-portfolio/user123/proof/recoverable.jpg",
    fileId: "file_recoverable",
    filePath: "/custom-portfolio/user123/proof/recoverable.jpg",
  },
  reason: "firestore-completion-failed",
});
assert.equal(recoverableCleanupStore.quota("user123").reservedBytes, JPEG.length);
assert.deepEqual(await recoverableCleanupStore.safeDeleteUpload({
  uid: "user123",
  uploadId: "user123:recoverable-cleanup",
  deleteFile: async (fileId) => {
    assert.equal(fileId, "file_recoverable");
  },
}), { deleted: true, uploadId: "user123:recoverable-cleanup" });
assert.equal(recoverableCleanupStore.quota("user123").reservedBytes, 0);

const pngForm = multipart([{ name: "file", filename: "named.png", type: "image/jpeg", data: PNG }]);
const png = await call({
  token: signToken(validPayload()),
  body: pngForm.body,
  contentType: pngForm.contentType,
  allowUids: "user123,other",
  uploadFile: acceptingUpload("image/png"),
});
assert.equal(png.status, 200);
assert.equal(png.json.contentType, "image/png");

const webpForm = multipart([{ name: "file", filename: "shot.webp", type: "image/webp", data: WEBP }]);
const webp = await call({
  token: signToken(validPayload()),
  body: webpForm.body,
  contentType: webpForm.contentType,
  developmentProof: true,
  uploadFile: acceptingUpload("image/webp"),
});
assert.equal(webp.status, 200);
assert.equal(webp.json.contentType, "image/webp");

const wrongMethod = await call({ method: "GET", token: signToken(validPayload()), developmentProof: true });
assert.equal(wrongMethod.status, 405);

let retiredStatus = 0;
let retiredBody = "";
await retiredAuth({}, {
  status(code: number) {
    retiredStatus = code;
    return this;
  },
  setHeader() {},
  end(value: string) {
    retiredBody = value;
  },
});
assert.equal(retiredStatus, 410);
assert.equal(retiredBody.includes("signature"), false);
assert.equal(retiredBody.includes(privateApiKey), false);

const seen: number[] = [];
const uploaded = await uploadOptimizedFileToImageKit({
  file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
  idToken: "id-token",
  onProgress: (percent) => seen.push(percent),
  post: async (_file, init) => {
    assert.equal(init.idToken, "id-token");
    assert.match(init.uploadKey, /^[A-Za-z0-9._:-]+$/);
    init.onProgress?.(40);
    init.onProgress?.(100);
    return {
      status: 200,
      json: {
        url: "https://ik.imagekit.io/example/custom-portfolio/user123/proof/small.jpg",
        fileId: "file_123",
        filePath: "/custom-portfolio/user123/proof/small.jpg",
      },
    };
  },
});
assert.deepEqual(seen, [40, 100]);
assert.equal(uploaded.fileId, "file_123");

const controller = new AbortController();
controller.abort();
await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    signal: controller.signal,
    post: async () => {
      throw new Error("should not upload");
    },
  }),
  ImageUploadCancelled,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    post: async () => ({ status: 200, json: { url: "", fileId: "file_123" } }),
  }),
  (error: unknown) => error instanceof ImageKitTransferError && error.message === IMAGEKIT_UPLOAD_FAILED,
);

await assert.rejects(
  () => uploadOptimizedFileToImageKit({
    file: new File([JPEG], "small.jpg", { type: "image/jpeg" }),
    idToken: "id-token",
    post: async () => ({
      status: 200,
      json: { url: "https://ik.imagekit.io/example/a.jpg", fileId: "file_123", privateKey: "nope" },
    }),
  }),
  (error: unknown) => error instanceof ImageKitTransferError && error.message === IMAGEKIT_UPLOAD_FAILED,
);

const gif = Buffer.from("GIF89a");
const proof = await proveImageKitUpload({
  file: new File([gif], "anim.gif", { type: "image/gif" }),
  idToken: "id-token",
  loadUploadedImage: async (url) => {
    assert.equal(url, "https://ik.imagekit.io/example/custom-portfolio/user123/proof/anim.gif");
  },
  post: async () => {
    return {
      status: 200,
      json: {
        url: "https://ik.imagekit.io/example/custom-portfolio/user123/proof/anim.gif",
        fileId: "gif_1",
        filePath: "/custom-portfolio/user123/proof/anim.gif",
      },
    };
  },
});
assert.equal(proof.optimizedBytes, gif.length);
assert.equal(proof.fileId, "gif_1");

console.log("imagekit auth checks passed");
