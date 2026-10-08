import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readableSaveError } from "./accountLoad";
import { confirmDiscard } from "./unsavedChanges";
import { portfolioUpdatedLabel, workspaceOverview } from "./workspaceOverview";

const savedAt = new Date(2026, 9, 8, 14, 5);
assert.equal(portfolioUpdatedLabel({ toDate: () => savedAt }), "8 Oct 2026, 14:05");
assert.equal(portfolioUpdatedLabel({ seconds: Math.floor(savedAt.getTime() / 1000) }), "8 Oct 2026, 14:05");
assert.equal(portfolioUpdatedLabel(savedAt.toISOString())?.includes("2026"), true);
assert.equal(portfolioUpdatedLabel(null), null);
assert.equal(portfolioUpdatedLabel(""), null);
assert.equal(portfolioUpdatedLabel("not-a-date"), null);
assert.equal(portfolioUpdatedLabel({ toDate: () => "nope" }), null);

const published = workspaceOverview({
  id: "port-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  publicSlug: "ada-loves",
  updatedAt: savedAt,
  publishing: { status: "published" },
  profile: { brandName: "  Ada  " },
});
assert.equal(published.name, "Ada");
assert.equal(published.publiclyAccessible, true);
assert.equal(published.publicUrl, "https://customportfolio.broadbrand.com.ng/p/ada-loves");
assert.equal(published.updatedLabel, "8 Oct 2026, 14:05");

const draft = workspaceOverview({
  id: "port-1",
  selectedTemplate: "wdk-premium-portfolio-1",
  publicSlug: "",
  updatedAt: null,
  publishing: { status: "draft" },
  profile: { brandName: "" },
});
assert.equal(draft.name, "Untitled portfolio");
assert.equal(draft.publiclyAccessible, false);
assert.equal(draft.publicUrl, "https://customportfolio.broadbrand.com.ng/p/port-1");
assert.equal(draft.updatedLabel, null);

assert.equal(confirmDiscard(false, () => false), true);
assert.equal(confirmDiscard(true, () => false), false);
assert.equal(confirmDiscard(true, () => true), true);

assert.equal(
  readableSaveError({ code: "permission-denied", message: "Missing or insufficient permissions." }, "Try again."),
  "You don't have permission to change this.",
);
assert.equal(
  readableSaveError(new Error("The client is offline."), "Try again."),
  "We couldn't reach the server. Check your connection and try again.",
);
assert.equal(readableSaveError(new Error("Brand name is required."), "Try again."), "Brand name is required.");
assert.equal(readableSaveError(new Error("FirebaseError: internal"), "Try again."), "Try again.");
assert.notEqual(readableSaveError({ message: "Missing or insufficient permissions." }, "Taken."), "Taken.");

const seoSource = readFileSync(new URL("../components/portfolio-seo/PortfolioSeo.tsx", import.meta.url), "utf8");
assert.match(seoSource, /canonicalPortfolioUrl\(portfolio\.id, portfolio\.publicSlug\)/);
assert.doesNotMatch(seoSource, /portfolioCanonicalUrl\(portfolio\.id\)/);
assert.match(seoSource, /beforeLeave=\{leave\}/);

console.log("workspace overview checks passed");
