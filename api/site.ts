import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { robotsTxt, siteEnvironmentFromHost, sitemapXml } from "../src/lib/portfolioSeo.js";
import { homeHtml, loadSitemapEntries, publicPortfolioHtml } from "../src/server/seoResponse.js";

type HeaderValue = string | string[] | undefined;

type SiteRequest = {
  url?: string;
  headers: Record<string, HeaderValue>;
};

type SiteResponse = {
  status: (code: number) => SiteResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

function shellHtml(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "dist", "index.html"),
    join(here, "..", "dist", "index.html"),
    join(process.cwd(), "index.html"),
    join(here, "..", "index.html"),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("Application shell was not found.");
  return readFileSync(found, "utf8");
}

function environmentFor(req: SiteRequest) {
  const forwarded = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const host = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return siteEnvironmentFromHost(host.split(",")[0] ?? "");
}

/**
 * Initial HTML for the product home, a published portfolio, robots.txt, and the sitemap.
 * Reads only the public Firestore projection with the web API key. No admin credential.
 */
export default async function handler(req: SiteRequest, res: SiteResponse) {
  const url = new URL(req.url ?? "/", "https://customportfolio.broadbrand.com.ng");
  const kind = url.searchParams.get("kind");
  const environment = environmentFor(req);

  if (kind === "robots") {
    res.status(200);
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(robotsTxt(environment));
    return;
  }

  if (kind === "sitemap") {
    try {
      const entries = await loadSitemapEntries();
      res.status(200);
      res.setHeader("content-type", "application/xml; charset=utf-8");
      res.setHeader("cache-control", "public, max-age=300");
      res.end(sitemapXml(entries));
    } catch {
      res.status(503);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Sitemap unavailable");
    }
    return;
  }

  if (kind === "portfolio") {
    const publicId = url.searchParams.get("publicId") ?? "";
    const result = await publicPortfolioHtml(publicId, shellHtml(), environment);
    res.status(result.status);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    res.end(result.html);
    return;
  }

  res.status(200);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(homeHtml(shellHtml(), environment));
}
