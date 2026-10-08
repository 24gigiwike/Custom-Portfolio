import type { PortfolioSEO } from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { PublicPortfolio } from "../types/publicPortfolio";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { templateForCreation, templateSupportsContentArea } from "./templateCatalog";

export const PRODUCT_NAME = "Custom Portfolio";
export const PRODUCT_DESCRIPTION = "Your work deserves a place of its own.";
export const PRODUCTION_ORIGIN = "https://customportfolio.broadbrand.com.ng";
export const PRODUCT_SHARE_IMAGE =
  "https://res.cloudinary.com/dtkluxukm/image/upload/v1787401285/BD_BD_4_gttxlf.png";

const PUBLIC_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const HTTPS_URL = /^https:\/\/[^\s<>"]+$/i;
const DESCRIPTION_LIMIT = 160;

export type SiteEnvironment = "production" | "preview" | "development";
export type RobotsDirective = "index, follow" | "noindex, nofollow";

export type SeoSource = {
  publicId: string;
  selectedTemplate: string;
  profile: { brandName: string; headline: string };
  contact: { description: string };
  projects: { title: string; url: string }[];
  seo: Pick<PortfolioSEO, "title" | "description" | "ogImage" | "twitterImage">;
};

export type ResolvedPortfolioSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: RobotsDirective;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  jsonLd: string;
};

export function normalizeSeoText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function siteEnvironmentFromHost(hostname: string): SiteEnvironment {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  if (host === "customportfolio.broadbrand.com.ng") return "production";
  if (host.endsWith(".vercel.app")) return "preview";
  return "development";
}

export function portfolioCanonicalUrl(publicId: string): string | null {
  const id = publicId.trim();
  if (!PUBLIC_ID.test(id)) return null;
  return `${PRODUCTION_ORIGIN}/p/${encodeURIComponent(id)}`;
}

export function portfolioPageTitle(input: {
  seoTitle?: string;
  brandName?: string;
  headline?: string;
}): string {
  const explicit = normalizeSeoText(input.seoTitle ?? "");
  if (explicit) return explicit;
  const name = normalizeSeoText(input.brandName ?? "");
  const headline = normalizeSeoText(input.headline ?? "");
  if (name && headline) {
    if (headline.toLowerCase().startsWith(name.toLowerCase())) return headline;
    return `${name} — ${headline}`;
  }
  if (name) return name;
  if (headline) return headline;
  return "Portfolio";
}

export function portfolioPageDescription(input: {
  seoDescription?: string;
  contactDescription?: string;
  headline?: string;
  brandName?: string;
}): string {
  const explicit = normalizeSeoText(input.seoDescription ?? "");
  if (explicit) return clipDescription(explicit);
  const contact = normalizeSeoText(input.contactDescription ?? "");
  if (contact) return clipDescription(contact);
  const headline = normalizeSeoText(input.headline ?? "");
  if (headline) return clipDescription(headline);
  const name = normalizeSeoText(input.brandName ?? "");
  if (name) return clipDescription(name);
  return "";
}

function clipDescription(value: string): string {
  if (value.length <= DESCRIPTION_LIMIT) return value;
  const sliced = value.slice(0, DESCRIPTION_LIMIT + 1);
  const boundary = sliced.lastIndexOf(" ");
  const clipped = (boundary > 80 ? sliced.slice(0, boundary) : value.slice(0, DESCRIPTION_LIMIT)).trim();
  return clipped;
}

export function portfolioShareImage(seo: { ogImage?: string; twitterImage?: string }): string {
  const og = normalizeSeoText(seo.ogImage ?? "");
  if (HTTPS_URL.test(og)) return og;
  const twitter = normalizeSeoText(seo.twitterImage ?? "");
  if (HTTPS_URL.test(twitter)) return twitter;
  return "";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonLd(value: string): string {
  return value.replace(/</g, "\\u003c");
}

export function portfolioRobots(environment: SiteEnvironment): RobotsDirective {
  return environment === "production" ? "index, follow" : "noindex, nofollow";
}

export function homeRobots(environment: SiteEnvironment): RobotsDirective {
  return environment === "production" ? "index, follow" : "noindex, nofollow";
}

/**
 * One resolver for browser titles and crawler HTML.
 * An unknown template returns null and does not borrow WDK.
 */
export function resolvePortfolioSeo(source: SeoSource, environment: SiteEnvironment): ResolvedPortfolioSeo | null {
  if (!templateForCreation(source.selectedTemplate)) return null;
  const canonicalUrl = portfolioCanonicalUrl(source.publicId);
  if (!canonicalUrl) return null;
  const title = portfolioPageTitle({
    seoTitle: source.seo.title,
    brandName: source.profile.brandName,
    headline: source.profile.headline,
  });
  const description = portfolioPageDescription({
    seoDescription: source.seo.description,
    contactDescription: source.contact.description,
    headline: source.profile.headline,
    brandName: source.profile.brandName,
  });
  const image = portfolioShareImage(source.seo);
  const robots = portfolioRobots(environment);
  return {
    title,
    description,
    canonicalUrl,
    robots,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonicalUrl,
    ogImage: image,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    jsonLd: portfolioJsonLd(source, { title, description, canonicalUrl, image }),
  };
}

export function resolvePublicPortfolioSeo(
  portfolio: PublicPortfolio,
  environment: SiteEnvironment
): ResolvedPortfolioSeo | null {
  return resolvePortfolioSeo(portfolio, environment);
}

function portfolioJsonLd(
  source: SeoSource,
  resolved: { title: string; description: string; canonicalUrl: string; image: string }
): string {
  const name = normalizeSeoText(source.profile.brandName);
  if (!name) return "";
  const headline = normalizeSeoText(source.profile.headline);
  const person: Record<string, unknown> = {
    "@type": "Person",
    name,
    url: resolved.canonicalUrl,
  };
  if (headline) person.description = headline;
  if (resolved.image) person.image = resolved.image;
  const works = source.projects
    .map((project) => ({
      title: normalizeSeoText(project.title),
      url: project.url.trim(),
    }))
    .filter((project) => project.title && HTTPS_URL.test(project.url))
    .slice(0, 12)
    .map((project) => ({ "@type": "CreativeWork", name: project.title, url: project.url }));
  const page: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: resolved.canonicalUrl,
    name: resolved.title,
    mainEntity: person,
  };
  if (resolved.description) page.description = resolved.description;
  if (works.length > 0) page.hasPart = works;
  return escapeJsonLd(JSON.stringify(page));
}

export function resolvedToPortfolioSeo(resolved: ResolvedPortfolioSeo): PortfolioSEO {
  return {
    title: resolved.title,
    description: resolved.description,
    canonicalUrl: resolved.canonicalUrl,
    ogTitle: resolved.ogTitle,
    ogDescription: resolved.ogDescription,
    ogImage: resolved.ogImage,
    twitterTitle: resolved.twitterTitle,
    twitterDescription: resolved.twitterDescription,
    twitterImage: resolved.twitterImage,
  };
}

export function contentWithSeo(
  portfolio: UserPortfolio,
  input: { title: string; description: string; image: string }
): UserPortfolioContent {
  const title = normalizeSeoText(input.title);
  const description = normalizeSeoText(input.description);
  const image = portfolioShareImage({ ogImage: input.image });
  return {
    selectedTemplate: portfolio.selectedTemplate,
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    design: portfolio.design,
    publishing: portfolio.publishing,
    seo: {
      title,
      description,
      canonicalUrl: portfolioCanonicalUrl(portfolio.id) ?? "",
      ogTitle: title,
      ogDescription: description,
      ogImage: image,
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: image,
    },
  };
}

export function templateOffersSeo(selectedTemplate: string): boolean {
  return templateSupportsContentArea(selectedTemplate, "seo");
}

export function platformTitle(path: string): string {
  const pathname = path.split("?")[0].split("#")[0];
  if (pathname === "/auth") return `Sign In — ${PRODUCT_NAME}`;
  if (pathname === "/templates" || pathname === "/discover") return `Explore Templates — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio") return `My Portfolio — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio/edit") return `Edit Portfolio — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio/design") return `Portfolio Design — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio/review") return `Review Portfolio — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio/publish") return `Publish Portfolio — ${PRODUCT_NAME}`;
  if (pathname === "/portfolio/seo") return `Portfolio SEO — ${PRODUCT_NAME}`;
  return PRODUCT_NAME;
}

export function platformRobots(path: string, environment: SiteEnvironment): RobotsDirective {
  const pathname = path.split("?")[0].split("#")[0];
  if (pathname === "/" && environment === "production") return "index, follow";
  return "noindex, nofollow";
}

export function renderHeadTags(resolved: ResolvedPortfolioSeo): string {
  return renderTagList({
    title: resolved.title,
    description: resolved.description,
    robots: resolved.robots,
    canonicalUrl: resolved.canonicalUrl,
    ogType: "profile",
    ogTitle: resolved.ogTitle,
    ogDescription: resolved.ogDescription,
    ogUrl: resolved.ogUrl,
    ogImage: resolved.ogImage,
    twitterCard: resolved.ogImage ? "summary_large_image" : "summary",
    twitterTitle: resolved.twitterTitle,
    twitterDescription: resolved.twitterDescription,
    twitterImage: resolved.twitterImage,
    jsonLd: resolved.jsonLd,
  });
}

export function renderHomeHead(environment: SiteEnvironment): string {
  return renderTagList({
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    robots: homeRobots(environment),
    canonicalUrl: `${PRODUCTION_ORIGIN}/`,
    ogType: "website",
    ogTitle: PRODUCT_NAME,
    ogDescription: PRODUCT_DESCRIPTION,
    ogUrl: `${PRODUCTION_ORIGIN}/`,
    ogImage: PRODUCT_SHARE_IMAGE,
    twitterCard: "summary_large_image",
    twitterTitle: PRODUCT_NAME,
    twitterDescription: PRODUCT_DESCRIPTION,
    twitterImage: PRODUCT_SHARE_IMAGE,
    jsonLd: "",
  });
}

export function renderUnavailableHead(): string {
  return renderTagList({
    title: "Portfolio",
    description: "",
    robots: "noindex, nofollow",
    canonicalUrl: "",
    ogType: "website",
    ogTitle: "Portfolio",
    ogDescription: "",
    ogUrl: "",
    ogImage: "",
    twitterCard: "summary",
    twitterTitle: "Portfolio",
    twitterDescription: "",
    twitterImage: "",
    jsonLd: "",
  });
}

function renderTagList(tags: {
  title: string;
  description: string;
  robots: RobotsDirective;
  canonicalUrl: string;
  ogType: "website" | "profile";
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  twitterCard: "summary" | "summary_large_image";
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  jsonLd: string;
}): string {
  const lines = [
    `<title>${escapeHtml(tags.title)}</title>`,
    tags.description ? `<meta name="description" content="${escapeHtml(tags.description)}" />` : "",
    `<meta name="robots" content="${tags.robots}" />`,
    tags.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(tags.canonicalUrl)}" />` : "",
    `<meta property="og:type" content="${tags.ogType}" />`,
    `<meta property="og:title" content="${escapeHtml(tags.ogTitle)}" />`,
    tags.ogDescription ? `<meta property="og:description" content="${escapeHtml(tags.ogDescription)}" />` : "",
    tags.ogUrl ? `<meta property="og:url" content="${escapeHtml(tags.ogUrl)}" />` : "",
    tags.ogImage ? `<meta property="og:image" content="${escapeHtml(tags.ogImage)}" />` : "",
    `<meta name="twitter:card" content="${tags.twitterCard}" />`,
    `<meta name="twitter:title" content="${escapeHtml(tags.twitterTitle)}" />`,
    tags.twitterDescription ? `<meta name="twitter:description" content="${escapeHtml(tags.twitterDescription)}" />` : "",
    tags.twitterImage ? `<meta name="twitter:image" content="${escapeHtml(tags.twitterImage)}" />` : "",
    tags.jsonLd ? `<script type="application/ld+json">${tags.jsonLd}</script>` : "",
  ];
  return lines.filter(Boolean).join("\n    ");
}

export function applyHead(html: string, inner: string): string {
  const start = "<!-- seo:start -->";
  const end = "<!-- seo:end -->";
  const block = `${start}\n    ${inner}\n    ${end}`;
  if (html.includes(start) && html.includes(end)) {
    return html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  }
  return html.replace("</head>", `    ${block}\n  </head>`);
}

export function robotsTxt(environment: SiteEnvironment): string {
  if (environment !== "production") {
    return "User-agent: *\nDisallow: /\n";
  }
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /p/",
    "Disallow: /auth",
    "Disallow: /portfolio",
    "Disallow: /app",
    "Disallow: /onboarding",
    "Disallow: /discover",
    "Disallow: /templates",
    "Disallow: /template-preview",
    "",
    `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(entries: { publicId: string; updatedAt?: string }[]): string {
  const urls = entries.flatMap((entry) => {
    const loc = portfolioCanonicalUrl(entry.publicId);
    if (!loc) return [];
    const lastmod = entry.updatedAt?.trim();
    return [`  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
