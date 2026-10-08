import { normalizeDiscoverability } from "./discoverability.js";
import type { PortfolioSEO } from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { PortfolioDiscoverability } from "../types/discoverability";
import type { PublicPortfolio } from "../types/publicPortfolio";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { templateForCreation, templateSupportsContentArea } from "./templateCatalog.js";

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
  profile: { brandName: string; headline: string; capabilityTags?: string[] };
  contact: { description: string; projectTypes?: string[] };
  projects: { title: string; url: string; category?: string; tech?: string[] }[];
  seo: Pick<PortfolioSEO, "title" | "description" | "ogImage" | "twitterImage">;
  discoverability?: PortfolioDiscoverability;
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

function listed(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => normalizeSeoText(value)).filter(Boolean);
}

function showsArea(source: SeoSource, area: "profile" | "projects" | "contact" | "discoverability"): boolean {
  return templateSupportsContentArea(source.selectedTemplate, area);
}

function portfolioJsonLd(
  source: SeoSource,
  resolved: { title: string; description: string; canonicalUrl: string; image: string }
): string {
  const name = normalizeSeoText(source.profile.brandName);
  if (!name) return "";
  const facts = showsArea(source, "discoverability") ? normalizeDiscoverability(source.discoverability) : emptyFacts();
  const headline = showsArea(source, "profile") ? normalizeSeoText(source.profile.headline) : "";
  const summary = showsArea(source, "contact") ? normalizeSeoText(source.contact.description) : "";
  const expertise = showsArea(source, "profile") ? listed(source.profile.capabilityTags) : [];
  const services = showsArea(source, "contact") ? listed(source.contact.projectTypes) : [];
  const works = showsArea(source, "projects")
    ? source.projects
        .map((project) => ({
          title: normalizeSeoText(project.title),
          url: project.url.trim(),
          category: normalizeSeoText(project.category ?? ""),
          tech: listed(project.tech),
        }))
        .filter((project) => project.title && HTTPS_URL.test(project.url))
        .slice(0, 12)
        .map((project) => {
          const work: Record<string, unknown> = { "@type": "CreativeWork", name: project.title, url: project.url };
          if (project.category) work.about = project.category;
          if (project.tech.length > 0) work.keywords = project.tech.join(", ");
          return work;
        })
    : [];
  const entityId = `${resolved.canonicalUrl}#identity`;
  const graph: Record<string, unknown>[] = [];
  const page: Record<string, unknown> = {
    "@type": "ProfilePage",
    "@id": resolved.canonicalUrl,
    url: resolved.canonicalUrl,
    name: resolved.title,
  };
  if (resolved.description) page.description = resolved.description;
  if (works.length > 0) page.hasPart = works;
  if (facts.identity) {
    const entity: Record<string, unknown> = {
      "@type": facts.identity === "organization" ? "Organization" : "Person",
      "@id": entityId,
      name,
      url: resolved.canonicalUrl,
    };
    if (summary) entity.description = summary;
    else if (headline) entity.description = headline;
    if (resolved.image) entity.image = resolved.image;
    if (expertise.length > 0) entity.knowsAbout = expertise;
    if (facts.serviceRegion) entity.areaServed = facts.serviceRegion;
    if (services.length > 0) {
      entity.makesOffer = services.map((service) => ({ "@type": "Service", name: service }));
    }
    page.mainEntity = { "@id": entityId };
    graph.push(page, entity);
  } else {
    graph.push(page);
  }
  if (facts.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${resolved.canonicalUrl}#questions`,
      mainEntity: facts.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }
  return escapeJsonLd(JSON.stringify({ "@context": "https://schema.org", "@graph": graph }));
}

function emptyFacts(): PortfolioDiscoverability {
  return { identity: "", serviceRegion: "", faqs: [] };
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
  input: {
    title: string;
    description: string;
    image: string;
    discoverability?: PortfolioDiscoverability;
  }
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
    discoverability: normalizeDiscoverability(input.discoverability ?? portfolio.discoverability),
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

export function templateOffersDiscoverability(selectedTemplate: string): boolean {
  return templateSupportsContentArea(selectedTemplate, "discoverability");
}

/** Visible public facts for the initial HTML. The same facts are shown by a supporting template. */
export function renderPortfolioFacts(source: SeoSource): string {
  const name = normalizeSeoText(source.profile.brandName);
  const headline = showsArea(source, "profile") ? normalizeSeoText(source.profile.headline) : "";
  const summary = showsArea(source, "contact") ? normalizeSeoText(source.contact.description) : "";
  const expertise = showsArea(source, "profile") ? listed(source.profile.capabilityTags) : [];
  const services = showsArea(source, "contact") ? listed(source.contact.projectTypes) : [];
  const facts = showsArea(source, "discoverability") ? normalizeDiscoverability(source.discoverability) : emptyFacts();
  const projects = showsArea(source, "projects")
    ? source.projects.flatMap((project) => {
        const title = normalizeSeoText(project.title);
        if (!title) return [];
        const url = project.url.trim();
        const href = HTTPS_URL.test(url) ? url : "";
        return [{ title, href }];
      })
    : [];
  const heading = headline || name || "Portfolio";
  const lines = [
    `<article>`,
    name && headline ? `<p>${escapeHtml(name)}</p>` : "",
    `<h1>${escapeHtml(heading)}</h1>`,
    summary ? `<p>${escapeHtml(summary)}</p>` : "",
    expertise.length ? `<h2>Expertise</h2><ul>${expertise.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "",
    services.length ? `<h2>Services</h2><ul>${services.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "",
    facts.serviceRegion ? `<p>${escapeHtml(facts.serviceRegion)}</p>` : "",
    projects.length
      ? `<h2>Selected work</h2><ul>${projects
          .map((project) =>
            project.href
              ? `<li><a href="${escapeHtml(project.href)}">${escapeHtml(project.title)}</a></li>`
              : `<li>${escapeHtml(project.title)}</li>`
          )
          .join("")}</ul>`
      : "",
    facts.faqs.length
      ? `<section aria-label="Questions"><h2>Questions</h2>${facts.faqs
          .map((faq) => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`)
          .join("")}</section>`
      : "",
    `</article>`,
  ];
  return lines.filter(Boolean).join("");
}

export function applyPublicBody(html: string, inner: string): string {
  if (!html.includes('<div id="root">')) return html;
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${inner}</div>`);
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
