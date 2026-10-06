/**
 * Semantic design choices for one portfolio.
 * These are preset ids. They are not CSS.
 */
export const PORTFOLIO_PALETTE_IDS = ["original", "ocean", "forest", "warm"] as const;

export type PortfolioPaletteId = (typeof PORTFOLIO_PALETTE_IDS)[number];

export type PortfolioDesign = {
  palette: PortfolioPaletteId;
};

export const DEFAULT_PORTFOLIO_DESIGN: PortfolioDesign = { palette: "original" };

export function portfolioPaletteId(value: unknown): PortfolioPaletteId {
  if (typeof value === "string" && (PORTFOLIO_PALETTE_IDS as readonly string[]).includes(value)) {
    return value as PortfolioPaletteId;
  }
  return DEFAULT_PORTFOLIO_DESIGN.palette;
}

/** Missing or invalid stored design becomes the template default. */
export function normalizePortfolioDesign(value: unknown): PortfolioDesign {
  const record = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { palette: portfolioPaletteId(record.palette) };
}
