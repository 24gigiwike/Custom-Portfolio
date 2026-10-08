import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountContactFields } from "../components/account/AccountContactFields";
import type { UserProfile } from "../types";
import type { UserPortfolio } from "../types/userPortfolio";
import {
  EMAIL_UPDATES_CONSENT_VERSION,
  EMAIL_UPDATES_CONSENT_WORDING,
  SUPPORT_MESSAGE,
  WHATSAPP_HELPER_TEXT,
  WHATSAPP_RECOMMENDED_LABEL,
  accountContactPayload,
  configuredSupportWhatsapp,
  normalizeWhatsappNumber,
  readAccountContact,
  supportWhatsappLink,
} from "./accountContact";
import { draftFromAccount, emptyDraft, publicProfessionalSeed, validatePersonal } from "./onboardingFoundation";
import { seedPortfolioFromAccount } from "./portfolioSeed";
import { privateKeysInPublicFields, publicPortfolioFromUserPortfolio } from "./publicPortfolio";
import { renderPortfolioFacts, resolvePortfolioSeo } from "./portfolioSeo";

const empty = normalizeWhatsappNumber("   ");
assert.equal(empty.ok, true);
if (empty.ok) assert.equal(empty.e164, "");

const localNumber = normalizeWhatsappNumber("08031234567");
assert.equal(localNumber.ok, false);
if (!localNumber.ok) assert.match(localNumber.error, /country code/);

const spaced = normalizeWhatsappNumber("+234 803 123 4567");
assert.equal(spaced.ok, true);
if (spaced.ok) assert.equal(spaced.e164, "+2348031234567");

const uk = normalizeWhatsappNumber("+447911123456");
assert.equal(uk.ok, true);
if (uk.ok) assert.equal(uk.e164, "+447911123456");

const invalid = normalizeWhatsappNumber("+123");
assert.equal(invalid.ok, false);

const personal = emptyDraft();
personal.dateOfBirth = "1990-01-01";
assert.equal(personal.emailUpdatesOptIn, false);
assert.deepEqual(validatePersonal(personal), {});
personal.whatsappNumber = "08031234567";
assert.match(validatePersonal(personal).whatsappNumber ?? "", /country code/);
personal.whatsappNumber = "+447911123456";
assert.deepEqual(validatePersonal(personal), {});

const now = "2026-10-08T12:00:00.000Z";
const opted = accountContactPayload(
  {
    whatsappNumber: "+234 803 123 4567",
    emailUpdatesOptIn: true,
    emailUpdatesConsentAt: null,
    emailUpdatesConsentVersion: null,
  },
  now,
);
assert.equal(opted.contact.whatsappNumber, "+2348031234567");
assert.equal(opted.marketing.emailUpdatesOptIn, true);
assert.equal(opted.marketing.emailUpdatesConsentAt, now);
assert.equal(opted.marketing.emailUpdatesConsentVersion, EMAIL_UPDATES_CONSENT_VERSION);

const kept = accountContactPayload(
  {
    whatsappNumber: "+2348031234567",
    emailUpdatesOptIn: true,
    emailUpdatesConsentAt: opted.marketing.emailUpdatesConsentAt,
    emailUpdatesConsentVersion: opted.marketing.emailUpdatesConsentVersion,
  },
  "2026-10-09T00:00:00.000Z",
);
assert.equal(kept.marketing.emailUpdatesConsentAt, now);

const withdrawn = accountContactPayload(
  {
    whatsappNumber: "",
    emailUpdatesOptIn: false,
    emailUpdatesConsentAt: now,
    emailUpdatesConsentVersion: EMAIL_UPDATES_CONSENT_VERSION,
  },
  "2026-10-10T00:00:00.000Z",
);
assert.deepEqual(withdrawn.marketing, {
  emailUpdatesOptIn: false,
  emailUpdatesConsentAt: null,
  emailUpdatesConsentVersion: null,
});
assert.equal(withdrawn.contact.whatsappNumber, "");

const missing = readAccountContact({});
assert.equal(missing.contact.whatsappNumber, "");
assert.equal(missing.marketing.emailUpdatesOptIn, false);
assert.equal(missing.marketing.emailUpdatesConsentAt, null);
const incomplete = readAccountContact({ marketing: { emailUpdatesOptIn: true } });
assert.equal(incomplete.marketing.emailUpdatesOptIn, false);
const roundTrip = readAccountContact(opted);
assert.equal(roundTrip.contact.whatsappNumber, "+2348031234567");
assert.equal(roundTrip.marketing.emailUpdatesOptIn, true);

const existing = {
  uid: "user-1",
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  photoURL: null,
  createdAt: null,
  updatedAt: null,
  onboardingCompleted: true,
} as UserProfile;
const existingDraft = draftFromAccount(existing);
assert.equal(existingDraft.whatsappNumber, "");
assert.equal(existingDraft.emailUpdatesOptIn, false);
assert.equal(existingDraft.emailUpdatesConsentAt, null);

const seeded = seedPortfolioFromAccount(
  {
    ...existing,
    contact: { whatsappNumber: "+2348031234567" },
    marketing: opted.marketing,
    accountPrivate: { firstName: "Ada", lastName: "Lovelace", dateOfBirth: "1990-01-01", email: "ada@example.com" },
  },
  "wdk-premium-portfolio-1",
);
const seededJson = JSON.stringify(seeded);
assert.equal(seededJson.includes("+2348031234567"), false);
assert.equal(seededJson.includes("whatsapp"), false);
assert.equal(seededJson.includes("emailUpdates"), false);
const professionalSeed = publicProfessionalSeed({ ...existingDraft, whatsappNumber: "+2348031234567", emailUpdatesOptIn: true });
assert.equal(JSON.stringify(professionalSeed).includes("+2348031234567"), false);
assert.equal(JSON.stringify(professionalSeed).includes("emailUpdates"), false);

const portfolio = {
  id: "ABC123",
  ownerId: "owner-secret-uid",
  selectedTemplate: "wdk-premium-portfolio-1",
  profile: {
    brandName: "Ada Lovelace",
    logo: "",
    heroImage: "",
    heroImageMobile: "",
    headline: "Analytical engines",
    capabilityTags: [],
    ctaLabel: "",
    ctaHref: "",
    email: "",
  },
  socialLinks: [],
  projects: [],
  contact: {
    email: "",
    eyebrow: "",
    heading: "",
    description: "Write about a project.",
    projectTypes: [],
    formEndpoint: "",
    whatsappNumber: "+2348031234567",
  },
  seo: {
    title: "Ada Lovelace",
    description: "Portfolio",
    canonicalUrl: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
  },
  discoverability: { identity: "person", serviceRegion: "", faqs: [] },
  design: { palette: "original" },
  publicSlug: "",
  publicSlugAliases: [],
  publishing: { status: "published" },
  createdAt: null,
  updatedAt: null,
  marketing: opted.marketing,
} as UserPortfolio;
const fields = publicPortfolioFromUserPortfolio(portfolio);
if (!fields) throw new Error("expected a public projection");
const publicJson = JSON.stringify(fields);
assert.equal(publicJson.includes("+2348031234567"), false);
assert.equal(publicJson.includes("whatsappNumber"), false);
assert.equal(publicJson.includes("emailUpdates"), false);
assert.deepEqual(privateKeysInPublicFields(fields), []);
const seo = resolvePortfolioSeo(
  {
    publicId: portfolio.id,
    selectedTemplate: portfolio.selectedTemplate,
    profile: portfolio.profile,
    contact: { description: portfolio.contact.description, projectTypes: portfolio.contact.projectTypes },
    projects: portfolio.projects,
    seo: portfolio.seo,
    discoverability: portfolio.discoverability,
    publicSlug: portfolio.publicSlug,
  },
  "production",
);
assert.equal(seo?.jsonLd.includes("+2348031234567"), false);
assert.equal(seo?.jsonLd.includes("whatsappNumber"), false);
assert.equal(renderPortfolioFacts({
  publicId: portfolio.id,
  selectedTemplate: portfolio.selectedTemplate,
  profile: portfolio.profile,
  contact: { description: portfolio.contact.description },
  projects: portfolio.projects,
  seo: portfolio.seo,
}).includes("+2348031234567"), false);

const support = supportWhatsappLink("+234 803 123 4567");
assert.ok(support);
const supportUrl = new URL(support ?? "");
assert.equal(supportUrl.origin + supportUrl.pathname, "https://wa.me/2348031234567");
assert.equal(supportUrl.searchParams.get("text"), SUPPORT_MESSAGE);
assert.equal(SUPPORT_MESSAGE, "Hello BroadBrand, I need help with my Custom Portfolio account.");
assert.equal(supportUrl.searchParams.get("text")?.includes("owner-secret"), false);
assert.equal(support?.includes("token"), false);
assert.equal(supportWhatsappLink(""), null);
assert.equal(supportWhatsappLink("   "), null);
assert.equal(supportWhatsappLink("08031234567"), null);
assert.equal(configuredSupportWhatsapp({}), null);
assert.equal(configuredSupportWhatsapp({ VITE_BROADBRAND_SUPPORT_WHATSAPP: "+447911123456" })?.startsWith("https://wa.me/447911123456?text="), true);

const fieldsMarkup = renderToStaticMarkup(createElement(AccountContactFields, {
  idPrefix: "onboarding",
  whatsappNumber: "",
  emailUpdatesOptIn: false,
  onWhatsappChange: () => undefined,
  onEmailUpdatesChange: () => undefined,
}));
assert.match(fieldsMarkup, /WhatsApp number/);
assert.match(fieldsMarkup, /Recommended — optional/);
assert.match(fieldsMarkup, /won&#x27;t appear on your portfolio/);
assert.equal(WHATSAPP_HELPER_TEXT.includes("won't appear on your portfolio."), true);
assert.match(fieldsMarkup, /Email me occasional updates about new templates, improvements, and Custom Portfolio news/);
assert.equal(EMAIL_UPDATES_CONSENT_WORDING, "Email me occasional updates about new templates, improvements, and Custom Portfolio news.");
assert.match(fieldsMarkup, /type="checkbox"/);
assert.equal(fieldsMarkup.includes("checked"), false);

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const rules = read("../../firestore.rules");
const usersRules = rules.slice(rules.indexOf("match /users/{userId}"), rules.indexOf("match /portfolios/{portfolioId}"));
const publicRules = rules.slice(rules.indexOf("match /publicPortfolios/{publicId}"), rules.indexOf("match /portfolioSlugs/{slug}"));
assert.match(usersRules, /allow read: if isOwner\(userId\);/);
assert.match(usersRules, /allow update: if isOwner\(userId\);/);
assert.equal(publicRules.includes("whatsappNumber"), false);
assert.equal(publicRules.includes("emailUpdatesOptIn"), false);
const wdk = read("../templates/wdk-premium-portfolio-1/template/WdkPremiumPortfolio.tsx");
assert.equal(wdk.includes("whatsappNumber"), false);
assert.equal(wdk.includes("emailUpdates"), false);
const accountWriter = read("./userAccount.ts");
const contactSave = accountWriter.slice(
  accountWriter.indexOf("export async function saveAccountContactPreferences"),
  accountWriter.indexOf("function mapUserAccount"),
);
assert.match(contactSave, /merge: true/);
assert.equal(contactSave.includes("publicPortfolios"), false);
assert.equal(contactSave.includes("onboardingCompleted"), false);
const workspace = read("../components/portfolio-workspace/PortfolioWorkspace.tsx");
assert.match(workspace, /ContactSupportLink/);
assert.match(workspace, /AccountContactPreferences/);
const preferences = read("../components/portfolio-workspace/AccountContactPreferences.tsx");
assert.match(preferences, /if \(!href\) return null/);
assert.match(preferences, /if \(savingRef\.current \|\| !user\) return/);
const onboarding = read("../components/onboarding/OnboardingScreen.tsx");
assert.match(onboarding, /if \(savingRef\.current\) return/);

console.log("account contact checks passed");
