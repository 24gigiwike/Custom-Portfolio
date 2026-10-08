/**
 * Client-Side Adaptive Image Optimization for Custom Portfolio
 *
 * Automatically inspects, resizes, and compresses images before upload
 * preserving high visual quality for editorial portfolio display while
 * drastically reducing upload time and bandwidth.
 */

export interface OptimizedImageResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  format: string;
  wasOptimized: boolean;
}

const MAX_DIMENSION = 2048;
const MAX_PROCESSABLE_BYTES = 30 * 1024 * 1024;

/** GIFs are not re-encoded, so the animation stays intact. Larger GIFs are refused. */
export const GIF_MAX_BYTES = 2 * 1024 * 1024;

export const GIF_TOO_LARGE_MESSAGE =
  "GIFs keep their animation and are not resized. Please choose a GIF under 2 MB.";

export const IMAGE_PREPARATION_FAILED_MESSAGE =
  "This image couldn't be prepared. Please choose a smaller JPG, PNG, or WEBP.";

export class ImagePreparationError extends Error {
  readonly name = "ImagePreparationError";

  constructor(message: string) {
    super(message);
  }
}

export type ImageUse = "portrait" | "logo" | "social" | "project";

export type ImageProfile = {
  maxLongSide: number;
  quality: number;
  /** Within the long-side limit and at or below this size: upload the file unchanged. */
  passThroughMaxBytes: number;
  /** If encoding fails, an original within the long-side limit and this size may still upload. */
  safeOriginalMaxBytes: number;
};

/**
 * Portrait stays large because the same file is the hero and the small avatar.
 * Logo and social images are not shown that large, so their caps are lower.
 * Nothing is upscaled.
 */
export const IMAGE_PROFILES: Record<ImageUse, ImageProfile> = {
  portrait: { maxLongSide: 2048, quality: 0.84, passThroughMaxBytes: 500 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
  logo: { maxLongSide: 800, quality: 0.9, passThroughMaxBytes: 250 * 1024, safeOriginalMaxBytes: 1024 * 1024 },
  social: { maxLongSide: 1600, quality: 0.86, passThroughMaxBytes: 450 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
  project: { maxLongSide: 2048, quality: 0.84, passThroughMaxBytes: 350 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
};

export type ImagePlan =
  | { action: "passthrough"; reason: "gif" | "already-efficient" }
  | { action: "optimize" }
  | { action: "reject"; message: string };

export type ImagePreparePhase = "preparing" | "optimizing";

const RASTER_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function fittedLongSide(
  width: number,
  height: number,
  maxSide = MAX_DIMENSION
): { width: number; height: number; resized: boolean } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0, resized: false };
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height, resized: false };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

export function planImageFile(input: {
  type: string;
  size: number;
  width: number;
  height: number;
  profile?: ImageUse;
}): ImagePlan {
  const type = input.type.toLowerCase();
  const limits = IMAGE_PROFILES[input.profile ?? "project"];
  if (type === "image/gif") {
    if (input.size <= GIF_MAX_BYTES) return { action: "passthrough", reason: "gif" };
    return { action: "reject", message: GIF_TOO_LARGE_MESSAGE };
  }
  if (type === "image/svg+xml") return { action: "reject", message: IMAGE_PREPARATION_FAILED_MESSAGE };
  if (input.size > MAX_PROCESSABLE_BYTES) return { action: "reject", message: IMAGE_PREPARATION_FAILED_MESSAGE };
  const knownSize = input.width > 0 && input.height > 0;
  if (
    knownSize &&
    RASTER_TYPES.has(type) &&
    input.width <= limits.maxLongSide &&
    input.height <= limits.maxLongSide &&
    input.size <= limits.passThroughMaxBytes
  ) {
    return { action: "passthrough", reason: "already-efficient" };
  }
  return { action: "optimize" };
}

/** Small raster files that already fit the profile limit can upload as-is. */
export function canUploadOriginal(input: {
  type: string;
  size: number;
  width: number;
  height: number;
  profile?: ImageUse;
}): boolean {
  const plan = planImageFile(input);
  return plan.action === "passthrough" && plan.reason === "already-efficient";
}

/** WebP keeps transparency. Without WebP, a transparent image stays PNG instead of becoming JPEG. */
export function encodedMimeType(input: { hasAlpha: boolean; supportsWebP: boolean }): "image/webp" | "image/png" | "image/jpeg" {
  if (input.supportsWebP) return "image/webp";
  if (input.hasAlpha) return "image/png";
  return "image/jpeg";
}

export function imageHasTransparency(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true;
  }
  return false;
}

export function originalAllowedAfterOptimizationFailure(input: {
  type: string;
  size: number;
  width: number;
  height: number;
  profile?: ImageUse;
}): boolean {
  const limits = IMAGE_PROFILES[input.profile ?? "project"];
  const type = input.type.toLowerCase();
  if (type === "image/gif") return input.size <= GIF_MAX_BYTES && input.size <= limits.safeOriginalMaxBytes;
  if (!RASTER_TYPES.has(type) || input.size > limits.safeOriginalMaxBytes) return false;
  if (input.width <= 0 || input.height <= 0) return input.size <= limits.passThroughMaxBytes;
  return input.width <= limits.maxLongSide && input.height <= limits.maxLongSide;
}

/** Keep an already-small original when re-encoding would make it larger. Oversized originals are still resized. */
export function shouldKeepOriginal(input: {
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  profile?: ImageUse;
}): boolean {
  const limits = IMAGE_PROFILES[input.profile ?? "project"];
  return (
    input.optimizedSize >= input.originalSize &&
    input.width > 0 &&
    input.height > 0 &&
    input.width <= limits.maxLongSide &&
    input.height <= limits.maxLongSide &&
    input.originalSize <= limits.safeOriginalMaxBytes
  );
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * Check if the browser supports WebP canvas export
 */
let supportsWebPCache: boolean | null = null;
function checkWebPSupport(): boolean {
  if (supportsWebPCache !== null) return supportsWebPCache;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL("image/webp");
    supportsWebPCache = dataUrl.indexOf("image/webp") === 5;
  } catch {
    supportsWebPCache = false;
  }
  return supportsWebPCache;
}

/**
 * Safely load an image File into an HTMLImageElement using Object URL
 */
function loadImageElement(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    // Modern browsers use natural orientation according to EXIF data
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image file."));
    };
    img.src = objectUrl;
  });
}

/**
 * Adaptively optimize an image File before uploading to Firebase Storage.
 *
 * Rules:
 * 1. Uses the field profile for the long-side cap and the pass-through size.
 * 2. Leaves an already-small file unchanged and never upscales.
 * 3. Keeps GIF animation by skipping re-encoding, and refuses GIFs over 2 MB.
 * 4. If preparation fails, uploads the original only when it is already within the profile limits.
 */
async function decodeBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("ImageBitmap decoding is unavailable.");
  }
  return createImageBitmap(file);
}

async function bitmapAtSize(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  if (source.width === width && source.height === height) return source;
  try {
    const resized = await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    source.close();
    return resized;
  } catch {
    return source;
  }
}

function unchangedImage(file: File, width: number, height: number): OptimizedImageResult {
  return {
    file,
    originalSize: file.size,
    optimizedSize: file.size,
    width,
    height,
    format: file.type,
    wasOptimized: false,
  };
}

function encodeCanvas(canvas: HTMLCanvasElement, file: File, profile: ImageUse, sourceWidth: number, sourceHeight: number): Promise<OptimizedImageResult> {
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
      if (
        shouldKeepOriginal({
          originalSize: file.size,
          optimizedSize: optimizedFile.size,
          width: sourceWidth,
          height: sourceHeight,
          profile,
        })
      ) {
        resolve(unchangedImage(file, sourceWidth, sourceHeight));
        return;
      }
      resolve({
        file: optimizedFile,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        width: canvas.width,
        height: canvas.height,
        format: targetMimeType,
        wasOptimized: true,
      });
    }, targetMimeType, limits.quality);
  });
}

export async function optimizeImageForUpload(
  file: File,
  onPhase?: (phase: ImagePreparePhase) => void,
  profile: ImageUse = "project",
): Promise<OptimizedImageResult> {
  const originalSize = file.size;
  onPhase?.("preparing");
  await yieldToPaint();

  const early = planImageFile({ type: file.type, size: originalSize, width: 0, height: 0, profile });
  if (early.action === "reject") throw new ImagePreparationError(early.message);
  if (early.action === "passthrough") return unchangedImage(file, 0, 0);

  let bitmap: ImageBitmap | null = null;
  let knownWidth = 0;
  let knownHeight = 0;

  try {
    bitmap = await decodeBitmap(file);
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

    onPhase?.("optimizing");
    await yieldToPaint();

    const limits = IMAGE_PROFILES[profile];
    const target = fittedLongSide(knownWidth, knownHeight, limits.maxLongSide);
    bitmap = await bitmapAtSize(bitmap, target.width, target.height);

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0);
    return await encodeCanvas(canvas, file, profile, knownWidth, knownHeight);
  } catch (err) {
    if (err instanceof ImagePreparationError) throw err;
    try {
      return await optimizeWithImageElement(file, profile);
    } catch (fallbackError) {
      if (fallbackError instanceof ImagePreparationError) throw fallbackError;
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
      console.warn("Client-side image optimization failed:", err, fallbackError);
      throw new ImagePreparationError(IMAGE_PREPARATION_FAILED_MESSAGE);
    }
  } finally {
    bitmap?.close();
  }
}

async function optimizeWithImageElement(file: File, profile: ImageUse): Promise<OptimizedImageResult> {
  const { img, objectUrl } = await loadImageElement(file);
  try {
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
    return await encodeCanvas(canvas, file, profile, naturalWidth, naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
