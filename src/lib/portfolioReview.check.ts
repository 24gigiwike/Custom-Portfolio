import assert from "node:assert/strict";
import { commaSeparated } from "../templates/wdk-premium-portfolio-1/presentation/commaList";
import { isPortfolioDesignPath } from "../components/portfolio-design/portfolioDesignPath";
import { isPortfolioEditorPath } from "../components/portfolio-editor/portfolioEditorPath";
import { isPortfolioWorkspacePath } from "../components/portfolio-workspace/portfolioWorkspacePath";
import {
  isFramedPortfolioReview,
  isPortfolioReviewPath,
  PORTFOLIO_REVIEW_PATH,
  reviewFramePath,
} from "../components/portfolio-review/portfolioReviewPath";
import type { PortfolioPaletteId } from "../types/portfolioDesign";
import type { UserPortfolio } from "../types/userPortfolio";
import {
  DEFAULT_REVIEW_VIEWPORT,
  reviewAssessment,
  reviewEntry,
  reviewViewport,
  savedPortfolioPresentation,
} from "./portfolioReview";

function portfolio(overrides: Partial<UserPortfolio> = {}): UserPortfolio {
  return {
    id: "ABC123",
    ownerId: "user-1",
    selectedTemplate: "wdk-premium-portfolio-1",
    profile: {
      brandName: "Ada Lovelace",
      logo: "https://cdn.example.com/logo.png",
      heroImage: "https://cdn.example.com/portrait.jpg",
      heroImageMobile: "https://cdn.example.com/portrait-mobile.jpg",
      headline: "Analytical engines",
      capabilityTags: ["Mathematics"],
      ctaLabel: "Write",
      ctaHref: "#contact",
      email: "",
    },
    socialLinks: [],
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
      email: "",
      eyebrow: "",
      heading: "Start a project",
      description: "A short note.",
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
    design: { palette: "original" },
    publishing: { status: "draft" },
    createdAt: "2024-01-01",
    updatedAt: "2024-06-01",
    ...overrides,
  };
}

function item(assessment: NonNullable<ReturnType<typeof reviewAssessment>>, id: string) {
  const found = assessment.items.find((entry) => entry.id === id);
  assert.ok(found, id);
  return found;
}

const complete = portfolio();
const completeBefore = structuredClone(complete);
const assessment = reviewAssessment(complete);
assert.ok(assessment);
assert.equal(assessment.title, "Ready for publishing");
assert.equal(assessment.palette, "original");
assert.equal(item(assessment, "name").status, "complete");
assert.equal(item(assessment, "headline").status, "complete");
assert.equal(item(assessment, "portrait").status, "complete");
assert.equal(item(assessment, "logo").status, "complete");
assert.equal(item(assessment, "projects").status, "complete");
assert.equal(item(assessment, "contact").status, "complete");
assert.equal(assessment.items.some((entry) => entry.id === "social"), false);
assert.equal(assessment.items.some((entry) => entry.id === "seo"), false);
assert.deepEqual(complete, completeBefore);
assert.equal(complete.publishing.status, "draft");

const missingHeadline = reviewAssessment(portfolio({
  profile: { ...complete.profile, headline: "  " },
}));
assert.ok(missingHeadline);
assert.equal(missingHeadline.title, "A few things to check");
assert.equal(item(missingHeadline, "headline").status, "attention");
assert.equal(item(missingHeadline, "headline").importance, "important");
assert.equal(item(missingHeadline, "name").status, "complete");

const missingPortrait = reviewAssessment(portfolio({
  profile: { ...complete.profile, heroImage: "", heroImageMobile: "" },
}));
assert.ok(missingPortrait);
assert.equal(item(missingPortrait, "portrait").status, "attention");
assert.equal(missingPortrait.title, "A few things to check");

const emptyProjects = reviewAssessment(portfolio({ projects: [] }));
assert.ok(emptyProjects);
assert.equal(item(emptyProjects, "projects").status, "attention");

const oneProject = reviewAssessment(portfolio({
  projects: [{ id: "only", title: "Only one", category: "", url: "https://ada.example", tech: [] }],
}));
assert.ok(oneProject);
assert.equal(item(oneProject, "projects").status, "complete");
assert.equal(oneProject.title, "Ready for publishing");

const untitled = reviewAssessment(portfolio({
  projects: [
    { id: "a", title: "", category: "Essay", url: "https://ada.example", tech: ["HTML"] },
    { id: "b", title: "Named", category: "", url: "", tech: ["CSS"] },
  ],
}));
assert.ok(untitled);
assert.equal(item(untitled, "projects").status, "attention");

const quietSocial = reviewAssessment(portfolio({ socialLinks: [], profile: { ...complete.profile, logo: "" } }));
assert.ok(quietSocial);
assert.equal(quietSocial.title, "Ready for publishing");
assert.equal(item(quietSocial, "logo").status, "attention");
assert.equal(item(quietSocial, "logo").importance, "optional");
assert.equal(quietSocial.items.some((entry) => entry.id === "social" || entry.id === "tiktok"), false);

const missingContact = reviewAssessment(portfolio({
  contact: { ...complete.contact, heading: "", description: "   " },
}));
assert.ok(missingContact);
assert.equal(item(missingContact, "contact").status, "attention");

const headingOnly = reviewAssessment(portfolio({
  contact: { ...complete.contact, heading: "Hello", description: "" },
}));
assert.ok(headingOnly);
assert.equal(item(headingOnly, "contact").status, "complete");

assert.equal(reviewAssessment(portfolio({ selectedTemplate: "future-template" })), null);
assert.equal(savedPortfolioPresentation(portfolio({ selectedTemplate: "future-template" })), null);

const palettes: PortfolioPaletteId[] = ["original", "ocean", "forest", "warm"];
for (const palette of palettes) {
  const presented = savedPortfolioPresentation(portfolio({ design: { palette } }));
  assert.ok(presented);
  assert.equal(presented.palette, palette);
  assert.equal(presented.data.profile.heroImage, "https://cdn.example.com/portrait.jpg");
  assert.equal(presented.data.profile.logo, "https://cdn.example.com/logo.png");
  assert.deepEqual(presented.data.projects[0]?.tech, ["HTML", "CSS", "JavaScript"]);
  assert.equal(Array.isArray(presented.data.projects[0]?.tech), true);
  assert.equal(commaSeparated(presented.data.projects[0]?.tech ?? []), "HTML, CSS, JavaScript");
  const checked = reviewAssessment(portfolio({ design: { palette } }));
  assert.equal(checked?.palette, palette);
}

const invalidPalette = savedPortfolioPresentation(portfolio({
  design: { palette: "neon" as PortfolioPaletteId },
}));
assert.equal(invalidPalette?.palette, "original");
const missingDesign = reviewAssessment(portfolio({
  design: undefined as unknown as UserPortfolio["design"],
}));
assert.equal(missingDesign?.palette, "original");
assert.equal(missingDesign?.items.some((entry) => entry.id === "design" && entry.status === "attention"), false);

const beforeSwitch = structuredClone(complete);
assert.equal(DEFAULT_REVIEW_VIEWPORT, "desktop");
assert.equal(reviewViewport("desktop", "mobile"), "mobile");
assert.equal(reviewViewport("mobile", "desktop"), "desktop");
assert.deepEqual(complete, beforeSwitch);

assert.deepEqual(reviewEntry({ status: "missing" }), { kind: "missing" });
assert.deepEqual(reviewEntry({ status: "legacy", reason: "unselected" }), { kind: "choose-template" });
assert.deepEqual(reviewEntry({ status: "legacy", reason: "unknown" }), { kind: "unsupported" });
const ready = reviewEntry({ status: "ready", portfolio: complete });
assert.equal(ready.kind, "review");
if (ready.kind === "review") {
  assert.equal(ready.previewPath, "/template-preview/wdk-premium-portfolio-1");
  assert.equal(ready.assessment.palette, "original");
}
assert.equal(reviewEntry({ status: "ready", portfolio: portfolio({ selectedTemplate: "future-template" }) }).kind, "unsupported");

assert.equal(isPortfolioReviewPath(PORTFOLIO_REVIEW_PATH), true);
assert.equal(isPortfolioReviewPath("/portfolio"), false);
assert.equal(isPortfolioWorkspacePath(PORTFOLIO_REVIEW_PATH), false);
assert.equal(isPortfolioEditorPath(PORTFOLIO_REVIEW_PATH), false);
assert.equal(isPortfolioDesignPath(PORTFOLIO_REVIEW_PATH), false);
assert.equal(reviewFramePath("/template-preview/wdk-premium-portfolio-1"), "/template-preview/wdk-premium-portfolio-1?review=frame");
assert.equal(isFramedPortfolioReview("?review=frame"), true);
assert.equal(isFramedPortfolioReview("?data=sample&palette=ocean"), false);

console.log("portfolio review checks passed");
