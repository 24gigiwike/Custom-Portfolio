const PUBLIC_ID = /^\/p\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/?$/;

export function publicPortfolioPath(publicId: string): string {
  return `/p/${publicId}`;
}

/** Portfolio id from a public pathname. Query and hash are ignored. */
export function publicPortfolioIdFromPath(path: string): string | null {
  const pathname = path.split("?")[0].split("#")[0];
  const match = PUBLIC_ID.exec(pathname);
  return match ? match[1] : null;
}

export function isPublicPortfolioPath(path: string): boolean {
  return publicPortfolioIdFromPath(path) !== null;
}

/**
 * Absolute public URL for the current site.
 * Pass origin in tests and non-browser callers. Production is not hardcoded.
 */
export function publicPortfolioUrl(publicId: string, origin?: string): string {
  const base = (origin ?? window.location.origin).replace(/\/$/, "");
  return `${base}${publicPortfolioPath(publicId)}`;
}
