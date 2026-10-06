import assert from "node:assert/strict";
import { isPortfolioDesignPath, PORTFOLIO_DESIGN_PATH } from "../components/portfolio-design/portfolioDesignPath";
import { isPortfolioEditorPath } from "../components/portfolio-editor/portfolioEditorPath";
import { isPortfolioWorkspacePath } from "../components/portfolio-workspace/portfolioWorkspacePath";
import { WDK_PALETTE_COLORS, wdkPaletteVariables } from "../templates/wdk-premium-portfolio-1/design/palettes";
import type { UserPortfolio } from "../types/userPortfolio";
import { normalizePortfolioDesign, PORTFOLIO_PALETTE_IDS } from "../types/portfolioDesign";
import {
  templateDesignCapabilities,
  templateDesignControl,
  templateSupportsDesignControl,
} from "./templateCatalog";
import { contentWithDesign, designOptionSwatches } from "./portfolioDesign";
import { toWdkPremiumPortfolioData, wdkPaletteForPortfolio } from "./wdkPortfolioAdapter";

const wdkDesign = templateDesignCapabilities("wdk-premium-portfolio-1");
assert.ok(wdkDesign);
assert.deepEqual(
  wdkDesign.controls.map((control) => control.id),
  ["palette"]
);
assert.equal(templateSupportsDesignControl("wdk-premium-portfolio-1", "palette"), true);
assert.deepEqual(
  templateDesignControl("wdk-premium-portfolio-1", "palette")?.options.map((option) => option.id),
  [...PORTFOLIO_PALETTE_IDS]
);

assert.equal(templateDesignCapabilities("future-template"), null);
assert.equal(templateDesignCapabilities("unknown-template"), null);
assert.equal(templateDesignControl("unknown-template", "palette"), null);
assert.equal(templateSupportsDesignControl("unknown-template", "palette"), false);
assert.equal(templateSupportsDesignControl("future-template", "palette"), false);

assert.deepEqual(normalizePortfolioDesign(undefined), { palette: "original" });
assert.deepEqual(normalizePortfolioDesign({}), { palette: "original" });
assert.deepEqual(normalizePortfolioDesign({ palette: "neon", background: "#ff0000" }), { palette: "original" });
assert.deepEqual(Object.keys(normalizePortfolioDesign({ palette: "forest", background: "#fff" })), ["palette"]);
assert.deepEqual(normalizePortfolioDesign({ palette: "forest" }), { palette: "forest" });

const originalVariables = wdkPaletteVariables("original");
assert.equal(originalVariables["--wdk-accent"], WDK_PALETTE_COLORS.original.accent);
assert.equal(originalVariables["--wdk-accent-deep"], "#e09ae9");
assert.equal(originalVariables["--wdk-accent-soft"], "#e8c9fc");
assert.equal(originalVariables["--wdk-accent-mid"], "#e4cce7");
assert.equal(originalVariables["--wdk-accent-bright"], "#f7d7fe");

const oceanVariables = wdkPaletteVariables("ocean");
assert.equal(oceanVariables["--wdk-accent"], WDK_PALETTE_COLORS.ocean.accent);
assert.notEqual(oceanVariables["--wdk-accent"], originalVariables["--wdk-accent"]);
assert.equal(JSON.stringify(wdkPaletteVariables("#ff0000")), JSON.stringify(originalVariables));
assert.equal(JSON.stringify(wdkPaletteVariables("background: #ff0000")), JSON.stringify(originalVariables));
assert.equal(JSON.stringify(oceanVariables).includes("#ff0000"), false);

const portfolio: UserPortfolio = {
  id: "portfolio-1",
  ownerId: "owner-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "Amina Cole",
    logo: "logo.png",
    heroImage: "https://example.com/desktop.jpg",
    heroImageMobile: "https://example.com/mobile.jpg",
    headline: "Product designer",
    capabilityTags: ["Brand"],
    ctaLabel: "Start a project",
    ctaHref: "#contact",
    email: "amina@example.com",
  },
  socialLinks: [{ platform: "instagram", url: "https://instagram.com/amina" }],
  projects: [{ id: "project-kept", title: "Northline", category: "Identity", url: "https://northline.example", tech: ["Figma"] }],
  contact: {
    email: "studio@example.com",
    eyebrow: "Contact",
    heading: "Let's talk",
    description: "Available for selected work.",
    projectTypes: ["Identity"],
    formEndpoint: "",
  },
  seo: {
    title: "Amina Cole",
    description: "Portfolio",
    canonicalUrl: "",
    ogTitle: "Amina Cole",
    ogDescription: "Portfolio",
    ogImage: "",
    twitterTitle: "Amina Cole",
    twitterDescription: "Portfolio",
    twitterImage: "",
  },
  design: { palette: "original" },
  publishing: { status: "draft" },
  createdAt: null,
  updatedAt: null,
};

assert.equal(wdkPaletteForPortfolio(portfolio), "original");
assert.equal(wdkPaletteForPortfolio({ ...portfolio, design: undefined }), "original");

const oceanContent = contentWithDesign(portfolio, "ocean");
assert.equal(oceanContent.design.palette, "ocean");
assert.equal(oceanContent.selectedTemplate, portfolio.selectedTemplate);
assert.deepEqual(oceanContent.profile, portfolio.profile);
assert.deepEqual(oceanContent.socialLinks, portfolio.socialLinks);
assert.deepEqual(oceanContent.projects, portfolio.projects);
assert.deepEqual(oceanContent.contact, portfolio.contact);
assert.deepEqual(oceanContent.seo, portfolio.seo);
assert.equal(oceanContent.profile.email, "amina@example.com");
assert.equal(oceanContent.contact.email, "studio@example.com");

const rejected = contentWithDesign(portfolio, "#ff0000");
assert.equal(rejected.design.palette, "original");
assert.equal(JSON.stringify(rejected.design).includes("#ff0000"), false);

const unknown = contentWithDesign({ ...portfolio, selectedTemplate: "future-template" }, "ocean");
assert.equal(unknown.design.palette, "original");
assert.equal(unknown.selectedTemplate, "future-template");
assert.deepEqual(unknown.profile, portfolio.profile);

const oceanPortfolio = { ...portfolio, design: { palette: "ocean" as const } };
assert.equal(wdkPaletteForPortfolio(oceanPortfolio), "ocean");
assert.equal(wdkPaletteForPortfolio({ ...oceanPortfolio, selectedTemplate: "future-template" }), "original");
assert.equal(wdkPaletteForPortfolio({ ...portfolio, design: { palette: "not-a-palette" as "original" } }), "original");

const presented = toWdkPremiumPortfolioData(oceanPortfolio);
assert.equal(presented.profile.brandName, "Amina Cole");
assert.equal(presented.profile.email, "amina@example.com");
assert.deepEqual(presented.socialLinks, portfolio.socialLinks);
assert.equal(presented.projects[0]?.id, "project-kept");
assert.equal(presented.contact.email, "studio@example.com");
assert.deepEqual(presented.seo, portfolio.seo);
assert.equal("design" in presented, false);

assert.deepEqual(designOptionSwatches("wdk-premium-portfolio-1", "ocean"), [
  WDK_PALETTE_COLORS.ocean.soft,
  WDK_PALETTE_COLORS.ocean.accent,
  WDK_PALETTE_COLORS.ocean.deep,
]);
assert.equal(designOptionSwatches("future-template", "ocean"), null);
assert.equal(designOptionSwatches("wdk-premium-portfolio-1", "#ff0000"), null);

assert.equal(isPortfolioDesignPath(PORTFOLIO_DESIGN_PATH), true);
assert.equal(isPortfolioDesignPath("/portfolio"), false);
assert.equal(isPortfolioDesignPath("/portfolio/edit"), false);
assert.equal(isPortfolioWorkspacePath(PORTFOLIO_DESIGN_PATH), false);
assert.equal(isPortfolioEditorPath(PORTFOLIO_DESIGN_PATH), false);

console.log("portfolio design checks passed");
