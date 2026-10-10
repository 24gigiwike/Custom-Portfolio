/** The only upload purpose this step will authorize. Portfolio fields are not included. */
export const IMAGEKIT_UPLOAD_PURPOSE = "poc" as const;

export type ImageKitUploadPurpose = typeof IMAGEKIT_UPLOAD_PURPOSE;
