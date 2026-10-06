import type { Template, TemplateRecommendationContext } from "../types/template";
import { listCatalogTemplates } from "./templateCatalog";

/**
 * Older recommendation shape. Discovery reads the template catalog directly.
 * This list stays derived from that catalog so it cannot advertise templates that are not registered.
 */
export function listTemplates(): Template[] {
  return listCatalogTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    categories: [],
    purposes: [],
    styles: [],
    preview: null,
    version: 1,
  }));
}

export function recommendTemplates(_context: TemplateRecommendationContext): Template[] {
  return listTemplates();
}
