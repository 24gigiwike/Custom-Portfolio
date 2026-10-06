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

const MAX_DIMENSION = 2048; // Maximum width or height on longest side for high-DPI displays
const COMPRESSION_QUALITY = 0.84; // Quality factor (0.80 - 0.85 delivers artifact-free retina clarity)
const ALREADY_OPTIMIZED_THRESHOLD_BYTES = 350 * 1024; // 350KB

export type ImagePreparePhase = "preparing" | "optimizing";

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

/** Small raster files that already fit the long-side limit can upload as-is. */
export function canUploadOriginal(input: { type: string; size: number; width: number; height: number }): boolean {
  const raster =
    input.type === "image/jpeg" ||
    input.type === "image/jpg" ||
    input.type === "image/png" ||
    input.type === "image/webp";
  return (
    raster &&
    input.size <= ALREADY_OPTIMIZED_THRESHOLD_BYTES &&
    input.width > 0 &&
    input.height > 0 &&
    input.width <= MAX_DIMENSION &&
    input.height <= MAX_DIMENSION
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
 * 1. Inspects natural dimensions and original file size.
 * 2. If already small (<350KB) and dimensions <= 2048px, leaves file as-is.
 * 3. Otherwise scales down keeping aspect ratio, paints to Canvas, and exports WebP/JPEG.
 * 4. Gracefully falls back to the original file if canvas processing encounters any error.
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

export async function optimizeImageForUpload(
  file: File,
  onPhase?: (phase: ImagePreparePhase) => void
): Promise<OptimizedImageResult> {
  const originalSize = file.size;
  const isGif = file.type === "image/gif";

  onPhase?.("preparing");
  await yieldToPaint();

  // If it is a GIF (which might be animated) or SVG, do not re-encode via canvas
  if (isGif || file.type === "image/svg+xml") {
    return {
      file,
      originalSize,
      optimizedSize: originalSize,
      width: 0,
      height: 0,
      format: file.type,
      wasOptimized: false,
    };
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await decodeBitmap(file);
    const naturalWidth = bitmap.width;
    const naturalHeight = bitmap.height;

    if (canUploadOriginal({ type: file.type, size: originalSize, width: naturalWidth, height: naturalHeight })) {
      bitmap.close();
      bitmap = null;
      return {
        file,
        originalSize,
        optimizedSize: originalSize,
        width: naturalWidth,
        height: naturalHeight,
        format: file.type,
        wasOptimized: false,
      };
    }

    onPhase?.("optimizing");
    await yieldToPaint();

    const target = fittedLongSide(naturalWidth, naturalHeight);
    bitmap = await bitmapAtSize(bitmap, target.width, target.height);

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    bitmap = null;

    const supportsWebP = checkWebPSupport();
    const targetMimeType = supportsWebP ? "image/webp" : "image/jpeg";
    const extension = supportsWebP ? ".webp" : ".jpg";
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const newFileName = `${cleanBaseName}${extension}`;

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), targetMimeType, COMPRESSION_QUALITY);
    });
    if (!blob) throw new Error("Canvas toBlob failed.");

    const optimizedFile = new File([blob], newFileName, {
      type: targetMimeType,
      lastModified: Date.now(),
    });

    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedFile.size,
      width: canvas.width,
      height: canvas.height,
      format: targetMimeType,
      wasOptimized: true,
    };
  } catch (err) {
    bitmap?.close();
    try {
      return await optimizeWithImageElement(file);
    } catch (fallbackError) {
      console.warn("Client-side image optimization fallback triggered:", err, fallbackError);
      return {
        file,
        originalSize,
        optimizedSize: originalSize,
        width: 0,
        height: 0,
        format: file.type,
        wasOptimized: false,
      };
    }
  }
}

async function optimizeWithImageElement(file: File): Promise<OptimizedImageResult> {
  const originalSize = file.size;
  const { img, objectUrl } = await loadImageElement(file);
  try {
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const target = fittedLongSide(naturalWidth, naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = target.width || naturalWidth;
    canvas.height = target.height || naturalHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Unable to obtain 2D canvas context.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const supportsWebP = checkWebPSupport();
    const targetMimeType = supportsWebP ? "image/webp" : "image/jpeg";
    const extension = supportsWebP ? ".webp" : ".jpg";
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const newFileName = `${baseName.replace(/[^a-zA-Z0-9_-]/g, "_")}${extension}`;
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), targetMimeType, COMPRESSION_QUALITY);
    });
    if (!blob) throw new Error("Canvas toBlob failed.");
    const optimizedFile = new File([blob], newFileName, { type: targetMimeType, lastModified: Date.now() });
    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedFile.size,
      width: canvas.width,
      height: canvas.height,
      format: targetMimeType,
      wasOptimized: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
