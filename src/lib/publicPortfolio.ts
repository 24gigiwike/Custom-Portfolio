import type {
  PortfolioContact,
  PortfolioData,
  PortfolioProfile,
  PortfolioSEO,
  Project,
  SocialLink,
  SocialPlatform,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type { PortfolioDesign, PortfolioPaletteId } from "../types/portfolioDesign";
import { normalizePortfolioDesign } from "../types/portfolioDesign";
import type { PublicPortfolio } from "../types/publicPortfolio";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { templateForCreation } from "./templateCatalog";
import { toWdkPremiumPortfolioData, wdkPaletteForPortfolio } from "./wdkPortfolioAdapter";

const PLATFORMS = new Set<SocialPlatform>(["x", "instagram", "facebook", "youtube", "tiktok", "email"]);

const WDK_TEMPLATE_ID = templateConfig.id;

/**
 * Fields copied into the public document.
 * Identity, publishing timestamps, and CMS mirrors are added only by the writer.
 */
export type PublicPortfolioFields = {
  publicId: string;
  selectedTemplate: string;
  profile: PortfolioProfile;
  socialLinks: SocialLink[];
  projects: Project[];
  contact: PortfolioContact;
  seo: PortfolioSEO;
  design: PortfolioDesign;
};

export type PublicDelivery =
  | { action: "leave" }
  | { action: "remove"; publicId: string }
  | { action: "upsert"; publicId: string; fields: PublicPortfolioFields }
  | { action: "reject" };

const PRIVATE_KEYS = [
  "ownerId",
  "stylePreset",
  "theme",
  "slug",
  "profession",
  "bio",
  "profileImage",
  "enabledSections",
  "published",
  "publishing",
  "createdAt",
  "photoPath",
  "dateOfBirth",
  "accountPrivate",
  "uid",
  "storagePath",
] as const;

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

function publicProfile(profile: PortfolioProfile): PortfolioProfile {
  return {
    brandName: profile.brandName,
    logo: profile.logo,
    heroImage: profile.heroImage,
    heroImageMobile: profile.heroImageMobile,
    headline: profile.headline,
    capabilityTags: [...profile.capabilityTags],
    ctaLabel: profile.ctaLabel,
    ctaHref: profile.ctaHref,
    email: profile.email,
  };
}

function publicSocialLinks(links: SocialLink[]): SocialLink[] {
  return links.flatMap((link) => {
    if (!PLATFORMS.has(link.platform) || typeof link.url !== "string") return [];
    return [{ platform: link.platform, url: link.url }];
  });
}

function publicProjects(projects: Project[]): Project[] {
  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    category: project.category,
    url: project.url,
    tech: [...project.tech],
  }));
}

function publicContact(contact: PortfolioContact): PortfolioContact {
  return {
    email: contact.email,
    eyebrow: contact.eyebrow,
    heading: contact.heading,
    description: contact.description,
    projectTypes: [...contact.projectTypes],
    formEndpoint: contact.formEndpoint,
  };
}

function publicSeo(seo: PortfolioSEO): PortfolioSEO {
  return {
    title: seo.title,
    description: seo.description,
    canonicalUrl: seo.canonicalUrl,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage,
    twitterTitle: seo.twitterTitle,
    twitterDescription: seo.twitterDescription,
    twitterImage: seo.twitterImage,
  };
}

/**
 * Explicit private-to-public copy.
 * Returns null when the selected template cannot be delivered.
 * Readiness for a first publish is decided by planPublish, not here.
 */
export function publicPortfolioFromUserPortfolio(portfolio: UserPortfolio): PublicPortfolioFields | null {
  const template = templateForCreation(portfolio.selectedTemplate);
  if (!template) return null;
  return {
    publicId: portfolio.id,
    selectedTemplate: template.id,
    profile: publicProfile(portfolio.profile),
    socialLinks: publicSocialLinks(portfolio.socialLinks),
    projects: publicProjects(portfolio.projects),
    contact: publicContact(portfolio.contact),
    seo: publicSeo(portfolio.seo),
    design: { palette: normalizePortfolioDesign(portfolio.design).palette },
  };
}

/**
 * A saved edit while published must refresh the public document.
 * A draft save must not create one. A published portfolio with no projection fails the save.
 */
export function publicDeliveryForSavedContent(
  current: UserPortfolio,
  content: UserPortfolioContent
): PublicDelivery {
  if (content.publishing.status !== "published") return { action: "leave" };
  const fields = publicPortfolioFromUserPortfolio({
    ...current,
    ...content,
    id: current.id,
    ownerId: current.ownerId,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
  });
  if (!fields) return { action: "reject" };
  return { action: "upsert", publicId: current.id, fields };
}

/** Unpublish removes the public document. The private portfolio id stays the public id. */
export function publicDeliveryForUnpublish(portfolioId: string): PublicDelivery {
  return { action: "remove", publicId: portfolioId };
}

export function collectKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
    return found;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      collectKeys(child, found);
    }
  }
  return found;
}

export function privateKeysInPublicFields(fields: PublicPortfolioFields): string[] {
  const keys = new Set(collectKeys(fields));
  return PRIVATE_KEYS.filter((key) => keys.has(key));
}

function readProfile(value: unknown): PortfolioProfile | null {
  if (!isRecord(value)) return null;
  const heroImage = text(value.heroImage);
  return {
    brandName: text(value.brandName),
    logo: text(value.logo),
    heroImage,
    heroImageMobile: text(value.heroImageMobile) || heroImage,
    headline: text(value.headline),
    capabilityTags: stringList(value.capabilityTags),
    ctaLabel: text(value.ctaLabel),
    ctaHref: text(value.ctaHref),
    email: text(value.email),
  };
}

function readSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.platform !== "string" || typeof item.url !== "string") return [];
    if (!PLATFORMS.has(item.platform as SocialPlatform)) return [];
    return [{ platform: item.platform as SocialPlatform, url: item.url }];
  });
}

function readProjects(value: unknown): Project[] {
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

function readContact(value: unknown): PortfolioContact | null {
  if (!isRecord(value)) return null;
  return {
    email: text(value.email),
    eyebrow: text(value.eyebrow),
    heading: text(value.heading),
    description: text(value.description),
    projectTypes: stringList(value.projectTypes),
    formEndpoint: text(value.formEndpoint),
  };
}

function readSeo(value: unknown): PortfolioSEO | null {
  if (!isRecord(value)) return null;
  return publicSeo({
    title: text(value.title),
    description: text(value.description),
    canonicalUrl: text(value.canonicalUrl),
    ogTitle: text(value.ogTitle),
    ogDescription: text(value.ogDescription),
    ogImage: text(value.ogImage),
    twitterTitle: text(value.twitterTitle),
    twitterDescription: text(value.twitterDescription),
    twitterImage: text(value.twitterImage),
  });
}

function readTime(value: unknown): PublicPortfolio["publishedAt"] {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) return value as PublicPortfolio["publishedAt"];
  return null;
}

/**
 * Read a public document into presentation data.
 * Legacy CMS fields are not consulted. An unknown template returns null.
 */
export function readPublicPortfolio(publicId: string, data: Record<string, unknown>): PublicPortfolio | null {
  if (data.publicId !== publicId) return null;
  if (typeof data.selectedTemplate !== "string") return null;
  const template = templateForCreation(data.selectedTemplate.trim());
  if (!template) return null;
  const profile = readProfile(data.profile);
  const contact = readContact(data.contact);
  const seo = readSeo(data.seo);
  if (!profile || !contact || !seo || !isRecord(data.design)) return null;
  return {
    publicId,
    selectedTemplate: template.id,
    profile,
    socialLinks: readSocialLinks(data.socialLinks),
    projects: readProjects(data.projects),
    contact,
    seo,
    design: normalizePortfolioDesign(data.design),
    publishedAt: readTime(data.publishedAt),
    updatedAt: readTime(data.updatedAt),
  };
}

export type PublicWdkPresentation = {
  data: PortfolioData;
  palette: PortfolioPaletteId;
};

const publicRenderers: Record<string, (portfolio: PublicPortfolio) => PublicWdkPresentation> = {
  [WDK_TEMPLATE_ID]: (portfolio) => ({
    data: toWdkPremiumPortfolioData(portfolio),
    palette: wdkPaletteForPortfolio(portfolio),
  }),
};

/** Template registry. An unknown id does not fall back to WDK. */
export function publicPortfolioPresentation(portfolio: PublicPortfolio): PublicWdkPresentation | null {
  const render = publicRenderers[portfolio.selectedTemplate];
  return render ? render(portfolio) : null;
}

/** Document title only. Stored SEO fields are otherwise left to the template. */
export function publicDocumentTitle(portfolio: PublicPortfolio): string {
  const seoTitle = portfolio.seo.title.trim();
  if (seoTitle) return seoTitle;
  const name = portfolio.profile.brandName.trim();
  if (name) return name;
  return "Portfolio";
}
