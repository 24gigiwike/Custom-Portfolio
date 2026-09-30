const STORAGE_PREFIX = "portfolio-assets/";

export function isStoredImagePath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(STORAGE_PREFIX) && !value.includes("..");
}

export function readCoverImagePath(value: unknown): string | null {
  return isStoredImagePath(value) ? value : null;
}

export function alignImagePaths(images: string[], paths?: Array<string | null | undefined>): string[] {
  return images.map((_, index) => {
    const path = paths?.[index];
    return isStoredImagePath(path) ? path : "";
  });
}

export function normalizeImagesAndPaths(
  images: string[] | undefined,
  paths: Array<string | null | undefined> | undefined
): { images: string[]; imagePaths: string[] } {
  const source = Array.isArray(images) ? images : [];
  const normalizedImages: string[] = [];
  const normalizedPaths: string[] = [];

  source.forEach((image, index) => {
    if (!image) return;
    normalizedImages.push(image);
    const path = paths?.[index];
    normalizedPaths.push(isStoredImagePath(path) ? path : "");
  });

  return { images: normalizedImages, imagePaths: normalizedPaths };
}

export function collectStoredImagePaths(data: {
  coverImagePath?: string | null;
  imagePaths?: Array<string | null | undefined>;
}): string[] {
  const paths: string[] = [];
  if (isStoredImagePath(data.coverImagePath)) {
    paths.push(data.coverImagePath);
  }
  for (const path of data.imagePaths || []) {
    if (isStoredImagePath(path)) paths.push(path);
  }
  return paths;
}
