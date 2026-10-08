import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPortfolioSeoPath, PORTFOLIO_SEO_PATH } from "../components/portfolio-seo/portfolioSeoPath";
import type { UserPortfolio } from "../types/userPortfolio";
import type { SeoSource } from "./portfolioSeo";
import { publicDeliveryForSavedContent } from "./publicPortfolio";
import {
  applyHead,
  applyPublicBody,
  contentWithSeo,
  escapeHtml,
  homeRobots,
  normalizeSeoText,
  platformRobots,
  platformTitle,
  canonicalPortfolioUrl,
  portfolioCanonicalUrl,
  portfolioPageDescription,
  portfolioPageTitle,
  portfolioRobots,
  portfolioShareImage,
  renderHeadTags,
  renderUnavailableHead,
  renderPortfolioFacts,
  resolvePortfolioSeo,
  templateOffersDiscoverability,
  robotsTxt,
  siteEnvironmentFromHost,
  sitemapXml,
  PRODUCT_NAME,
} from "./portfolioSeo";

function source(overrides: Partial<UserPortfolio> = {}): UserPortfolio {
  return {
    id: "ABC123",
    ownerId: "owner-secret-uid",
    selectedTemplate: "wdk-premium-portfolio-1",
    profile: {
      brandName: "John Paul",
      logo: "",
      heroImage: "https://cdn.example.com/portrait.jpg",
      heroImageMobile: "",
      headline: "Motion Designer & Animator",
      capabilityTags: [],
      ctaLabel: "",
      ctaHref: "",
      email: "",
    },
    socialLinks: [],
    projects: [{ id: "reel", title: "Title Sequence", category: "", url: "https://john.example/reel", tech: ["After Effects"] }],
    contact: {
      email: "",
      eyebrow: "",
      heading: "",
      description: "Selected animation and motion work.",
      projectTypes: [],
      formEndpoint: "",
    },
    seo: {
      title: "",
      description: "",
      canonicalUrl: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
    },
    discoverability: { identity: "", serviceRegion: "", faqs: [] },
    design: { palette: "ocean" },
    publicSlug: "",
    publicSlugAliases: [],
    publishing: { status: "published", publishedAt: "2024-07-01" },
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function seoSource(portfolio: UserPortfolio): SeoSource {
  return {
    publicId: portfolio.id,
    selectedTemplate: portfolio.selectedTemplate,
    profile: {
      brandName: portfolio.profile.brandName,
      headline: portfolio.profile.headline,
      capabilityTags: portfolio.profile.capabilityTags,
    },
    contact: { description: portfolio.contact.description, projectTypes: portfolio.contact.projectTypes },
    projects: portfolio.projects.map((project) => ({
      title: project.title,
      url: project.url,
      category: project.category,
      tech: project.tech,
    })),
    seo: portfolio.seo,
    discoverability: portfolio.discoverability,
    publicSlug: portfolio.publicSlug,
  };
}

assert.equal(portfolioPageTitle({ seoTitle: "  John Paul — Motion  " }), "John Paul — Motion");
assert.equal(
  portfolioPageTitle({ brandName: "John Paul", headline: "Motion Designer & Animator" }),
  "John Paul — Motion Designer & Animator"
);
assert.equal(portfolioPageTitle({ brandName: "John Paul", headline: "John Paul, animator" }), "John Paul, animator");
assert.equal(portfolioPageTitle({ brandName: "  John Paul  " }), "John Paul");
assert.equal(portfolioPageTitle({ headline: "Animator" }), "Animator");
assert.equal(portfolioPageTitle({ seoTitle: "   ", brandName: "   ", headline: "  " }), "Portfolio");
assert.equal(portfolioPageTitle({ seoTitle: "Ada & Engines" }).includes(PRODUCT_NAME), false);
assert.equal(normalizeSeoText("Ada\n\nLovelace"), "Ada Lovelace");

assert.equal(
  portfolioPageDescription({ seoDescription: "Explore the animation work of John Paul." }),
  "Explore the animation work of John Paul."
);
assert.equal(portfolioPageDescription({ contactDescription: "  Selected animation.  " }), "Selected animation.");
assert.equal(portfolioPageDescription({ headline: "Motion Designer" }), "Motion Designer");
assert.equal(portfolioPageDescription({}), "");
assert.equal(portfolioPageDescription({ seoDescription: "a".repeat(200) }).length <= 160, true);

const canonical = portfolioCanonicalUrl("ABC123");
assert.equal(canonical, "https://customportfolio.broadbrand.com.ng/p/ABC123");
assert.equal(canonicalPortfolioUrl("ABC123", "johnpaul"), "https://customportfolio.broadbrand.com.ng/p/johnpaul");
assert.equal(canonicalPortfolioUrl("ABC123", ""), canonical);
assert.equal(portfolioCanonicalUrl("a b"), null);
assert.equal(portfolioCanonicalUrl("../admin"), null);
assert.equal(portfolioCanonicalUrl("ABC123?utm=1"), null);
assert.equal(canonical?.includes("//p/"), false);

assert.equal(siteEnvironmentFromHost("customportfolio.broadbrand.com.ng"), "production");
assert.equal(siteEnvironmentFromHost("my-app.vercel.app"), "preview");
assert.equal(siteEnvironmentFromHost("localhost:3000"), "development");
assert.equal(portfolioRobots("production"), "index, follow");
assert.equal(portfolioRobots("preview"), "noindex, nofollow");
assert.equal(homeRobots("development"), "noindex, nofollow");
assert.equal(platformRobots("/portfolio/edit", "production"), "noindex, nofollow");
assert.equal(platformRobots("/", "production"), "index, follow");

assert.equal(portfolioShareImage({ ogImage: "https://cdn.example.com/card.jpg" }), "https://cdn.example.com/card.jpg");
assert.equal(portfolioShareImage({ ogImage: "", twitterImage: "https://cdn.example.com/card.jpg" }), "https://cdn.example.com/card.jpg");
assert.equal(portfolioShareImage({ ogImage: "http://cdn.example.com/card.jpg" }), "");
assert.equal(portfolioShareImage({ ogImage: "javascript:alert(1)" }), "");
assert.equal(portfolioShareImage({}), "");

const named = source();
const resolved = resolvePortfolioSeo(seoSource(named), "production");
if (!resolved) throw new Error("expected metadata");
assert.equal(resolved.title, "John Paul — Motion Designer & Animator");
assert.equal(resolved.description, "Selected animation and motion work.");
assert.equal(resolved.ogTitle, resolved.title);
assert.equal(resolved.twitterDescription, resolved.description);
assert.equal(resolved.canonicalUrl, canonical);
assert.equal(resolved.ogImage, "");
assert.equal(resolved.robots, "index, follow");
assert.equal(resolved.jsonLd.includes("owner-secret-uid"), false);
assert.equal(resolved.jsonLd.includes("Title Sequence"), true);
assert.equal(resolved.jsonLd.includes("https://john.example/reel"), true);

const explicit = resolvePortfolioSeo(seoSource(source({
  seo: { ...named.seo, title: "Custom title", description: "Custom description", ogImage: "https://cdn.example.com/share.jpg" },
})), "preview");
if (!explicit) throw new Error("expected explicit metadata");
assert.equal(explicit.title, "Custom title");
assert.equal(explicit.description, "Custom description");
assert.equal(explicit.ogImage, "https://cdn.example.com/share.jpg");
assert.equal(explicit.twitterImage, "https://cdn.example.com/share.jpg");
assert.equal(explicit.robots, "noindex, nofollow");
assert.equal(explicit.canonicalUrl, canonical);

const html = applyHead("<head><!-- seo:start -->\n    <title>Old</title>\n    <!-- seo:end --></head>", renderHeadTags(explicit));
assert.match(html, /<title>Custom title<\/title>/);
assert.match(html, /name="description" content="Custom description"/);
assert.match(html, /rel="canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/ABC123"/);
assert.match(html, /property="og:title" content="Custom title"/);
assert.match(html, /property="og:image" content="https:\/\/cdn\.example\.com\/share\.jpg"/);
assert.match(html, /name="twitter:title" content="Custom title"/);
assert.match(html, /name="robots" content="noindex, nofollow"/);
assert.equal(html.includes("<title>Old</title>"), false);

const escaped = resolvePortfolioSeo(seoSource(source({
  seo: { ...named.seo, title: `Ada & "Engines" <notes>` },
})), "production");
if (!escaped) throw new Error("expected escaped metadata");
const escapedHtml = renderHeadTags(escaped);
assert.match(escapedHtml, /Ada &amp; &quot;Engines&quot; &lt;notes&gt;/);
assert.equal(escapedHtml.includes("<notes>"), false);
assert.equal(escapeHtml(`<script>`), "&lt;script&gt;");

const missingImage = renderHeadTags(resolved);
assert.equal(missingImage.includes("og:image"), false);
assert.equal(missingImage.includes("twitter:image"), false);
assert.match(missingImage, /twitter:card" content="summary"/);

assert.equal(resolvePortfolioSeo(seoSource(source({ selectedTemplate: "future-template" })), "production"), null);
assert.equal(resolvePortfolioSeo(seoSource(source({ id: "bad id" })), "production"), null);

const unavailable = renderUnavailableHead();
assert.match(unavailable, /<title>Portfolio<\/title>/);
assert.match(unavailable, /noindex, nofollow/);
assert.equal(unavailable.includes("John Paul"), false);
assert.equal(unavailable.includes("Selected animation"), false);
assert.equal(unavailable.includes("owner-secret-uid"), false);

const saved = contentWithSeo(named, {
  title: "  New title  ",
  description: "New description",
  image: "https://cdn.example.com/share.jpg",
});
assert.equal(saved.seo.title, "New title");
assert.equal(saved.seo.ogTitle, "New title");
assert.equal(saved.seo.twitterImage, "https://cdn.example.com/share.jpg");
assert.equal(saved.selectedTemplate, named.selectedTemplate);
assert.equal(saved.profile.brandName, named.profile.brandName);
assert.equal(saved.projects[0].title, "Title Sequence");
assert.equal(saved.design.palette, "ocean");
assert.equal(saved.publishing.status, "published");
assert.equal(saved.publishing.publishedAt, "2024-07-01");
assert.deepEqual(saved.discoverability, named.discoverability);
assert.equal(saved.publicSlug, named.publicSlug);
assert.deepEqual(saved.publicSlugAliases, named.publicSlugAliases);
const delivery = publicDeliveryForSavedContent(named, saved);
assert.equal(delivery.action, "upsert");
if (delivery.action === "upsert") {
  assert.equal(delivery.publicId, "ABC123");
  assert.equal(delivery.fields.seo.title, "New title");
  assert.equal(JSON.stringify(delivery.fields).includes("owner-secret-uid"), false);
}
const draft = source({ publishing: { status: "draft" } });
assert.equal(publicDeliveryForSavedContent(draft, contentWithSeo(draft, { title: "Hidden", description: "", image: "" })).action, "leave");

const xml = sitemapXml([
  { publicId: "ABC123", updatedAt: "2024-07-01T00:00:00Z" },
  { publicId: "not valid" },
]);
assert.match(xml, /https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/ABC123/);
assert.match(xml, /<lastmod>2024-07-01T00:00:00Z<\/lastmod>/);
assert.equal(xml.includes("not valid"), false);
const sluggedXml = sitemapXml([{ publicId: "ABC123", slug: "johnpaul", updatedAt: "2024-07-01T00:00:00Z" }]);
assert.match(sluggedXml, /\/p\/johnpaul</);
assert.equal(sluggedXml.includes("/p/ABC123"), false);

const productionRobots = robotsTxt("production");
assert.match(productionRobots, /Allow: \/p\//);
assert.match(productionRobots, /Disallow: \/portfolio/);
assert.match(productionRobots, /Sitemap: https:\/\/customportfolio\.broadbrand\.com\.ng\/sitemap\.xml/);
assert.equal(robotsTxt("preview").includes("Disallow: /"), true);
assert.equal(robotsTxt("preview").includes("Sitemap:"), false);

assert.equal(platformTitle("/"), PRODUCT_NAME);
assert.equal(platformTitle("/auth"), "Sign In — Custom Portfolio");
assert.equal(platformTitle("/templates"), "Explore Templates — Custom Portfolio");
assert.equal(platformTitle("/portfolio"), "My Portfolio — Custom Portfolio");
assert.equal(platformTitle("/portfolio/edit"), "Edit Portfolio — Custom Portfolio");
assert.equal(platformTitle("/portfolio/design"), "Portfolio Design — Custom Portfolio");
assert.equal(platformTitle("/portfolio/review"), "Review Portfolio — Custom Portfolio");
assert.equal(platformTitle("/portfolio/publish"), "Publish Portfolio — Custom Portfolio");
assert.equal(platformTitle("/portfolio/seo"), "Portfolio SEO — Custom Portfolio");
assert.equal(isPortfolioSeoPath(PORTFOLIO_SEO_PATH), true);
assert.equal(isPortfolioSeoPath("/p/ABC123"), false);

const factual = seoSource(source({
  profile: {
    ...named.profile,
    capabilityTags: ["Motion design"],
  },
  contact: { ...named.contact, projectTypes: ["Title sequences"] },
  discoverability: {
    identity: "person",
    serviceRegion: "Lagos",
    faqs: [
      { question: "  Do you take commissions?  ", answer: "Yes, for selected films." },
      { question: "Incomplete", answer: "   " },
    ],
  },
}));
const person = resolvePortfolioSeo(factual, "production");
if (!person) throw new Error("expected person metadata");
assert.equal(person.title, "John Paul — Motion Designer & Animator");
assert.match(person.jsonLd, /"@type":"Person"/);
assert.equal(person.jsonLd.includes('"@type":"Organization"'), false);
assert.match(person.jsonLd, /Motion design/);
assert.match(person.jsonLd, /Title sequences/);
assert.equal(person.jsonLd.includes("Do you take commissions?"), false);
assert.equal(person.jsonLd.includes("FAQPage"), false);
assert.equal(person.jsonLd.includes("Lagos"), false);
assert.equal(person.jsonLd.includes("areaServed"), false);
assert.equal(person.jsonLd.includes("Incomplete"), false);
assert.equal(person.jsonLd.includes("owner-secret-uid"), false);
assert.equal(person.jsonLd.includes("studio@"), false);

const organization = resolvePortfolioSeo({
  ...factual,
  discoverability: { identity: "organization", serviceRegion: "", faqs: [] },
}, "production");
if (!organization) throw new Error("expected organization metadata");
assert.match(organization.jsonLd, /"@type":"Organization"/);
assert.equal(organization.jsonLd.includes('"@type":"Person"'), false);
assert.equal(organization.jsonLd.includes("FAQPage"), false);

const unspecified = resolvePortfolioSeo({
  ...factual,
  seo: { ...factual.seo, title: "Kept title" },
  discoverability: { identity: "", serviceRegion: "Remote", faqs: [] },
}, "production");
if (!unspecified) throw new Error("expected unspecified metadata");
assert.equal(unspecified.title, "Kept title");
assert.equal(unspecified.jsonLd.includes('"@type":"Person"'), false);
assert.equal(unspecified.jsonLd.includes('"@type":"Organization"'), false);
assert.equal(unspecified.jsonLd.includes("FAQPage"), false);
assert.equal(unspecified.jsonLd.includes("Remote"), false);

const factsHtml = renderPortfolioFacts(factual);
assert.match(factsHtml, /<p>John Paul<\/p>/);
assert.match(factsHtml, /<h1>Motion Designer &amp; Animator<\/h1>/);
assert.match(factsHtml, /Motion design/);
assert.match(factsHtml, /Title sequences/);
assert.equal(factsHtml.includes("Do you take commissions?"), false);
assert.equal(factsHtml.includes("Yes, for selected films."), false);
assert.equal(factsHtml.includes("Lagos"), false);
assert.equal(factsHtml.includes("Questions"), false);
assert.equal(factsHtml.includes("<script"), false);
assert.equal(factsHtml.includes("owner-secret-uid"), false);
const escapedFacts = renderPortfolioFacts({
  ...factual,
  profile: { ...factual.profile, headline: `Cost <script> & "care"` },
});
assert.match(escapedFacts, /Cost &lt;script&gt; &amp; &quot;care&quot;/);
assert.equal(escapedFacts.includes("<script>"), false);
assert.equal(templateOffersDiscoverability("wdk-premium-portfolio-1"), true);
assert.equal(templateOffersDiscoverability("future-template"), false);
const wdkTemplate = readFileSync(
  new URL("../templates/wdk-premium-portfolio-1/template/WdkPremiumPortfolio.tsx", import.meta.url),
  "utf8"
);
assert.match(wdkTemplate, /<Hero /);
assert.match(wdkTemplate, /<ProjectSpotlight /);
assert.match(wdkTemplate, /<Contact /);
assert.equal(wdkTemplate.includes("ProfessionalFacts"), false);
const wdkCss = readFileSync(new URL("../templates/wdk-premium-portfolio-1/styles/portfolio.css", import.meta.url), "utf8");
assert.equal(wdkCss.includes("portfolio-facts"), false);
const withBody = applyPublicBody(`<div id="root"></div>`, factsHtml);
assert.match(withBody, /<div id="root"><article>/);
assert.equal((withBody.match(/<h1>/g) ?? []).length, 1);

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const sitemapRules = rules.slice(rules.indexOf("match /sitemapEntries/{publicId}"), rules.indexOf("match /{document=**}"));
assert.match(sitemapRules, /allow read: if true;/);
assert.match(sitemapRules, /privatePortfolioAfter\(\)\.data\.ownerId == request\.auth\.uid/);
assert.match(sitemapRules, /request\.resource\.data\.keys\(\)\.hasOnly\(\["publicId", "updatedAt", "slug"\]\)/);
const privateRules = rules.slice(rules.indexOf("match /portfolios/{portfolioId}"), rules.indexOf("match /publicPortfolios/{publicId}"));
assert.match(privateRules, /allow read: if isSignedIn\(\) && resource\.data\.ownerId == request\.auth\.uid;/);
assert.equal(privateRules.includes("allow read: if true"), false);

const vercel = readFileSync(new URL("../../vercel.json", import.meta.url), "utf8");
assert.match(vercel, /\/api\/site\?kind=portfolio/);
assert.match(vercel, /\/robots\.txt/);
assert.match(vercel, /\/sitemap\.xml/);

console.log("portfolio seo checks passed");
