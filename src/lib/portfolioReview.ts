import type { PortfolioPaletteId } from "../types/portfolioDesign";
import type { UserPortfolio } from "../types/userPortfolio";
import { templateContentAreas, templateSupportsDesignControl } from "./templateCatalog";
import { portfolioTemplateInfo } from "./portfolioTemplate";
import { resolvePortfolioSeo, resolvedToPortfolioSeo, siteEnvironmentFromHost } from "./portfolioSeo";
import { toWdkPremiumPortfolioData, wdkPaletteForPortfolio } from "./wdkPortfolioAdapter";
import type { PortfolioData } from "../templates/wdk-premium-portfolio-1/types/portfolio";

export const WDK_TEMPLATE_ID = "wdk-premium-portfolio-1";

export type ReviewViewport = "desktop" | "mobile";

export const DEFAULT_REVIEW_VIEWPORT: ReviewViewport = "desktop";

export function reviewViewport(current: ReviewViewport, next: ReviewViewport): ReviewViewport {
  void current;
  return next === "mobile" ? "mobile" : "desktop";
}

export type ReviewItem = {
  id: string;
  label: string;
  detail: string;
  status: "complete" | "attention";
  importance: "important" | "optional";
  action: "edit" | "design";
};

export type ReviewAssessment = {
  title: "Ready for publishing" | "A few things to check";
  summary: string;
  items: ReviewItem[];
  palette: PortfolioPaletteId | null;
};

export type ReviewEntry =
  | { kind: "missing" }
  | { kind: "choose-template" }
  | { kind: "unsupported" }
  | { kind: "review"; assessment: ReviewAssessment; previewPath: string | null };

function filled(value: string): boolean {
  return value.trim().length > 0;
}

function item(
  id: string,
  label: string,
  ready: boolean,
  importance: ReviewItem["importance"],
  readyDetail: string,
  attentionDetail: string
): ReviewItem {
  return {
    id,
    label,
    detail: ready ? readyDetail : attentionDetail,
    status: ready ? "complete" : "attention",
    importance,
    action: "edit",
  };
}

/**
 * Readiness for the selected template's visible presentation.
 * Capability support does not make every field required.
 * An unknown template does not borrow WDK's rules.
 */
export function reviewAssessment(portfolio: UserPortfolio): ReviewAssessment | null {
  if (portfolio.selectedTemplate !== WDK_TEMPLATE_ID) return null;
  const areas = templateContentAreas(portfolio.selectedTemplate);
  if (!areas) return null;

  const items: ReviewItem[] = [];

  if (areas.includes("profile")) {
    items.push(
      item(
        "name",
        "Name",
        filled(portfolio.profile.brandName),
        "important",
        "The name is in place.",
        "Add the name that appears with your work."
      ),
      item(
        "headline",
        "Headline",
        filled(portfolio.profile.headline),
        "important",
        "The headline is in place.",
        "Add the headline that opens the portfolio."
      ),
      item(
        "portrait",
        "Portrait",
        filled(portfolio.profile.heroImage) || filled(portfolio.profile.heroImageMobile),
        "important",
        "A portrait is in place.",
        "Add a portrait. It carries the first screen."
      ),
      item(
        "logo",
        "Logo",
        filled(portfolio.profile.logo),
        "optional",
        "A logo is in place.",
        "A logo is optional. The name still identifies the work."
      )
    );
  }

  if (areas.includes("projects")) {
    const meaningful = portfolio.projects.filter((project) => filled(project.title) && filled(project.url));
    items.push(
      item(
        "projects",
        "Projects",
        meaningful.length > 0,
        "important",
        meaningful.length === 1 ? "One project is ready to present." : "Projects are ready to present.",
        "Add a project with a title and a link."
      )
    );
  }

  if (areas.includes("contact")) {
    items.push(
      item(
        "contact",
        "Contact",
        filled(portfolio.contact.heading) || filled(portfolio.contact.description),
        "important",
        "The contact introduction is in place.",
        "Add a contact heading or description."
      )
    );
  }

  const needsAttention = items.some((entry) => entry.importance === "important" && entry.status === "attention");
  const palette = templateSupportsDesignControl(portfolio.selectedTemplate, "palette")
    ? wdkPaletteForPortfolio(portfolio)
    : null;

  return {
    title: needsAttention ? "A few things to check" : "Ready for publishing",
    summary: needsAttention
      ? "These parts of the template still need a look. Publishing stays off until you decide."
      : "What this template presents is in place. Publishing comes next.",
    items,
    palette,
  };
}

/**
 * How Review should respond to the current portfolio lookup.
 * This does not create, adopt, or update a portfolio.
 */
export function reviewEntry(lookup: {
  status: "missing" | "legacy" | "ready";
  reason?: "unselected" | "unknown";
  portfolio?: UserPortfolio;
}): ReviewEntry {
  if (lookup.status === "missing") return { kind: "missing" };
  if (lookup.status === "legacy" && lookup.reason === "unselected") return { kind: "choose-template" };
  if (lookup.status !== "ready" || !lookup.portfolio) return { kind: "unsupported" };

  const assessment = reviewAssessment(lookup.portfolio);
  if (!assessment) return { kind: "unsupported" };
  return {
    kind: "review",
    assessment,
    previewPath: portfolioTemplateInfo(lookup.portfolio.selectedTemplate).previewPath,
  };
}

/**
 * Saved content and palette for the selected template renderer.
 * Unknown templates do not receive WDK's adapter.
 */
export function savedPortfolioPresentation(
  portfolio: UserPortfolio
): { data: PortfolioData; palette: PortfolioPaletteId } | null {
  if (portfolio.selectedTemplate !== WDK_TEMPLATE_ID) return null;
  if (!templateContentAreas(portfolio.selectedTemplate)) return null;
  const data = toWdkPremiumPortfolioData(portfolio);
  const environment = typeof window === "undefined" ? "development" : siteEnvironmentFromHost(window.location.hostname);
  const resolved = resolvePortfolioSeo(
    {
      publicId: portfolio.id,
      selectedTemplate: portfolio.selectedTemplate,
      profile: portfolio.profile,
      contact: portfolio.contact,
      projects: portfolio.projects,
      seo: portfolio.seo,
    },
    environment
  );
  return {
    data: resolved ? { ...data, seo: resolvedToPortfolioSeo(resolved) } : data,
    palette: wdkPaletteForPortfolio(portfolio),
  };
}
