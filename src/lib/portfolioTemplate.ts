import { WDK_TEMPLATE_PREVIEW_PATH } from "../preview/templatePreviewPath";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";

export type PortfolioTemplateInfo = {
  id: string;
  name: string;
  previewPath: string | null;
};

const knownTemplates: PortfolioTemplateInfo[] = [
  {
    id: templateConfig.id,
    name: templateConfig.name,
    previewPath: WDK_TEMPLATE_PREVIEW_PATH,
  },
];

/**
 * Display details for the portfolio's selected template.
 * Unknown templates keep their id and do not borrow another template's preview.
 */
export function portfolioTemplateInfo(selectedTemplate: string): PortfolioTemplateInfo {
  const match = knownTemplates.find((template) => template.id === selectedTemplate);
  if (match) return match;
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
