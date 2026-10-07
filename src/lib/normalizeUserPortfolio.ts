import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project as TemplateProject,
  SocialLink,
  SocialPlatform,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { normalizePortfolioDesign } from "../types/portfolioDesign";
import { findCatalogTemplate } from "./templateCatalog";

const PLATFORMS = new Set<SocialPlatform>(["x", "instagram", "facebook", "youtube", "tiktok", "email"]);

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

/**
 * A portfolio enters the current editor only when it already names a catalog template.
 * A missing template id is not treated as WDK.
 */
function catalogTemplateId(data: Record<string, unknown>): string | null {
  if (typeof data.selectedTemplate !== "string") return null;
  const id = data.selectedTemplate.trim();
  if (!id) return null;
  return findCatalogTemplate(id)?.id ?? null;
}

function present(record: Record<string, unknown> | null, key: string, fallback: string): string {
  if (!record || !(key in record)) return fallback;
  return text(record[key]);
}

function legacyPortrait(data: Record<string, unknown>): string {
  return text(data.profileImage).trim();
}

function readProfile(data: Record<string, unknown>): PortfolioProfile {
  const profile = isRecord(data.profile) ? data.profile : null;
  const portrait = legacyPortrait(data);
  const heroImage = present(profile, "heroImage", portrait);
  return {
    brandName: present(profile, "brandName", text(data.title)),
    logo: present(profile, "logo", ""),
    heroImage,
    heroImageMobile: present(profile, "heroImageMobile", heroImage || portrait),
    headline: present(profile, "headline", text(data.headline)),
    capabilityTags: profile ? stringList(profile.capabilityTags) : [],
    ctaLabel: present(profile, "ctaLabel", ""),
    ctaHref: present(profile, "ctaHref", ""),
    email: present(profile, "email", text(data.email)),
  };
}

function readSocialLinks(value: unknown): SocialLink[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item) || typeof item.platform !== "string" || typeof item.url !== "string") return [];
      if (!PLATFORMS.has(item.platform as SocialPlatform)) return [];
      return [{ platform: item.platform as SocialPlatform, url: item.url }];
    });
  }
  if (!isRecord(value)) return [];
  const links: SocialLink[] = [];
  for (const platform of PLATFORMS) {
    const url = text(value[platform]).trim();
    if (url) links.push({ platform, url });
  }
  return links;
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
    email: present(contact, "email", text(data.email)),
    eyebrow: present(contact, "eyebrow", ""),
    heading: present(contact, "heading", ""),
    description: present(contact, "description", text(data.bio)),
    projectTypes: contact ? stringList(contact.projectTypes) : [],
    formEndpoint: present(contact, "formEndpoint", ""),
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
 * Current portfolio fields from a stored document and an already chosen catalog template.
 * This does not write, and it does not decide that a missing template is WDK.
 */
export function portfolioContentForTemplate(
  data: Record<string, unknown>,
  selectedTemplate: string
): UserPortfolioContent {
  return {
    selectedTemplate,
    profile: readProfile(data),
    socialLinks: readSocialLinks(data.socialLinks),
    projects: readProjects(data.projects),
    contact: readContact(data),
    seo: readSeo(data.seo),
    design: normalizePortfolioDesign(data.design),
    publishing: { status: "draft" },
  };
}

/**
 * Read a stored portfolio into the current shape.
 * Missing compatible fields receive defaults. This does not write to Firestore.
 * Unknown template ids, and documents with no selected template, return null.
 */
export function normalizeUserPortfolio(id: string, data: Record<string, unknown>): UserPortfolio | null {
  const selectedTemplate = catalogTemplateId(data);
  if (!selectedTemplate) return null;
  return {
    id,
    ownerId: text(data.ownerId),
    ...portfolioContentForTemplate(data, selectedTemplate),
    createdAt: (data.createdAt as UserPortfolio["createdAt"]) || null,
    updatedAt: (data.updatedAt as UserPortfolio["updatedAt"]) || null,
  };
}
