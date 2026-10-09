/**
 * Shared upload transport decisions that do not import Firebase.
 * Stall detection watches bytes transferred. Unchanged progress snapshots do not reset the timer.
 */

export const UPLOAD_STALL_MS = 45_000;

/**
 * Caps Firebase upload retries on the shared Storage instance.
 * This is upload-specific (`maxUploadRetryTime`). Deletes and download-URL reads use
 * `maxOperationRetryTime`, which is left at the SDK default.
 * 2 minutes is a backstop for retry storms that still trickle bytes and therefore
 * reset the 45 second inactivity timer. It is not a second automatic retry loop.
 */
export const UPLOAD_RETRY_LIMIT_MS = 120_000;

export const STALL_BEFORE_FIRST_BYTE = "Upload stalled before any data was sent. Retry.";
export const STALL_DURING_TRANSFER = "Upload stalled — Retry.";
export const DOWNLOAD_URL_FAILED = "The image was uploaded, but its link could not be retrieved. Try again.";
export const UPLOAD_FAILED = "Upload failed. Try again.";
export const AUTH_EXPIRED = "Your session expired. Sign in again, then retry the upload.";
export const UPLOAD_UNAUTHORIZED = "You do not have permission to upload this image.";
export const UPLOAD_RETRY_LIMIT = "The upload kept failing on the network. Check your connection and try again.";

export type StallKind = "before-first-byte" | "mid-transfer";
export type TransferStage = "upload" | "download-url" | "auth";

export class ImageTransferError extends Error {
  readonly name = "ImageTransferError";
  readonly stage: TransferStage;
  readonly storageCode: string;

  constructor(stage: TransferStage, storageCode: string, message: string) {
    super(message);
    this.stage = stage;
    this.storageCode = storageCode;
  }
}

export class ImageUploadStalled extends Error {
  readonly name = "ImageUploadStalled";
  readonly stall: StallKind;

  constructor(stall: StallKind) {
    super(stall === "before-first-byte" ? STALL_BEFORE_FIRST_BYTE : STALL_DURING_TRANSFER);
    this.stall = stall;
  }
}

export function storageCodeOf(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = String((error as { code?: unknown }).code ?? "");
  return code.startsWith("storage/") ? code.slice("storage/".length) : code;
}

export function messageForStorageFailure(code: string, stage: TransferStage): string {
  if (stage === "download-url") return DOWNLOAD_URL_FAILED;
  if (stage === "auth" || code === "unauthenticated") return AUTH_EXPIRED;
  if (code === "unauthorized") return UPLOAD_UNAUTHORIZED;
  if (code === "retry-limit-exceeded") return UPLOAD_RETRY_LIMIT;
  if (code === "canceled" || code === "cancelled") return "Upload cancelled.";
  if (code === "quota-exceeded") return "Upload storage is full. Try again later.";
  return UPLOAD_FAILED;
}

export type StallWatch = {
  /** Record the latest byte count. The timer resets only when the count increases. */
  noteBytes: (bytes: number) => void;
  stop: () => void;
};

export function createStallWatch(
  onStall: (kind: StallKind) => void,
  timeoutMs = UPLOAD_STALL_MS,
): StallWatch {
  let lastBytes = 0;
  let sawIncrease = false;
  let stopped = false;
  let timer = setTimeout(fire, timeoutMs);

  function fire() {
    if (stopped) return;
    stopped = true;
    onStall(sawIncrease ? "mid-transfer" : "before-first-byte");
  }

  return {
    noteBytes(bytes: number) {
      if (stopped || !(bytes > lastBytes)) return;
      lastBytes = bytes;
      sawIncrease = true;
      clearTimeout(timer);
      timer = setTimeout(fire, timeoutMs);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
