import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
  type UploadTask,
  type UploadTaskSnapshot,
} from "firebase/storage";
import app, { auth } from "./firebase";
import { ImageUploadCancelled } from "./imageAttempt";
import { uploadOptimizedFileToImageKit } from "./imageKitStorage";
import { accountPhotoImageStorageProvider } from "./imageStorageProvider";
import { optimizeImageForUpload, ImagePreparationError, throwIfUploadAborted, type ImageUse, type OptimizedImageResult } from "./imageOptimizer";
import type { ImageUploadStatus } from "./imageAttempt";
import {
  createStallWatch,
  ImageTransferError,
  ImageUploadStalled,
  messageForStorageFailure,
  storageCodeOf,
  UPLOAD_RETRY_LIMIT_MS,
} from "./imageTransfer";
import { nowMs, traceImageUpload } from "./imageUploadTrace";

export type { ImageUploadStatus };

let storageInstance: FirebaseStorage | null = null;

function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(app);
    // Upload retries only. getDownloadURL and deleteObject keep the SDK operation timeout.
    storageInstance.maxUploadRetryTime = UPLOAD_RETRY_LIMIT_MS;
  }
  return storageInstance;
}

// Allow up to 30MB source images before client-side optimization
const MAX_RAW_IMAGE_SIZE_BYTES = 30 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file format and acceptable raw processing size
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: "Please select an image file." };
  }

  const fileType = file.type.toLowerCase();
  const isValidType =
    ALLOWED_IMAGE_TYPES.includes(fileType) ||
    file.name.match(/\.(jpe?g|png|webp|gif)$/i) !== null;

  if (!isValidType) {
    return {
      valid: false,
      error: "This image format isn't supported. Please use JPG, PNG, or WEBP.",
    };
  }

  if (file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: "This image is too large to process. Please choose another image.",
    };
  }

  return { valid: true };
}

export interface UploadProjectImageOptions {
  folder?: "cover" | "gallery";
  onProgress?: (percent: number) => void;
  onStatus?: (status: ImageUploadStatus) => void;
  onOptimized?: (result: OptimizedImageResult) => void;
}

export interface UploadedProjectImage {
  downloadUrl: string;
  storagePath: string;
}

export type PortfolioImageUpload = {
  cancel: () => void;
  done: Promise<UploadedProjectImage>;
};

function isCancelledUpload(error: unknown): boolean {
  if (error instanceof ImageUploadCancelled) return true;
  return storageCodeOf(error) === "canceled";
}

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * One resumable upload shared by portfolio, project, and account images.
 * Cancel aborts compression and the Storage task. A stalled task is cancelled once.
 */
export function beginImageTransfer(input: {
  file: File;
  profile: ImageUse;
  signInMessage: string;
  pathFor: (uid: string, fileName: string) => string;
  metadataFor: (uid: string) => Record<string, string>;
  onStatus?: (status: ImageUploadStatus) => void;
  onOptimized?: (result: OptimizedImageResult) => void;
}): PortfolioImageUpload {
  let cancelled = false;
  let uploadTask: UploadTask | null = null;
  let stallWatch: { stop: () => void } | null = null;
  const abort = new AbortController();

  const done = (async () => {
    const validationStarted = nowMs();
    const validation = validateImageFile(input.file);
    traceImageUpload("validate", {
      durationMs: Math.round(nowMs() - validationStarted),
      originalBytes: input.file.size,
      valid: validation.valid,
    });
    if (!validation.valid) throw new Error(validation.error || "Please choose a valid image.");

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error(input.signInMessage);
    const authStarted = nowMs();
    try {
      await currentUser.getIdToken(false);
    } catch (error) {
      const code = storageCodeOf(error) || "unauthenticated";
      traceImageUpload("auth-ready", { durationMs: Math.round(nowMs() - authStarted), ok: false, storageCode: code });
      throw new ImageTransferError("auth", code, messageForStorageFailure(code, "auth"));
    }
    traceImageUpload("auth-ready", { durationMs: Math.round(nowMs() - authStarted), ok: true, storageCode: null });
    throwIfUploadAborted(abort.signal);
    if (cancelled) throw new ImageUploadCancelled();

    input.onStatus?.({ phase: "preparing", percent: null });
    const optimizationResult = await optimizeImageForUpload(
      input.file,
      (phase) => input.onStatus?.({ phase, percent: null }),
      input.profile,
      { signal: abort.signal },
    );
    input.onOptimized?.(optimizationResult);
    if (cancelled || abort.signal.aborted) throw new ImageUploadCancelled();

    const fileToUpload = optimizationResult.file;
    const storagePath = input.pathFor(currentUser.uid, `${Date.now()}_${cleanFileName(fileToUpload.name)}`);
    const fileRef = ref(getStorageInstance(), storagePath);
    uploadTask = uploadBytesResumable(fileRef, fileToUpload, {
      contentType: fileToUpload.type || input.file.type || "application/octet-stream",
      customMetadata: {
        ...input.metadataFor(currentUser.uid),
        originalSize: String(optimizationResult.originalSize),
        optimizedSize: String(optimizationResult.optimizedSize),
        wasOptimized: String(optimizationResult.wasOptimized),
      },
    });
    if (cancelled) {
      uploadTask.cancel();
      throw new ImageUploadCancelled();
    }

    const uploadStarted = nowMs();
    let firstProgressMs: number | null = null;
    let stalledError: ImageUploadStalled | null = null;
    const watch = createStallWatch((kind) => {
      stalledError = new ImageUploadStalled(kind);
      traceImageUpload("upload-stalled", { stall: kind, storageCode: null });
      uploadTask?.cancel();
    });
    stallWatch = watch;

    return await new Promise<UploadedProjectImage>((resolve, reject) => {
      input.onStatus?.({ phase: "uploading", percent: null });
      uploadTask?.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          watch.noteBytes(snapshot.bytesTransferred);
          if (firstProgressMs === null && snapshot.bytesTransferred > 0) {
            firstProgressMs = Math.round(nowMs() - uploadStarted);
            traceImageUpload("upload-first-progress", {
              waitMs: firstProgressMs,
              bytesTransferred: snapshot.bytesTransferred,
            });
          }
          if (snapshot.totalBytes > 0) {
            const percent = Math.min(
              100,
              Math.max(0, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
            );
            input.onStatus?.({ phase: "uploading", percent });
          }
        },
        (error) => {
          watch.stop();
          if (stalledError) {
            reject(stalledError);
            return;
          }
          if (cancelled || isCancelledUpload(error)) {
            reject(new ImageUploadCancelled());
            return;
          }
          const code = storageCodeOf(error);
          traceImageUpload("upload-failed", { storageCode: code || null, stage: "upload" });
          console.error("Firebase Storage upload failed", code || "unknown");
          reject(new ImageTransferError("upload", code, messageForStorageFailure(code, "upload")));
        },
        async () => {
          watch.stop();
          if (cancelled || !uploadTask) {
            reject(new ImageUploadCancelled());
            return;
          }
          if (stalledError) {
            reject(stalledError);
            return;
          }
          traceImageUpload("upload-bytes", {
            durationMs: Math.round(nowMs() - uploadStarted),
            bytesTransferred: uploadTask.snapshot.bytesTransferred,
            firstProgressMs,
          });
          const urlStarted = nowMs();
          try {
            input.onStatus?.({ phase: "finalizing", percent: null });
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (cancelled) {
              reject(new ImageUploadCancelled());
              return;
            }
            traceImageUpload("download-url", {
              durationMs: Math.round(nowMs() - urlStarted),
              ok: true,
              storageCode: null,
            });
            input.onStatus?.({ phase: "ready", percent: null });
            resolve({ downloadUrl, storagePath });
          } catch (error) {
            if (cancelled || isCancelledUpload(error)) {
              reject(new ImageUploadCancelled());
              return;
            }
            const code = storageCodeOf(error);
            traceImageUpload("download-url", {
              durationMs: Math.round(nowMs() - urlStarted),
              ok: false,
              storageCode: code || null,
            });
            console.error("Download URL retrieval failed", code || "unknown");
            reject(new ImageTransferError("download-url", code, messageForStorageFailure(code, "download-url")));
          }
        },
      );
    });
  })().catch((error: unknown) => {
    stallWatch?.stop();
    if (error instanceof ImagePreparationError || error instanceof ImageTransferError || error instanceof ImageUploadStalled) {
      throw error;
    }
    if (isCancelledUpload(error)) throw new ImageUploadCancelled();
    throw error;
  });

  return {
    cancel() {
      cancelled = true;
      abort.abort();
      stallWatch?.stop();
      uploadTask?.cancel();
    },
    done,
  };
}

function forwardProgress(onProgress: ((percent: number) => void) | undefined, onStatus?: (status: ImageUploadStatus) => void) {
  return (status: ImageUploadStatus) => {
    onStatus?.(status);
    if (status.phase === "uploading" && status.percent !== null) onProgress?.(status.percent);
  };
}

export function beginProjectImageUpload(
  portfolioId: string,
  projectId: string,
  file: File,
  options?: UploadProjectImageOptions | "cover" | "gallery",
): PortfolioImageUpload {
  const folder: "cover" | "gallery" = typeof options === "string" ? options : options?.folder || "cover";
  const onProgress = typeof options === "object" ? options.onProgress : undefined;
  const onStatus = typeof options === "object" ? options.onStatus : undefined;
  const onOptimized = typeof options === "object" ? options.onOptimized : undefined;
  return beginImageTransfer({
    file,
    profile: "project",
    signInMessage: "You must be signed in to upload project images.",
    onStatus: forwardProgress(onProgress, onStatus),
    onOptimized,
    pathFor: (uid, fileName) => `portfolio-assets/${uid}/${portfolioId}/projects/${projectId}/${folder}/${fileName}`,
    metadataFor: (uid) => ({
      ownerId: uid,
      portfolioId,
      projectId,
      originalName: file.name,
    }),
  });
}

/**
 * Adaptively optimize and upload a project image to Firebase Storage with real progress tracking.
 * Path: portfolio-assets/{uid}/{portfolioId}/projects/{projectId}/{folder}/{timestamp}_{filename}
 */
export async function uploadProjectImage(
  portfolioId: string,
  projectId: string,
  file: File,
  options?: UploadProjectImageOptions | "cover" | "gallery",
): Promise<UploadedProjectImage> {
  return beginProjectImageUpload(portfolioId, projectId, file, options).done;
}

function ownedStoragePrefix(uid: string): string {
  return `portfolio-assets/${uid}/`;
}

/**
 * Delete one object by the storage path recorded at upload time.
 * Paths are never inferred from download URLs.
 */
export async function deleteStoredImage(storagePath: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to remove images.");
  }

  const prefix = ownedStoragePrefix(currentUser.uid);
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new Error("This image cannot be removed because its storage path is not available.");
  }

  try {
    await deleteObject(ref(getStorageInstance(), storagePath));
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "storage/object-not-found") return;
    console.error("Firebase Storage delete error:", error);
    throw new Error("We couldn't remove the stored image file.");
  }
}

/**
 * Upload an account profile image with the account size profile.
 * Stored under the signed-in user's own prefix.
 */
export function beginAccountProfileImageUpload(
  file: File,
  onStatus?: (status: ImageUploadStatus) => void,
): PortfolioImageUpload {
  if (accountPhotoImageStorageProvider() === "imagekit") {
    return beginImageKitAccountProfileImageUpload(file, onStatus);
  }
  return beginImageTransfer({
    file,
    profile: "account",
    signInMessage: "You must be signed in to upload a profile picture.",
    onStatus,
    pathFor: (uid, fileName) => `portfolio-assets/${uid}/account/profile/${fileName}`,
    metadataFor: (uid) => ({
      ownerId: uid,
      purpose: "account-profile",
      originalName: file.name,
    }),
  });
}

function beginImageKitAccountProfileImageUpload(
  file: File,
  onStatus?: (status: ImageUploadStatus) => void,
): PortfolioImageUpload {
  let cancelled = false;
  const abort = new AbortController();

  const done = (async () => {
    const validation = validateImageFile(file);
    if (!validation.valid) throw new Error(validation.error || "Please choose a valid image.");

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("You must be signed in to upload a profile picture.");
    let idToken = "";
    try {
      idToken = await currentUser.getIdToken(false);
    } catch (error) {
      const code = storageCodeOf(error) || "unauthenticated";
      throw new ImageTransferError("auth", code, messageForStorageFailure(code, "auth"));
    }
    throwIfUploadAborted(abort.signal);
    if (cancelled) throw new ImageUploadCancelled();

    onStatus?.({ phase: "preparing", percent: null });
    const optimizationResult = await optimizeImageForUpload(
      file,
      (phase) => onStatus?.({ phase, percent: null }),
      "account",
      { signal: abort.signal },
    );
    if (cancelled || abort.signal.aborted) throw new ImageUploadCancelled();

    onStatus?.({ phase: "uploading", percent: null });
    const uploaded = await uploadOptimizedFileToImageKit({
      file: optimizationResult.file,
      idToken,
      signal: abort.signal,
      onProgress: (percent) => onStatus?.({ phase: "uploading", percent }),
    });
    if (cancelled || abort.signal.aborted) throw new ImageUploadCancelled();
    if (!uploaded.filePath) throw new ImageTransferError("upload", null, "Upload failed. Try again.");

    onStatus?.({ phase: "ready", percent: null });
    return { downloadUrl: uploaded.url, storagePath: uploaded.filePath };
  })().catch((error: unknown) => {
    if (error instanceof ImagePreparationError || error instanceof ImageTransferError || error instanceof ImageUploadCancelled) {
      throw error;
    }
    if (cancelled || abort.signal.aborted) throw new ImageUploadCancelled();
    throw error;
  });

  return {
    cancel() {
      cancelled = true;
      abort.abort();
    },
    done,
  };
}

export async function uploadAccountProfileImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedProjectImage> {
  return beginAccountProfileImageUpload(file, forwardProgress(onProgress)).done;
}

export type PortfolioImageFolder = "portrait" | "logo" | "social";

function profileForFolder(folder: PortfolioImageFolder): ImageUse {
  if (folder === "logo") return "logo";
  if (folder === "social") return "social";
  return "portrait";
}

/**
 * Prepare and upload one portfolio image.
 * Cancel stops compression and the resumable task. A cancelled attempt does not resolve a URL.
 * A replacement is not deleted: Save has not happened yet, and an older published document may still reference the previous object.
 */
export function beginPortfolioImageUpload(
  portfolioId: string,
  file: File,
  folder: PortfolioImageFolder,
  onStatus?: (status: ImageUploadStatus) => void,
): PortfolioImageUpload {
  if (!portfolioId) {
    return {
      cancel() {},
      done: Promise.reject(new Error("Your portfolio needs to finish loading before an image can be added.")),
    };
  }
  return beginImageTransfer({
    file,
    profile: profileForFolder(folder),
    signInMessage: "You must be signed in to upload an image.",
    onStatus,
    pathFor: (uid, fileName) => `portfolio-assets/${uid}/${portfolioId}/${folder}/${fileName}`,
    metadataFor: (uid) => ({
      ownerId: uid,
      portfolioId,
      purpose: folder === "logo" ? "portfolio-logo" : folder === "social" ? "portfolio-social" : "portfolio-portrait",
      originalName: file.name,
    }),
  });
}

/**
 * Upload a portfolio image. The editor stores the download URL only.
 * Portrait: portfolio-assets/{uid}/{portfolioId}/portrait/{timestamp}_{file}
 * Logo: portfolio-assets/{uid}/{portfolioId}/logo/{timestamp}_{file}
 * Social: portfolio-assets/{uid}/{portfolioId}/social/{timestamp}_{file}
 */
export async function uploadPortfolioImage(
  portfolioId: string,
  file: File,
  folder: PortfolioImageFolder,
  onStatus?: (status: ImageUploadStatus) => void,
): Promise<UploadedProjectImage> {
  return beginPortfolioImageUpload(portfolioId, file, folder, onStatus).done;
}

/**
 * Upload the portfolio portrait with the same optimizer and resumable upload
 * used for account and project images. The portfolio stores the download URL only.
 */
export async function uploadPortfolioPortrait(
  portfolioId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedProjectImage> {
  return uploadPortfolioImage(portfolioId, file, "portrait", (status) => {
    if (status.phase === "uploading" && status.percent !== null) onProgress?.(status.percent);
  });
}

export async function deleteStoredImages(storagePaths: string[]): Promise<void> {
  const unique = [...new Set(storagePaths.filter(Boolean))];
  await Promise.all(
    unique.map(async (storagePath) => {
      try {
        await deleteStoredImage(storagePath);
      } catch (error) {
        console.error("Stored image cleanup failed:", storagePath, error);
      }
    }),
  );
}
