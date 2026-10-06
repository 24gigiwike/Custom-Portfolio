import { templateSupportsDesignControl } from "./templateCatalog";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1/types/portfolio";
import { DEFAULT_PORTFOLIO_DESIGN, portfolioPaletteId, type PortfolioPaletteId } from "../types/portfolioDesign";
import type { UserPortfolio } from "../types/userPortfolio";

/**
 * Presentation boundary. The template receives PortfolioData and nothing about Firebase.
 */
export function toWdkPremiumPortfolioData(portfolio: UserPortfolio): PortfolioData {
  return {
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
  };
}

/**
 * Semantic accent for WDK. Unsupported templates and unknown ids use the original palette.
 */
export function wdkPaletteForPortfolio(
  portfolio: Pick<UserPortfolio, "selectedTemplate"> & { design?: { palette?: unknown } | null }
): PortfolioPaletteId {
  if (!templateSupportsDesignControl(portfolio.selectedTemplate, "palette")) {
    return DEFAULT_PORTFOLIO_DESIGN.palette;
  }
  return portfolioPaletteId(portfolio.design?.palette);
}
