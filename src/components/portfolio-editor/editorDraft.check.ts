import assert from "node:assert/strict";
import type { UserPortfolio } from "../../types/userPortfolio";
import {
  applyEditorDraft,
  contentFromDraft,
  draftFromPortfolio,
  editorAreasForTemplate,
  textToTech,
  validateEditorDraft,
} from "./editorDraft";

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
  discoverability: { identity: "", serviceRegion: "", faqs: [] },
  design: { palette: "ocean" },
  publicSlug: "",
  publicSlugAliases: [],
  publishing: { status: "draft" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

assert.deepEqual(editorAreasForTemplate("wdk-premium-portfolio-1"), [
  "profile",
  "socialLinks",
  "projects",
  "contact",
]);
assert.equal(editorAreasForTemplate("future-template"), null);
assert.equal(editorAreasForTemplate("unknown-template"), null);

const invalid = draftFromPortfolio(portfolio);
invalid.brandName = " ";
invalid.headline = "";
invalid.projects[0].title = "";
invalid.projects[0].url = "";
const errors = validateEditorDraft(invalid, portfolio.selectedTemplate);
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

assert.equal(validateEditorDraft(draft, portfolio.selectedTemplate), null);
assert.deepEqual(textToTech("React\nTypeScript\nFirebase"), ["React", "TypeScript", "Firebase"]);

const content = contentFromDraft(portfolio, draft);
assert.equal(content.profile.brandName, "Amina Cole Studio");
assert.equal(content.profile.headline, "Independent product designer");
assert.equal(content.profile.heroImage, "https://cdn.example/portrait.jpg");
assert.equal(content.profile.heroImageMobile, "https://cdn.example/portrait.jpg");
assert.equal(content.profile.logo, "logo.png");
assert.deepEqual(content.profile.capabilityTags, ["Brand", "Web"]);
assert.equal(content.profile.ctaHref, "#contact");
assert.equal(content.profile.email, "amina@example.com");
assert.equal(content.selectedTemplate, "wdk-premium-portfolio-1");
assert.deepEqual(content.socialLinks, portfolio.socialLinks);
assert.deepEqual(content.contact, portfolio.contact);
assert.deepEqual(content.seo, portfolio.seo);
assert.deepEqual(content.design, { palette: "ocean" });
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

const rich = draftFromPortfolio(portfolio);
rich.brandName = "Amina Cole Studio";
rich.logo = "cdn.example.com/mark.svg";
rich.capabilityTagsText = "Brand\nProduct";
rich.ctaLabel = "Write to me";
rich.ctaHref = "mailto:studio@example.com";
rich.socialLinks = [{ id: "social-email", platform: "email", url: "studio@example.com" }];
rich.contact = {
  eyebrow: "Inquire",
  heading: "Begin a project",
  description: "A short note is enough.",
  projectTypesText: "Identity\nWebsite",
  formEndpoint: "formspree.io/f/abc",
};
assert.equal(validateEditorDraft(rich, portfolio.selectedTemplate), null);
const richContent = contentFromDraft(portfolio, rich);
assert.equal(richContent.profile.brandName, "Amina Cole Studio");
assert.equal(richContent.profile.logo, "https://cdn.example.com/mark.svg");
assert.deepEqual(richContent.profile.capabilityTags, ["Brand", "Product"]);
assert.equal(richContent.profile.ctaLabel, "Write to me");
assert.equal(richContent.profile.ctaHref, "mailto:studio@example.com");
assert.equal(richContent.profile.email, "amina@example.com");
assert.deepEqual(richContent.socialLinks, [{ platform: "email", url: "mailto:studio@example.com" }]);
assert.equal(richContent.contact.email, "studio@example.com");
assert.equal(richContent.contact.eyebrow, "Inquire");
assert.equal(richContent.contact.heading, "Begin a project");
assert.equal(richContent.contact.description, "A short note is enough.");
assert.deepEqual(richContent.contact.projectTypes, ["Identity", "Website"]);
assert.equal(richContent.contact.formEndpoint, "https://formspree.io/f/abc");
assert.deepEqual(richContent.design, { palette: "ocean" });
assert.equal(richContent.projects[0].id, "project-kept");
assert.equal(richContent.projects[0].title, "Northline");
assert.deepEqual(richContent.seo, portfolio.seo);
assert.equal(richContent.selectedTemplate, "wdk-premium-portfolio-1");

const emptied = draftFromPortfolio(portfolio);
emptied.socialLinks = [];
emptied.projects = [];
emptied.logo = "";
emptied.ctaHref = "";
emptied.contact.formEndpoint = "";
emptied.contact.description = "";
assert.equal(validateEditorDraft(emptied, portfolio.selectedTemplate), null);
const emptyContent = contentFromDraft(portfolio, emptied);
assert.deepEqual(emptyContent.socialLinks, []);
assert.deepEqual(emptyContent.projects, []);
assert.equal(emptyContent.contact.email, "studio@example.com");
assert.equal(emptyContent.profile.email, "amina@example.com");

const bad = draftFromPortfolio(portfolio);
bad.socialLinks[0].url = "not a link";
bad.ctaHref = "%%%";
bad.contact.formEndpoint = "not a form";
bad.projects[0].url = "bad url";
bad.logo = "javascript:alert(1)";
bad.heroImage = "not a url";
const badErrors = validateEditorDraft(bad, portfolio.selectedTemplate);
assert.equal(badErrors?.socialLinks[bad.socialLinks[0].id]?.url, "Enter a valid link.");
assert.equal(badErrors?.ctaHref, "Enter a valid link.");
assert.equal(badErrors?.formEndpoint, "Enter a valid form address.");
assert.equal(badErrors?.projects["project-kept"]?.url, "Enter a valid project URL.");
assert.equal(badErrors?.logo, "Enter a valid image address.");
assert.equal(badErrors?.heroImage, "Enter a valid image address.");

const linked = draftFromPortfolio(portfolio);
linked.heroImage = "cdn.example.com/portrait.jpg";
linked.heroImageMobile = "cdn.example.com/portrait.jpg";
assert.equal(validateEditorDraft(linked, portfolio.selectedTemplate), null);
const linkedContent = contentFromDraft(portfolio, linked);
assert.equal(linkedContent.profile.heroImage, "https://cdn.example.com/portrait.jpg");
assert.equal(linkedContent.profile.heroImageMobile, "https://cdn.example.com/portrait.jpg");
assert.equal(linkedContent.selectedTemplate, "wdk-premium-portfolio-1");
assert.deepEqual(linkedContent.design, { palette: "ocean" });
assert.deepEqual(linkedContent.profile.capabilityTags, ["Brand", "Web"]);
assert.deepEqual(linkedContent.projects[0]?.tech, ["Figma", "React"]);
assert.equal(linkedContent.profile.email, "amina@example.com");

const socialDraft = draftFromPortfolio(portfolio);
socialDraft.socialLinks[0].url = "instagram.com/amina-studio";
socialDraft.brandName = "Should stay";
socialDraft.projects[0].title = "Should stay";
socialDraft.contact.description = "Should stay";
const socialOnly = applyEditorDraft(portfolio, socialDraft, ["socialLinks"]);
assert.equal(socialOnly.socialLinks[0]?.url, "https://instagram.com/amina-studio");
assert.equal(socialOnly.profile.brandName, "Amina Cole");
assert.equal(socialOnly.profile.email, "amina@example.com");
assert.equal(socialOnly.projects[0]?.title, "Northline");
assert.equal(socialOnly.projects[0]?.id, "project-kept");
assert.equal(socialOnly.contact.description, "Available for selected work.");
assert.equal(socialOnly.contact.email, "studio@example.com");
assert.deepEqual(socialOnly.seo, portfolio.seo);
assert.deepEqual(socialOnly.design, { palette: "ocean" });
assert.equal(socialOnly.selectedTemplate, portfolio.selectedTemplate);

const profileOnly = applyEditorDraft(portfolio, rich, ["profile", "seo"]);
assert.equal(profileOnly.profile.brandName, "Amina Cole Studio");
assert.equal(profileOnly.profile.logo, "https://cdn.example.com/mark.svg");
assert.deepEqual(profileOnly.socialLinks, portfolio.socialLinks);
assert.deepEqual(profileOnly.projects, portfolio.projects);
assert.equal(profileOnly.contact.email, portfolio.contact.email);
assert.deepEqual(profileOnly.seo, portfolio.seo);
assert.deepEqual(profileOnly.design, { palette: "ocean" });
assert.equal(profileOnly.selectedTemplate, portfolio.selectedTemplate);

const unknownPortfolio: UserPortfolio = { ...portfolio, selectedTemplate: "future-template" };
const unknownDraft = draftFromPortfolio(unknownPortfolio);
unknownDraft.brandName = "Changed";
unknownDraft.socialLinks[0].url = "https://example.com";
unknownDraft.projects[0].title = "Changed";
unknownDraft.contact.heading = "Changed";
const unknownContent = contentFromDraft(unknownPortfolio, unknownDraft);
assert.equal(unknownContent.profile.brandName, "Amina Cole");
assert.equal(unknownContent.socialLinks[0]?.url, "https://instagram.com/amina");
assert.equal(unknownContent.projects[0]?.title, "Northline");
assert.equal(unknownContent.contact.heading, "Let's talk");
assert.equal(unknownContent.selectedTemplate, "future-template");
assert.deepEqual(unknownContent.seo, portfolio.seo);
assert.deepEqual(unknownContent.design, { palette: "ocean" });
assert.deepEqual(unknownContent.publishing, portfolio.publishing);
assert.equal(validateEditorDraft(unknownDraft, unknownPortfolio.selectedTemplate), null);

console.log("editor draft checks passed");
