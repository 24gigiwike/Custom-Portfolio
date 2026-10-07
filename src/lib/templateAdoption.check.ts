import assert from "node:assert/strict";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import { templateForCreation } from "./templateCatalog";
import {
  planTemplateUse,
  reconcileAdoption,
  templateChoiceError,
  templateChoiceMessage,
} from "./templateAdoption";

const WDK = "wdk-premium-portfolio-1";
const PORTFOLIO_ID = "ABC123";

function realCatalog(id: string): string | null {
  return templateForCreation(id)?.id ?? null;
}

function catalogWithAnotherTemplate(id: string): string | null {
  if (id === "editorial-two") return id;
  return realCatalog(id);
}

function legacyPortfolio(): Record<string, unknown> {
  return {
    id: PORTFOLIO_ID,
    ownerId: "user-1",
    title: "Ada Lovelace",
    headline: "Analytical engines",
    bio: "Notes on the engine.",
    profileImage: "https://cdn.example.com/ada.jpg",
    email: "ada@example.com",
    socialLinks: {
      x: "https://x.com/ada",
      instagram: "https://instagram.com/ada",
      twitter: "https://twitter.com/ada",
      linkedin: "https://linkedin.com/in/ada",
      github: "https://github.com/ada",
      website: "https://ada.example",
      other: "https://ada.example/other",
    },
    stylePreset: "MINIMAL",
    theme: { mode: "light", accent: "#6DAEAD" },
    createdAt: "2023-01-01",
    updatedAt: "2023-06-01",
    customLegacyNote: "keep me",
  };
}

function plan(owned: { id: string; data: Record<string, unknown> } | null, templateId: string, ownerId = "user-1", resolve = realCatalog) {
  return planTemplateUse({
    owned,
    requestedTemplateId: templateId,
    ownerId,
    resolveCatalogTemplate: resolve,
  });
}

const none = plan(null, WDK);
assert.equal(none.action, "create");

const legacy = legacyPortfolio();
const legacyBefore = structuredClone(legacy);
assert.equal(normalizeUserPortfolio(PORTFOLIO_ID, legacy), null);
const adopted = plan({ id: PORTFOLIO_ID, data: legacy }, WDK);
assert.equal(adopted.action, "adopt");
if (adopted.action !== "adopt") throw new Error("expected adoption");
assert.equal(adopted.portfolioId, PORTFOLIO_ID);
assert.notEqual(adopted.action, "create");
assert.equal(adopted.content.selectedTemplate, WDK);
assert.equal(adopted.content.profile.brandName, "Ada Lovelace");
assert.equal(adopted.content.profile.headline, "Analytical engines");
assert.equal(adopted.content.profile.heroImage, "https://cdn.example.com/ada.jpg");
assert.equal(adopted.content.profile.heroImageMobile, "https://cdn.example.com/ada.jpg");
assert.equal(adopted.content.contact.description, "Notes on the engine.");
assert.equal(adopted.content.profile.email, "ada@example.com");
assert.equal(adopted.content.contact.email, "ada@example.com");
assert.equal(adopted.content.design.palette, "original");
assert.deepEqual(adopted.content.projects, []);
assert.deepEqual(adopted.content.socialLinks, [
  { platform: "x", url: "https://x.com/ada" },
  { platform: "instagram", url: "https://instagram.com/ada" },
]);
assert.equal(adopted.preserveStoredSocialLinks, true);
assert.deepEqual(legacy, legacyBefore);

const decision = reconcileAdoption(adopted, PORTFOLIO_ID);
assert.equal(decision.outcome, "update");
if (decision.outcome !== "update") throw new Error("expected update");
assert.equal(decision.portfolioId, PORTFOLIO_ID);
assert.equal(decision.fields.selectedTemplate, WDK);
assert.equal("id" in decision.fields, false);
assert.equal("ownerId" in decision.fields, false);
assert.equal("createdAt" in decision.fields, false);
assert.equal("title" in decision.fields, false);
assert.equal("headline" in decision.fields, false);
assert.equal("bio" in decision.fields, false);
assert.equal("profileImage" in decision.fields, false);
assert.equal("email" in decision.fields, false);
assert.equal("stylePreset" in decision.fields, false);
assert.equal("theme" in decision.fields, false);
assert.equal("socialLinks" in decision.fields, false);
assert.equal("customLegacyNote" in decision.fields, false);
assert.equal("capabilities" in decision.fields, false);
assert.deepEqual(decision.fields.publishing, { status: "draft" });
assert.deepEqual(decision.fields.design, { palette: "original" });
assert.deepEqual(decision.fields.projects, []);

const currentWins = plan({
  id: PORTFOLIO_ID,
  data: {
    ownerId: "user-1",
    title: "Legacy title",
    headline: "Legacy headline",
    bio: "Legacy bio",
    profileImage: "https://cdn.example.com/legacy.jpg",
    email: "legacy@example.com",
    profile: {
      brandName: "Current name",
      headline: "",
      heroImage: "",
      heroImageMobile: "https://cdn.example.com/mobile.jpg",
      email: "public@example.com",
    },
    contact: { description: "Current description", email: "contact@example.com" },
    seo: { title: "Current SEO", description: "Saved" },
    projects: [{ id: "note", title: "Notes", category: "Essay", url: "https://ada.example", tech: ["HTML"] }],
    design: { palette: "forest" },
    theme: { mode: "light", accent: "#112233" },
    stylePreset: "BOLD",
  },
}, WDK);
assert.equal(currentWins.action, "adopt");
if (currentWins.action !== "adopt") throw new Error("expected adoption");
assert.equal(currentWins.content.profile.brandName, "Current name");
assert.equal(currentWins.content.profile.headline, "");
assert.equal(currentWins.content.profile.heroImage, "");
assert.equal(currentWins.content.profile.heroImageMobile, "https://cdn.example.com/mobile.jpg");
assert.equal(currentWins.content.contact.description, "Current description");
assert.equal(currentWins.content.contact.email, "contact@example.com");
assert.equal(currentWins.content.profile.email, "public@example.com");
assert.equal(currentWins.content.seo.title, "Current SEO");
assert.equal(currentWins.content.design.palette, "forest");
assert.equal(currentWins.content.projects[0]?.title, "Notes");
assert.deepEqual(currentWins.content.projects[0]?.tech, ["HTML"]);
const currentFields = reconcileAdoption(currentWins, PORTFOLIO_ID);
assert.equal(currentFields.outcome, "update");
if (currentFields.outcome !== "update") throw new Error("expected update");
assert.deepEqual(currentFields.fields.design, { palette: "forest" });
assert.equal("theme" in currentFields.fields, false);
assert.equal("stylePreset" in currentFields.fields, false);

const noEmail = plan({
  id: PORTFOLIO_ID,
  data: { ownerId: "user-1", title: "Ada" },
}, WDK);
assert.equal(noEmail.action, "adopt");
if (noEmail.action !== "adopt") throw new Error("expected adoption");
assert.equal(noEmail.content.profile.email, "");
assert.equal(noEmail.content.contact.email, "");
assert.equal(noEmail.preserveStoredSocialLinks, false);
const seededSocial = reconcileAdoption(noEmail, PORTFOLIO_ID);
assert.equal(seededSocial.outcome, "update");
if (seededSocial.outcome !== "update") throw new Error("expected update");
assert.deepEqual(seededSocial.fields.socialLinks, []);

const socialArray = plan({
  id: PORTFOLIO_ID,
  data: {
    ownerId: "user-1",
    socialLinks: [
      { platform: "x", url: "https://x.com/ada" },
      { platform: "twitter", url: "https://twitter.com/ada" },
    ],
  },
}, WDK);
assert.equal(socialArray.action, "adopt");
if (socialArray.action !== "adopt") throw new Error("expected adoption");
assert.equal(socialArray.preserveStoredSocialLinks, true);
assert.deepEqual(socialArray.content.socialLinks, [{ platform: "x", url: "https://x.com/ada" }]);

const existingWdk = plan({
  id: PORTFOLIO_ID,
  data: { ownerId: "user-1", selectedTemplate: WDK, profile: { brandName: "Ada" }, design: { palette: "ocean" } },
}, WDK);
assert.equal(existingWdk.action, "open");
if (existingWdk.action !== "open") throw new Error("expected open");
assert.equal(existingWdk.portfolioId, PORTFOLIO_ID);
assert.equal(reconcileAdoption(existingWdk, PORTFOLIO_ID).outcome, "unchanged");

const otherTemplate = {
  id: PORTFOLIO_ID,
  ownerId: "user-1",
  selectedTemplate: "editorial-two",
  title: "Keep this",
  profile: { brandName: "Editorial" },
};
const otherBefore = structuredClone(otherTemplate);
const switched = plan({ id: PORTFOLIO_ID, data: otherTemplate }, WDK, "user-1", catalogWithAnotherTemplate);
assert.equal(switched.action, "reject");
if (switched.action !== "reject") throw new Error("expected reject");
assert.equal(switched.reason, "template-already-selected");
assert.equal(reconcileAdoption(switched, PORTFOLIO_ID).outcome, "reject");
assert.deepEqual(otherTemplate, otherBefore);
const sameOther = plan({ id: PORTFOLIO_ID, data: otherTemplate }, "editorial-two", "user-1", catalogWithAnotherTemplate);
assert.equal(sameOther.action, "open");

const unknownData = {
  id: PORTFOLIO_ID,
  ownerId: "user-1",
  selectedTemplate: "future-template",
  title: "Future",
  profile: { brandName: "Future" },
  design: { palette: "warm" },
};
const unknownBefore = structuredClone(unknownData);
const unknown = plan({ id: PORTFOLIO_ID, data: unknownData }, WDK);
assert.equal(unknown.action, "reject");
if (unknown.action !== "reject") throw new Error("expected reject");
assert.equal(unknown.reason, "unknown-template");
assert.equal(templateChoiceMessage(unknown.reason), "This portfolio already uses a template that is not available. It was left unchanged.");
const unknownDecision = reconcileAdoption(unknown, PORTFOLIO_ID);
assert.equal(unknownDecision.outcome, "reject");
assert.deepEqual(unknownData, unknownBefore);
assert.equal(normalizeUserPortfolio(PORTFOLIO_ID, unknownData), null);

const unavailable = plan({ id: PORTFOLIO_ID, data: legacyPortfolio() }, "not-a-template");
assert.equal(unavailable.action, "reject");
if (unavailable.action !== "reject") throw new Error("expected reject");
assert.equal(unavailable.reason, "unavailable");
assert.equal(plan(null, "editorial-two").action, "reject");

const wrongOwner = plan({ id: PORTFOLIO_ID, data: legacyPortfolio() }, WDK, "someone-else");
assert.equal(wrongOwner.action, "reject");
if (wrongOwner.action !== "reject") throw new Error("expected reject");
assert.equal(wrongOwner.reason, "wrong-owner");

const appeared = legacyPortfolio();
appeared.selectedTemplate = WDK;
const appearedPlan = plan({ id: PORTFOLIO_ID, data: appeared }, WDK);
assert.equal(reconcileAdoption(appearedPlan, PORTFOLIO_ID).outcome, "unchanged");

const becameUnknown = legacyPortfolio();
becameUnknown.selectedTemplate = "future-template";
const becameUnknownPlan = plan({ id: PORTFOLIO_ID, data: becameUnknown }, WDK);
const becameUnknownDecision = reconcileAdoption(becameUnknownPlan, PORTFOLIO_ID);
assert.equal(becameUnknownDecision.outcome, "reject");
if (becameUnknownDecision.outcome !== "reject") throw new Error("expected reject");
assert.match(becameUnknownDecision.message, /left unchanged/);

const disappeared = reconcileAdoption(plan(null, WDK), PORTFOLIO_ID);
assert.equal(disappeared.outcome, "reject");
if (disappeared.outcome !== "reject") throw new Error("expected reject");
assert.equal(disappeared.message, "Your portfolio could not be updated.");

assert.equal(templateChoiceError(new Error("That template is not available."), "fallback"), "That template is not available.");
assert.equal(
  templateChoiceError(new Error("FirebaseError: permission-denied"), "fallback"),
  "You don't have permission to change this."
);
assert.equal(templateChoiceError(new Error("something else"), "Your portfolio could not be created."), "Your portfolio could not be created.");

console.log("template adoption checks passed");
