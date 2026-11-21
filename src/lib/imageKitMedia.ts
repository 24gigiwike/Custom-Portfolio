/**
 * Fixed media categories the browser may name.
 * The server builds the folder. A client folder or owner id is never accepted.
 */

export const IMAGEKIT_MEDIA_CATEGORIES = [
  "account",
  "portrait",
  "logo",
  "social",
  "project-cover",
  "project-gallery",
] as const;

export type ImageKitMediaCategory = (typeof IMAGEKIT_MEDIA_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(IMAGEKIT_MEDIA_CATEGORIES);
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const IMAGEKIT_FILE_TOKEN_PREFIX = "imagekit:";

export function isImageKitMediaCategory(value: string): value is ImageKitMediaCategory {
  return CATEGORY_SET.has(value);
}

export function imageKitFileToken(fileId: string): string | null {
  return FILE_ID_PATTERN.test(fileId) ? `${IMAGEKIT_FILE_TOKEN_PREFIX}${fileId}` : null;
}

export function imageKitFileIdFromToken(value: string): string | null {
  if (!value.startsWith(IMAGEKIT_FILE_TOKEN_PREFIX)) return null;
  const fileId = value.slice(IMAGEKIT_FILE_TOKEN_PREFIX.length);
  return FILE_ID_PATTERN.test(fileId) ? fileId : null;
}

/** Delivery URLs already stored on portfolios. Hosts other than ImageKit stay external links. */
export function isImageKitDeliveryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return url.hostname === "ik.imagekit.io" || url.pathname.includes("/custom-portfolio/");
  } catch {
    return false;
  }
}

/**
 * Upload mode for a saved image value.
 * Empty, Firebase, and ImageKit values stay on the upload control.
 * Any other address stays on the link control.
 */
export function imageValueUsesUploadMode(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("https://firebasestorage.googleapis.com")) return true;
  if (value.includes("/portfolio-assets/")) return true;
  return isImageKitDeliveryUrl(value);
}
