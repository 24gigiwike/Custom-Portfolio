export const WDK_TEMPLATE_PREVIEW_PATH = "/template-preview/wdk-premium-portfolio-1";
export const CREATIVE_TEMPLATE_PREVIEW_PATH = "/template-preview/the-creative";

const CREATIVE_PROJECT_PREVIEW = /^\/template-preview\/the-creative\/work\/[^/]+\/?$/;

/** Preview pathname with a Creative project page folded back to the template preview. */
export function catalogPreviewPathname(path: string): string {
    const pathname = path.split("?")[0].split("#")[0];
    if (CREATIVE_PROJECT_PREVIEW.test(pathname)) return CREATIVE_TEMPLATE_PREVIEW_PATH;
    return pathname;
}

export function isWdkTemplatePreviewPath(path: string) {
    return path.split("?")[0].split("#")[0] === WDK_TEMPLATE_PREVIEW_PATH;
}

export function isCatalogTemplatePreviewPath(path: string) {
    const pathname = path.split("?")[0].split("#")[0];
    return pathname === WDK_TEMPLATE_PREVIEW_PATH
        || pathname === CREATIVE_TEMPLATE_PREVIEW_PATH
        || CREATIVE_PROJECT_PREVIEW.test(pathname);
}

/** Marketplace preview for any catalogue template. The sample query selects fixture content. */
export function catalogSamplePreviewPath(previewPath: string): string {
    const hashless = previewPath.split("#")[0];
    const cut = hashless.indexOf("?");
    const pathname = cut === -1 ? hashless : hashless.slice(0, cut);
    const params = new URLSearchParams(cut === -1 ? "" : hashless.slice(cut + 1));
    params.set("data", "sample");
    return `${pathname}?${params.toString()}`;
}
