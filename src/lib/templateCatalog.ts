import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1/types/portfolio";

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

/** A template id can be used to create a portfolio only when the catalog lists it as available. */
export function templateForCreation(templateId: string): CatalogTemplate | null {
  const template = findCatalogTemplate(templateId);
  if (!template || template.availability !== "available") return null;
  return template;
}
