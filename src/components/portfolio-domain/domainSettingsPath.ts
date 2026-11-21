export const PORTFOLIO_DOMAIN_PATH = "/portfolio/domain";

export function isPortfolioDomainPath(path: string) {
  return path.split("?")[0].split("#")[0] === PORTFOLIO_DOMAIN_PATH;
}
