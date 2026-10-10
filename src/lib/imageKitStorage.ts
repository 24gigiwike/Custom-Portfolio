import { ImageUploadCancelled } from "./imageAttempt";

export const IMAGEKIT_UPLOAD_FAILED = "Upload failed. Try again.";
export const IMAGEKIT_AUTH_REQUIRED = "Sign in to upload an image.";
export const IMAGEKIT_AUTH_EXPIRED = "Your session expired. Sign in again, then retry the upload.";
export const IMAGEKIT_NOT_AVAILABLE = "Image upload is not available.";
export const IMAGEKIT_NOT_CONFIGURED = "Image upload storage is not configured.";

export class ImageKitTransferError extends Error {
  readonly name = "ImageKitTransferError";

  constructor(message: string) {
    super(message);
  }
}

export type UploadedImageKitFile = {
  url: string;
  fileId: string | null;
  filePath: string | null;
};

export type ImageKitServerPost = (
  file: Blob,
  init: {
    idToken: string;
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
  },
) => Promise<{ status: number; json: unknown }>;

const SAFE_SERVER_ERRORS = new Set([
  IMAGEKIT_AUTH_REQUIRED,
  IMAGEKIT_AUTH_EXPIRED,
  IMAGEKIT_NOT_AVAILABLE,
  IMAGEKIT_NOT_CONFIGURED,
  "This image format isn't supported. Please use JPG, PNG, WEBP, or GIF.",
  "This image is too large to process. Please choose another image.",
  "Choose an image file.",
  "Send one image file.",
  "This upload field is not available.",
  "Send the image as multipart form data.",
  "Image upload failed. Try again.",
  "This upload route is no longer available.",
]);

function messageForStatus(status: number, json: unknown): string {
  const error = json && typeof json === "object" && "error" in json ? (json as { error?: unknown }).error : "";
  if (typeof error === "string" && SAFE_SERVER_ERRORS.has(error)) return error;
  if (status === 401) return IMAGEKIT_AUTH_EXPIRED;
  if (status === 403) return IMAGEKIT_NOT_AVAILABLE;
  if (status === 503) return IMAGEKIT_NOT_CONFIGURED;
  return IMAGEKIT_UPLOAD_FAILED;
}

function readResult(json: unknown): UploadedImageKitFile {
  if (!json || typeof json !== "object") throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  const payload = json as Record<string, unknown>;
  if ("privateKey" in payload || "signature" in payload || "token" in payload || "publicKey" in payload) {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  if (typeof payload.url !== "string" || !payload.url.startsWith("https://")) {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  if (payload.fileId !== undefined && typeof payload.fileId !== "string") {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  if (payload.filePath !== undefined && typeof payload.filePath !== "string") {
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  return {
    url: payload.url,
    fileId: typeof payload.fileId === "string" ? payload.fileId : null,
    filePath: typeof payload.filePath === "string" ? payload.filePath : null,
  };
}

function postWithFetch(
  file: Blob,
  init: { idToken: string; signal?: AbortSignal; onProgress?: (percent: number) => void },
): Promise<{ status: number; json: unknown }> {
  const form = new FormData();
  form.append("file", file, "image");
  return fetch("/api/imagekit-upload", {
    method: "POST",
    headers: { authorization: `Bearer ${init.idToken}` },
    body: form,
    signal: init.signal,
  }).then(async (response) => ({ status: response.status, json: await response.json().catch(() => ({})) }));
}

function postWithProgress(
  file: Blob,
  init: { idToken: string; signal?: AbortSignal; onProgress?: (percent: number) => void },
): Promise<{ status: number; json: unknown }> {
  if (typeof XMLHttpRequest === "undefined") return postWithFetch(file, init);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/imagekit-upload");
    xhr.setRequestHeader("authorization", `Bearer ${init.idToken}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      try {
        init.onProgress?.(percent);
      } catch {
        // Progress display must not fail the transfer.
      }
    };
    const abort = () => xhr.abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    xhr.onload = () => {
      init.signal?.removeEventListener("abort", abort);
      let json: unknown = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = {};
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED));
    xhr.onabort = () => reject(new ImageUploadCancelled());
    const form = new FormData();
    form.append("file", file, "image");
    xhr.send(form);
  });
}

/**
 * Send one already-optimized file to the authenticated server upload.
 * The server chooses the folder, file name, and overwrite behavior.
 */
export async function uploadOptimizedFileToImageKit(input: {
  file: Blob;
  idToken: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  post?: ImageKitServerPost;
}): Promise<UploadedImageKitFile> {
  if (!input.idToken) throw new ImageKitTransferError(IMAGEKIT_AUTH_REQUIRED);
  if (input.signal?.aborted) throw new ImageUploadCancelled();
  const post = input.post ?? postWithProgress;
  let response: { status: number; json: unknown };
  try {
    response = await post(input.file, {
      idToken: input.idToken,
      signal: input.signal,
      onProgress: input.onProgress,
    });
  } catch (error) {
    if (input.signal?.aborted || error instanceof ImageUploadCancelled) throw new ImageUploadCancelled();
    if (error instanceof ImageKitTransferError) throw error;
    throw new ImageKitTransferError(IMAGEKIT_UPLOAD_FAILED);
  }
  if (response.status !== 200) throw new ImageKitTransferError(messageForStatus(response.status, response.json));
  return readResult(response.json);
}
