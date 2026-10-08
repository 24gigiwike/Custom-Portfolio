/** A blank address must not become a CSS request for the current page. */
export function cssImageUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed ? `url("${trimmed}")` : "none";
}
