import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import { wdkPaletteColors } from "../templates/wdk-premium-portfolio-1/design/palettes";
import { templateDesignControl } from "./templateCatalog";
import { portfolioPaletteId } from "../types/portfolioDesign";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";

/**
 * Replace only the semantic palette. Every other portfolio field is copied through.
 * A template that does not offer the palette keeps the stored choice unchanged.
 */
export function contentWithDesign(portfolio: UserPortfolio, palette: string): UserPortfolioContent {
  const control = templateDesignControl(portfolio.selectedTemplate, "palette");
  const allowed = control?.options.some((option) => option.id === palette) ?? false;
  return {
    selectedTemplate: portfolio.selectedTemplate,
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
    design: { palette: allowed ? portfolioPaletteId(palette) : portfolio.design.palette },
    publishing: portfolio.publishing,
  };
}

/**
 * Small color samples for a supported palette option.
 * Unknown templates and unsupported ids return null.
 */
export function designOptionSwatches(selectedTemplate: string, optionId: string): readonly string[] | null {
  const control = templateDesignControl(selectedTemplate, "palette");
  if (!control?.options.some((option) => option.id === optionId)) return null;
  if (selectedTemplate !== templateConfig.id) return null;
  const colors = wdkPaletteColors(optionId);
  return [colors.soft, colors.accent, colors.deep];
}
