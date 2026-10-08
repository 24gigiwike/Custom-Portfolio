import type { PortfolioDiscoverability } from "../types/discoverability";
import { templateSupportsDesignControl } from "./templateCatalog.js";
import type {
  PortfolioContact,
  PortfolioData,
  PortfolioProfile,
  PortfolioSEO,
  Project,
  SocialLink,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import { DEFAULT_PORTFOLIO_DESIGN, portfolioPaletteId, type PortfolioPaletteId } from "../types/portfolioDesign.js";

/** Presentation fields the template can render. Private CMS fields are not part of this. */
export type WdkPresentationSource = {
  profile: PortfolioProfile;
  socialLinks: SocialLink[];
  projects: Project[];
  contact: PortfolioContact;
  seo: PortfolioSEO;
  discoverability?: PortfolioDiscoverability;
};

/**
 * Presentation boundary. The template receives PortfolioData and nothing about Firebase.
 */
export function toWdkPremiumPortfolioData(portfolio: WdkPresentationSource): PortfolioData {
  return {
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
    discoverability: portfolio.discoverability,
  };
}

/**
 * Semantic accent for WDK. Unsupported templates and unknown ids use the original palette.
 */
export function wdkPaletteForPortfolio(
  portfolio: { selectedTemplate: string; design?: { palette?: unknown } | null }
): PortfolioPaletteId {
  if (!templateSupportsDesignControl(portfolio.selectedTemplate, "palette")) {
    return DEFAULT_PORTFOLIO_DESIGN.palette;
  }
  return portfolioPaletteId(portfolio.design?.palette);
}
