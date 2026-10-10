import { ImageUploadCancelled } from "./imageAttempt";
import { IMAGEKIT_UPLOAD_PURPOSE } from "./imageKitUploadPurpose";

export const IMAGEKIT_UPLOAD_FAILED = "Upload failed. Try again.";
export const IMAGEKIT_AUTH_REQUIRED = "Sign in to upload an image.";
export const IMAGEKIT_AUTH_EXPIRED = "Your session expired. Sign in again, then retry the upload.";
export const IMAGEKIT_RATE_LIMITED = "Too many upload attempts. Wait a moment and try again.";
export const IMAGEKIT_NOT_CONFIGURED = "Image upload storage is not configured.";

export class ImageKitTransferError extends Error {
  readonly name = "ImageKitTransferError";

  constructor(message: string) {
    super(message);
  }
}

export type ImageKitUploadAuthorization = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder: string;
  purpose: typeof IMAGEKIT_UPLOAD_PURPOSE;
};

export type UploadedImageKitFile = {
  url: string;
  fileId: string | null;
  filePath: string | null;
};

type UploadProgressEvent = { loaded?: number; total?: number };

export type ImageKitBrowserUpload = (options: {
  file: Blob;
  fileName: string;
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
  folder: string;
  useUniqueFileName: boolean;
  abortSignal?: AbortSignal;
  onProgress?: (event: UploadProgressEvent) => void;
}) => Promise<{ url?: string; fileId?: string; filePath?: string }>;

function cleanFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(0, 80) || "image.jpg";
}

function messageForAuthStatus(status: number): string {
  if (status === 401) return IMAGEKIT_AUTH_EXPIRED;
  if (status === 429) return IMAGEKIT_RATE_LIMITED;
  if (status === 503) return IMAGEKIT_NOT_CONFIGURED;
  return IMAGEKIT_UPLOAD_FAILED;
}

export async function requestImageKitUploadAuthorization(
  idToken: string,
  options?: { fetch?: typeof fetch; purpose?: typeof IMAGEKIT_UPLOAD_PURPOSE },
): Promise<ImageKitUploadAuthorization> {
  if (!idToken) throw new ImageKitTransferError(IMAGEKIT_AUTH_REQUIRED);
  const response = await (options?.fetch ?? fetch)("/api/imagekit-auth", {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ purpose: options?.purpose ?? IMAGEKIT_UPLOAD_PURPOSE }),
  });
  if (!response.ok) throw new ImageKitTransferError(messageForAuthStatus(response.status));
  const payload = (await response.json()) as Partial<ImageKitUploadAuthorization> & { privateKey?: unknown };
  if (payload.privateKey !== undefined) throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  if (
    typeof payload.token !== "string" ||
    typeof payload.signature !== "string" ||
    typeof payload.publicKey !== "string" ||
    typeof payload.urlEndpoint !== "string" ||
    typeof payload.folder !== "string" ||
    typeof payload.expire !== "number" ||
    payload.purpose !== IMAGEKIT_UPLOAD_PURPOSE
  ) {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  return {
    token: payload.token,
    expire: payload.expire,
    signature: payload.signature,
    publicKey: payload.publicKey,
    urlEndpoint: payload.urlEndpoint,
    folder: payload.folder,
    purpose: IMAGEKIT_UPLOAD_PURPOSE,
  };
}

async function defaultBrowserUpload(): Promise<ImageKitBrowserUpload> {
  const sdk = await import("@imagekit/javascript");
  return (options) => sdk.upload(options);
}

/**
 * Upload one file that has already been through optimizeImageForUpload.
 * Compression stays in the shared optimizer.
 */
export async function uploadOptimizedFileToImageKit(input: {
  file: Blob & { name?: string };
  authorization: ImageKitUploadAuthorization;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  upload?: ImageKitBrowserUpload;
}): Promise<UploadedImageKitFile> {
  if (input.signal?.aborted) throw new ImageUploadCancelled();
  const upload = input.upload ?? (await defaultBrowserUpload());
  let response: { url?: string; fileId?: string; filePath?: string };
  try {
    response = await upload({
      file: input.file,
      fileName: cleanFileName(input.file.name || "image.jpg"),
      token: input.authorization.token,
      signature: input.authorization.signature,
      expire: input.authorization.expire,
      publicKey: input.authorization.publicKey,
      folder: input.authorization.folder,
      useUniqueFileName: true,
      abortSignal: input.signal,
      onProgress: (event) => {
        const total = event.total ?? 0;
        if (total <= 0) return;
        const percent = Math.max(0, Math.min(100, Math.round(((event.loaded ?? 0) / total) * 100)));
        try {
          input.onProgress?.(percent);
        } catch {
          // Progress display must not fail the transfer.
        }
      },
    });
  } catch (error) {
    if (input.signal?.aborted) throw new ImageUploadCancelled();
    const name = error instanceof Error ? error.name : "";
    if (name === "ImageKitAbortError" || name === "AbortError") throw new ImageUploadCancelled();
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  if (!response.url || !response.url.startsWith("https://")) {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  return {
    url: response.url,
    fileId: response.fileId ?? null,
    filePath: response.filePath ?? null,
  };
}
