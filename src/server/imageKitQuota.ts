import { createHash } from "node:crypto";
import ImageKit from "@imagekit/nodejs";
import type { DocumentSnapshot, Firestore, QuerySnapshot, Transaction } from "firebase-admin/firestore";

export const IMAGEKIT_QUOTA_COLLECTION = "imageKitQuotas";
export const IMAGEKIT_UPLOAD_COLLECTION = "imageKitUploads";
export const IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES = 25 * 1024 * 1024;
export const IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_ENV = "IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES";
export const IMAGEKIT_UPLOAD_RESERVATION_LEASE_MS = 15 * 60 * 1000;

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CONFIGURED_QUOTA_BYTES = 1024 * 1024 * 1024;

export type ImageKitUploadStatus = "reserved" | "uploading" | "uploaded" | "recoverable" | "delete-pending" | "deleted" | "expired";

export type ImageKitTrackedUpload = {
  uploadId: string;
  uid: string;
  status: ImageKitUploadStatus;
  sizeBytes: number;
  contentSha256: string;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  folder: string;
  fileName: string;
  url?: string;
  fileId?: string;
  filePath?: string;
  imageKitAttemptedAtMs?: number;
  leaseExpiresAtMs?: number;
  quotaReleasedAtMs?: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ImageKitQuotaReservation =
  | { kind: "reserved"; uploadId: string }
  | { kind: "already-uploaded"; upload: ImageKitTrackedUpload }
  | { kind: "in-progress"; uploadId: string }
  | { kind: "recoverable"; uploadId: string; upload?: ImageKitTrackedUpload };

export type ImageKitReservationReconciliation = {
  uploadId: string;
  action: "released-unattempted" | "held-for-manual-recovery";
};

export type ImageKitCleanupResult =
  | { deleted: true; uploadId: string }
  | {
      deleted: false;
      uploadId: string;
      reason:
        | "not-found"
        | "wrong-owner"
        | "not-cleanable"
        | "missing-imagekit-file"
        | "referenced-by-account"
        | "referenced-by-saved-portfolio"
        | "referenced-by-published-portfolio"
        | "reference-check-failed"
        | "delete-in-progress"
        | "delete-failed";
    };

export type ImageKitQuotaStore = {
  reserveUpload: (input: {
    uid: string;
    uploadKey: string;
    sizeBytes: number;
    contentSha256: string;
    contentType: ImageKitTrackedUpload["contentType"];
    folder: string;
    fileName: string;
    nowMs?: number;
  }) => Promise<ImageKitQuotaReservation>;
  completeUpload: (input: {
    uid: string;
    uploadId: string;
    sizeBytes: number;
    uploaded: Required<Pick<ImageKitTrackedUpload, "url" | "fileId" | "filePath">>;
    nowMs?: number;
  }) => Promise<ImageKitTrackedUpload>;
  markUploadAttemptStarted: (input: {
    uid: string;
    uploadId: string;
    sizeBytes: number;
    nowMs?: number;
  }) => Promise<void>;
  markUploadRecoverable: (input: {
    uid: string;
    uploadId: string;
    sizeBytes: number;
    uploaded?: Required<Pick<ImageKitTrackedUpload, "url" | "fileId" | "filePath">>;
    reason: string;
    nowMs?: number;
  }) => Promise<void>;
  reconcileStaleReservations: (input: {
    uid: string;
    nowMs?: number;
    limit?: number;
  }) => Promise<ImageKitReservationReconciliation[]>;
  releaseVerifiedUnstoredUpload: (input: {
    uid: string;
    uploadId: string;
    nowMs?: number;
  }) => Promise<boolean>;
  safeDeleteUpload: (input: {
    uid: string;
    uploadId: string;
    deleteFile: (fileId: string) => Promise<void>;
    nowMs?: number;
  }) => Promise<ImageKitCleanupResult>;
};

export type ImageKitQuotaErrorReason =
  | "invalid-upload-key"
  | "invalid-owner"
  | "quota-exceeded"
  | "duplicate-upload-mismatch"
  | "upload-not-reserved"
  | "quota-record-missing";

export class ImageKitQuotaError extends Error {
  readonly name = "ImageKitQuotaError";
  readonly reason: ImageKitQuotaErrorReason;

  constructor(reason: ImageKitQuotaErrorReason) {
    super(reason);
    this.reason = reason;
  }
}

export function imageKitDefaultQuotaBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_ENV]?.trim();
  if (!raw) return IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_CONFIGURED_QUOTA_BYTES) {
    return IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES;
  }
  return parsed;
}

export function imageKitUploadId(uid: string, uploadKey: string): string {
  if (!UID_PATTERN.test(uid)) throw new ImageKitQuotaError("invalid-owner");
  if (!IDEMPOTENCY_KEY_PATTERN.test(uploadKey)) throw new ImageKitQuotaError("invalid-upload-key");
  return createHash("sha256").update(`${uid}\0${uploadKey}`).digest("hex");
}

export function containsExactImageReference(value: unknown, upload: Pick<ImageKitTrackedUpload, "url" | "filePath">): boolean {
  if (typeof value === "string") return value === upload.url || value === upload.filePath;
  if (Array.isArray(value)) return value.some((item) => containsExactImageReference(item, upload));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => containsExactImageReference(item, upload));
  }
  return false;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function uploadFromSnapshot(snapshot: DocumentSnapshot): ImageKitTrackedUpload | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  if (typeof data.uid !== "string" || !UID_PATTERN.test(data.uid)) return null;
  if (!["reserved", "uploading", "uploaded", "recoverable", "delete-pending", "deleted", "expired"].includes(String(data.status))) return null;
  if (typeof data.contentType !== "string") return null;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.contentType)) return null;
  if (typeof data.contentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.contentSha256)) return null;
  if (typeof data.folder !== "string" || typeof data.fileName !== "string") return null;
  return {
    uploadId: snapshot.id,
    uid: data.uid,
    status: data.status as ImageKitUploadStatus,
    sizeBytes: numberField(data.sizeBytes),
    contentSha256: data.contentSha256,
    contentType: data.contentType as ImageKitTrackedUpload["contentType"],
    folder: data.folder,
    fileName: data.fileName,
    url: typeof data.url === "string" ? data.url : undefined,
    fileId: typeof data.fileId === "string" ? data.fileId : undefined,
    filePath: typeof data.filePath === "string" ? data.filePath : undefined,
    imageKitAttemptedAtMs: numberField(data.imageKitAttemptedAtMs) || undefined,
    leaseExpiresAtMs: numberField(data.leaseExpiresAtMs) || undefined,
    quotaReleasedAtMs: numberField(data.quotaReleasedAtMs) || undefined,
    createdAtMs: numberField(data.createdAtMs),
    updatedAtMs: numberField(data.updatedAtMs),
  };
}

function quotaFields(data: Record<string, unknown> | undefined, defaultLimitBytes: number) {
  return {
    limitBytes: numberField(data?.limitBytes) || defaultLimitBytes,
    usedBytes: numberField(data?.usedBytes),
    reservedBytes: numberField(data?.reservedBytes),
    createdAtMs: numberField(data?.createdAtMs),
  };
}

function assertSameUpload(existing: ImageKitTrackedUpload, input: { uid: string; sizeBytes: number; contentSha256: string; contentType: string; folder: string }) {
  if (
    existing.uid !== input.uid ||
    existing.sizeBytes !== input.sizeBytes ||
    existing.contentSha256 !== input.contentSha256 ||
    existing.contentType !== input.contentType ||
    existing.folder !== input.folder
  ) {
    throw new ImageKitQuotaError("duplicate-upload-mismatch");
  }
}

function decrement(value: number, by: number): number {
  return Math.max(0, value - by);
}

function nextLeaseExpiresAt(nowMs: number): number {
  return nowMs + IMAGEKIT_UPLOAD_RESERVATION_LEASE_MS;
}

function hasStoredImageKitFile(upload: ImageKitTrackedUpload): upload is ImageKitTrackedUpload & Required<Pick<ImageKitTrackedUpload, "url" | "fileId" | "filePath">> {
  return Boolean(upload.url && upload.fileId && upload.filePath);
}

async function snapshotHasReference(snapshot: QuerySnapshot, upload: Pick<ImageKitTrackedUpload, "url" | "filePath">): Promise<boolean> {
  for (const doc of snapshot.docs) {
    if (containsExactImageReference(doc.data(), upload)) return true;
  }
  return false;
}

export function createFirestoreImageKitQuotaStore(
  db: Firestore,
  options: { defaultLimitBytes?: number } = {},
): ImageKitQuotaStore {
  const defaultLimitBytes = options.defaultLimitBytes ?? IMAGEKIT_DEFAULT_ACCOUNT_QUOTA_BYTES;
  const quotaRef = (uid: string) => db.collection(IMAGEKIT_QUOTA_COLLECTION).doc(uid);
  const uploadRef = (uploadId: string) => db.collection(IMAGEKIT_UPLOAD_COLLECTION).doc(uploadId);

  async function runReferenceCheck(uid: string, upload: ImageKitTrackedUpload): Promise<ImageKitCleanupResult | null> {
    if (!upload.url || !upload.fileId || !upload.filePath) {
      return { deleted: false, uploadId: upload.uploadId, reason: "missing-imagekit-file" };
    }
    try {
      const account = await db.collection("users").doc(uid).get();
      if (account.exists && containsExactImageReference(account.data(), upload)) {
        return { deleted: false, uploadId: upload.uploadId, reason: "referenced-by-account" };
      }
      const saved = await db.collection("portfolios").where("ownerId", "==", uid).get();
      if (await snapshotHasReference(saved, upload)) {
        return { deleted: false, uploadId: upload.uploadId, reason: "referenced-by-saved-portfolio" };
      }
      const published = await db.collection("publicPortfolios").get();
      if (await snapshotHasReference(published, upload)) {
        return { deleted: false, uploadId: upload.uploadId, reason: "referenced-by-published-portfolio" };
      }
    } catch {
      return { deleted: false, uploadId: upload.uploadId, reason: "reference-check-failed" };
    }
    return null;
  }

  return {
    async reserveUpload(input) {
      const uploadId = imageKitUploadId(input.uid, input.uploadKey);
      return db.runTransaction(async (transaction: Transaction) => {
        const uploadSnapshot = await transaction.get(uploadRef(uploadId));
        const existing = uploadFromSnapshot(uploadSnapshot);
        if (existing) {
          assertSameUpload(existing, input);
          if (existing.status === "uploaded") return { kind: "already-uploaded", upload: existing };
          if (existing.status === "recoverable") return { kind: "recoverable", uploadId, upload: hasStoredImageKitFile(existing) ? existing : undefined };
          return { kind: "in-progress", uploadId };
        }

        const quotaSnapshot = await transaction.get(quotaRef(input.uid));
        const quota = quotaFields(quotaSnapshot.data(), defaultLimitBytes);
        const availableBytes = quota.limitBytes - quota.usedBytes - quota.reservedBytes;
        if (input.sizeBytes > availableBytes) throw new ImageKitQuotaError("quota-exceeded");

        const nowMs = input.nowMs ?? Date.now();
        transaction.set(quotaRef(input.uid), {
          uid: input.uid,
          limitBytes: quota.limitBytes,
          usedBytes: quota.usedBytes,
          reservedBytes: quota.reservedBytes + input.sizeBytes,
          createdAtMs: quota.createdAtMs || nowMs,
          updatedAtMs: nowMs,
        }, { merge: true });
        transaction.set(uploadRef(uploadId), {
          uid: input.uid,
          status: "reserved",
          sizeBytes: input.sizeBytes,
          contentSha256: input.contentSha256,
          contentType: input.contentType,
          folder: input.folder,
          fileName: input.fileName,
          leaseExpiresAtMs: nextLeaseExpiresAt(nowMs),
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        });
        return { kind: "reserved", uploadId };
      });
    },

    async completeUpload(input) {
      return db.runTransaction(async (transaction: Transaction) => {
        const uploadSnapshot = await transaction.get(uploadRef(input.uploadId));
        const existing = uploadFromSnapshot(uploadSnapshot);
        if (!existing || existing.uid !== input.uid) throw new ImageKitQuotaError("upload-not-reserved");
        if (existing.status === "uploaded") return existing;
        if (!["reserved", "uploading", "recoverable"].includes(existing.status)) {
          throw new ImageKitQuotaError("upload-not-reserved");
        }

        const quotaSnapshot = await transaction.get(quotaRef(input.uid));
        if (!quotaSnapshot.exists) throw new ImageKitQuotaError("quota-record-missing");
        const quota = quotaFields(quotaSnapshot.data(), defaultLimitBytes);
        const nowMs = input.nowMs ?? Date.now();
        const completed: ImageKitTrackedUpload = {
          ...existing,
          status: "uploaded",
          url: input.uploaded.url,
          fileId: input.uploaded.fileId,
          filePath: input.uploaded.filePath,
          updatedAtMs: nowMs,
        };
        transaction.update(quotaRef(input.uid), {
          usedBytes: quota.usedBytes + input.sizeBytes,
          reservedBytes: decrement(quota.reservedBytes, input.sizeBytes),
          updatedAtMs: nowMs,
        });
        transaction.update(uploadRef(input.uploadId), {
          status: "uploaded",
          url: input.uploaded.url,
          fileId: input.uploaded.fileId,
          filePath: input.uploaded.filePath,
          updatedAtMs: nowMs,
        });
        return completed;
      });
    },

    async markUploadAttemptStarted(input) {
      await db.runTransaction(async (transaction: Transaction) => {
        const uploadSnapshot = await transaction.get(uploadRef(input.uploadId));
        const existing = uploadFromSnapshot(uploadSnapshot);
        if (!existing || existing.uid !== input.uid) throw new ImageKitQuotaError("upload-not-reserved");
        if (existing.status === "uploaded" || existing.status === "deleted") return;
        if (existing.status !== "reserved" && existing.status !== "uploading") {
          throw new ImageKitQuotaError("upload-not-reserved");
        }
        const nowMs = input.nowMs ?? Date.now();
        transaction.update(uploadRef(input.uploadId), {
          status: "uploading",
          imageKitAttemptedAtMs: existing.imageKitAttemptedAtMs ?? nowMs,
          leaseExpiresAtMs: nextLeaseExpiresAt(nowMs),
          updatedAtMs: nowMs,
        });
      });
    },

    async markUploadRecoverable(input) {
      await db.runTransaction(async (transaction: Transaction) => {
        const uploadSnapshot = await transaction.get(uploadRef(input.uploadId));
        const existing = uploadFromSnapshot(uploadSnapshot);
        if (!existing || existing.uid !== input.uid || existing.status === "uploaded" || existing.status === "deleted") return;
        const nowMs = input.nowMs ?? Date.now();
        transaction.update(uploadRef(input.uploadId), {
          status: "recoverable",
          recoveryReason: input.reason,
          ...(input.uploaded ?? {}),
          leaseExpiresAtMs: nextLeaseExpiresAt(nowMs),
          updatedAtMs: nowMs,
        });
      });
    },

    async reconcileStaleReservations(input) {
      const nowMs = input.nowMs ?? Date.now();
      const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
      const snapshots = await Promise.all(
        ["reserved", "uploading"].map((status) =>
          db.collection(IMAGEKIT_UPLOAD_COLLECTION)
            .where("uid", "==", input.uid)
            .where("status", "==", status)
            .where("leaseExpiresAtMs", "<=", nowMs)
            .limit(limit)
            .get(),
        ),
      );
      const uploadIds = [...new Set(snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.id)))].slice(0, limit);
      const reconciled = await Promise.all(uploadIds.map((uploadId) =>
        db.runTransaction(async (transaction: Transaction): Promise<ImageKitReservationReconciliation | null> => {
          const snapshot = await transaction.get(uploadRef(uploadId));
          const upload = uploadFromSnapshot(snapshot);
          if (!upload || upload.uid !== input.uid || upload.quotaReleasedAtMs) return null;
          if (!["reserved", "uploading"].includes(upload.status)) return null;
          if (!upload.leaseExpiresAtMs || upload.leaseExpiresAtMs > nowMs) return null;
          const quotaSnapshot = await transaction.get(quotaRef(input.uid));
          const quota = quotaFields(quotaSnapshot.data(), defaultLimitBytes);
          if (upload.status === "reserved" && !upload.imageKitAttemptedAtMs) {
            transaction.update(quotaRef(input.uid), {
              reservedBytes: decrement(quota.reservedBytes, upload.sizeBytes),
              updatedAtMs: nowMs,
            });
            transaction.update(uploadRef(uploadId), {
              status: "expired",
              recoveryReason: "reservation-expired-before-imagekit-attempt",
              quotaReleasedAtMs: nowMs,
              updatedAtMs: nowMs,
            });
            return { uploadId, action: "released-unattempted" };
          }
          transaction.update(uploadRef(uploadId), {
            status: "recoverable",
            recoveryReason: "reservation-lease-expired-after-imagekit-attempt",
            leaseExpiresAtMs: nextLeaseExpiresAt(nowMs),
            updatedAtMs: nowMs,
          });
          return { uploadId, action: "held-for-manual-recovery" };
        }),
      ));
      return reconciled.filter((item): item is ImageKitReservationReconciliation => item !== null);
    },

    async releaseVerifiedUnstoredUpload(input) {
      return db.runTransaction(async (transaction: Transaction) => {
        const snapshot = await transaction.get(uploadRef(input.uploadId));
        const upload = uploadFromSnapshot(snapshot);
        if (!upload || upload.uid !== input.uid) return false;
        if (upload.quotaReleasedAtMs) return true;
        if (hasStoredImageKitFile(upload)) return false;
        if (!["recoverable", "expired"].includes(upload.status)) return false;
        const quotaSnapshot = await transaction.get(quotaRef(input.uid));
        const quota = quotaFields(quotaSnapshot.data(), defaultLimitBytes);
        const nowMs = input.nowMs ?? Date.now();
        transaction.update(quotaRef(input.uid), {
          reservedBytes: decrement(quota.reservedBytes, upload.sizeBytes),
          updatedAtMs: nowMs,
        });
        transaction.update(uploadRef(input.uploadId), {
          status: "expired",
          recoveryReason: "operator-verified-no-imagekit-file",
          quotaReleasedAtMs: nowMs,
          updatedAtMs: nowMs,
        });
        return true;
      });
    },

    async safeDeleteUpload(input) {
      const loaded = await db.runTransaction(async (transaction: Transaction) => {
        const snapshot = await transaction.get(uploadRef(input.uploadId));
        const upload = uploadFromSnapshot(snapshot);
        if (!upload) return { result: { deleted: false, uploadId: input.uploadId, reason: "not-found" } as ImageKitCleanupResult };
        if (upload.uid !== input.uid) return { result: { deleted: false, uploadId: input.uploadId, reason: "wrong-owner" } as ImageKitCleanupResult };
        if (upload.status === "deleted") return { result: { deleted: true, uploadId: input.uploadId } as ImageKitCleanupResult };
        if (upload.status === "delete-pending") return { result: { deleted: false, uploadId: input.uploadId, reason: "delete-in-progress" } as ImageKitCleanupResult };
        if (!["uploaded", "recoverable"].includes(upload.status)) return { result: { deleted: false, uploadId: input.uploadId, reason: "not-cleanable" } as ImageKitCleanupResult };
        return { upload };
      });
      if ("result" in loaded) return loaded.result;

      const unsafe = await runReferenceCheck(input.uid, loaded.upload);
      if (unsafe) return unsafe;

      const nowMs = input.nowMs ?? Date.now();
      const pending = await db.runTransaction(async (transaction: Transaction) => {
        const snapshot = await transaction.get(uploadRef(input.uploadId));
        const upload = uploadFromSnapshot(snapshot);
        if (!upload || upload.uid !== input.uid) return false;
        if (!["uploaded", "recoverable"].includes(upload.status) || !upload.fileId || !FILE_ID_PATTERN.test(upload.fileId)) return false;
        transaction.update(uploadRef(input.uploadId), { status: "delete-pending", deletePreviousStatus: upload.status, updatedAtMs: nowMs });
        return true;
      });
      if (!pending) return { deleted: false, uploadId: input.uploadId, reason: "delete-in-progress" };

      try {
        await input.deleteFile(loaded.upload.fileId!);
      } catch {
        await db.runTransaction(async (transaction: Transaction) => {
          const snapshot = await transaction.get(uploadRef(input.uploadId));
          const upload = uploadFromSnapshot(snapshot);
          if (upload?.uid === input.uid && upload.status === "delete-pending") {
            const previousStatus = snapshot.data()?.deletePreviousStatus === "uploaded" ? "uploaded" : "recoverable";
            transaction.update(uploadRef(input.uploadId), { status: previousStatus, deleteErrorAtMs: Date.now(), updatedAtMs: Date.now() });
          }
        }).catch(() => {});
        return { deleted: false, uploadId: input.uploadId, reason: "delete-failed" };
      }

      await db.runTransaction(async (transaction: Transaction) => {
        const snapshot = await transaction.get(uploadRef(input.uploadId));
        const upload = uploadFromSnapshot(snapshot);
        if (!upload || upload.uid !== input.uid || upload.status !== "delete-pending") return;
        const quotaSnapshot = await transaction.get(quotaRef(input.uid));
        const quota = quotaFields(quotaSnapshot.data(), defaultLimitBytes);
        const previousStatus = snapshot.data()?.deletePreviousStatus === "uploaded" ? "uploaded" : "recoverable";
        transaction.update(quotaRef(input.uid), previousStatus === "uploaded"
          ? {
              usedBytes: decrement(quota.usedBytes, upload.sizeBytes),
              updatedAtMs: nowMs,
            }
          : {
              reservedBytes: decrement(quota.reservedBytes, upload.sizeBytes),
              updatedAtMs: nowMs,
            });
        transaction.update(uploadRef(input.uploadId), { status: "deleted", deletedAtMs: nowMs, quotaReleasedAtMs: nowMs, updatedAtMs: nowMs });
      });

      return { deleted: true, uploadId: input.uploadId };
    },
  };
}

export function imageKitDeleteFile(privateKey: string): (fileId: string) => Promise<void> {
  return async (fileId: string) => {
    if (!FILE_ID_PATTERN.test(fileId)) throw new Error("Invalid ImageKit file id.");
    const client = new ImageKit({ privateKey });
    await client.files.delete(fileId);
  };
}
