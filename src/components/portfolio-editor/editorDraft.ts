import type { Project as TemplateProject } from "../../templates/wdk-premium-portfolio-1/types/portfolio";
import type { UserPortfolio, UserPortfolioContent } from "../../types/userPortfolio";

/** Matches normalizeUrl in src/lib/portfolio.ts without loading Firebase. */
function withHttpProtocol(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export type EditorProjectDraft = {
  id: string;
  title: string;
  category: string;
  url: string;
  techText: string;
};

export type EditorDraft = {
  brandName: string;
  headline: string;
  heroImage: string;
  heroImageMobile: string;
  projects: EditorProjectDraft[];
};

export type EditorFieldErrors = {
  brandName?: string;
  headline?: string;
  projects: Record<string, { title?: string; url?: string }>;
};

export function techToText(tech: string[]): string {
  return tech.join("\n");
}

export function textToTech(value: string): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function draftFromPortfolio(portfolio: UserPortfolio): EditorDraft {
  return {
    brandName: portfolio.profile.brandName,
    headline: portfolio.profile.headline,
    heroImage: portfolio.profile.heroImage,
    heroImageMobile: portfolio.profile.heroImageMobile,
    projects: portfolio.projects.map((project) => ({
      id: project.id,
      title: project.title,
      category: project.category,
      url: project.url,
      techText: techToText(project.tech),
    })),
  };
}

export function validateEditorDraft(draft: EditorDraft): EditorFieldErrors | null {
  const errors: EditorFieldErrors = { projects: {} };
  if (!draft.brandName.trim()) {
    errors.brandName = "Please enter the name on your portfolio.";
  }
  if (!draft.headline.trim()) {
    errors.headline = "Please enter a headline.";
  }
  for (const project of draft.projects) {
    const projectErrors: { title?: string; url?: string } = {};
    if (!project.title.trim()) {
      projectErrors.title = "Please enter a project title.";
    }
    if (!project.url.trim()) {
      projectErrors.url = "Please enter the project URL.";
    }
    if (projectErrors.title || projectErrors.url) {
      errors.projects[project.id] = projectErrors;
    }
  }
  if (errors.brandName || errors.headline || Object.keys(errors.projects).length > 0) {
    return errors;
  }
  return null;
}

export function contentFromDraft(portfolio: UserPortfolio, draft: EditorDraft): UserPortfolioContent {
  const projects: TemplateProject[] = draft.projects.map((project) => ({
    id: project.id,
    title: project.title.trim(),
    category: project.category.trim(),
    url: withHttpProtocol(project.url),
    tech: textToTech(project.techText),
  }));

  return {
    selectedTemplate: portfolio.selectedTemplate,
    profile: {
      ...portfolio.profile,
      brandName: draft.brandName.trim(),
      headline: draft.headline.trim(),
      heroImage: draft.heroImage.trim(),
      heroImageMobile: draft.heroImageMobile.trim(),
    },
    socialLinks: portfolio.socialLinks,
    projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
    publishing: { status: "draft" },
  };
}

export function draftsMatch(left: EditorDraft, right: EditorDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
