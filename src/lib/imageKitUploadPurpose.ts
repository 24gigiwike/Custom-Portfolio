/**
 * Retired client purpose. The server upload does not accept a purpose field.
 * Portfolio fields are not included.
 */
export const IMAGEKIT_UPLOAD_PURPOSE = "poc" as const;

export type ImageKitUploadPurpose = typeof IMAGEKIT_UPLOAD_PURPOSE;
