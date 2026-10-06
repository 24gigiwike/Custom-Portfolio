import type {
  Project as TemplateProject,
  SocialLink,
  SocialPlatform,
} from "../../templates/wdk-premium-portfolio-1/types/portfolio";
import type { ContentArea } from "../../lib/templateCatalog";
import { templateContentAreas } from "../../lib/templateCatalog";
import type { UserPortfolio, UserPortfolioContent } from "../../types/userPortfolio";

/** Matches normalizeUrl in src/lib/portfolio.ts without loading Firebase. */
function withHttpProtocol(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const url = new URL(withHttpProtocol(trimmed));
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Page anchors, site paths, mailto, and web addresses. Empty is allowed. */
export function normalizeHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/") || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  return withHttpProtocol(trimmed);
}

function isAcceptableHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  if (/^mailto:/i.test(trimmed)) {
    return isEmailAddress(trimmed.slice("mailto:".length).split("?")[0] ?? "");
  }
  return isHttpUrl(trimmed);
}

function normalizeWebImage(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return withHttpProtocol(trimmed);
}

function normalizeLogo(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|data:|blob:)/i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  if (/^www\./i.test(trimmed) || /^[^\s/]+\.[^\s/]+\/.+/.test(trimmed)) return withHttpProtocol(trimmed);
  return trimmed;
}

function isAcceptableLogo(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed) || /^javascript:/i.test(trimmed)) return false;
  if (/^https?:/i.test(trimmed)) return isHttpUrl(trimmed);
  return true;
}

function normalizeSocialUrl(platform: SocialPlatform, url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (platform === "email") {
    if (/^mailto:/i.test(trimmed)) return trimmed;
    if (isEmailAddress(trimmed)) return `mailto:${trimmed}`;
  }
  return withHttpProtocol(trimmed);
}

function isAcceptableSocialUrl(platform: SocialPlatform, url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (platform === "email") {
    if (/^mailto:/i.test(trimmed)) return isEmailAddress(trimmed.slice("mailto:".length).split("?")[0] ?? "");
    if (isEmailAddress(trimmed)) return true;
  }
  return isHttpUrl(trimmed);
}

export const SOCIAL_PLATFORM_OPTIONS: { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "email", label: "Email" },
];

const SOCIAL_PLATFORMS = new Set<SocialPlatform>(SOCIAL_PLATFORM_OPTIONS.map((option) => option.value));

export function isSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.has(value as SocialPlatform);
}

/**
 * Visible editing surfaces. Search and sharing is a template capability,
 * but it is document metadata rather than a section of the portfolio.
 */
export const EDITOR_AREAS = ["profile", "socialLinks", "projects", "contact"] as const;

export type EditorArea = (typeof EDITOR_AREAS)[number];

export function editorAreasForTemplate(selectedTemplate: string): readonly EditorArea[] | null {
  const areas = templateContentAreas(selectedTemplate);
  if (!areas) return null;
  return EDITOR_AREAS.filter((area) => areas.includes(area));
}

export type EditorProjectDraft = {
  id: string;
  title: string;
  category: string;
  url: string;
  techText: string;
};

export type EditorSocialDraft = {
  id: string;
  platform: SocialPlatform;
  url: string;
};

export type EditorContactDraft = {
  eyebrow: string;
  heading: string;
  description: string;
  projectTypesText: string;
  formEndpoint: string;
};

export type EditorDraft = {
  brandName: string;
  headline: string;
  heroImage: string;
  heroImageMobile: string;
  logo: string;
  capabilityTagsText: string;
  ctaLabel: string;
  ctaHref: string;
  socialLinks: EditorSocialDraft[];
  projects: EditorProjectDraft[];
  contact: EditorContactDraft;
};

export type EditorFieldErrors = {
  brandName?: string;
  headline?: string;
  heroImage?: string;
  logo?: string;
  ctaHref?: string;
  socialLinks: Record<string, { url?: string }>;
  projects: Record<string, { title?: string; url?: string }>;
  formEndpoint?: string;
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

export function listToLines(items: string[]): string {
  return items.join("\n");
}

export function linesToList(value: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const item = line.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
  }
  return items;
}

export function createSocialLinkDraft(platform: SocialPlatform = "instagram"): EditorSocialDraft {
  return {
    id: `social-${Math.random().toString(36).slice(2, 10)}`,
    platform,
    url: "",
  };
}

export function draftFromPortfolio(portfolio: UserPortfolio): EditorDraft {
  return {
    brandName: portfolio.profile.brandName,
    headline: portfolio.profile.headline,
    heroImage: portfolio.profile.heroImage,
    heroImageMobile: portfolio.profile.heroImageMobile,
    logo: portfolio.profile.logo,
    capabilityTagsText: listToLines(portfolio.profile.capabilityTags),
    ctaLabel: portfolio.profile.ctaLabel,
    ctaHref: portfolio.profile.ctaHref,
    socialLinks: portfolio.socialLinks.flatMap((link) =>
      isSocialPlatform(link.platform)
        ? [{ id: `social-${Math.random().toString(36).slice(2, 10)}`, platform: link.platform, url: link.url }]
        : []
    ),
    projects: portfolio.projects.map((project) => ({
      id: project.id,
      title: project.title,
      category: project.category,
      url: project.url,
      techText: techToText(project.tech),
    })),
    contact: {
      eyebrow: portfolio.contact.eyebrow,
      heading: portfolio.contact.heading,
      description: portfolio.contact.description,
      projectTypesText: listToLines(portfolio.contact.projectTypes),
      formEndpoint: portfolio.contact.formEndpoint,
    },
  };
}

export function validateEditorDraft(draft: EditorDraft, selectedTemplate: string): EditorFieldErrors | null {
  const areas = editorAreasForTemplate(selectedTemplate);
  const errors: EditorFieldErrors = { socialLinks: {}, projects: {} };
  if (!areas) return null;

  if (areas.includes("profile")) {
    if (!draft.brandName.trim()) errors.brandName = "Please enter the name on your portfolio.";
    if (!draft.headline.trim()) errors.headline = "Please enter a headline.";
    if (draft.heroImage.trim() && !isHttpUrl(draft.heroImage)) errors.heroImage = "Enter a valid image address.";
    if (!isAcceptableLogo(draft.logo)) errors.logo = "Enter a valid image address.";
    if (!isAcceptableHref(draft.ctaHref)) errors.ctaHref = "Enter a valid link.";
  }

  if (areas.includes("socialLinks")) {
    for (const link of draft.socialLinks) {
      if (!link.url.trim()) {
        errors.socialLinks[link.id] = { url: "Enter a link for this platform." };
      } else if (!isSocialPlatform(link.platform) || !isAcceptableSocialUrl(link.platform, link.url)) {
        errors.socialLinks[link.id] = { url: "Enter a valid link." };
      }
    }
  }

  if (areas.includes("projects")) {
    for (const project of draft.projects) {
      const projectErrors: { title?: string; url?: string } = {};
      if (!project.title.trim()) projectErrors.title = "Please enter a project title.";
      if (!project.url.trim()) projectErrors.url = "Please enter the project URL.";
      else if (!isHttpUrl(project.url)) projectErrors.url = "Enter a valid project URL.";
      if (projectErrors.title || projectErrors.url) errors.projects[project.id] = projectErrors;
    }
  }

  if (areas.includes("contact") && draft.contact.formEndpoint.trim() && !isHttpUrl(draft.contact.formEndpoint)) {
    errors.formEndpoint = "Enter a valid form address.";
  }

  if (
    errors.brandName ||
    errors.headline ||
    errors.heroImage ||
    errors.logo ||
    errors.ctaHref ||
    errors.formEndpoint ||
    Object.keys(errors.socialLinks).length > 0 ||
    Object.keys(errors.projects).length > 0
  ) {
    return errors;
  }
  return null;
}

function portfolioContent(portfolio: UserPortfolio): UserPortfolioContent {
  return {
    selectedTemplate: portfolio.selectedTemplate,
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
    design: portfolio.design,
    publishing: portfolio.publishing,
  };
}

/**
 * Writes only the areas the caller lists. Search metadata, account email,
 * public contact email, and the selected template are copied through.
 * A null area list means the template is unknown, so nothing is rewritten.
 */
export function applyEditorDraft(
  portfolio: UserPortfolio,
  draft: EditorDraft,
  areas: readonly ContentArea[] | null
): UserPortfolioContent {
  if (!areas) return portfolioContent(portfolio);

  const projects: TemplateProject[] = draft.projects.map((project) => ({
    id: project.id,
    title: project.title.trim(),
    category: project.category.trim(),
    url: withHttpProtocol(project.url),
    tech: textToTech(project.techText),
  }));

  const socialLinks: SocialLink[] = draft.socialLinks
    .filter((link) => isSocialPlatform(link.platform))
    .map((link) => ({
      platform: link.platform,
      url: normalizeSocialUrl(link.platform, link.url),
    }));

  return {
    selectedTemplate: portfolio.selectedTemplate,
    profile: areas.includes("profile")
      ? {
          ...portfolio.profile,
          brandName: draft.brandName.trim(),
          headline: draft.headline.trim(),
          logo: normalizeLogo(draft.logo),
          heroImage: normalizeWebImage(draft.heroImage),
          heroImageMobile: normalizeWebImage(draft.heroImageMobile),
          capabilityTags: linesToList(draft.capabilityTagsText),
          ctaLabel: draft.ctaLabel.trim(),
          ctaHref: normalizeHref(draft.ctaHref),
        }
      : portfolio.profile,
    socialLinks: areas.includes("socialLinks") ? socialLinks : portfolio.socialLinks,
    projects: areas.includes("projects") ? projects : portfolio.projects,
    contact: areas.includes("contact")
      ? {
          ...portfolio.contact,
          eyebrow: draft.contact.eyebrow.trim(),
          heading: draft.contact.heading.trim(),
          description: draft.contact.description.trim(),
          projectTypes: linesToList(draft.contact.projectTypesText),
          formEndpoint: draft.contact.formEndpoint.trim() ? withHttpProtocol(draft.contact.formEndpoint) : "",
        }
      : portfolio.contact,
    seo: portfolio.seo,
    design: portfolio.design,
    publishing: { status: "draft" },
  };
}

export function contentFromDraft(portfolio: UserPortfolio, draft: EditorDraft): UserPortfolioContent {
  return applyEditorDraft(portfolio, draft, templateContentAreas(portfolio.selectedTemplate));
}

export function draftsMatch(left: EditorDraft, right: EditorDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
