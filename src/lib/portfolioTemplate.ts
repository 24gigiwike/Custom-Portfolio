import { findCatalogTemplate } from "./templateCatalog";

export type PortfolioTemplateInfo = {
  id: string;
  name: string;
  previewPath: string | null;
};

/**
 * Display details for a portfolio's selected template.
 * Unknown ids keep their own name and do not borrow another template's preview.
 */
export function portfolioTemplateInfo(selectedTemplate: string): PortfolioTemplateInfo {
  const match = findCatalogTemplate(selectedTemplate);
  if (match) {
    return {
      id: match.id,
      name: match.name,
      previewPath: match.previewPath,
    };
  }
  return {
    id: selectedTemplate,
    name: selectedTemplate || "Template",
    previewPath: null,
  };
}

export function publishingStatusLabel(status: string): string {
  if (status === "draft") return "Draft";
  if (!status) return "Draft";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
