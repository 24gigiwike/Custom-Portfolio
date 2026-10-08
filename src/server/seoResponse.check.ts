import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../../api/site";
import { homeHtml, loadSitemapEntries, publicPortfolioHtml } from "./seoResponse";

const shell = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function field(value: unknown): unknown {
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((item) => field(item)) } };
  if (value && typeof value === "object") {
    const fields: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) fields[key] = field(child);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function documentFor(data: Record<string, unknown>): string {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) fields[key] = field(value);
  return JSON.stringify({ fields });
}

const published = documentFor({
  publicId: "ABC123",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "John Paul",
    headline: "Motion Designer & Animator",
    heroImage: "https://cdn.example.com/portrait.jpg",
    email: "private-looking@example.com",
  },
  contact: { description: "Selected animation and motion work.", email: "studio@example.com" },
  projects: [{ id: "reel", title: "Title Sequence", url: "https://john.example/reel" }],
  socialLinks: [],
  seo: {
    title: "John Paul — Motion Designer & Animator",
    description: "Explore the animation work of John Paul.",
    ogImage: "https://cdn.example.com/share.jpg",
    twitterImage: "https://cdn.example.com/share.jpg",
  },
  design: { palette: "ocean" },
  discoverability: {
    identity: "person",
    serviceRegion: "Lagos",
    faqs: [{ question: "Do you take commissions?", answer: "Yes, for selected films." }],
  },
  ownerId: "owner-secret-uid",
});

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
}

try {
  mockFetch((url) => {
    if (url.includes("/publicPortfolios/ABC123")) return new Response(published, { status: 200 });
    if (url.includes("/publicPortfolios/missingid")) return new Response("{}", { status: 404 });
    if (url.includes("/publicPortfolios/deniedid")) return new Response("{}", { status: 403 });
    if (url.includes("/publicPortfolios/futureid")) {
      return new Response(documentFor({
        publicId: "futureid",
        selectedTemplate: "future-template",
        profile: { brandName: "Hidden Name" },
        contact: { description: "Hidden description" },
        seo: { title: "Hidden title" },
        design: { palette: "ocean" },
      }), { status: 200 });
    }
    if (url.includes("/publicPortfolios/brokenid")) return new Response("nope", { status: 500 });
    if (url.includes("/publicPortfolios/SLUGID")) {
      return new Response(documentFor({
        publicId: "SLUGID",
        selectedTemplate: "wdk-premium-portfolio-1",
        profile: { brandName: "John Paul", headline: "Motion Designer" },
        contact: { description: "Selected animation and motion work." },
        projects: [],
        socialLinks: [],
        seo: { title: "John Paul — Motion Designer", description: "Selected animation and motion work." },
        design: { palette: "original" },
        publicSlug: "johnpaul",
      }), { status: 200 });
    }
    if (url.includes("/publicPortfolios/IDONLY")) {
      return new Response(documentFor({
        publicId: "IDONLY",
        selectedTemplate: "wdk-premium-portfolio-1",
        profile: { brandName: "Kept Name", headline: "Kept headline" },
        contact: { description: "Kept description." },
        projects: [],
        socialLinks: [],
        seo: { title: "Kept title", description: "Kept description." },
        design: { palette: "original" },
        publicSlug: "",
      }), { status: 200 });
    }
    if (url.includes("/portfolioSlugs/johnpaul")) {
      return new Response(documentFor({ slug: "johnpaul", portfolioId: "SLUGID", role: "active" }), { status: 200 });
    }
    if (url.includes("/portfolioSlugs/old-name")) {
      return new Response(documentFor({ slug: "old-name", portfolioId: "SLUGID", role: "alias" }), { status: 200 });
    }
    if (url.includes("/portfolioSlugs/hidden")) return new Response("{}", { status: 403 });
    if (url.includes("/sitemapEntries")) return new Response("{}", { status: 403 });
    return new Response("{}", { status: 404 });
  });

  const page = await publicPortfolioHtml("ABC123", shell, "production");
  assert.equal(page.status, 200);
  assert.match(page.html, /<title>John Paul — Motion Designer &amp; Animator<\/title>/);
  assert.match(page.html, /name="description" content="Explore the animation work of John Paul."/);
  assert.match(page.html, /rel="canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/ABC123"/);
  assert.match(page.html, /property="og:title" content="John Paul — Motion Designer &amp; Animator"/);
  assert.match(page.html, /property="og:description" content="Explore the animation work of John Paul."/);
  assert.match(page.html, /property="og:image" content="https:\/\/cdn\.example\.com\/share\.jpg"/);
  assert.match(page.html, /name="twitter:card" content="summary_large_image"/);
  assert.match(page.html, /name="twitter:title"/);
  assert.match(page.html, /name="robots" content="index, follow"/);
  assert.match(page.html, /application\/ld\+json/);
  assert.match(page.html, /<h1>Motion Designer &amp; Animator<\/h1>/);
  assert.equal(page.html.includes("Do you take commissions?"), false);
  assert.equal(page.html.includes("FAQPage"), false);
  assert.equal(page.html.includes("Lagos"), false);
  assert.equal(page.html.includes("areaServed"), false);
  assert.match(page.html, /"@type":"Person"/);
  assert.equal(page.html.includes("owner-secret-uid"), false);
  assert.equal(page.html.includes("private-looking@example.com"), false);
  assert.equal(page.html.includes("studio@example.com"), false);
  assert.equal(page.html.includes("portrait.jpg"), false);

  const preview = await publicPortfolioHtml("ABC123", shell, "preview");
  assert.equal(preview.status, 200);
  assert.match(preview.html, /name="robots" content="noindex, nofollow"/);
  assert.match(preview.html, /canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/ABC123"/);

  const missing = await publicPortfolioHtml("missingid", shell, "production");
  assert.equal(missing.status, 404);
  assert.match(missing.html, /<title>Portfolio<\/title>/);
  assert.match(missing.html, /noindex, nofollow/);
  assert.equal(missing.html.includes("John Paul"), false);
  assert.equal(missing.html.includes("Do you take commissions"), false);
  assert.equal(missing.html.includes("Explore the animation"), false);
  assert.equal(missing.html.includes("share.jpg"), false);

  const denied = await publicPortfolioHtml("deniedid", shell, "production");
  assert.equal(denied.status, 404);
  assert.equal(denied.html.includes("Hidden"), false);

  const unknown = await publicPortfolioHtml("futureid", shell, "production");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.html.includes("Hidden title"), false);
  assert.equal(unknown.html.includes("Hidden Name"), false);

  const broken = await publicPortfolioHtml("brokenid", shell, "production");
  assert.equal(broken.status, 502);
  assert.match(broken.html, /<title>Portfolio<\/title>/);
  assert.equal(broken.html.includes("John Paul"), false);

  const home = homeHtml(shell, "production");
  assert.match(home, /<title>Custom Portfolio<\/title>/);
  assert.match(home, /name="robots" content="index, follow"/);
  assert.match(home, /canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/"/);
  const localHome = homeHtml(shell, "development");
  assert.match(localHome, /name="robots" content="noindex, nofollow"/);

  await assert.rejects(() => loadSitemapEntries());

  const slugPage = await publicPortfolioHtml("johnpaul", shell, "production");
  assert.equal(slugPage.status, 200);
  assert.match(slugPage.html, /<title>John Paul — Motion Designer<\/title>/);
  assert.match(slugPage.html, /rel="canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/johnpaul"/);
  assert.equal(slugPage.html.includes("/p/SLUGID"), false);
  assert.equal(slugPage.html.includes("owner-secret"), false);

  const idRedirect = await publicPortfolioHtml("SLUGID", shell, "production");
  assert.equal(idRedirect.status, 301);
  assert.equal(idRedirect.location, "https://customportfolio.broadbrand.com.ng/p/johnpaul");
  assert.equal(idRedirect.html.includes("John Paul"), false);
  assert.equal(idRedirect.html.includes("FAQPage"), false);

  const alias = await publicPortfolioHtml("old-name", shell, "production");
  assert.equal(alias.status, 301);
  assert.equal(alias.location, "https://customportfolio.broadbrand.com.ng/p/johnpaul");
  assert.equal(alias.html.includes("John Paul"), false);

  const idOnly = await publicPortfolioHtml("IDONLY", shell, "production");
  assert.equal(idOnly.status, 200);
  assert.match(idOnly.html, /rel="canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/IDONLY"/);
  assert.equal(idOnly.location, undefined);

  const hiddenSlug = await publicPortfolioHtml("hidden", shell, "production");
  assert.equal(hiddenSlug.status, 404);
  assert.equal(hiddenSlug.location, undefined);
  assert.equal(hiddenSlug.html.includes("John Paul"), false);

  const unknownSlug = await publicPortfolioHtml("not-a-portfolio", shell, "production");
  assert.equal(unknownSlug.status, 404);

  const respond = async (url: string, host: string) => {
    let status = 0;
    let body = "";
    const headers: Record<string, string> = {};
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      end(value: string) {
        body = value;
      },
    };
    await handler({ url, headers: { host } }, res);
    return { status, body, headers };
  };

  const productionHome = await respond("/api/site?kind=home", "customportfolio.broadbrand.com.ng");
  assert.equal(productionHome.status, 200);
  assert.match(productionHome.body, /<title>Custom Portfolio<\/title>/);
  assert.match(productionHome.body, /name="robots" content="index, follow"/);

  const previewRobots = await respond("/api/site?kind=robots", "custom-portfolio-git-preview.vercel.app");
  assert.equal(previewRobots.status, 200);
  assert.match(previewRobots.body, /Disallow: \//);
  assert.equal(previewRobots.body.includes("Sitemap:"), false);

  const productionRobots = await respond("/api/site?kind=robots", "customportfolio.broadbrand.com.ng");
  assert.match(productionRobots.body, /Sitemap: https:\/\/customportfolio\.broadbrand\.com\.ng\/sitemap\.xml/);
  assert.match(productionRobots.body, /Disallow: \/portfolio/);

  const missingPage = await respond("/api/site?kind=portfolio&publicId=missingid", "customportfolio.broadbrand.com.ng");
  assert.equal(missingPage.status, 404);
  assert.match(missingPage.body, /<title>Portfolio<\/title>/);
  assert.equal(missingPage.body.includes("John Paul"), false);

  const slugRefresh = await respond("/api/site?kind=portfolio&publicId=johnpaul", "customportfolio.broadbrand.com.ng");
  assert.equal(slugRefresh.status, 200);
  assert.match(slugRefresh.body, /canonical" href="https:\/\/customportfolio\.broadbrand\.com\.ng\/p\/johnpaul"/);

  const idRefresh = await respond("/api/site?kind=portfolio&publicId=SLUGID", "customportfolio.broadbrand.com.ng");
  assert.equal(idRefresh.status, 301);
  assert.equal(idRefresh.headers.location, "https://customportfolio.broadbrand.com.ng/p/johnpaul");
  assert.equal(idRefresh.body.includes("John Paul"), false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("seo response checks passed");
