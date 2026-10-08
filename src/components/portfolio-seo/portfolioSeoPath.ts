export const PORTFOLIO_SEO_PATH = "/portfolio/seo";

export function isPortfolioSeoPath(path: string) {
  return path.split("?")[0].split("#")[0] === PORTFOLIO_SEO_PATH;
}
