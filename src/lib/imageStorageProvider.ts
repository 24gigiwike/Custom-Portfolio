export type ImageStorageProviderName = "firebase" | "imagekit";

function configuredValue(): string {
  const value = import.meta.env?.VITE_IMAGE_STORAGE_PROVIDER;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Build-time preference. `firebase` is the default.
 * Existing portfolio and project uploads do not read this yet.
 */
export function configuredImageStorageProvider(): ImageStorageProviderName {
  return configuredValue() === "imagekit" ? "imagekit" : "firebase";
}

/**
 * Narrow opt-in for the account photo proof only.
 */
export function accountPhotoImageStorageProvider(): ImageStorageProviderName {
  return configuredImageStorageProvider();
}

/**
 * Provider actually used by portfolio image fields.
 * ImageKit stays off this path until a real upload has been proven and a later step switches it.
 */
export function activeImageStorageProvider(): ImageStorageProviderName {
  return "firebase";
}
