import assert from "node:assert/strict";
import { draftFromPortfolio, editorAreasForTemplate } from "../components/portfolio-editor/editorDraft";
import { templateContentAreas, templateDesignCapabilities } from "./templateCatalog";
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
  title: "Ada Lovelace",
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

const normalized = normalizeUserPortfolio("port-current", current);
assert.ok(normalized);
assert.equal(normalized.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(normalized.design.palette, "ocean");
assert.equal(normalized.profile.headline, "Analytical engines");
assert.equal(normalized.contact.description, "A saved description.");
assert.equal(normalized.contact.email, "work@example.com");
assert.deepEqual(normalized.projects[0]?.tech, ["HTML", "CSS", "JavaScript"]);
assert.equal(Array.isArray(normalized.projects[0]?.tech), true);
assert.equal(normalized.ownerId, "user-1");
assert.equal(normalized.seo.title, "Ada | Notes");
assert.equal(wdkPaletteForPortfolio(normalized), "ocean");

const again = normalizeUserPortfolio("port-current", normalized as unknown as Record<string, unknown>);
assert.ok(again);
assert.deepEqual(meaningful(again), meaningful(normalized));

const legacy = normalizeUserPortfolio("port-old", {
  ownerId: "user-1",
  title: "Ada Lovelace",
  slug: "ada-lovelace",
  profession: "Mathematician",
  headline: "Analytical engines",
  bio: "Notes on the engine.",
  profileImage: "https://cdn.example.com/ada.jpg",
  email: "ada@example.com",
  socialLinks: {
    instagram: "https://instagram.com/ada",
    twitter: "https://twitter.com/ada",
    x: "",
    linkedin: "https://linkedin.com/in/ada",
    website: "https://ada.example",
  },
  stylePreset: "MINIMAL",
  theme: { mode: "light", accent: "#6DAEAD" },
  published: false,
});
assert.ok(legacy);
assert.equal(legacy.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(legacy.design.palette, "original");
assert.equal(wdkPaletteForPortfolio(legacy), "original");
assert.equal(legacy.profile.brandName, "Ada Lovelace");
assert.equal(legacy.profile.headline, "Analytical engines");
assert.equal(legacy.profile.heroImage, "https://cdn.example.com/ada.jpg");
assert.equal(legacy.profile.heroImageMobile, "https://cdn.example.com/ada.jpg");
assert.equal(legacy.profile.logo, "");
assert.equal(legacy.profile.email, "ada@example.com");
assert.equal(legacy.contact.description, "Notes on the engine.");
assert.equal(legacy.contact.email, "ada@example.com");
assert.deepEqual(legacy.socialLinks, [
  { platform: "x", url: "https://twitter.com/ada" },
  { platform: "instagram", url: "https://instagram.com/ada" },
]);
assert.deepEqual(legacy.projects, []);
assert.equal(legacy.design.palette === "original", true);
assert.notEqual(legacy.design.palette, "#6DAEAD");
assert.deepEqual(templateContentAreas(legacy.selectedTemplate), [
  "profile",
  "socialLinks",
  "projects",
  "contact",
  "seo",
]);
assert.equal(templateDesignCapabilities(legacy.selectedTemplate)?.controls[0]?.id, "palette");
assert.deepEqual(editorAreasForTemplate(legacy.selectedTemplate), [
  "profile",
  "socialLinks",
  "projects",
  "contact",
]);
assert.equal("capabilities" in legacy, false);

const partial = normalizeUserPortfolio("port-partial", {
  ownerId: "user-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "Ada Lovelace",
    headline: "Analytical engines",
  },
  socialLinks: [],
  projects: [{ id: "quiet", title: "Quiet study", category: "", url: "https://ada.example", tech: [] }],
  contact: { description: "Only a description." },
});
assert.ok(partial);
assert.equal(partial.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(partial.design.palette, "original");
assert.equal(partial.profile.heroImage, "");
assert.equal(partial.profile.heroImageMobile, "");
assert.equal(partial.profile.logo, "");
assert.equal(partial.contact.eyebrow, "");
assert.equal(partial.contact.heading, "");
assert.equal(partial.contact.formEndpoint, "");
assert.equal(partial.contact.description, "Only a description.");
assert.deepEqual(partial.socialLinks, []);
assert.deepEqual(partial.projects[0]?.tech, []);
assert.equal(partial.seo.title, "");
const partialDraft = draftFromPortfolio(partial);
assert.equal(partialDraft.heroImage, "");
assert.equal(partialDraft.logo, "");
assert.equal(partialDraft.projects[0]?.techText, "");
assert.equal(editorAreasForTemplate(partial.selectedTemplate)?.includes("profile"), true);

const invalidPalette = normalizeUserPortfolio("port-palette", {
  ownerId: "user-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: { brandName: "Ada", headline: "Math" },
  design: { palette: "neon" },
  theme: { mode: "light", accent: "#ff00aa" },
  stylePreset: "CREATIVE",
});
assert.ok(invalidPalette);
assert.equal(invalidPalette.design.palette, "original");
assert.equal(invalidPalette.selectedTemplate, "wdk-premium-portfolio-1");

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
assert.equal(editorAreasForTemplate("future-template"), null);

const blank = normalizeUserPortfolio("port-blank", { ownerId: "user-1" });
assert.equal(blank, null);

console.log("portfolio normalization checks passed");
