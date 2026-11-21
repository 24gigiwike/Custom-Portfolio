import assert from "node:assert/strict";
import type { PortfolioData } from "../../wdk-premium-portfolio-1/types/portfolio.ts";
import { creativeView } from "./creativeView.ts";

const empty: PortfolioData = {
  profile: {
    brandName: "",
    logo: "",
    heroImage: "",
    heroImageMobile: "",
    headline: "  ",
    capabilityTags: ["", "  "],
    ctaLabel: "Write",
    ctaHref: "",
    email: "",
  },
  socialLinks: [{ platform: "instagram", url: "  " }],
  projects: [{ id: "1", title: " ", category: "", url: "", tech: [" "] }],
  contact: {
    email: "",
    eyebrow: "",
    heading: "",
    description: "",
    projectTypes: [],
    formEndpoint: "javascript:alert(1)",
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
};

const quiet = creativeView(empty);
assert.equal(quiet.name, "");
assert.equal(quiet.statement, "");
assert.equal(quiet.portrait, "");
assert.equal(quiet.projects.length, 0);
assert.equal(quiet.showForm, false);
assert.equal(JSON.stringify(quiet).includes("unsplash"), false);
assert.equal(JSON.stringify(quiet).includes("CoverWDK"), false);

const full = creativeView({
  ...empty,
  profile: {
    ...empty.profile,
    brandName: "Ada Studio",
    headline: "Designer",
    heroImage: "https://cdn.example.com/hero.jpg",
    capabilityTags: ["Identity"],
    ctaLabel: "About",
    ctaHref: "#about",
  },
  projects: [
    {
      id: "a",
      title: "Atlas",
      category: "Identity",
      url: "https://example.com/atlas",
      tech: ["Type"],
      image: "https://cdn.example.com/atlas.jpg",
      client: "Atlas",
      year: "2024",
      summary: "A study in type.",
    },
    { id: "b", title: "Field", category: "Space", url: "", tech: [] },
    { id: "c", title: "North", category: "", url: "javascript:alert(1)", tech: [] },
  ],
  contact: {
    ...empty.contact,
    heading: "A clearer visual voice.",
    description: "Selected collaborations.",
    email: "ada@example.com",
  },
});

assert.equal(full.role, "Designer");
assert.equal(full.statement, "A clearer visual voice.");
assert.equal(full.support, "Selected collaborations.");
assert.equal(full.projects[0]?.externalHref, "https://example.com/atlas");
assert.equal(full.projects[0]?.image, "https://cdn.example.com/atlas.jpg");
assert.equal(full.projects[0]?.client, "Atlas");
assert.equal(full.projects[1]?.externalHref, "");
assert.equal(full.projects[1]?.image, "");
assert.equal(full.projects[2]?.externalHref, "");
assert.equal(full.portrait, "https://cdn.example.com/hero.jpg");
assert.equal(JSON.stringify(full).includes("CoverWDK"), false);

console.log("the creative view checks passed");
