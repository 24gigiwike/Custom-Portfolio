import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "../types/user";
import type { PortfolioAvailability, PortfolioSocialLinks, PortfolioStylePreset } from "../types/portfolio";
import { emptyDiscoverability } from "../lib/discoverability";
import { generateSlug } from "../lib/portfolioSlugText";
import { seedPortfolioFromAccount } from "../lib/portfolioSeed";
import { templateForCreation } from "../lib/templateCatalog";
import { DEFAULT_PORTFOLIO_DESIGN } from "../types/portfolioDesign";

const REJECTED_FIELDS = [
  "ownerId",
  "uid",
  "creationTime",
  "createdAt",
  "updatedAt",
  "authTime",
  "auth_time",
  "portfolioPolicy",
  "accountClassification",
  "publishing",
  "published",
] as const;

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STYLE_PRESETS = ["MINIMAL", "CREATIVE", "EDITORIAL", "BOLD"] as const;
const AVAILABILITY = ["Available for work", "Open to opportunities", "Currently unavailable"] as const;
const SOCIAL_KEYS = ["website", "linkedin", "github", "instagram", "twitter", "x", "other"] as const;

const DEFAULT_ENABLED_SECTIONS = {
  hero: true,
  about: true,
  projects: true,
  experience: true,
  skills: true,
  services: false,
  education: false,
  certifications: false,
  testimonials: false,
  clients: false,
  contact: true,
};

const DEFAULT_THEME = { mode: "light" as const, accent: "#6DAEAD" };

export class PortfolioCreateError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "PortfolioCreateError";
    this.code = code;
    this.status = status;
  }
}

export type PortfolioCreateOutcome = {
  portfolioId: string;
  outcome: "created" | "existing";
};

export type ParsedPortfolioCreate =
  | { purpose: "template"; templateId: string; requestId: string }
  | {
      purpose: "setup";
      requestId: string;
      title: string;
      profession: string;
      headline: string;
      bio: string;
      location: string;
      profileImage: string | null;
      availability: PortfolioAvailability;
      email: string;
      socialLinks: PortfolioSocialLinks;
      stylePreset: PortfolioStylePreset;
    };

function requireRequestId(record: Record<string, unknown>): string {
  const value = record.requestId;
  if (typeof value !== "string" || !REQUEST_ID.test(value)) {
    throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
  }
  return value.toLowerCase();
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalText(value: unknown, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Accept only the fields this route understands.
 * Owner, account age, publishing, and classification never come from the body.
 */
export function parsePortfolioCreateBody(body: unknown): ParsedPortfolioCreate {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
  }
  const record = body as Record<string, unknown>;
  for (const field of REJECTED_FIELDS) {
    if (field in record) {
      throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
    }
  }
  if (record.purpose === "template") {
    const allowed = new Set(["purpose", "templateId", "requestId"]);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
      throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
    }
    const templateId = text(record.templateId, 80);
    if (!templateId || !templateForCreation(templateId)) {
      throw new PortfolioCreateError("unknown-template", 400, "That template is not available.");
    }
    return { purpose: "template", templateId: templateForCreation(templateId)!.id, requestId: requireRequestId(record) };
  }
  if (record.purpose === "setup") {
    const allowed = new Set([
      "purpose",
      "requestId",
      "title",
      "profession",
      "headline",
      "bio",
      "location",
      "profileImage",
      "availability",
      "email",
      "socialLinks",
      "stylePreset",
    ]);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
      throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
    }
    const title = text(record.title, 160);
    const profession = text(record.profession, 160);
    const headline = text(record.headline, 240);
    const bio = text(record.bio, 4000);
    const email = text(record.email, 320);
    if (!title || !profession || !headline || !bio || !email) {
      throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
    }
    const availability = AVAILABILITY.includes(record.availability as PortfolioAvailability)
      ? (record.availability as PortfolioAvailability)
      : "Available for work";
    const stylePreset = STYLE_PRESETS.includes(record.stylePreset as PortfolioStylePreset)
      ? (record.stylePreset as PortfolioStylePreset)
      : "MINIMAL";
    const socialLinks: PortfolioSocialLinks = {};
    if (record.socialLinks != null) {
      if (typeof record.socialLinks !== "object" || Array.isArray(record.socialLinks)) {
        throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
      }
      for (const key of Object.keys(record.socialLinks)) {
        if (!SOCIAL_KEYS.includes(key as (typeof SOCIAL_KEYS)[number])) {
          throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
        }
      }
      const links = record.socialLinks as Record<string, unknown>;
      for (const key of SOCIAL_KEYS) {
        if (links[key] == null || links[key] === "") continue;
        const value = text(links[key], 500);
        if (!value) throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
        socialLinks[key] = value;
      }
    }
    const profileImage = record.profileImage == null || record.profileImage === ""
      ? null
      : text(record.profileImage, 2000);
    if (record.profileImage != null && record.profileImage !== "" && !profileImage) {
      throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
    }
    return {
      purpose: "setup",
      requestId: requireRequestId(record),
      title,
      profession,
      headline,
      bio,
      location: optionalText(record.location, 160),
      profileImage,
      availability,
      email,
      socialLinks,
      stylePreset,
    };
  }
  throw new PortfolioCreateError("invalid-request", 400, "The portfolio request is not valid.");
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Profile fields used to seed a template portfolio. Account createdAt is not read. */
export function accountSeedFromDocument(uid: string, data: Record<string, unknown> | undefined): UserProfile | null {
  if (!data) return null;
  const professional = data.professionalProfile;
  const profile = professional && typeof professional === "object" ? professional as Record<string, unknown> : null;
  const accountPrivate = data.accountPrivate;
  const privateProfile = accountPrivate && typeof accountPrivate === "object"
    ? accountPrivate as Record<string, unknown>
    : null;
  const categories = Array.isArray(profile?.categories)
    ? profile.categories.filter((item): item is string => typeof item === "string")
    : [];
  return {
    uid,
    email: textField(data.email),
    displayName: textField(data.displayName),
    photoURL: textField(data.photoURL) || null,
    createdAt: null,
    updatedAt: null,
    onboardingCompleted: false,
    profession: textField(data.profession),
    accountPrivate: privateProfile
      ? {
          firstName: textField(privateProfile.firstName),
          lastName: textField(privateProfile.lastName),
          dateOfBirth: null,
          email: "",
        }
      : undefined,
    professionalProfile: profile
      ? {
          categories,
          title: textField(profile.title),
          description: textField(profile.description),
          photoURL: textField(profile.photoURL) || null,
          photoPath: null,
        }
      : undefined,
  };
}

function templateDocument(portfolioId: string, ownerId: string, account: UserProfile | null, templateId: string) {
  const content = seedPortfolioFromAccount(account, templateId);
  return {
    id: portfolioId,
    ownerId,
    selectedTemplate: content.selectedTemplate,
    profile: content.profile,
    socialLinks: content.socialLinks,
    projects: content.projects,
    contact: content.contact,
    seo: content.seo,
    discoverability: content.discoverability,
    design: content.design ?? { ...DEFAULT_PORTFOLIO_DESIGN },
    publicSlug: "",
    publicSlugAliases: [],
    publishing: { status: "draft" },
    title: content.profile.brandName || "Portfolio",
    slug: generateSlug(content.profile.brandName || "portfolio"),
    profession: content.profile.headline || content.profile.capabilityTags[0] || "",
    headline: content.profile.headline,
    bio: content.contact.description,
    email: content.profile.email,
    profileImage: content.profile.heroImage || null,
    stylePreset: "MINIMAL",
    theme: DEFAULT_THEME,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function setupDocument(portfolioId: string, ownerId: string, request: Extract<ParsedPortfolioCreate, { purpose: "setup" }>) {
  return {
    id: portfolioId,
    ownerId,
    title: request.title,
    slug: generateSlug(request.title),
    profession: request.profession,
    headline: request.headline,
    bio: request.bio,
    location: request.location,
    profileImage: request.profileImage,
    availability: request.availability,
    email: request.email,
    socialLinks: request.socialLinks,
    stylePreset: request.stylePreset,
    theme: DEFAULT_THEME,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    discoverability: emptyDiscoverability(),
    design: { ...DEFAULT_PORTFOLIO_DESIGN },
    publicSlug: "",
    publicSlugAliases: [],
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Create one portfolio for a verified Auth user.
 * An account that already has a portfolio cannot create another, even with a new request id.
 * The same request id returns the portfolio it already created.
 * A historical accountPortfolios lock is not read or written.
 * Portfolios the account already has are not updated.
 */
export async function createPortfolioForAccount(input: {
  db: Firestore;
  uid: string;
  request: ParsedPortfolioCreate;
  account: UserProfile | null;
  beforeCommit?: () => void;
}): Promise<PortfolioCreateOutcome> {
  const documentFor = (portfolioId: string) => input.request.purpose === "template"
    ? templateDocument(portfolioId, input.uid, input.account, input.request.templateId)
    : setupDocument(portfolioId, input.uid, input.request);

  return input.db.runTransaction(async (transaction) => {
    const requestRef = input.db
      .collection("portfolioCreateRequests")
      .doc(input.uid)
      .collection("items")
      .doc(input.request.requestId);
    const sentinelRef = input.db.collection("portfolioCreateRequests").doc(input.uid);
    const requestSnap = await transaction.get(requestRef);
    const storedId = requestSnap.exists ? requestSnap.get("portfolioId") : "";
    const rememberedId = typeof storedId === "string" ? storedId.trim() : "";
    const remembered = rememberedId
      ? await transaction.get(input.db.collection("portfolios").doc(rememberedId))
      : null;
    if (remembered?.exists && remembered.get("ownerId") === input.uid) {
      return { portfolioId: rememberedId, outcome: "existing" as const };
    }

    const sentinelSnap = await transaction.get(sentinelRef);
    const ownedSnap = await transaction.get(
      input.db.collection("portfolios").where("ownerId", "==", input.uid).limit(1),
    );
    const sentinelId = sentinelSnap.exists && typeof sentinelSnap.get("portfolioId") === "string"
      ? sentinelSnap.get("portfolioId").trim()
      : "";
    const sentinelPortfolio = sentinelId
      ? await transaction.get(input.db.collection("portfolios").doc(sentinelId))
      : null;
    const alreadyOwned = !ownedSnap.empty
      || Boolean(sentinelPortfolio?.exists && sentinelPortfolio.get("ownerId") === input.uid);
    if (alreadyOwned) {
      throw new PortfolioCreateError("portfolio-exists", 409, "This account already has a portfolio.");
    }

    const portfolioRef = input.db.collection("portfolios").doc();
    const portfolioId = portfolioRef.id;
    transaction.create(portfolioRef, documentFor(portfolioId));
    transaction.create(input.db.collection("portfolioIds").doc(portfolioId), { portfolioId });
    transaction.set(requestRef, { portfolioId });
    transaction.set(sentinelRef, { portfolioId }, { merge: true });
    input.beforeCommit?.();
    return { portfolioId, outcome: "created" as const };
  });
}
