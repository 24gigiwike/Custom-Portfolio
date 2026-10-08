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
import { optimizeImageForUpload, ImagePreparationError, type ImageUse, type OptimizedImageResult } from "./imageOptimizer";
import type { ImageUploadStatus } from "./imageAttempt";

export type { ImageUploadStatus };

let storageInstance: FirebaseStorage | null = null;

function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(app);
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
  onOptimized?: (result: OptimizedImageResult) => void;
}

export interface UploadedProjectImage {
  downloadUrl: string;
  storagePath: string;
}

/**
 * Adaptively optimize and upload a project image to Firebase Storage with real progress tracking.
 * Path: portfolio-assets/{uid}/{portfolioId}/projects/{projectId}/{folder}/{timestamp}_{filename}
 */
export async function uploadProjectImage(
  portfolioId: string,
  projectId: string,
  file: File,
  options?: UploadProjectImageOptions | "cover" | "gallery"
): Promise<UploadedProjectImage> {
  const folder: "cover" | "gallery" =
    typeof options === "string" ? options : options?.folder || "cover";
  const onProgress = typeof options === "object" ? options.onProgress : undefined;
  const onOptimized = typeof options === "object" ? options.onOptimized : undefined;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid image file.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to upload project images.");
  }

  // 1. Client-Side Adaptive Optimization
  const optimizationResult = await optimizeImageForUpload(file, undefined, "project");
  if (onOptimized) {
    onOptimized(optimizationResult);
  }

  const fileToUpload = optimizationResult.file;

  try {
    const storage = getStorageInstance();
    const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}_${cleanFileName}`;
    const storagePath = `portfolio-assets/${currentUser.uid}/${portfolioId}/projects/${projectId}/${folder}/${uniqueFileName}`;
    const fileRef = ref(storage, storagePath);

    // 2. Resumable upload with accurate progress tracking
    const uploadTask = uploadBytesResumable(fileRef, fileToUpload, {
      contentType: fileToUpload.type,
      customMetadata: {
        ownerId: currentUser.uid,
        portfolioId,
        projectId,
        originalName: file.name,
        originalSize: String(optimizationResult.originalSize),
        optimizedSize: String(optimizationResult.optimizedSize),
        wasOptimized: String(optimizationResult.wasOptimized),
      },
    });

    return await new Promise<UploadedProjectImage>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.min(
              100,
              Math.max(0, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
            );
            onProgress(percent);
          }
        },
        (error) => {
          console.error("Firebase Storage Upload Task Error:", error);
          const msg = error.message || String(error);
          if (msg.includes("unauthorized") || msg.includes("permission")) {
            reject(new Error("You do not have permission to upload this file."));
          } else if (msg.includes("quota") || msg.includes("limit")) {
            reject(new Error("Upload quota exceeded. Please try again later."));
          } else {
            reject(new Error("Couldn't upload this image. Try again."));
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({ downloadUrl, storagePath });
          } catch (err) {
            console.error("Failed to get download URL:", err);
            reject(new Error("We couldn't prepare this image. Try another image."));
          }
        }
      );
    });
  } catch (error) {
    console.error("Upload error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Couldn't upload this image. Try again.");
  }
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
 * Upload an account profile image with the same optimizer and resumable upload
 * used for project images. Stored under the signed-in user's own prefix.
 */
export async function uploadAccountProfileImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedProjectImage> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Please choose a valid image.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to upload a profile picture.");
  }

  const optimizationResult = await optimizeImageForUpload(file);
  const fileToUpload = optimizationResult.file;
  const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `portfolio-assets/${currentUser.uid}/account/profile/${Date.now()}_${cleanFileName}`;
  const fileRef = ref(getStorageInstance(), storagePath);

  const uploadTask = uploadBytesResumable(fileRef, fileToUpload, {
    contentType: fileToUpload.type,
    customMetadata: {
      ownerId: currentUser.uid,
      purpose: "account-profile",
      originalName: file.name,
    },
  });

  return await new Promise<UploadedProjectImage>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const percent = Math.min(
            100,
            Math.max(0, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
          );
          onProgress(percent);
        }
      },
      (error) => {
        console.error("Profile image upload error:", error);
        const msg = error.message || String(error);
        if (msg.includes("unauthorized") || msg.includes("permission")) {
          reject(new Error("You do not have permission to upload this picture."));
        } else {
          reject(new Error("Couldn't upload this picture. Try again."));
        }
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (onProgress) onProgress(100);
          resolve({ downloadUrl, storagePath });
        } catch (err) {
          console.error("Failed to get profile image URL:", err);
          reject(new Error("We couldn't prepare this picture. Try another image."));
        }
      }
    );
  });
}

export type PortfolioImageFolder = "portrait" | "logo" | "social";

function profileForFolder(folder: PortfolioImageFolder): ImageUse {
  if (folder === "logo") return "logo";
  if (folder === "social") return "social";
  return "portrait";
}

function uploadFailureMessage(folder: PortfolioImageFolder): string {
  if (folder === "logo") return "Couldn't upload this logo. Try again.";
  if (folder === "social") return "Couldn't upload this image. Try again.";
  return "Couldn't upload this portrait. Try again.";
}

function isCancelledUpload(error: unknown): boolean {
  if (error instanceof ImageUploadCancelled) return true;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return code === "storage/canceled";
}

export type PortfolioImageUpload = {
  cancel: () => void;
  done: Promise<UploadedProjectImage>;
};

/**
 * Prepare and upload one portfolio image.
 * Cancel stops the resumable task. A cancelled attempt does not resolve a URL.
 */
export function beginPortfolioImageUpload(
  portfolioId: string,
  file: File,
  folder: PortfolioImageFolder,
  onStatus?: (status: ImageUploadStatus) => void,
): PortfolioImageUpload {
  let cancelled = false;
  let uploadTask: UploadTask | null = null;

  const done = (async () => {
    const validation = validateImageFile(file);
    if (!validation.valid) throw new Error(validation.error || "Please choose a valid image.");
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("You must be signed in to upload an image.");
    if (!portfolioId) throw new Error("Your portfolio needs to finish loading before an image can be added.");

    onStatus?.({ phase: "preparing", percent: null });
    const optimizationResult = await optimizeImageForUpload(
      file,
      (phase) => onStatus?.({ phase, percent: null }),
      profileForFolder(folder),
    );
    if (cancelled) throw new ImageUploadCancelled();

    const fileToUpload = optimizationResult.file;
    const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `portfolio-assets/${currentUser.uid}/${portfolioId}/${folder}/${Date.now()}_${cleanFileName}`;
    const fileRef = ref(getStorageInstance(), storagePath);
    uploadTask = uploadBytesResumable(fileRef, fileToUpload, {
      contentType: fileToUpload.type,
      customMetadata: {
        ownerId: currentUser.uid,
        portfolioId,
        purpose: folder === "logo" ? "portfolio-logo" : folder === "social" ? "portfolio-social" : "portfolio-portrait",
        originalName: file.name,
      },
    });
    if (cancelled) {
      uploadTask.cancel();
      throw new ImageUploadCancelled();
    }

    return await new Promise<UploadedProjectImage>((resolve, reject) => {
      onStatus?.({ phase: "uploading", percent: null });
      uploadTask?.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          if (snapshot.totalBytes > 0 && onStatus) {
            const percent = Math.min(
              100,
              Math.max(0, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
            );
            onStatus({ phase: "uploading", percent });
          }
        },
        (error) => {
          if (isCancelledUpload(error)) {
            reject(new ImageUploadCancelled());
            return;
          }
          console.error("Portfolio image upload error:", error);
          const msg = error.message || String(error);
          if (msg.includes("unauthorized") || msg.includes("permission")) {
            reject(new Error("You do not have permission to upload this image."));
          } else {
            reject(new Error(uploadFailureMessage(folder)));
          }
        },
        async () => {
          if (cancelled || !uploadTask) {
            reject(new ImageUploadCancelled());
            return;
          }
          try {
            onStatus?.({ phase: "finalizing", percent: null });
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (cancelled) {
              reject(new ImageUploadCancelled());
              return;
            }
            onStatus?.({ phase: "ready", percent: null });
            resolve({ downloadUrl, storagePath });
          } catch (err) {
            if (isCancelledUpload(err)) {
              reject(new ImageUploadCancelled());
              return;
            }
            console.error("Failed to get portfolio image URL:", err);
            reject(new Error(uploadFailureMessage(folder)));
          }
        },
      );
    });
  })().catch((error: unknown) => {
    if (error instanceof ImagePreparationError) throw error;
    if (isCancelledUpload(error)) throw new ImageUploadCancelled();
    throw error;
  });

  return {
    cancel() {
      cancelled = true;
      uploadTask?.cancel();
    },
    done,
  };
}

/**
 * Upload a portfolio image. The editor stores the download URL only.
 * A replacement is not deleted: Save has not happened yet, and an older
 * published document may still reference the previous object.
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
  onProgress?: (percent: number) => void
): Promise<UploadedProjectImage> {
  return uploadPortfolioImage(portfolioId, file, "portrait", (status) => {
    if (status.phase === "uploading" && status.percent !== null) onProgress?.(status.percent);
    if (status.phase === "ready") onProgress?.(100);
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
    })
  );
}

