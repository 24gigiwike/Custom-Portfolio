import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { PortfolioPaletteId } from "../types/portfolioDesign";
import { PORTFOLIO_PALETTE_IDS } from "../types/portfolioDesign";

export type TemplateAvailability = "available";

/**
 * Content areas a template can present.
 * These name areas of UserPortfolio, not the user's saved values.
 */
export const CONTENT_AREAS = ["profile", "socialLinks", "projects", "contact", "seo"] as const;

export type ContentArea = (typeof CONTENT_AREAS)[number];

export type TemplateCapabilities = {
  readonly areas: readonly ContentArea[];
};

export const DESIGN_CONTROL_IDS = ["palette"] as const;

export type DesignControlId = (typeof DESIGN_CONTROL_IDS)[number];

export type DesignPaletteOption = {
  id: PortfolioPaletteId;
  label: string;
  description: string;
};

export type DesignControl = {
  id: "palette";
  label: string;
  description: string;
  options: readonly DesignPaletteOption[];
};

/**
 * Visual choices a template can safely interpret.
 * These describe controls, not the user's saved selection.
 */
export type TemplateDesignCapabilities = {
  readonly controls: readonly DesignControl[];
};

type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * WDK reads every PortfolioData area: profile and social links in the hero,
 * projects in the spotlight, contact in the form section, and seo in the document head.
 * profile.email and contact.email are on the data contract but are not displayed.
 */
const WDK_CONTENT_AREAS = [
  "profile",
  "socialLinks",
  "projects",
  "contact",
  "seo",
] as const satisfies readonly (keyof PortfolioData)[];

type _wdkAreasMatchPortfolioData = Assert<Same<(typeof WDK_CONTENT_AREAS)[number], keyof PortfolioData>>;

const WDK_PALETTE_OPTIONS = [
  { id: "original", label: "Original", description: "The accent this template already uses." },
  { id: "ocean", label: "Ocean", description: "A cool blue accent." },
  { id: "forest", label: "Forest", description: "A quiet green accent." },
  { id: "warm", label: "Warm", description: "A terracotta accent." },
] as const satisfies readonly DesignPaletteOption[];

type _wdkPalettesMatchDomain = Assert<Same<(typeof WDK_PALETTE_OPTIONS)[number]["id"], PortfolioPaletteId>>;
type _wdkPaletteCount = Assert<Same<(typeof WDK_PALETTE_OPTIONS)["length"], (typeof PORTFOLIO_PALETTE_IDS)["length"]>>;

/**
 * WDK can recolor its accent. Layout, type, spacing, and the paper background stay with the template.
 */
const WDK_DESIGN_CAPABILITIES = {
  controls: [
    {
      id: "palette",
      label: "Accent",
      description: "A curated color direction. The template decides where it appears.",
      options: WDK_PALETTE_OPTIONS,
    },
  ],
} as const satisfies TemplateDesignCapabilities;

const CONTENT_AREA_LABELS: Record<ContentArea, string> = {
  profile: "Profile",
  socialLinks: "Social links",
  projects: "Projects",
  contact: "Contact",
  seo: "Search and sharing",
};

/**
 * Product-level description of a template that can be discovered and selected.
 * This is not the template's presentation code and it does not talk to Firebase.
 */
export type CatalogTemplate = {
  id: string;
  name: string;
  version: string;
  description: string;
  fit: string;
  previewPath: string;
  availability: TemplateAvailability;
  capabilities: TemplateCapabilities;
  design: TemplateDesignCapabilities;
};

const catalog: CatalogTemplate[] = [
  {
    id: templateConfig.id,
    name: templateConfig.name,
    version: templateConfig.version,
    description: templateConfig.description,
    fit: "A personal portfolio for an independent designer or creative professional.",
    previewPath: WDK_TEMPLATE_PREVIEW_PATH,
    availability: "available",
    capabilities: { areas: WDK_CONTENT_AREAS },
    design: WDK_DESIGN_CAPABILITIES,
  },
];

export function listCatalogTemplates(): CatalogTemplate[] {
  return catalog.filter((template) => template.availability === "available");
}

export function findCatalogTemplate(id: string): CatalogTemplate | null {
  return catalog.find((template) => template.id === id) ?? null;
}

export function catalogTemplateForPreviewPath(path: string): CatalogTemplate | null {
  const pathname = path.split("?")[0].split("#")[0];
  return catalog.find((template) => template.previewPath === pathname) ?? null;
}

export function contentAreaLabel(area: ContentArea): string {
  return CONTENT_AREA_LABELS[area];
}

/**
 * Content areas the selected template can present.
 * An unknown id returns null and does not borrow another template's areas.
 */
export function templateContentAreas(selectedTemplate: string): readonly ContentArea[] | null {
  return findCatalogTemplate(selectedTemplate)?.capabilities.areas ?? null;
}

export function templateSupportsContentArea(selectedTemplate: string, area: ContentArea): boolean {
  return templateContentAreas(selectedTemplate)?.includes(area) ?? false;
}

/**
 * Design controls the selected template can interpret.
 * An unknown id returns null and does not borrow another template's controls.
 */
export function templateDesignCapabilities(selectedTemplate: string): TemplateDesignCapabilities | null {
  return findCatalogTemplate(selectedTemplate)?.design ?? null;
}

export function templateDesignControl(
  selectedTemplate: string,
  controlId: DesignControlId
): DesignControl | null {
  const capabilities = templateDesignCapabilities(selectedTemplate);
  if (!capabilities) return null;
  return capabilities.controls.find((control) => control.id === controlId) ?? null;
}

export function templateSupportsDesignControl(selectedTemplate: string, controlId: DesignControlId): boolean {
  return templateDesignControl(selectedTemplate, controlId) !== null;
}

/** A template id can be used to create a portfolio only when the catalog lists it as available. */
export function templateForCreation(templateId: string): CatalogTemplate | null {
  const template = findCatalogTemplate(templateId);
  if (!template || template.availability !== "available") return null;
  return template;
}
