/**
 * Canvas rollback for image preparation.
 * Loaded only when VITE_IMAGE_COMPRESSION_BACKEND=legacy.
 * One encode at the profile quality. This file does not import the worker compressor.
 */
import { ImageUploadCancelled } from "./imageAttempt";
import {
  encodedMimeType,
  fittedLongSide,
  imageHasTransparency,
  IMAGE_PREPARATION_FAILED_MESSAGE,
  IMAGE_PROFILES,
  ImagePreparationError,
  originalAllowedAfterOptimizationFailure,
  planImageFile,
  settleCompressedOutput,
  throwIfUploadAborted,
  unchangedImage,
  type ImagePreparePhase,
  type ImageUse,
  type OptimizedImageResult,
} from "./imageOptimizer";
import { nowMs, traceImageUpload } from "./imageUploadTrace";

let supportsWebPCache: boolean | null = null;
function checkWebPSupport(): boolean {
  if (supportsWebPCache !== null) return supportsWebPCache;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    supportsWebPCache = canvas.toDataURL("image/webp").indexOf("image/webp") === 5;
  } catch {
    supportsWebPCache = false;
  }
  return supportsWebPCache;
}

function loadImageElement(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image file."));
    };
    img.src = objectUrl;
  });
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") throw new Error("ImageBitmap decoding is unavailable.");
  return createImageBitmap(file);
}

async function bitmapAtSize(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  if (source.width === width && source.height === height) return source;
  const resized = await createImageBitmap(source, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  });
  source.close();
  return resized;
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  file: File,
  profile: ImageUse,
  sourceWidth: number,
  sourceHeight: number,
): Promise<OptimizedImageResult> {
  const limits = IMAGE_PROFILES[profile];
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
  const hasAlpha = imageHasTransparency(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  const targetMimeType = encodedMimeType({ hasAlpha, supportsWebP: checkWebPSupport() });
  const extension = targetMimeType === "image/webp" ? ".webp" : targetMimeType === "image/png" ? ".png" : ".jpg";
  const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
  const newFileName = `${baseName.replace(/[^a-zA-Z0-9_-]/g, "_")}${extension}`;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed."));
        return;
      }
      const optimizedFile = new File([blob], newFileName, { type: targetMimeType, lastModified: Date.now() });
      try {
        resolve(settleCompressedOutput({
          original: file,
          compressed: optimizedFile,
          width: canvas.width,
          height: canvas.height,
          sourceWidth,
          sourceHeight,
          profile,
        }));
      } catch (error) {
        reject(error);
      }
    }, targetMimeType, limits.quality);
  });
}

async function optimizeWithImageElement(
  file: File,
  profile: ImageUse,
  signal?: AbortSignal,
): Promise<OptimizedImageResult> {
  throwIfUploadAborted(signal);
  const { img, objectUrl } = await loadImageElement(file);
  try {
    throwIfUploadAborted(signal);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const planned = planImageFile({
      type: file.type,
      size: file.size,
      width: naturalWidth,
      height: naturalHeight,
      profile,
    });
    if (planned.action === "reject") throw new ImagePreparationError(planned.message);
    if (planned.action === "passthrough") return unchangedImage(file, naturalWidth, naturalHeight);
    const target = fittedLongSide(naturalWidth, naturalHeight, IMAGE_PROFILES[profile].maxLongSide);
    const canvas = document.createElement("canvas");
    canvas.width = target.width || naturalWidth;
    canvas.height = target.height || naturalHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    throwIfUploadAborted(signal);
    return await encodeCanvas(canvas, file, profile, naturalWidth, naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function optimizeWithLegacyCanvas(
  file: File,
  profile: ImageUse,
  options: { signal?: AbortSignal; onPhase?: (phase: ImagePreparePhase) => void },
): Promise<OptimizedImageResult> {
  const originalSize = file.size;
  const started = nowMs();
  throwIfUploadAborted(options.signal);
  let bitmap: ImageBitmap | null = null;
  let knownWidth = 0;
  let knownHeight = 0;
  try {
    bitmap = await decodeBitmap(file);
    throwIfUploadAborted(options.signal);
    knownWidth = bitmap.width;
    knownHeight = bitmap.height;
    const planned = planImageFile({
      type: file.type,
      size: originalSize,
      width: knownWidth,
      height: knownHeight,
      profile,
    });
    if (planned.action === "reject") throw new ImagePreparationError(planned.message);
    if (planned.action === "passthrough") return unchangedImage(file, knownWidth, knownHeight);

    options.onPhase?.("optimizing");
    const limits = IMAGE_PROFILES[profile];
    const target = fittedLongSide(knownWidth, knownHeight, limits.maxLongSide);
    bitmap = await bitmapAtSize(bitmap, target.width, target.height);
    throwIfUploadAborted(options.signal);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0);
    const result = await encodeCanvas(canvas, file, profile, knownWidth, knownHeight);
    traceImageUpload("compress", {
      backend: "legacy",
      profile,
      worker: false,
      originalBytes: originalSize,
      optimizedBytes: result.optimizedSize,
      ratio: originalSize > 0 ? Math.round((result.optimizedSize / originalSize) * 1000) / 1000 : null,
      width: result.width,
      height: result.height,
      targetMissed: result.wasOptimized && result.optimizedSize > limits.maxBytes,
      durationMs: Math.round(nowMs() - started),
    });
    return result;
  } catch (error) {
    if (error instanceof ImageUploadCancelled || error instanceof ImagePreparationError) throw error;
    try {
      return await optimizeWithImageElement(file, profile, options.signal);
    } catch (fallbackError) {
      if (fallbackError instanceof ImageUploadCancelled || fallbackError instanceof ImagePreparationError) throw fallbackError;
      if (
        originalAllowedAfterOptimizationFailure({
          type: file.type,
          size: originalSize,
          width: knownWidth,
          height: knownHeight,
          profile,
        })
      ) {
        return unchangedImage(file, knownWidth, knownHeight);
      }
      console.warn("Legacy image preparation failed.");
      throw new ImagePreparationError(IMAGE_PREPARATION_FAILED_MESSAGE);
    }
  } finally {
    bitmap?.close();
  }
}
