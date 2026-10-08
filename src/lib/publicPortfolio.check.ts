import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPortfolioPublishPath } from "../components/portfolio-publish/portfolioPublishPath";
import { isPublicPortfolioPath, publicPortfolioIdFromPath, publicPortfolioPath, publicPortfolioUrl } from "../components/public/publicPortfolioPath";
import { isWdkTemplatePreviewPath } from "../preview/templatePreviewPath";
import { commaSeparated } from "../templates/wdk-premium-portfolio-1/presentation/commaList";
import type { UserPortfolio } from "../types/userPortfolio";
import { contentWithDesign } from "./portfolioDesign";
import { contentPreservingPublishing, planPublish, planUnpublish, publishDocumentFields, unpublishDocumentFields } from "./portfolioPublishing";
import {
  collectKeys,
  privateKeysInPublicFields,
  publicDeliveryForSavedContent,
  publicDeliveryForUnpublish,
  publicDocumentTitle,
  publicPortfolioFromUserPortfolio,
  publicPortfolioPresentation,
  readPublicPortfolio,
} from "./publicPortfolio";

function portfolio(overrides: Partial<UserPortfolio> = {}): UserPortfolio {
  return {
    id: "ABC123",
    ownerId: "owner-secret-uid",
    selectedTemplate: "wdk-premium-portfolio-1",
    profile: {
      brandName: "Ada Lovelace",
      logo: "https://cdn.example.com/logo.png",
      heroImage: "https://cdn.example.com/portrait.jpg",
      heroImageMobile: "https://cdn.example.com/portrait-mobile.jpg",
      headline: "Analytical engines",
      capabilityTags: ["Mathematics", "Machines"],
      ctaLabel: "Start a project",
      ctaHref: "https://ada.example/start",
      email: "",
    },
    socialLinks: [
      { platform: "x", url: "https://x.com/ada" },
      { platform: "instagram", url: "https://instagram.com/ada" },
    ],
    projects: [{
      id: "note",
      title: "Notes",
      category: "Writing",
      url: "https://ada.example/notes",
      tech: ["HTML", "CSS", "JavaScript"],
    }],
    contact: {
      email: "studio@example.com",
      eyebrow: "Contact",
      heading: "Hello",
      description: "Write about a project.",
      projectTypes: ["Identity", "Editorial"],
      formEndpoint: "https://forms.example/ada",
    },
    seo: {
      title: "Ada Lovelace",
      description: "Portfolio of Ada Lovelace",
      canonicalUrl: "https://ada.example",
      ogTitle: "Ada Lovelace",
      ogDescription: "Portfolio",
      ogImage: "https://cdn.example.com/og.jpg",
      twitterTitle: "Ada Lovelace",
      twitterDescription: "Portfolio",
      twitterImage: "https://cdn.example.com/twitter.jpg",
    },
    discoverability: { identity: "", serviceRegion: "", faqs: [] },
    design: { palette: "ocean" },
    publishing: { status: "draft", publishedAt: "2024-07-01" },
    createdAt: "2024-01-01",
    updatedAt: "2024-06-01",
    ...overrides,
  };
}

const accountEmail = "ada.auth@gmail.com";
const ready = portfolio();
const draftPlan = planPublish({ actorId: ready.ownerId, owned: { id: ready.id, data: { ...ready } } });
assert.equal(draftPlan.action, "publish");
if (draftPlan.action !== "publish") throw new Error("expected publish");
assert.equal(draftPlan.publishedAt, "2024-07-01");

const publishedPortfolio = portfolio({
  publishing: { status: "published", publishedAt: draftPlan.publishedAt ?? "2024-07-01" },
});
const fields = publicPortfolioFromUserPortfolio(publishedPortfolio);
if (!fields) throw new Error("expected a public projection");
assert.equal(fields.publicId, "ABC123");
assert.equal(fields.selectedTemplate, "wdk-premium-portfolio-1");
assert.equal(fields.profile.brandName, "Ada Lovelace");
assert.equal(fields.profile.headline, "Analytical engines");
assert.equal(fields.profile.heroImage, publishedPortfolio.profile.heroImage);
assert.equal(fields.profile.logo, publishedPortfolio.profile.logo);
assert.deepEqual(fields.profile.capabilityTags, ["Mathematics", "Machines"]);
assert.equal(fields.profile.ctaLabel, "Start a project");
assert.deepEqual(fields.socialLinks, publishedPortfolio.socialLinks);
assert.deepEqual(fields.projects[0].tech, ["HTML", "CSS", "JavaScript"]);
assert.equal(Array.isArray(fields.projects[0].tech), true);
assert.equal(fields.contact.heading, "Hello");
assert.equal(fields.contact.email, "studio@example.com");
assert.equal(fields.profile.email, "");
assert.equal(fields.design.palette, "ocean");
assert.equal(fields.seo.title, "Ada Lovelace");
assert.deepEqual(privateKeysInPublicFields(fields), []);
assert.equal(JSON.stringify(fields).includes(ready.ownerId), false);
assert.equal(JSON.stringify(fields).includes(accountEmail), false);
assert.equal("title" in fields, false);
assert.equal("email" in fields, false);
assert.equal(collectKeys(fields).includes("ownerId"), false);
assert.equal(collectKeys(fields).includes("stylePreset"), false);
assert.equal(collectKeys(fields).includes("theme"), false);
assert.equal(collectKeys(fields).includes("storagePath"), false);

const privatePublishFields = publishDocumentFields(draftPlan.publishedAt);
assert.equal(privatePublishFields.published, true);
assert.equal("profile" in privatePublishFields, false);
assert.equal(fields.publicId, publishedPortfolio.id);

const notReady = portfolio({ profile: { ...ready.profile, brandName: "" } });
const blocked = planPublish({ actorId: notReady.ownerId, owned: { id: notReady.id, data: { ...notReady } } });
assert.equal(blocked.action, "reject");
if (blocked.action === "reject") assert.equal(blocked.reason, "not-ready");

const presentation = publicPortfolioPresentation({
  ...fields,
  publishedAt: "2024-07-01",
  updatedAt: "2024-07-01",
});
if (!presentation) throw new Error("expected WDK presentation");
assert.equal(presentation.data.profile.brandName, "Ada Lovelace");
assert.equal(presentation.data.profile.headline, "Analytical engines");
assert.equal(presentation.data.profile.heroImage, "https://cdn.example.com/portrait.jpg");
assert.equal(presentation.data.profile.logo, "https://cdn.example.com/logo.png");
assert.deepEqual(presentation.data.profile.capabilityTags, ["Mathematics", "Machines"]);
assert.equal(presentation.data.profile.ctaLabel, "Start a project");
assert.equal(presentation.data.socialLinks.length, 2);
assert.equal(presentation.data.projects[0].title, "Notes");
assert.deepEqual(presentation.data.projects[0].tech, ["HTML", "CSS", "JavaScript"]);
assert.equal(commaSeparated(presentation.data.projects[0].tech), "HTML, CSS, JavaScript");
assert.equal(presentation.data.contact.description, "Write about a project.");
assert.equal(presentation.data.contact.email, "studio@example.com");
assert.equal(presentation.palette, "ocean");
assert.equal(publicDocumentTitle({ ...fields, publishedAt: null, updatedAt: null }), "Ada Lovelace");

const missingEmail = publicPortfolioFromUserPortfolio(portfolio({
  profile: { ...ready.profile, email: "" },
  contact: { ...ready.contact, email: "" },
}));
assert.equal(missingEmail?.profile.email, "");
assert.equal(missingEmail?.contact.email, "");
assert.equal(JSON.stringify(missingEmail).includes(accountEmail), false);

const explicitEmail = publicPortfolioFromUserPortfolio(portfolio({
  profile: { ...ready.profile, email: "hello@studio.test" },
}));
assert.equal(explicitEmail?.profile.email, "hello@studio.test");

const publicDoc = readPublicPortfolio("ABC123", {
  ...fields,
  ownerId: ready.ownerId,
  stylePreset: "MINIMAL",
  theme: { ink: "#000" },
  email: accountEmail,
  publishedAt: "2024-07-01",
  updatedAt: "2024-07-02",
});
if (!publicDoc) throw new Error("expected to read the public document");
assert.equal("ownerId" in publicDoc, false);
assert.equal(JSON.stringify(publicDoc).includes(ready.ownerId), false);
assert.equal(JSON.stringify(publicDoc).includes(accountEmail), false);
assert.equal(publicDoc.contact.email, "studio@example.com");
assert.equal(publicDoc.profile.email, "");
assert.deepEqual(publicDoc.projects[0].tech, ["HTML", "CSS", "JavaScript"]);

const legacyShaped = readPublicPortfolio("ABC123", {
  publicId: "ABC123",
  selectedTemplate: "wdk-premium-portfolio-1",
  email: accountEmail,
  title: "Secret title",
  bio: "Private bio",
  profileImage: "https://cdn.example.com/private.jpg",
  profile: fields.profile,
  socialLinks: fields.socialLinks,
  projects: fields.projects,
  contact: { ...fields.contact, email: "" },
  seo: fields.seo,
  design: fields.design,
});
assert.equal(legacyShaped?.profile.email, "");
assert.equal(legacyShaped?.contact.email, "");
assert.equal(JSON.stringify(legacyShaped).includes(accountEmail), false);
assert.equal(JSON.stringify(legacyShaped).includes("Secret title"), false);

assert.equal(readPublicPortfolio("ABC123", { ...fields, selectedTemplate: "future-template" }), null);
assert.equal(readPublicPortfolio("OTHER", fields), null);
assert.equal(publicPortfolioPresentation({
  ...fields,
  selectedTemplate: "future-template",
  publishedAt: null,
  updatedAt: null,
}), null);

const unnamed = portfolio({
  seo: { ...ready.seo, title: "  " },
  profile: { ...ready.profile, brandName: "Ada Lovelace" },
});
const unnamedFields = publicPortfolioFromUserPortfolio(unnamed);
if (!unnamedFields) throw new Error("expected projection");
assert.equal(
  publicDocumentTitle({ ...unnamedFields, publishedAt: null, updatedAt: null }),
  "Ada Lovelace — Analytical engines"
);

const unpublish = planUnpublish({
  actorId: publishedPortfolio.ownerId,
  owned: { id: publishedPortfolio.id, data: { ...publishedPortfolio } },
});
assert.equal(unpublish.action, "unpublish");
if (unpublish.action !== "unpublish") throw new Error("expected unpublish");
assert.equal(unpublish.publishedAt, "2024-07-01");
const removal = publicDeliveryForUnpublish(publishedPortfolio.id);
assert.deepEqual(removal, { action: "remove", publicId: "ABC123" });
const draftFields = unpublishDocumentFields(unpublish.publishedAt);
assert.equal((draftFields.publishing as { status: string }).status, "draft");
assert.equal(publishedPortfolio.projects[0].title, "Notes");
assert.equal(publishedPortfolio.profile.brandName, "Ada Lovelace");

const republishSource = portfolio({
  publishing: { status: "draft", publishedAt: unpublish.publishedAt },
});
const republish = planPublish({
  actorId: republishSource.ownerId,
  owned: { id: republishSource.id, data: { ...republishSource } },
});
assert.equal(republish.action, "publish");
if (republish.action !== "publish") throw new Error("expected republish");
assert.equal(republish.publishedAt, "2024-07-01");
const republishedFields = publicPortfolioFromUserPortfolio({
  ...republishSource,
  publishing: { status: "published", publishedAt: republish.publishedAt },
});
assert.equal(republishedFields?.publicId, "ABC123");
assert.equal(publicPortfolioPath(republishedFields?.publicId ?? ""), publicPortfolioPath(fields.publicId));
assert.equal(publicPortfolioUrl("ABC123", "https://customportfolio.broadbrand.com.ng"), "https://customportfolio.broadbrand.com.ng/p/ABC123");
assert.equal(publicPortfolioUrl("ABC123", "http://localhost:3000"), "http://localhost:3000/p/ABC123");

const edited = contentPreservingPublishing(publishedPortfolio, {
  ...publishedPortfolio,
  profile: { ...publishedPortfolio.profile, brandName: "Ada King" },
});
assert.equal(edited.publishing.status, "published");
const editDelivery = publicDeliveryForSavedContent(publishedPortfolio, edited);
assert.equal(editDelivery.action, "upsert");
if (editDelivery.action !== "upsert") throw new Error("expected public edit sync");
assert.equal(editDelivery.publicId, "ABC123");
assert.equal(editDelivery.fields.profile.brandName, "Ada King");
assert.equal(editDelivery.fields.profile.headline, "Analytical engines");

const designed = contentWithDesign(publishedPortfolio, "forest");
assert.equal(designed.publishing.status, "published");
assert.equal(designed.publishing.publishedAt, "2024-07-01");
const designDelivery = publicDeliveryForSavedContent(publishedPortfolio, designed);
assert.equal(designDelivery.action, "upsert");
if (designDelivery.action !== "upsert") throw new Error("expected public design sync");
assert.equal(designDelivery.fields.design.palette, "forest");
assert.equal(designDelivery.publicId, publishedPortfolio.id);

const draftSave = publicDeliveryForSavedContent(ready, { ...ready, profile: { ...ready.profile, brandName: "Draft only" } });
assert.equal(draftSave.action, "leave");

const brokenSave = publicDeliveryForSavedContent(publishedPortfolio, {
  ...publishedPortfolio,
  selectedTemplate: "future-template",
});
assert.equal(brokenSave.action, "reject");

assert.equal(publicPortfolioIdFromPath("/p/ABC123"), "ABC123");
assert.equal(publicPortfolioIdFromPath("/p/ABC123/"), "ABC123");
assert.equal(publicPortfolioIdFromPath("/p/ABC123?ref=1"), "ABC123");
assert.equal(isPublicPortfolioPath("/p/ABC123"), true);
assert.equal(publicPortfolioIdFromPath("/p/"), null);
assert.equal(publicPortfolioIdFromPath("/p/ABC123/edit"), null);
assert.equal(isPublicPortfolioPath("/portfolio"), false);
assert.equal(isPublicPortfolioPath("/portfolio/publish"), false);
assert.equal(isPublicPortfolioPath("/template-preview/wdk-premium-portfolio-1"), false);
assert.equal(isWdkTemplatePreviewPath("/p/ABC123"), false);
assert.equal(isPortfolioPublishPath("/p/ABC123"), false);
assert.equal(publicPortfolioPath("ABC123"), "/p/ABC123");

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const usersRules = rules.slice(rules.indexOf("match /users/{userId}"), rules.indexOf("match /portfolios/{portfolioId}"));
const privateRules = rules.slice(rules.indexOf("match /portfolios/{portfolioId}"), rules.indexOf("match /publicPortfolios/{publicId}"));
const publicRules = rules.slice(rules.indexOf("match /publicPortfolios/{publicId}"), rules.indexOf("match /{document=**}"));
assert.match(usersRules, /allow read: if isOwner\(userId\);/);
assert.match(privateRules, /allow read: if isSignedIn\(\) && resource\.data\.ownerId == request\.auth\.uid;/);
assert.equal(privateRules.includes("allow read: if true"), false);
assert.equal(privateRules.includes("published"), false);
assert.match(publicRules, /allow read: if resource\.data\.publicId == publicId/);
assert.match(publicRules, /isPublished\(privatePortfolio\(\)\.data\)/);
assert.match(publicRules, /privatePortfolioAfter\(\)\.data\.ownerId == request\.auth\.uid/);
assert.match(publicRules, /allow create, update: if isSignedIn\(\)/);
assert.match(publicRules, /allow delete: if isSignedIn\(\)/);
assert.equal(publicRules.includes("allow write: if true"), false);
assert.equal(publicRules.includes("allow read, write: if true"), false);
assert.equal(publicRules.includes('"ownerId"'), false);
assert.match(rules, /allow read, write: if false/);

const vercel = readFileSync(new URL("../../vercel.json", import.meta.url), "utf8");
assert.match(vercel, /"destination": "\/index\.html"/);

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const publicGuard = app.indexOf("if (isPublicPortfolioPath(currentRoute)) return;");
const signedOutRedirect = app.indexOf('authPhase === "SIGNED_OUT" || !user');
assert.ok(publicGuard !== -1 && signedOutRedirect !== -1 && publicGuard < signedOutRedirect);
assert.match(app, /isPublicPortfolioPath\(window\.location\.pathname\)/);
assert.match(app, /<PublicPortfolioView publicId=\{publicPortfolioId\} \/>/);

const service = readFileSync(new URL("./userPortfolio.ts", import.meta.url), "utf8");
const updateFn = service.slice(service.indexOf("export async function updatePortfolio"), service.indexOf("export async function publishPortfolio"));
const publishFn = service.slice(service.indexOf("export async function publishPortfolio"), service.indexOf("export async function unpublishPortfolio"));
const unpublishFn = service.slice(service.indexOf("export async function unpublishPortfolio"), service.indexOf("export async function syncPublishedPortfolio"));
assert.match(updateFn, /runTransaction/);
assert.match(updateFn, /publicDeliveryForSavedContent/);
assert.equal(updateFn.includes("updateDoc"), false);
assert.match(publishFn, /transaction\.update/);
assert.match(publishFn, /transaction\.set/);
assert.match(publishFn, /publicPortfolios/);
assert.match(unpublishFn, /transaction\.delete/);
assert.match(unpublishFn, /publicDeliveryForUnpublish/);

const view = readFileSync(new URL("../components/public/PublicPortfolioView.tsx", import.meta.url), "utf8");
assert.match(view, /This portfolio is not available\./);
assert.match(view, /This portfolio could not be loaded\./);
assert.equal(view.toLowerCase().includes("unpublished"), false);
assert.equal(view.includes("getPortfolio"), false);
assert.match(view, /WdkPremiumPortfolio/);
const store = readFileSync(new URL("./publicPortfolioStore.ts", import.meta.url), "utf8");
assert.match(store, /publicPortfolios/);
assert.equal(store.includes('collection(db, "portfolios")'), false);
assert.equal(store.includes("getPortfolio"), false);

console.log("public portfolio checks passed");
