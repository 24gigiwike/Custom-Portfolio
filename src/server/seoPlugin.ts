import { readFileSync } from "node:fs";
import type { Connect, Plugin } from "vite";
import { publicPortfolioIdFromPath } from "../components/public/publicPortfolioPath";
import { robotsTxt, sitemapXml } from "../lib/portfolioSeo";
import { loadSitemapEntries, publicPortfolioHtml } from "./seoResponse";

function attach(shellPath: string, transform?: (url: string, html: string) => Promise<string>): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/robots.txt") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(robotsTxt("development"));
      return;
    }
    if (pathname === "/sitemap.xml") {
      try {
        const entries = await loadSitemapEntries();
        res.statusCode = 200;
        res.setHeader("content-type", "application/xml; charset=utf-8");
        res.setHeader("cache-control", "public, max-age=300");
        res.end(sitemapXml(entries));
      } catch {
        res.statusCode = 503;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Sitemap unavailable");
      }
      return;
    }
    const publicId = publicPortfolioIdFromPath(pathname);
    if (!publicId) {
      next();
      return;
    }
    const rawShell = readFileSync(shellPath, "utf8");
    const shell = transform ? await transform(req.url ?? "/", rawShell) : rawShell;
    const result = await publicPortfolioHtml(publicId, shell, "development");
    res.statusCode = result.status;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    res.end(result.html);
  };
}

/** Dev and preview servers answer /p/:id, /robots.txt, and /sitemap.xml before the SPA fallback. */
export function portfolioSeoPlugin(root: string): Plugin {
  return {
    name: "portfolio-seo",
    configureServer(server) {
      server.middlewares.use(attach(`${root}/index.html`, (url, html) => server.transformIndexHtml(url, html)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(attach(`${root}/dist/index.html`));
    },
  };
}
