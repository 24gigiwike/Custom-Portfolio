/**
 * Client-Side Adaptive Image Optimization for Custom Portfolio
 *
 * Automatically inspects, resizes, and compresses images before upload
 * preserving high visual quality for editorial portfolio display while
 * drastically reducing upload time and bandwidth.
 *
 * One backend runs per upload. `browser` is the default. `legacy` is the canvas rollback.
 */
import { ImageUploadCancelled } from "./imageAttempt";
import { traceImageUpload } from "./imageUploadTrace";

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

export type ImageUse = "portrait" | "logo" | "social" | "project" | "account";

export type ImageProfile = {
  maxLongSide: number;
  quality: number;
  /** Preferred output size. The browser backend tries to land at or below this. */
  maxBytes: number;
  /** Within the long-side limit and at or below this size: upload the file unchanged. */
  passThroughMaxBytes: number;
  /**
   * Largest file that may still upload when the size target is missed or encoding fails,
   * and only when the image is already within the long-side limit.
   */
  safeOriginalMaxBytes: number;
};

/**
 * Portrait stays large because the same file is the hero and the small avatar.
 * Logo and social images are not shown that large, so their caps are lower.
 * Nothing is upscaled.
 */
export const IMAGE_PROFILES: Record<ImageUse, ImageProfile> = {
  portrait: { maxLongSide: 2048, quality: 0.84, maxBytes: 800 * 1024, passThroughMaxBytes: 500 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
  logo: { maxLongSide: 800, quality: 0.9, maxBytes: 350 * 1024, passThroughMaxBytes: 250 * 1024, safeOriginalMaxBytes: 1024 * 1024 },
  social: { maxLongSide: 1600, quality: 0.86, maxBytes: 600 * 1024, passThroughMaxBytes: 450 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
  project: { maxLongSide: 2048, quality: 0.84, maxBytes: 800 * 1024, passThroughMaxBytes: 350 * 1024, safeOriginalMaxBytes: 2 * 1024 * 1024 },
  /** Account photos are avatars, so they stay smaller than a portfolio hero. */
  account: { maxLongSide: 1024, quality: 0.85, maxBytes: 350 * 1024, passThroughMaxBytes: 350 * 1024, safeOriginalMaxBytes: 1024 * 1024 },
};

/** Quality steps inside one compressor. The library multiplies quality by about 0.95 each step. */
export const COMPRESSION_MAX_ITERATIONS = 6;

export type ImageCompressionBackend = "browser" | "legacy";

/**
 * `browser` is the default. Set VITE_IMAGE_COMPRESSION_BACKEND=legacy and redeploy to roll back.
 * Vite reads the variable at build time.
 */
export function imageCompressionBackend(): ImageCompressionBackend {
  const value = (import.meta as { env?: { VITE_IMAGE_COMPRESSION_BACKEND?: string } }).env?.VITE_IMAGE_COMPRESSION_BACKEND;
  return value === "legacy" ? "legacy" : "browser";
}

/** The library treats maxSizeMB as 1024×1024 bytes. */
export function bytesToMaxSizeMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/** WebP keeps transparency. Without WebP, PNG and WebP sources stay PNG instead of becoming JPEG. */
export function outputMimeForUpload(fileType: string, supportsWebP: boolean): "image/webp" | "image/png" | "image/jpeg" {
  if (supportsWebP) return "image/webp";
  const type = fileType.toLowerCase();
  if (type === "image/png" || type === "image/webp") return "image/png";
  return "image/jpeg";
}

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

export type OptimizeImageOptions = {
  signal?: AbortSignal;
};

export function unchangedImage(file: File, width: number, height: number): OptimizedImageResult {
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

export function throwIfUploadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImageUploadCancelled();
}

/**
 * Accept a compressed file from the one backend that ran.
 * A result over the preferred size can still upload when it is within the hard ceiling.
 * A result over that ceiling is refused. The original is kept only when it is already safe
 * and re-encoding made it larger.
 */
export function settleCompressedOutput(input: {
  original: File;
  compressed: File;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  profile: ImageUse;
}): OptimizedImageResult {
  const limits = IMAGE_PROFILES[input.profile];
  if (
    shouldKeepOriginal({
      originalSize: input.original.size,
      optimizedSize: input.compressed.size,
      width: input.sourceWidth,
      height: input.sourceHeight,
      profile: input.profile,
    })
  ) {
    return unchangedImage(input.original, input.sourceWidth, input.sourceHeight);
  }
  if (input.compressed.size > limits.safeOriginalMaxBytes && input.compressed.size > limits.maxBytes) {
    throw new ImagePreparationError(IMAGE_PREPARATION_FAILED_MESSAGE);
  }
  return {
    file: input.compressed,
    originalSize: input.original.size,
    optimizedSize: input.compressed.size,
    width: input.width,
    height: input.height,
    format: input.compressed.type || input.original.type,
    wasOptimized: true,
  };
}

export type ImageOptimizerRunner = (
  file: File,
  profile: ImageUse,
  options: { signal?: AbortSignal; onPhase?: (phase: ImagePreparePhase) => void },
) => Promise<OptimizedImageResult>;

/**
 * Prepare one image for upload.
 * GIF animation is preserved by skipping the compressor. Small files that already fit are not re-encoded.
 * The selected backend is the only compressor that runs.
 */
export async function optimizeImageForUpload(
  file: File,
  onPhase?: (phase: ImagePreparePhase) => void,
  profile: ImageUse = "project",
  options?: OptimizeImageOptions,
): Promise<OptimizedImageResult> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  onPhase?.("preparing");
  await yieldToPaint();
  throwIfUploadAborted(options?.signal);

  const early = planImageFile({ type: file.type, size: file.size, width: 0, height: 0, profile });
  if (early.action === "reject") throw new ImagePreparationError(early.message);
  if (early.action === "passthrough") {
    traceImageUpload("compress", {
      backend: imageCompressionBackend(),
      profile,
      skipped: true,
      originalBytes: file.size,
      optimizedBytes: file.size,
      durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started),
    });
    return unchangedImage(file, 0, 0);
  }

  const backend = imageCompressionBackend();
  try {
    const runner: ImageOptimizerRunner = backend === "legacy"
      ? (await import("./imageOptimizerLegacy")).optimizeWithLegacyCanvas
      : (await import("./imageOptimizerBrowser")).optimizeWithBrowserLibrary;
    throwIfUploadAborted(options?.signal);
    return await runner(file, profile, { signal: options?.signal, onPhase });
  } catch (error) {
    if (error instanceof ImageUploadCancelled || error instanceof ImagePreparationError) throw error;
    if (
      originalAllowedAfterOptimizationFailure({
        type: file.type,
        size: file.size,
        width: 0,
        height: 0,
        profile,
      })
    ) {
      return unchangedImage(file, 0, 0);
    }
    console.warn("Client-side image optimization failed.");
    throw new ImagePreparationError(IMAGE_PREPARATION_FAILED_MESSAGE);
  }
}
