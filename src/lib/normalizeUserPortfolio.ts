import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project as TemplateProject,
  SocialLink,
  SocialPlatform,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type { UserPortfolio } from "../types/userPortfolio";
import { normalizePortfolioDesign } from "../types/portfolioDesign";
import { findCatalogTemplate } from "./templateCatalog";

const PLATFORMS = new Set<SocialPlatform>(["x", "instagram", "facebook", "youtube", "tiktok", "email"]);

/**
 * The only portfolio product that existed before `selectedTemplate`.
 * Documents from that workspace have no template id. Unknown ids are not mapped here.
 */
const PRE_TEMPLATE_PORTFOLIO_ID = templateConfig.id;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function storedTemplateId(data: Record<string, unknown>): string | null {
  if (typeof data.selectedTemplate !== "string") return null;
  const id = data.selectedTemplate.trim();
  return id || null;
}

/**
 * Workspace portfolios written before template selection.
 * Flat title/headline/style fields identify them. Theme is not a design palette.
 */
function isPreTemplateWorkspace(data: Record<string, unknown>): boolean {
  if (typeof data.ownerId !== "string" || !data.ownerId.trim()) return false;
  return typeof data.title === "string"
    || typeof data.headline === "string"
    || typeof data.stylePreset === "string"
    || isRecord(data.theme);
}

function resolveSelectedTemplate(data: Record<string, unknown>): string | null {
  const selected = storedTemplateId(data);
  if (selected) {
    return findCatalogTemplate(selected) ? selected : null;
  }
  return isPreTemplateWorkspace(data) ? PRE_TEMPLATE_PORTFOLIO_ID : null;
}

function firstPresent(record: Record<string, unknown> | null, key: string, fallback: string): string {
  if (!record || !(key in record)) return fallback;
  return text(record[key]);
}

function legacyPortrait(data: Record<string, unknown>): string {
  return text(data.profileImage).trim();
}

function readProfile(data: Record<string, unknown>): PortfolioProfile {
  const profile = isRecord(data.profile) ? data.profile : null;
  const portrait = legacyPortrait(data);
  const heroImage = firstPresent(profile, "heroImage", portrait);
  const heroImageMobile = firstPresent(profile, "heroImageMobile", heroImage || portrait);
  return {
    brandName: firstPresent(profile, "brandName", text(data.title)),
    logo: firstPresent(profile, "logo", ""),
    heroImage,
    heroImageMobile,
    headline: firstPresent(profile, "headline", text(data.headline)),
    capabilityTags: profile ? stringList(profile.capabilityTags) : [],
    ctaLabel: firstPresent(profile, "ctaLabel", ""),
    ctaHref: firstPresent(profile, "ctaHref", ""),
    email: firstPresent(profile, "email", text(data.email)),
  };
}

function legacyObjectLinks(value: Record<string, unknown>): SocialLink[] {
  const links: SocialLink[] = [];
  const push = (platform: SocialPlatform, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    links.push({ platform, url: trimmed });
  };
  push("x", text(value.x) || text(value.twitter));
  for (const platform of ["instagram", "facebook", "youtube", "tiktok"] as const) {
    push(platform, text(value[platform]));
  }
  push("email", text(value.email));
  return links;
}

function readSocialLinks(value: unknown): SocialLink[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item) || typeof item.platform !== "string" || typeof item.url !== "string") return [];
      if (!PLATFORMS.has(item.platform as SocialPlatform)) return [];
      return [{ platform: item.platform as SocialPlatform, url: item.url }];
    });
  }
  if (isRecord(value)) return legacyObjectLinks(value);
  return [];
}

function readProjects(value: unknown): TemplateProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") return [];
    return [{
      id: item.id,
      title: item.title,
      category: text(item.category),
      url: text(item.url),
      tech: stringList(item.tech),
    }];
  });
}

function readContact(data: Record<string, unknown>): PortfolioContact {
  const contact = isRecord(data.contact) ? data.contact : null;
  return {
    email: firstPresent(contact, "email", text(data.email)),
    eyebrow: firstPresent(contact, "eyebrow", ""),
    heading: firstPresent(contact, "heading", ""),
    description: firstPresent(contact, "description", text(data.bio)),
    projectTypes: contact ? stringList(contact.projectTypes) : [],
    formEndpoint: firstPresent(contact, "formEndpoint", ""),
  };
}

function readSeo(value: unknown): PortfolioSEO {
  const seo = isRecord(value) ? value : {};
  return {
    title: text(seo.title),
    description: text(seo.description),
    canonicalUrl: text(seo.canonicalUrl),
    ogTitle: text(seo.ogTitle),
    ogDescription: text(seo.ogDescription),
    ogImage: text(seo.ogImage),
    twitterTitle: text(seo.twitterTitle),
    twitterDescription: text(seo.twitterDescription),
    twitterImage: text(seo.twitterImage),
  };
}

/**
 * Read a stored portfolio into the current shape.
 * Missing compatible fields receive defaults. Unknown template ids stay unsupported.
 * This does not write to Firestore.
 */
export function normalizeUserPortfolio(id: string, data: Record<string, unknown>): UserPortfolio | null {
  const selectedTemplate = resolveSelectedTemplate(data);
  if (!selectedTemplate) return null;
  return {
    id,
    ownerId: text(data.ownerId),
    selectedTemplate,
    profile: readProfile(data),
    socialLinks: readSocialLinks(data.socialLinks),
    projects: readProjects(data.projects),
    contact: readContact(data),
    seo: readSeo(data.seo),
    design: normalizePortfolioDesign(data.design),
    publishing: { status: "draft" },
    createdAt: (data.createdAt as UserPortfolio["createdAt"]) || null,
    updatedAt: (data.updatedAt as UserPortfolio["updatedAt"]) || null,
  };
}
