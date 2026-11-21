import { useLayoutEffect } from "react";
import type { PortfolioSEO } from "../../wdk-premium-portfolio-1/types/portfolio.ts";

type Restore = () => void;

function upsertMeta(attribute: "name" | "property", key: string, content: string): Restore {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector(selector);
  if (!content) {
    if (!existing) return () => undefined;
    const previous = existing.getAttribute("content");
    existing.remove();
    return () => {
      const restored = document.createElement("meta");
      restored.setAttribute(attribute, key);
      if (previous !== null) restored.setAttribute("content", previous);
      document.head.appendChild(restored);
    };
  }
  const created = !existing;
  const previous = existing?.getAttribute("content") ?? null;
  const element = existing ?? document.createElement("meta");
  if (created) {
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
  return () => {
    if (created) {
      element.remove();
      return;
    }
    if (previous === null) element.removeAttribute("content");
    else element.setAttribute("content", previous);
  };
}

export function useCreativeSeo(seo: PortfolioSEO, robots = "noindex, nofollow") {
  useLayoutEffect(() => {
    const previousTitle = document.title;
    if (seo.title.trim()) document.title = seo.title;
    const restore = [
      upsertMeta("name", "description", seo.description),
      upsertMeta("name", "robots", robots),
      upsertMeta("property", "og:title", seo.ogTitle || seo.title),
      upsertMeta("property", "og:description", seo.ogDescription || seo.description),
      upsertMeta("property", "og:image", seo.ogImage),
      upsertMeta("name", "twitter:title", seo.twitterTitle || seo.ogTitle || seo.title),
      upsertMeta("name", "twitter:description", seo.twitterDescription || seo.ogDescription || seo.description),
      upsertMeta("name", "twitter:image", seo.twitterImage || seo.ogImage),
    ];
    return () => {
      document.title = previousTitle;
      restore.forEach((undo) => undo());
    };
  }, [seo, robots]);
}
