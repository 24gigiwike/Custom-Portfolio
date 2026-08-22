import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type FirebaseStorage,
  type UploadTaskSnapshot,
} from "firebase/storage";
import app, { auth } from "./firebase";
import { optimizeImageForUpload, type OptimizedImageResult } from "./imageOptimizer";

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

/**
 * Adaptively optimize and upload a project image to Firebase Storage with real progress tracking.
 * Path: portfolio-assets/{uid}/{portfolioId}/projects/{projectId}/{folder}/{timestamp}_{filename}
 */
export async function uploadProjectImage(
  portfolioId: string,
  projectId: string,
  file: File,
  options?: UploadProjectImageOptions | "cover" | "gallery"
): Promise<string> {
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
  const optimizationResult = await optimizeImageForUpload(file);
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

    return await new Promise<string>((resolve, reject) => {
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
            resolve(downloadUrl);
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

