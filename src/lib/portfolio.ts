import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import {
  completePortfolioCreateRequest,
  portfolioCreateRequestId,
  requestPortfolioCreate,
} from "./portfolioCreateRequest";
import type {
  Portfolio,
  CreatePortfolioInput,
  UpdatePortfolioProfileInput,
  PortfolioStylePreset,
  PortfolioEnabledSections,
  PortfolioTheme,
} from "../types/portfolio";
export { generateSlug } from "./portfolioSlugText";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const DEFAULT_ENABLED_SECTIONS: PortfolioEnabledSections = {
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

export const DEFAULT_PORTFOLIO_THEME: PortfolioTheme = {
  mode: "light",
  accent: "#6DAEAD",
};

function portfolioRecord(id: string, data: Record<string, unknown>): Portfolio {
  return {
    id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" && data.title ? data.title : "Untitled Portfolio",
    slug: typeof data.slug === "string" && data.slug ? data.slug : id,
    profession: typeof data.profession === "string" ? data.profession : "",
    headline: typeof data.headline === "string" ? data.headline : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    location: typeof data.location === "string" ? data.location : undefined,
    profileImage: typeof data.profileImage === "string" ? data.profileImage : null,
    availability: data.availability as Portfolio["availability"],
    email: typeof data.email === "string" ? data.email : "",
    socialLinks: legacySocialLinks(data.socialLinks),
    stylePreset: (data.stylePreset as PortfolioStylePreset) || "MINIMAL",
    theme: (data.theme as Portfolio["theme"]) || DEFAULT_PORTFOLIO_THEME,
    enabledSections: (data.enabledSections as Portfolio["enabledSections"]) || DEFAULT_ENABLED_SECTIONS,
    createdAt: (data.createdAt as Portfolio["createdAt"]) || null,
    updatedAt: (data.updatedAt as Portfolio["updatedAt"]) || null,
    published: Boolean(data.published),
  };
}

function legacySocialLinks(value: unknown): Portfolio["socialLinks"] {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Portfolio["socialLinks"];
  }
  return {};
}

/**
 * Fetch the user's portfolio by ownerId (Firebase Auth UID)
 */
export async function getUserPortfolio(ownerId: string): Promise<Portfolio | null> {
  const path = "portfolios";
  try {
    const q = query(
      collection(db, "portfolios"),
      where("ownerId", "==", ownerId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      return portfolioRecord(docData.id, docData.data());
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Ask the server to create one setup portfolio.
 * Ownership comes from the signed-in token. The supplied ownerId is not sent.
 */
export async function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  const ownerId = auth.currentUser?.uid;
  if (!ownerId) {
    throw new Error("You need to be signed in to use your portfolio.");
  }
  const path = "portfolios";
  try {
    const created = await requestPortfolioCreate({
      purpose: "setup",
      requestId: portfolioCreateRequestId("setup"),
      title: input.title.trim(),
      profession: input.profession.trim(),
      headline: input.headline.trim(),
      bio: input.bio.trim(),
      location: input.location?.trim() || "",
      profileImage: input.profileImage || null,
      availability: input.availability || "Available for work",
      email: input.email.trim(),
      socialLinks: input.socialLinks || {},
      stylePreset: input.stylePreset || "MINIMAL",
    });
    const snap = await getDoc(doc(db, "portfolios", created.portfolioId));
    if (!snap.exists()) {
      throw new Error("Your portfolio was created, but it could not be read back.");
    }
    completePortfolioCreateRequest("setup");
    return portfolioRecord(snap.id, snap.data());
  } catch (error) {
    const existing = await getUserPortfolio(ownerId);
    if (existing) return existing;
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Lightweight URL helper to ensure valid protocol
 */
export function normalizeUrl(url: string | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Calculate if standard profile essentials are fulfilled
 */
export function isProfileComplete(portfolio: Partial<Portfolio> | null | undefined): boolean {
  if (!portfolio) return false;
  const hasTitle = Boolean(portfolio.title && portfolio.title.trim().length > 0);
  const hasProfession = Boolean(portfolio.profession && portfolio.profession.trim().length > 0);
  const hasHeadline = Boolean(portfolio.headline && portfolio.headline.trim().length > 0);
  const hasBio = Boolean(portfolio.bio && portfolio.bio.trim().length > 0);
  const hasEmail = Boolean(portfolio.email && portfolio.email.trim().length > 0);

  return hasTitle && hasProfession && hasHeadline && hasBio && hasEmail;
}

/**
 * Update the profile and hero information for an existing portfolio
 */
export async function updatePortfolioProfile(
  portfolioId: string,
  input: UpdatePortfolioProfileInput
): Promise<void> {
  const portfolioDocRef = doc(db, "portfolios", portfolioId);
  const path = `portfolios/${portfolioId}`;

  // Clean and filter social links to only store non-empty strings
  const cleanedSocialLinks: Record<string, string> = {};
  if (input.socialLinks) {
    Object.entries(input.socialLinks).forEach(([key, val]) => {
      if (val && typeof val === "string" && val.trim().length > 0) {
        cleanedSocialLinks[key] = normalizeUrl(val);
      }
    });
  }

  const updates: Record<string, unknown> = {
    title: input.title.trim(),
    profession: input.profession.trim(),
    headline: input.headline.trim(),
    bio: input.bio.trim(),
    location: input.location ? input.location.trim() : "",
    profileImage: input.profileImage || null,
    availability: input.availability || "Available for work",
    email: input.email.trim(),
    socialLinks: cleanedSocialLinks,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(portfolioDocRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

