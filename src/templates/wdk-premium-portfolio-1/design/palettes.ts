import type { CSSProperties } from "react";
import { portfolioPaletteId, type PortfolioPaletteId } from "../../../types/portfolioDesign";

/**
 * WDK's interpretation of a semantic palette.
 * `original` is the approved template appearance.
 */
export type WdkPaletteColors = {
  accent: string;
  deep: string;
  soft: string;
  mid: string;
  bright: string;
};

export const WDK_PALETTE_COLORS: Record<PortfolioPaletteId, WdkPaletteColors> = {
  original: {
    accent: "#e4afeb",
    deep: "#e09ae9",
    soft: "#e8c9fc",
    mid: "#e4cce7",
    bright: "#f7d7fe",
  },
  ocean: {
    accent: "#b7dbe4",
    deep: "#1d6a80",
    soft: "#d5eef3",
    mid: "#b7d4de",
    bright: "#c5e4ea",
  },
  forest: {
    accent: "#b7d4c4",
    deep: "#1f6b45",
    soft: "#d7efe2",
    mid: "#c5e0d2",
    bright: "#e4f3ea",
  },
  warm: {
    accent: "#f0c7a8",
    deep: "#9a4e24",
    soft: "#f6d7c4",
    mid: "#f0c7a8",
    bright: "#f8e3d4",
  },
};

export function wdkPaletteColors(palette: unknown): WdkPaletteColors {
  return WDK_PALETTE_COLORS[portfolioPaletteId(palette)];
}

/** CSS variables for the accent only. Unknown ids resolve to the original palette. */
export function wdkPaletteVariables(palette: unknown): CSSProperties {
  const colors = wdkPaletteColors(palette);
  return {
    "--wdk-accent": colors.accent,
    "--wdk-accent-deep": colors.deep,
    "--wdk-accent-soft": colors.soft,
    "--wdk-accent-mid": colors.mid,
    "--wdk-accent-bright": colors.bright,
  };
}
