import assert from "node:assert/strict";
import { draftFromPortfolio, editorAreasForTemplate } from "../components/portfolio-editor/editorDraft";
import { templateContentAreas, templateDesignCapabilities, templatePreviewImage } from "./templateCatalog";
import { wdkPaletteForPortfolio } from "./wdkPortfolioAdapter";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import type { UserPortfolio } from "../types/userPortfolio";

const current: Record<string, unknown> = {
  ownerId: "user-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "Ada Lovelace",
    logo: "https://cdn.example.com/logo.png",
    heroImage: "https://cdn.example.com/portrait.jpg",
    heroImageMobile: "https://cdn.example.com/portrait-mobile.jpg",
    headline: "Analytical engines",
    capabilityTags: ["Mathematics", "Computing"],
    ctaLabel: "Write",
    ctaHref: "#contact",
    email: "ada@example.com",
  },
  socialLinks: [
    { platform: "instagram", url: "https://instagram.com/ada" },
    { platform: "x", url: "https://x.com/ada" },
  ],
  projects: [
    {
      id: "note",
      title: "Notes",
      category: "Essay",
      url: "https://ada.example/notes",
      tech: ["HTML", "CSS", "JavaScript"],
    },
  ],
  contact: {
    email: "work@example.com",
    eyebrow: "Start",
    heading: "Hello",
    description: "A saved description.",
    projectTypes: ["Website"],
    formEndpoint: "https://form.example/ada",
  },
  seo: {
    title: "Ada | Notes",
    description: "Saved search text.",
    canonicalUrl: "https://ada.example",
    ogTitle: "Ada",
    ogDescription: "Notes",
    ogImage: "https://cdn.example.com/og.jpg",
    twitterTitle: "Ada",
    twitterDescription: "Notes",
    twitterImage: "https://cdn.example.com/twitter.jpg",
  },
  design: { palette: "ocean" },
  publishing: { status: "draft" },
  title: "Do not replace the profile name",
  headline: "Do not replace the profile headline",
  bio: "Do not replace the contact description",
  stylePreset: "BOLD",
  theme: { mode: "light", accent: "#112233" },
  createdAt: "2024-01-01",
  updatedAt: "2024-06-01",
};

function meaningful(portfolio: UserPortfolio) {
  return {
    ownerId: portfolio.ownerId,
    selectedTemplate: portfolio.selectedTemplate,
    profile: portfolio.profile,
    socialLinks: portfolio.socialLinks,
    projects: portfolio.projects,
    contact: portfolio.contact,
    seo: portfolio.seo,
    design: portfolio.design,
    publishing: portfolio.publishing,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
  };
}

const before = structuredClone(current);
const normalized = normalizeUserPortfolio("port-current", current);
assert.deepEqual(current, before);
assert.ok(normalized);
assert.equal(normalized.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(normalized.ownerId, "user-1");
assert.equal(normalized.design.palette, "ocean");
assert.equal(normalized.profile.brandName, "Ada Lovelace");
assert.equal(normalized.profile.headline, "Analytical engines");
assert.equal(normalized.profile.heroImage, "https://cdn.example.com/portrait.jpg");
assert.equal(normalized.contact.description, "A saved description.");
assert.equal(normalized.contact.email, "work@example.com");
assert.equal(normalized.seo.title, "Ada | Notes");
assert.deepEqual(normalized.socialLinks, current.socialLinks);
assert.deepEqual(normalized.projects[0]?.tech, ["HTML", "CSS", "JavaScript"]);
assert.equal(Array.isArray(normalized.projects[0]?.tech), true);
assert.equal(normalized.createdAt, "2024-01-01");
assert.equal(normalized.updatedAt, "2024-06-01");
assert.equal(wdkPaletteForPortfolio(normalized), "ocean");
assert.deepEqual(templateContentAreas(normalized.selectedTemplate), [
  "profile",
  "socialLinks",
  "projects",
  "contact",
  "seo",
  "discoverability",
]);
assert.deepEqual(normalized.discoverability, { identity: "", serviceRegion: "", faqs: [] });
assert.equal(templateDesignCapabilities(normalized.selectedTemplate)?.controls[0]?.id, "palette");
assert.ok(templatePreviewImage(normalized.selectedTemplate));

const again = normalizeUserPortfolio("port-current", normalized as unknown as Record<string, unknown>);
assert.ok(again);
assert.deepEqual(meaningful(again), meaningful(normalized));

const olderWdk = normalizeUserPortfolio("port-older", {
  ownerId: "user-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: { brandName: "Ada Lovelace", headline: "Analytical engines" },
  projects: [{ id: "quiet", title: "Quiet study", category: "", url: "https://ada.example", tech: [] }],
  theme: { mode: "light", accent: "#6DAEAD" },
  stylePreset: "MINIMAL",
  createdAt: "2024-02-02",
  updatedAt: "2024-03-03",
});
assert.ok(olderWdk);
assert.equal(olderWdk.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(olderWdk.design.palette, "original");
assert.equal(wdkPaletteForPortfolio(olderWdk), "original");
assert.equal(olderWdk.profile.heroImage, "");
assert.equal(olderWdk.profile.heroImageMobile, "");
assert.equal(olderWdk.profile.logo, "");
assert.deepEqual(olderWdk.socialLinks, []);
assert.deepEqual(olderWdk.projects[0]?.tech, []);
assert.equal(olderWdk.contact.eyebrow, "");
assert.equal(olderWdk.contact.description, "");
assert.equal(olderWdk.seo.title, "");
assert.equal(olderWdk.createdAt, "2024-02-02");
assert.deepEqual(editorAreasForTemplate(olderWdk.selectedTemplate), [
  "profile",
  "socialLinks",
  "projects",
  "contact",
]);
const olderDraft = draftFromPortfolio(olderWdk);
assert.equal(olderDraft.heroImage, "");
assert.equal(olderDraft.logo, "");
assert.equal(olderDraft.projects[0]?.techText, "");

const invalidPalette = normalizeUserPortfolio("port-palette", {
  ownerId: "user-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: { brandName: "Ada", headline: "Math" },
  design: { palette: "neon" },
  theme: { mode: "light", accent: "#ff00aa" },
});
assert.ok(invalidPalette);
assert.equal(invalidPalette.design.palette, "original");
assert.equal(invalidPalette.selectedTemplate, "wdk-premium-portfolio-1");

const workspace = {
  ownerId: "user-1",
  title: "Ada Lovelace",
  headline: "Analytical engines",
  bio: "Notes on the engine.",
  profileImage: "https://cdn.example.com/ada.jpg",
  email: "ada@example.com",
  socialLinks: {
    instagram: "https://instagram.com/ada",
    twitter: "https://twitter.com/ada",
    linkedin: "https://linkedin.com/in/ada",
    website: "https://ada.example",
    github: "https://github.com/ada",
    other: "https://ada.example/other",
  },
  stylePreset: "MINIMAL",
  theme: { mode: "light", accent: "#6DAEAD" },
  createdAt: "2023-01-01",
  updatedAt: "2023-06-01",
};
const workspaceBefore = structuredClone(workspace);
assert.equal(normalizeUserPortfolio("port-workspace", workspace), null);
assert.deepEqual(workspace, workspaceBefore);

const unknown = normalizeUserPortfolio("port-unknown", {
  ownerId: "user-1",
  selectedTemplate: "future-template",
  title: "Ada Lovelace",
  headline: "Analytical engines",
  stylePreset: "MINIMAL",
  theme: { mode: "light", accent: "#6DAEAD" },
  profile: { brandName: "Ada Lovelace", headline: "Analytical engines" },
});
assert.equal(unknown, null);
assert.equal(templateContentAreas("future-template"), null);
assert.equal(templateDesignCapabilities("future-template"), null);
assert.equal(templatePreviewImage("future-template"), null);
assert.equal(editorAreasForTemplate("future-template"), null);

assert.equal(normalizeUserPortfolio("port-blank", { ownerId: "user-1" }), null);

console.log("portfolio normalization checks passed");
