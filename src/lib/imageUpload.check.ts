import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { draftFromPortfolio, draftsMatch } from "../components/portfolio-editor/editorDraft";
import { Hero } from "../templates/wdk-premium-portfolio-1/components/Hero.tsx";
import { Header } from "../templates/wdk-premium-portfolio-1/components/Header.tsx";
import { portfolioLogoSrc } from "../templates/wdk-premium-portfolio-1/presentation/logoSrc";
import { cssImageUrl } from "../templates/wdk-premium-portfolio-1/presentation/cssImageUrl";
import type { UserPortfolio } from "../types/userPortfolio";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

assert.equal(portfolioLogoSrc(""), null);
assert.equal(portfolioLogoSrc("   "), null);
assert.equal(portfolioLogoSrc("https://cdn.example.com/logo.png"), "https://cdn.example.com/logo.png");

const emptyHeader = renderToStaticMarkup(createElement(Header, { brandName: "Ada Lovelace", logo: "  ", socialLinks: [] }));
assert.equal(emptyHeader.includes("<img"), false);
assert.match(emptyHeader, /nav-container-left-L/);
assert.match(emptyHeader, /nav-container-left-R/);
const savedLogo = "https://cdn.example.com/logo.png";
const logoHeader = renderToStaticMarkup(createElement(Header, { brandName: "Ada Lovelace", logo: savedLogo, socialLinks: [] }));
assert.match(logoHeader, /class="logo"/);
assert.match(logoHeader, /src="https:\/\/cdn.example.com\/logo.png"/);
assert.match(logoHeader, /alt="Ada Lovelace"/);
assert.equal(logoHeader.includes('src=""'), false);
assert.equal(cssImageUrl(""), "none");
assert.equal(cssImageUrl("  "), "none");
assert.equal(cssImageUrl("https://cdn.example.com/portrait.jpg"), 'url("https://cdn.example.com/portrait.jpg")');

const profile = {
  brandName: "Ada Lovelace",
  logo: "",
  heroImage: "",
  heroImageMobile: "",
  headline: "Analytical engines",
  capabilityTags: ["Mathematics"],
  ctaLabel: "Write",
  ctaHref: "#contact",
  email: "",
};
const emptyHero = renderToStaticMarkup(createElement(Hero, { profile, socialLinks: [] }));
assert.equal(emptyHero.includes("<img"), false);
assert.match(emptyHero, /class="container"/);
assert.match(emptyHero, /class="container-left"/);
assert.match(emptyHero, /class="container-right"/);
assert.match(emptyHero, /Analytical engines/);
const savedHero = renderToStaticMarkup(createElement(Hero, {
  profile: { ...profile, logo: savedLogo },
  socialLinks: [],
}));
assert.match(savedHero, /class="logo"/);
assert.match(savedHero, /src="https:\/\/cdn\.example\.com\/logo\.png"/);
assert.equal(savedHero.includes('src=""'), false);
assert.match(savedHero, /class="container-right"/);
const emptyHeroStyle = renderToStaticMarkup(createElement("div", {
  className: "container-right",
  style: { "--hero-image": cssImageUrl(""), "--hero-image-mobile": cssImageUrl(" ") },
}));
assert.match(emptyHeroStyle, /--hero-image:none/);
assert.match(emptyHeroStyle, /--hero-image-mobile:none/);
assert.equal(emptyHeroStyle.includes("url("), false);
const savedHeroUrl = "https://cdn.example.com/portrait.jpg";
const savedHeroStyle = renderToStaticMarkup(createElement("div", {
  className: "container-right",
  style: { "--hero-image": cssImageUrl(savedHeroUrl), "--hero-image-mobile": cssImageUrl(savedHeroUrl) },
}));
assert.match(savedHeroStyle, /--hero-image:url\(&quot;https:\/\/cdn\.example\.com\/portrait\.jpg&quot;\)/);
assert.match(savedHeroStyle, /--hero-image-mobile:url\(&quot;https:\/\/cdn\.example\.com\/portrait\.jpg&quot;\)/);

const header = read("../templates/wdk-premium-portfolio-1/components/Header.tsx");
assert.match(header, /portfolioLogoSrc\(logo\)/);
assert.match(header, /logoSrc \? <img/);
assert.doesNotMatch(header, /src=\{logo\}/);
assert.doesNotMatch(header, /src=""/);

const template = read("../templates/wdk-premium-portfolio-1/template/WdkPremiumPortfolio.tsx");
assert.match(template, /cssImageUrl\(data\.profile\.heroImage\)/);
assert.match(template, /cssImageUrl\(data\.profile\.heroImageMobile\)/);
assert.doesNotMatch(template, /url\(""\)/);

const field = read("../components/portfolio-editor/ImageField.tsx");
assert.match(field, /const preview = localUrl \|\| value/);
assert.match(field, /Try again/);
assert.match(field, /Cancel/);
const fileInput = field.slice(field.indexOf('type="file"'), field.indexOf('type="file"') + 280);
assert.match(fileInput, /disabled=\{disabled\}/);
assert.doesNotMatch(fileInput, /disabled \|\| busy/);

const editor = read("../components/portfolio-editor/PortfolioEditor.tsx");
assert.match(editor, /updatePortfolio\(portfolio\.id, contentFromDraft\(portfolio, draft\)\)/);
assert.match(editor, /useUnsavedChanges\(hasUnsavedChanges\)/);
assert.match(editor, /confirmDiscard\(hasUnsavedChanges\)/);
assert.match(editor, /Unsaved changes\. Save before leaving\./);
assert.match(editor, /aria-live="polite">Saved/);
assert.match(editor, /heroImage: url, heroImageMobile: url/);
assert.doesNotMatch(editor, /deleteStoredImage/);

const hook = read("../components/portfolio-editor/usePortfolioImageField.ts");
assert.match(hook, /URL\.createObjectURL\(file\)/);
assert.match(hook, /URL\.revokeObjectURL/);
assert.match(hook, /ImagePreparationError/);
assert.match(hook, /ImageUploadCancelled/);
assert.match(hook, /beginPortfolioImageUpload/);
assert.match(hook, /releaseImageAttempt/);
assert.match(hook, /generationRef\.current = released\.generation/);
assert.match(hook, /attempt\.phase === "ready" \|\| attempt\.phase === "idle"/);
assert.match(hook, /probe\.onerror/);
const uploadResult = hook.slice(hook.indexOf("session.done.then"), hook.indexOf("error: unknown"));
assert.match(uploadResult, /generationRef\.current !== generation/);
assert.match(uploadResult, /onUploaded\(uploaded\.downloadUrl\)/);
const uploadFailure = hook.slice(hook.indexOf("error: unknown"), hook.indexOf("useEffect"));
assert.doesNotMatch(uploadFailure, /onUploaded/);
assert.match(hook, /fileRef\.current = file/);
assert.match(hook, /start\(file, next\.generation\)/);
assert.doesNotMatch(hook, /deleteStoredImage/);
assert.doesNotMatch(hook, /updatePortfolio/);

const portfolio = {
  id: "portfolio-1",
  ownerId: "owner-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "Ada",
    logo: "",
    heroImage: "https://cdn.example.com/saved.jpg",
    heroImageMobile: "https://cdn.example.com/saved.jpg",
    headline: "Hello",
    capabilityTags: [],
    ctaLabel: "Go",
    ctaHref: "#contact",
    email: "",
  },
  socialLinks: [],
  projects: [],
  contact: { email: "", eyebrow: "", heading: "", description: "", projectTypes: [], formEndpoint: "" },
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
  design: { palette: "original" },
  publicSlug: "",
  publicSlugAliases: [],
  publishing: { status: "draft" },
  createdAt: null,
  updatedAt: null,
} as UserPortfolio;
const savedDraft = draftFromPortfolio(portfolio);
const uploadedDraft = {
  ...savedDraft,
  heroImage: "https://cdn.example.com/uploaded.jpg",
  heroImageMobile: "https://cdn.example.com/uploaded.jpg",
};
assert.equal(draftsMatch(savedDraft, uploadedDraft), false);
assert.equal(draftsMatch(savedDraft, { ...savedDraft }), true);

const seo = read("../components/portfolio-seo/PortfolioSeo.tsx");
assert.match(seo, /contentWithSeo\(portfolio,/);
assert.match(seo, /useUnsavedChanges\(dirty\)/);
assert.match(seo, /beforeLeave=\{leave\}/);
assert.match(seo, /folder: "social"/);
assert.match(seo, /Unsaved changes\. Save before leaving\./);
assert.match(seo, /aria-live="polite">Saved/);
assert.doesNotMatch(seo, /deleteStoredImage/);

const storage = read("./storage.ts");
const beginUpload = storage.slice(
  storage.indexOf("export function beginPortfolioImageUpload"),
  storage.indexOf("export async function uploadPortfolioImage"),
);
assert.match(beginUpload, /uploadTask\?\.cancel\(\)/);
assert.match(beginUpload, /phase: "finalizing"/);
assert.doesNotMatch(beginUpload, /cacheControl|deleteStoredImage|deleteObject/);
assert.match(storage, /optimizeImageForUpload\(file, undefined, "project"\)/);
assert.doesNotMatch(storage, /cacheControl/);

const review = read("../components/portfolio-review/PortfolioReview.tsx");
assert.match(review, /getPortfolioByOwner/);
const preview = read("../preview/WdkTemplatePreview.tsx");
assert.match(preview, /getPortfolioByOwner/);

const overview = read("../components/portfolio-workspace/PortfolioWorkspace.tsx");
assert.match(overview, /fetchPriority="high"/);
assert.match(overview, /onError=\{\(\) => setPortraitBroken\(true\)\}/);

console.log("image upload checks passed");
