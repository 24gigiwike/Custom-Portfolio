import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";

export type TemplateAvailability = "available";

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

/** A template id can be used to create a portfolio only when the catalog lists it as available. */
export function templateForCreation(templateId: string): CatalogTemplate | null {
  const template = findCatalogTemplate(templateId);
  if (!template || template.availability !== "available") return null;
  return template;
}
