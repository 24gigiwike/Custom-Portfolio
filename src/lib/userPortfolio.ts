import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { templateConfig } from "../templates/wdk-premium-portfolio-1/data/template-config";
import type {
  PortfolioContact,
  PortfolioProfile,
  PortfolioSEO,
  Project as TemplateProject,
  SocialLink,
  SocialPlatform,
} from "../templates/wdk-premium-portfolio-1/types/portfolio";
import type { UserProfile } from "../types";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { auth, db } from "./firebase";
import { DEFAULT_ENABLED_SECTIONS, DEFAULT_PORTFOLIO_THEME, generateSlug } from "./portfolio";
import { seedPortfolioFromAccount } from "./portfolioSeed";

const PLATFORMS = new Set<SocialPlatform>(["x", "instagram", "facebook", "youtube", "tiktok", "email"]);

export type OwnedPortfolioLookup =
  | { status: "missing" }
  | { status: "legacy"; id: string }
  | { status: "ready"; portfolio: UserPortfolio };

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("You need to be signed in to use your portfolio.");
  }
  return uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isTemplateRecord(data: Record<string, unknown>): boolean {
  return data.selectedTemplate === templateConfig.id && isRecord(data.profile);
}

function readProfile(value: unknown): PortfolioProfile {
  const profile = isRecord(value) ? value : {};
  return {
    brandName: text(profile.brandName),
    logo: text(profile.logo),
    heroImage: text(profile.heroImage),
    heroImageMobile: text(profile.heroImageMobile),
    headline: text(profile.headline),
    capabilityTags: stringList(profile.capabilityTags),
    ctaLabel: text(profile.ctaLabel),
    ctaHref: text(profile.ctaHref),
    email: text(profile.email),
  };
}

function readSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.platform !== "string" || typeof item.url !== "string") return [];
    if (!PLATFORMS.has(item.platform as SocialPlatform)) return [];
    return [{ platform: item.platform as SocialPlatform, url: item.url }];
  });
}

function readProjects(value: unknown): TemplateProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") return [];
    return [{
      id: item.id,
      title: item.title,
      category: text(item.category),
      url: text(item.url),
      tech: stringList(item.tech),
    }];
  });
}

function readContact(value: unknown): PortfolioContact {
  const contact = isRecord(value) ? value : {};
  return {
    email: text(contact.email),
    eyebrow: text(contact.eyebrow),
    heading: text(contact.heading),
    description: text(contact.description),
    projectTypes: stringList(contact.projectTypes),
    formEndpoint: text(contact.formEndpoint),
  };
}

function readSeo(value: unknown): PortfolioSEO {
  const seo = isRecord(value) ? value : {};
  return {
    title: text(seo.title),
    description: text(seo.description),
    canonicalUrl: text(seo.canonicalUrl),
    ogTitle: text(seo.ogTitle),
    ogDescription: text(seo.ogDescription),
    ogImage: text(seo.ogImage),
    twitterTitle: text(seo.twitterTitle),
    twitterDescription: text(seo.twitterDescription),
    twitterImage: text(seo.twitterImage),
  };
}

function toUserPortfolio(id: string, data: Record<string, unknown>): UserPortfolio {
  return {
    id,
    ownerId: text(data.ownerId),
    selectedTemplate: templateConfig.id,
    profile: readProfile(data.profile),
    socialLinks: readSocialLinks(data.socialLinks),
    projects: readProjects(data.projects),
    contact: readContact(data.contact),
    seo: readSeo(data.seo),
    publishing: { status: "draft" },
    createdAt: (data.createdAt as UserPortfolio["createdAt"]) || null,
    updatedAt: (data.updatedAt as UserPortfolio["updatedAt"]) || null,
  };
}

async function findOwnedDocument(ownerId: string) {
  const owned = query(collection(db, "portfolios"), where("ownerId", "==", ownerId), limit(1));
  const snap = await getDocs(owned);
  return snap.empty ? null : snap.docs[0];
}

export async function getPortfolioByOwner(): Promise<OwnedPortfolioLookup> {
  const ownerId = requireUid();
  const existing = await findOwnedDocument(ownerId);
  if (!existing) return { status: "missing" };
  const data = existing.data();
  if (!isTemplateRecord(data) || data.ownerId !== ownerId) {
    return { status: "legacy", id: existing.id };
  }
  return { status: "ready", portfolio: toUserPortfolio(existing.id, data) };
}

export async function getPortfolio(portfolioId: string): Promise<UserPortfolio | null> {
  const ownerId = requireUid();
  const snap = await getDoc(doc(db, "portfolios", portfolioId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.ownerId !== ownerId || !isTemplateRecord(data)) return null;
  return toUserPortfolio(snap.id, data);
}

/**
 * Create one template portfolio for the signed-in user.
 * The owner id always comes from Firebase Auth.
 */
export async function createPortfolio(account: UserProfile | null): Promise<UserPortfolio> {
  const ownerId = requireUid();
  const existing = await findOwnedDocument(ownerId);
  if (existing) {
    const data = existing.data();
    if (isTemplateRecord(data) && data.ownerId === ownerId) {
      return toUserPortfolio(existing.id, data);
    }
    throw new Error("This account already has a workspace portfolio. It was left unchanged.");
  }

  const content = seedPortfolioFromAccount(account);
  const portfolioRef = doc(collection(db, "portfolios"));
  const portfolioId = portfolioRef.id;
  await setDoc(portfolioRef, firestorePayload(portfolioId, ownerId, content, true));

  const created = await getPortfolio(portfolioId);
  if (!created) {
    throw new Error("Your portfolio was created, but it could not be read back.");
  }
  return created;
}

export async function updatePortfolio(
  portfolioId: string,
  content: UserPortfolioContent
): Promise<UserPortfolio> {
  const ownerId = requireUid();
  const current = await getPortfolio(portfolioId);
  if (!current || current.ownerId !== ownerId) {
    throw new Error("You don't have permission to change this portfolio.");
  }

  const next: UserPortfolioContent = {
    ...content,
    selectedTemplate: templateConfig.id,
    publishing: { status: "draft" },
  };
  await updateDoc(doc(db, "portfolios", portfolioId), firestorePayload(portfolioId, ownerId, next, false));

  const saved = await getPortfolio(portfolioId);
  if (!saved) {
    throw new Error("Your portfolio was saved, but it could not be read back.");
  }
  return saved;
}

function firestorePayload(
  portfolioId: string,
  ownerId: string,
  content: UserPortfolioContent,
  includeCreatedAt: boolean
) {
  const payload: Record<string, unknown> = {
    id: portfolioId,
    ownerId,
    selectedTemplate: content.selectedTemplate,
    profile: content.profile,
    socialLinks: content.socialLinks,
    projects: content.projects,
    contact: content.contact,
    seo: content.seo,
    publishing: { status: "draft" },
    title: content.profile.brandName || "Portfolio",
    slug: generateSlug(content.profile.brandName || "portfolio"),
    profession: content.profile.headline || content.profile.capabilityTags[0] || "",
    headline: content.profile.headline,
    bio: content.contact.description,
    email: content.profile.email,
    profileImage: content.profile.heroImage || null,
    stylePreset: "MINIMAL",
    theme: DEFAULT_PORTFOLIO_THEME,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    published: false,
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}
