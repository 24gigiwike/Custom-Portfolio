export const PORTFOLIO_REVIEW_PATH = "/portfolio/review";

export function isPortfolioReviewPath(path: string) {
  return path === PORTFOLIO_REVIEW_PATH;
}

/** Saved-portfolio preview inside Review. This is not a public URL. */
export function isFramedPortfolioReview(search: string) {
  return new URLSearchParams(search).get("review") === "frame";
}

export function reviewFramePath(previewPath: string) {
  const url = new URL(previewPath, "http://localhost");
  url.searchParams.set("review", "frame");
  return `${url.pathname}${url.search}`;
}
