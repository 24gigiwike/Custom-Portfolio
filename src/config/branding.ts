/**
 * Custom Portfolio by BroadBrand
 * Central brand & design configuration
 */

export const brand = {
  name: "Custom Portfolio",
  family: "Custom",
  endorsement: "by BroadBrand",
  tagline: "Your work deserves a place of its own.",
  
  /**
   * Dedicated logo URL for splash screens and page transitions
   * Provided by BroadBrand asset CDN
   */
  splashLogoUrl: "https://res.cloudinary.com/dtkluxukm/image/upload/v1787401285/BD_BD_4_gttxlf.png",
  
  /**
   * Custom brand core color palette
   */
  colors: {
    slate: "#708595",
    mineral: "#689AA1",
    sage: "#6DAEAD",
    stone: "#849693",
    mint: "#94CEBB",
  },
} as const;

export type BrandConfig = typeof brand;
