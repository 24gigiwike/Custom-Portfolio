import assert from "node:assert/strict";
import type { UserPortfolio } from "../../types/userPortfolio";
import { contentFromDraft, draftFromPortfolio, textToTech, validateEditorDraft } from "./editorDraft";

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
    capabilityTags: ["Brand", "Web"],
    ctaLabel: "Start a project",
    ctaHref: "#contact",
    email: "amina@example.com",
  },
  socialLinks: [{ platform: "instagram", url: "https://instagram.com/amina" }],
  projects: [
    {
      id: "project-kept",
      title: "Northline",
      category: "Identity",
      url: "https://northline.example",
      tech: ["Figma", "React"],
    },
  ],
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
  publishing: { status: "draft" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const invalid = draftFromPortfolio(portfolio);
invalid.brandName = " ";
invalid.headline = "";
invalid.projects[0].title = "";
invalid.projects[0].url = "";
const errors = validateEditorDraft(invalid);
assert.equal(errors?.brandName, "Please enter the name on your portfolio.");
assert.equal(errors?.headline, "Please enter a headline.");
assert.equal(errors?.projects["project-kept"]?.title, "Please enter a project title.");
assert.equal(errors?.projects["project-kept"]?.url, "Please enter the project URL.");

const draft = draftFromPortfolio(portfolio);
draft.brandName = "Amina Cole Studio";
draft.headline = "Independent product designer";
draft.heroImage = "https://cdn.example/portrait.jpg";
draft.heroImageMobile = "https://cdn.example/portrait.jpg";
draft.projects[0].title = "Northline Refresh";
draft.projects[0].techText = "React\nTypeScript\nFirebase";
draft.projects.push({
  id: "project-new",
  title: "Harbor",
  category: "Web",
  url: "harbor.example",
  techText: "Motion, TypeScript",
});

assert.equal(validateEditorDraft(draft), null);
assert.deepEqual(textToTech("React\nTypeScript\nFirebase"), ["React", "TypeScript", "Firebase"]);

const content = contentFromDraft(portfolio, draft);
assert.equal(content.profile.brandName, "Amina Cole Studio");
assert.equal(content.profile.headline, "Independent product designer");
assert.equal(content.profile.heroImage, "https://cdn.example/portrait.jpg");
assert.equal(content.profile.heroImageMobile, "https://cdn.example/portrait.jpg");
assert.equal(content.profile.logo, "logo.png");
assert.deepEqual(content.profile.capabilityTags, ["Brand", "Web"]);
assert.equal(content.profile.email, "amina@example.com");
assert.equal(content.selectedTemplate, "wdk-premium-portfolio-1");
assert.deepEqual(content.socialLinks, portfolio.socialLinks);
assert.deepEqual(content.contact, portfolio.contact);
assert.deepEqual(content.seo, portfolio.seo);
assert.deepEqual(content.publishing, { status: "draft" });
assert.equal("ownerId" in content, false);
assert.equal("createdAt" in content, false);
assert.deepEqual(content.projects, [
  {
    id: "project-kept",
    title: "Northline Refresh",
    category: "Identity",
    url: "https://northline.example",
    tech: ["React", "TypeScript", "Firebase"],
  },
  {
    id: "project-new",
    title: "Harbor",
    category: "Web",
    url: "https://harbor.example",
    tech: ["Motion", "TypeScript"],
  },
]);

console.log("editor draft checks passed");
