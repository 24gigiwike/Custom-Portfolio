import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentWithDesign } from "./portfolioDesign";
import { contentWithSeo } from "./portfolioSeo";
import {
  RESERVED_SLUGS,
  SLUG_ALIAS_LIMIT,
  canonicalPublicSegment,
  parsePublicSlug,
  planSlugClaim,
  resolvePublicAddress,
  slugClaimMessage,
} from "./portfolioSlug";
import type { UserPortfolio } from "../types/userPortfolio";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
for (const slug of RESERVED_SLUGS) {
  assert.match(rules, new RegExp(`"${slug}"`));
}
assert.match(rules, /match \/portfolioSlugs\/\{slug\}/);
assert.match(rules, /match \/portfolioIds\/\{portfolioId\}/);
assert.match(rules, /allow list: if false;/);
assert.match(rules, /allow delete: if false;/);
assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/portfolios\/\$\(slug\)\)/);
assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/portfolioIds\/\$\(slug\)\)/);
const privateRules = rules.slice(rules.indexOf("match /portfolios/{portfolioId}"), rules.indexOf("match /publicPortfolios/{publicId}"));
assert.match(privateRules, /allow read: if isSignedIn\(\) && resource\.data\.ownerId == request\.auth\.uid;/);
assert.equal(privateRules.includes("allow read: if true"), false);

assert.deepEqual(parsePublicSlug("  John-Paul  "), { ok: true, slug: "john-paul" });
assert.deepEqual(parsePublicSlug(""), { ok: true, slug: "" });
assert.equal(parsePublicSlug("John Paul").ok, false);
assert.equal(parsePublicSlug("-john").ok, false);
assert.equal(parsePublicSlug("john--paul").ok, false);
assert.equal(parsePublicSlug("john-").ok, false);
assert.equal(parsePublicSlug("ab").ok, false);
assert.equal(parsePublicSlug("a".repeat(49)).ok, false);
assert.equal(parsePublicSlug("admin").ok, false);
assert.equal(parsePublicSlug("template-preview").ok, false);
assert.equal(parsePublicSlug("../john").ok, false);
assert.equal(parsePublicSlug("john/paul").ok, false);
assert.equal(slugClaimMessage("taken"), "That address is already taken.");

const claim = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "",
  aliases: [],
  requested: "JohnPaul",
  registry: null,
  identityReserved: false,
});
assert.deepEqual(claim, {
  ok: true,
  unchanged: false,
  publicSlug: "johnpaul",
  aliases: [],
  activate: "johnpaul",
  retire: null,
});

const taken = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "",
  aliases: [],
  requested: "johnpaul",
  registry: { portfolioId: "OTHER", role: "active" },
  identityReserved: false,
});
assert.deepEqual(taken, { ok: false, reason: "taken" });

const ownAlias = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "",
  aliases: [],
  requested: "old-name",
  registry: { portfolioId: "OTHER", role: "alias" },
  identityReserved: false,
});
assert.deepEqual(ownAlias, { ok: false, reason: "taken" });

assert.deepEqual(
  planSlugClaim({
    portfolioId: "porta",
    currentSlug: "",
    aliases: [],
    requested: "porta",
    registry: null,
    identityReserved: false,
  }),
  { ok: false, reason: "identity" }
);
assert.deepEqual(
  planSlugClaim({
    portfolioId: "ABC123",
    currentSlug: "",
    aliases: [],
    requested: "motion",
    registry: null,
    identityReserved: true,
  }),
  { ok: false, reason: "identity" }
);

const changed = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "johnpaul",
  aliases: ["older"],
  requested: "johnpaul-animation",
  registry: null,
  identityReserved: false,
});
assert.deepEqual(changed, {
  ok: true,
  unchanged: false,
  publicSlug: "johnpaul-animation",
  aliases: ["older", "johnpaul"],
  activate: "johnpaul-animation",
  retire: "johnpaul",
});

const reclaimed = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "johnpaul-animation",
  aliases: ["older", "johnpaul"],
  requested: "johnpaul",
  registry: { portfolioId: "ABC123", role: "alias" },
  identityReserved: false,
});
assert.equal(reclaimed.ok, true);
if (reclaimed.ok === true && reclaimed.unchanged === false) {
  assert.equal(reclaimed.publicSlug, "johnpaul");
  assert.deepEqual(reclaimed.aliases, ["older", "johnpaul-animation"]);
  assert.equal(reclaimed.activate, "johnpaul");
  assert.equal(reclaimed.retire, "johnpaul-animation");
}

const cleared = planSlugClaim({
  portfolioId: "ABC123",
  currentSlug: "johnpaul",
  aliases: ["older"],
  requested: "",
  registry: null,
  identityReserved: false,
});
assert.deepEqual(cleared, {
  ok: true,
  unchanged: false,
  publicSlug: "",
  aliases: ["older", "johnpaul"],
  activate: null,
  retire: "johnpaul",
});

const fullAliases = Array.from({ length: SLUG_ALIAS_LIMIT }, (_, index) => `old-${index + 1}`);
assert.deepEqual(
  planSlugClaim({
    portfolioId: "ABC123",
    currentSlug: "johnpaul",
    aliases: fullAliases,
    requested: "fresh-name",
    registry: null,
    identityReserved: false,
  }),
  { ok: false, reason: "alias-limit" }
);

assert.deepEqual(
  resolvePublicAddress({
    requested: "ABC123",
    byId: { publicId: "ABC123", publicSlug: "" },
    slugRecord: { portfolioId: "OTHER", role: "active" },
    bySlug: { publicId: "OTHER", publicSlug: "abc123" },
  }),
  { action: "serve", portfolioId: "ABC123" }
);
assert.deepEqual(
  resolvePublicAddress({
    requested: "ABC123",
    byId: { publicId: "ABC123", publicSlug: "johnpaul" },
    slugRecord: null,
    bySlug: null,
  }),
  { action: "redirect", segment: "johnpaul" }
);
assert.deepEqual(
  resolvePublicAddress({
    requested: "johnpaul",
    byId: null,
    slugRecord: { portfolioId: "ABC123", role: "active" },
    bySlug: { publicId: "ABC123", publicSlug: "johnpaul" },
  }),
  { action: "serve", portfolioId: "ABC123" }
);
assert.deepEqual(
  resolvePublicAddress({
    requested: "old-name",
    byId: null,
    slugRecord: { portfolioId: "ABC123", role: "alias" },
    bySlug: { publicId: "ABC123", publicSlug: "johnpaul" },
  }),
  { action: "redirect", segment: "johnpaul" }
);
assert.deepEqual(
  resolvePublicAddress({
    requested: "JohnPaul",
    byId: null,
    slugRecord: { portfolioId: "ABC123", role: "active" },
    bySlug: { publicId: "ABC123", publicSlug: "johnpaul" },
  }),
  { action: "redirect", segment: "johnpaul" }
);
assert.deepEqual(
  resolvePublicAddress({
    requested: "hidden",
    byId: null,
    slugRecord: null,
    bySlug: null,
  }),
  { action: "unavailable" }
);
assert.equal(canonicalPublicSegment("ABC123", "johnpaul"), "johnpaul");
assert.equal(canonicalPublicSegment("ABC123", ""), "ABC123");

const portfolio = {
  id: "ABC123",
  ownerId: "owner",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "John Paul",
    logo: "",
    heroImage: "",
    heroImageMobile: "",
    headline: "Motion",
    capabilityTags: [],
    ctaLabel: "",
    ctaHref: "",
    email: "",
  },
  socialLinks: [],
  projects: [],
  contact: { email: "", eyebrow: "", heading: "", description: "", projectTypes: [], formEndpoint: "" },
  seo: {
    title: "Kept title",
    description: "Kept description",
    canonicalUrl: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
  },
  discoverability: { identity: "person" as const, serviceRegion: "Lagos", faqs: [] },
  design: { palette: "ocean" as const },
  publicSlug: "johnpaul",
  publicSlugAliases: ["older"],
  publishing: { status: "published" as const },
  createdAt: null,
  updatedAt: null,
} satisfies UserPortfolio;

const edited = contentWithSeo(portfolio, { title: "New title", description: "New description", image: "" });
assert.equal(edited.publicSlug, "johnpaul");
assert.deepEqual(edited.publicSlugAliases, ["older"]);
assert.equal(edited.seo.title, "New title");
assert.equal(edited.seo.canonicalUrl, "https://customportfolio.broadbrand.com.ng/p/johnpaul");
assert.equal(edited.discoverability.identity, "person");
const designed = contentWithDesign(portfolio, "forest");
assert.equal(designed.publicSlug, "johnpaul");
assert.equal(designed.design.palette, "forest");
assert.equal(designed.seo.title, "Kept title");

const template = readFileSync(new URL("../templates/wdk-premium-portfolio-1/template/WdkPremiumPortfolio.tsx", import.meta.url), "utf8");
assert.equal(template.includes("publicSlug"), false);
assert.equal(template.includes("ProfessionalFacts"), false);

console.log("portfolio slug checks passed");
