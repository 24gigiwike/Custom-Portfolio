import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentFromDraft, draftFromPortfolio } from "../components/portfolio-editor/editorDraft";
import { isPortfolioPublishPath, PORTFOLIO_PUBLISH_PATH } from "../components/portfolio-publish/portfolioPublishPath";
import { isPortfolioReviewPath } from "../components/portfolio-review/portfolioReviewPath";
import type { UserPortfolio } from "../types/userPortfolio";
import { contentWithDesign } from "./portfolioDesign";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import { publishingStatusLabel } from "./portfolioTemplate";
import {
  contentPreservingPublishing,
  isPortfolioPublished,
  planPublish,
  planUnpublish,
  publishDocumentFields,
  publishEntry,
  publishingBlockers,
  publishingFromDocument,
  unpublishDocumentFields,
} from "./portfolioPublishing";

const CONTENT_KEYS = ["selectedTemplate", "profile", "socialLinks", "projects", "contact", "seo", "design", "ownerId", "id", "createdAt"];

function portfolio(overrides: Partial<UserPortfolio> = {}): UserPortfolio {
  return {
    id: "ABC123",
    ownerId: "user-1",
    selectedTemplate: "wdk-premium-portfolio-1",
    profile: {
      brandName: "Ada Lovelace",
      logo: "",
      heroImage: "https://cdn.example.com/portrait.jpg",
      heroImageMobile: "https://cdn.example.com/portrait.jpg",
      headline: "Analytical engines",
      capabilityTags: [],
      ctaLabel: "",
      ctaHref: "",
      email: "",
    },
    socialLinks: [],
    projects: [{ id: "note", title: "Notes", category: "", url: "https://ada.example", tech: ["HTML", "CSS", "JavaScript"] }],
    contact: {
      email: "",
      eyebrow: "",
      heading: "Hello",
      description: "",
      projectTypes: [],
      formEndpoint: "",
    },
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
    design: { palette: "ocean" },
    publishing: { status: "draft" },
    createdAt: "2024-01-01",
    updatedAt: "2024-06-01",
    ...overrides,
  };
}

function stored(current: UserPortfolio, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...current, ...extra };
}

function assertContentUntouched(fields: Record<string, unknown>) {
  for (const key of CONTENT_KEYS) assert.equal(key in fields, false, key);
}

const ready = portfolio();
const readyBefore = structuredClone(ready);
const publishable = planPublish({ actorId: "user-1", owned: { id: ready.id, data: stored(ready) } });
assert.equal(publishable.action, "publish");
if (publishable.action !== "publish") throw new Error("expected publish");
assert.equal(publishable.portfolioId, "ABC123");
assert.equal(publishable.publishedAt, null);
assert.deepEqual(ready, readyBefore);
const firstPublish = publishDocumentFields("2024-07-01");
assert.deepEqual(firstPublish.publishing, { status: "published", publishedAt: "2024-07-01" });
assert.equal(firstPublish.published, true);
assertContentUntouched(firstPublish);

const again = planPublish({
  actorId: "user-1",
  owned: { id: ready.id, data: stored(portfolio({ publishing: { status: "published", publishedAt: "2024-07-01" } })) },
});
assert.equal(again.action, "already-published");
const republish = planPublish({
  actorId: "user-1",
  owned: {
    id: ready.id,
    data: stored(portfolio({ publishing: { status: "draft", publishedAt: "2024-07-01" } }), { published: false }),
  },
});
assert.equal(republish.action, "publish");
if (republish.action !== "publish") throw new Error("expected republish");
assert.equal(republish.publishedAt, "2024-07-01");
assert.deepEqual(publishDocumentFields(republish.publishedAt).publishing, {
  status: "published",
  publishedAt: "2024-07-01",
});

const missingPortrait = portfolio({
  profile: { ...ready.profile, heroImage: "", heroImageMobile: "" },
});
const blocked = planPublish({ actorId: "user-1", owned: { id: missingPortrait.id, data: stored(missingPortrait) } });
assert.equal(blocked.action, "reject");
if (blocked.action !== "reject") throw new Error("expected reject");
assert.equal(blocked.reason, "not-ready");
assert.equal(publishingBlockers(missingPortrait)?.some((item) => item.id === "portrait"), true);

const optionalLogo = publishingBlockers(ready);
assert.ok(optionalLogo);
assert.equal(optionalLogo.some((item) => item.id === "logo"), false);
assert.equal(planPublish({ actorId: "user-1", owned: { id: ready.id, data: stored(ready) } }).action, "publish");
assert.equal(ready.socialLinks.length, 0);

const published = portfolio({ publishing: { status: "published", publishedAt: "2024-07-01" } });
assert.equal(isPortfolioPublished(published.publishing), true);
assert.equal(publishingStatusLabel(published.publishing.status), "Published");
const unpublish = planUnpublish({ actorId: "user-1", owned: { id: published.id, data: stored(published) } });
assert.equal(unpublish.action, "unpublish");
if (unpublish.action !== "unpublish") throw new Error("expected unpublish");
assert.equal(unpublish.portfolioId, published.id);
const draftFields = unpublishDocumentFields(unpublish.publishedAt);
assert.deepEqual(draftFields.publishing, { status: "draft", publishedAt: "2024-07-01" });
assert.equal(draftFields.published, false);
assertContentUntouched(draftFields);
assert.equal(planUnpublish({ actorId: "user-1", owned: { id: ready.id, data: stored(ready) } }).action, "already-draft");

assert.equal(planPublish({ actorId: null, owned: { id: ready.id, data: stored(ready) } }).action, "reject");
assert.equal(planPublish({ actorId: "user-1", owned: null }).action, "reject");
const signedOut = planPublish({ actorId: null, owned: null });
if (signedOut.action !== "reject") throw new Error("expected reject");
assert.equal(signedOut.reason, "signed-out");
assert.equal(planPublish({ actorId: "someone-else", owned: { id: ready.id, data: stored(ready) } }).action, "reject");
const wrong = planPublish({ actorId: "someone-else", owned: { id: ready.id, data: stored(ready) } });
if (wrong.action === "reject") assert.equal(wrong.reason, "wrong-owner");

const legacy = { ownerId: "user-1", title: "Ada", published: true };
const legacyBefore = structuredClone(legacy);
assert.equal(publishingFromDocument(legacy).status, "published");
assert.equal(normalizeUserPortfolio("ABC123", { ...legacy, selectedTemplate: "wdk-premium-portfolio-1" })?.publishing.status, "published");
assert.deepEqual(legacy, legacyBefore);
assert.equal(publishingFromDocument({ publishing: { status: "draft" }, published: true }).status, "draft");
assert.equal(publishingFromDocument({ publishing: { status: "published", publishedAt: "2024-07-01" }, published: false }).status, "published");
assert.equal(publishingFromDocument({}).status, "draft");
assert.equal(publishingFromDocument({ publishing: { status: "scheduled" } }).status, "draft");

const bare = { ownerId: "user-1", title: "Ada" };
const bareBefore = structuredClone(bare);
assert.equal(planPublish({ actorId: "user-1", owned: { id: "ABC123", data: bare } }).action, "reject");
const barePlan = planPublish({ actorId: "user-1", owned: { id: "ABC123", data: bare } });
if (barePlan.action === "reject") assert.equal(barePlan.reason, "choose-template");
assert.deepEqual(bare, bareBefore);
assert.equal(publishEntry({ status: "legacy", reason: "unselected" }).kind, "choose-template");

const unknownData = stored(portfolio({ selectedTemplate: "future-template" }));
const unknownBefore = structuredClone(unknownData);
const unknown = planPublish({ actorId: "user-1", owned: { id: "ABC123", data: unknownData } });
assert.equal(unknown.action, "reject");
if (unknown.action === "reject") assert.equal(unknown.reason, "unsupported");
assert.deepEqual(unknownData, unknownBefore);
assert.equal(planUnpublish({ actorId: "user-1", owned: { id: "ABC123", data: unknownData } }).action, "reject");
assert.equal(publishEntry({ status: "legacy", reason: "unknown" }).kind, "unsupported");
assert.equal(publishEntry({ status: "missing" }).kind, "missing");
assert.equal(publishEntry({ status: "ready", portfolio: ready }).kind, "draft");
assert.equal(publishEntry({ status: "ready", portfolio: published }).kind, "published");

const saved = contentPreservingPublishing(published, { ...published, publishing: { status: "draft" } });
assert.equal(saved.publishing.status, "published");
assert.equal(saved.publishing.publishedAt, "2024-07-01");
assert.equal(saved.design.palette, "ocean");
const edited = contentFromDraft(published, draftFromPortfolio(published));
assert.equal(edited.publishing.status, "published");
assert.equal(edited.publishing.publishedAt, "2024-07-01");
assert.equal(edited.profile.brandName, published.profile.brandName);
const designed = contentWithDesign(published, "forest");
assert.equal(designed.design.palette, "forest");
assert.equal(designed.publishing.status, "published");
assert.equal(designed.publishing.publishedAt, "2024-07-01");

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const privatePortfolioRules = rules.slice(
  rules.indexOf("match /portfolios/{portfolioId}"),
  rules.indexOf("match /publicPortfolios/{publicId}")
);
assert.match(privatePortfolioRules, /allow read: if isSignedIn\(\) && resource\.data\.ownerId == request\.auth\.uid;/);
assert.equal(privatePortfolioRules.includes("published"), false);
assert.equal(privatePortfolioRules.includes("allow read: if true"), false);
assert.equal(isPortfolioPublishPath(PORTFOLIO_PUBLISH_PATH), true);
assert.equal(isPortfolioPublishPath("/portfolio"), false);
assert.equal(isPortfolioPublishPath("/p/ada"), false);
assert.equal(isPortfolioReviewPath(PORTFOLIO_PUBLISH_PATH), false);

console.log("portfolio publishing checks passed");
