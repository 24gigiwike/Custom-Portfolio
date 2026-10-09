/**
 * browser-image-compression backend.
 * The worker script is the package's UMD build, served from this origin.
 * Blob workers resolve script URLs against the blob origin, so libURL must be absolute.
 */
import imageCompression from "browser-image-compression";
import { ImageUploadCancelled } from "./imageAttempt";
import {
  COMPRESSION_MAX_ITERATIONS,
  IMAGE_PROFILES,
  outputMimeForUpload,
  settleCompressedOutput,
  throwIfUploadAborted,
  type ImagePreparePhase,
  type ImageUse,
  type OptimizedImageResult,
} from "./imageOptimizer";
import { nowMs, traceImageUpload } from "./imageUploadTrace";

export const IMAGE_COMPRESSION_WORKER_PATH = "/browser-image-compression.js";

export function imageCompressionWorkerSupported(): boolean {
  return typeof OffscreenCanvas === "function";
}

/** Absolute same-origin URL. Relative paths fail inside a blob worker. */
export function imageCompressionWorkerUrl(): string {
  if (typeof window === "undefined" || !window.location?.origin) return IMAGE_COMPRESSION_WORKER_PATH;
  return new URL(IMAGE_COMPRESSION_WORKER_PATH, window.location.origin).href;
}

let supportsWebPCache: boolean | null = null;
export function canvasSupportsWebP(): boolean {
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

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted || error instanceof ImageUploadCancelled) return true;
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "AbortError";
}

async function bitmapSize(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== "function") return { width: 0, height: 0 };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

export async function optimizeWithBrowserLibrary(
  file: File,
  profile: ImageUse,
  options: { signal?: AbortSignal; onPhase?: (phase: ImagePreparePhase) => void },
): Promise<OptimizedImageResult> {
  throwIfUploadAborted(options.signal);
  const limits = IMAGE_PROFILES[profile];
  const worker = imageCompressionWorkerSupported();
  options.onPhase?.("optimizing");
  const started = nowMs();
  let compressed: File;
  try {
    compressed = await imageCompression(file, {
      maxSizeMB: limits.maxBytes / (1024 * 1024),
      maxWidthOrHeight: limits.maxLongSide,
      initialQuality: limits.quality,
      useWebWorker: worker,
      libURL: imageCompressionWorkerUrl(),
      fileType: outputMimeForUpload(file.type, canvasSupportsWebP()),
      preserveExif: false,
      maxIteration: COMPRESSION_MAX_ITERATIONS,
      alwaysKeepResolution: true,
      signal: options.signal,
    });
  } catch (error) {
    if (isAbort(error, options.signal)) throw new ImageUploadCancelled();
    throw error;
  }
  throwIfUploadAborted(options.signal);

  let sourceWidth = 0;
  let sourceHeight = 0;
  if (compressed.size >= file.size) {
    const source = await bitmapSize(file);
    sourceWidth = source.width;
    sourceHeight = source.height;
  }
  throwIfUploadAborted(options.signal);
  const outputSize = await bitmapSize(compressed);
  const result = settleCompressedOutput({
    original: file,
    compressed,
    width: outputSize.width,
    height: outputSize.height,
    sourceWidth,
    sourceHeight,
    profile,
  });
  traceImageUpload("compress", {
    backend: "browser",
    profile,
    worker,
    workerFallback: !worker,
    originalBytes: file.size,
    optimizedBytes: result.optimizedSize,
    ratio: file.size > 0 ? Math.round((result.optimizedSize / file.size) * 1000) / 1000 : null,
    width: result.width,
    height: result.height,
    targetMissed: result.wasOptimized && result.optimizedSize > limits.maxBytes,
    durationMs: Math.round(nowMs() - started),
  });
  return result;
}
