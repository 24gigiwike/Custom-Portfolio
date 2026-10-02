import type { PortfolioData } from "../templates/wdk-premium-portfolio-1/types/portfolio";
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
