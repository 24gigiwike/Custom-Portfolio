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
export async function optimizeImageForUpload(file: File): Promise<OptimizedImageResult> {
  const originalSize = file.size;
  const isGif = file.type === "image/gif";

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

  let loadedImg: HTMLImageElement | null = null;
  let objectUrlToRevoke: string | null = null;

  try {
    const { img, objectUrl } = await loadImageElement(file);
    loadedImg = img;
    objectUrlToRevoke = objectUrl;

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    // Check if optimization is necessary
    const isDimensionSmall = naturalWidth <= MAX_DIMENSION && naturalHeight <= MAX_DIMENSION;
    const isFileSmall = originalSize <= ALREADY_OPTIMIZED_THRESHOLD_BYTES;
    const isWebPAlready = file.type === "image/webp";

    if (isDimensionSmall && isFileSmall && isWebPAlready) {
      // Already optimized WebP with appropriate dimensions
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

    // Calculate adaptive target dimensions
    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;

    if (naturalWidth > MAX_DIMENSION || naturalHeight > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / naturalWidth, MAX_DIMENSION / naturalHeight);
      targetWidth = Math.max(1, Math.round(naturalWidth * scale));
      targetHeight = Math.max(1, Math.round(naturalHeight * scale));
    }

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("Unable to obtain 2D canvas context.");
    }

    // High quality bicubic smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Paint image onto canvas
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Target format selection (prefer WebP if supported, fallback to JPEG)
    const supportsWebP = checkWebPSupport();
    const targetMimeType = supportsWebP ? "image/webp" : "image/jpeg";
    const extension = supportsWebP ? ".webp" : ".jpg";

    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const newFileName = `${cleanBaseName}${extension}`;

    // Convert canvas to Blob
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        targetMimeType,
        COMPRESSION_QUALITY
      );
    });

    if (!blob) {
      throw new Error("Canvas toBlob failed.");
    }

    // Check if the optimized blob is actually smaller or if the resize makes it better
    // If blob is slightly larger than a tiny original file, but was resized, keep the optimized blob
    const optimizedFile = new File([blob], newFileName, {
      type: targetMimeType,
      lastModified: Date.now(),
    });

    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedFile.size,
      width: targetWidth,
      height: targetHeight,
      format: targetMimeType,
      wasOptimized: true,
    };
  } catch (err) {
    console.warn("Client-side image optimization fallback triggered:", err);
    // Safe fallback to original file so upload never fails
    return {
      file,
      originalSize,
      optimizedSize: originalSize,
      width: loadedImg?.naturalWidth || 0,
      height: loadedImg?.naturalHeight || 0,
      format: file.type,
      wasOptimized: false,
    };
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
