/**
 * Private display slug. This is not the public address and it is not reserved.
 * The same transformation is used by the browser and the portfolio-create server.
 */
export function generateSlug(title: string, now = Date.now()): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `portfolio-${now.toString(36)}`;
}
