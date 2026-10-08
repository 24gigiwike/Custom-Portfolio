import { canonicalPortfolioUrl } from "./portfolioSeo";
import { isPortfolioPublished } from "./portfolioPublishing";
import { portfolioTemplateInfo, publishingStatusLabel } from "./portfolioTemplate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WorkspaceOverview = {
  name: string;
  templateName: string;
  statusLabel: string;
  publicUrl: string | null;
  publiclyAccessible: boolean;
  updatedLabel: string | null;
};

/**
 * A saved time is shown only when it can be read as a real date.
 * An empty or unreadable value stays hidden.
 */
export function portfolioUpdatedLabel(value: unknown): string | null {
  const date = updatedDate(value);
  if (!date) return null;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${date.getHours()}:${minutes}`;
}

export function workspaceOverview(portfolio: {
  id: string;
  selectedTemplate: string;
  publicSlug: string;
  updatedAt: unknown;
  publishing: { status: string };
  profile: { brandName: string };
}): WorkspaceOverview {
  return {
    name: portfolio.profile.brandName.trim() || "Untitled portfolio",
    templateName: portfolioTemplateInfo(portfolio.selectedTemplate).name,
    statusLabel: publishingStatusLabel(portfolio.publishing.status),
    publicUrl: canonicalPortfolioUrl(portfolio.id, portfolio.publicSlug),
    publiclyAccessible: isPortfolioPublished(portfolio.publishing),
    updatedLabel: portfolioUpdatedLabel(portfolio.updatedAt),
  };
}

function updatedDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const parsed = value.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if ("seconds" in value && typeof value.seconds === "number") {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}
