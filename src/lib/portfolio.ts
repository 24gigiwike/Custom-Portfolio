import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type {
  Portfolio,
  CreatePortfolioInput,
  PortfolioStylePreset,
  PortfolioEnabledSections,
  PortfolioTheme,
} from "../types/portfolio";

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

/**
 * Generate a clean URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `portfolio-${Date.now().toString(36)}`;
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
      const data = docData.data();
      return {
        id: docData.id,
        ownerId: data.ownerId,
        title: data.title || "Untitled Portfolio",
        slug: data.slug || docData.id,
        profession: data.profession || "",
        headline: data.headline || "",
        bio: data.bio || "",
        location: data.location || undefined,
        profileImage: data.profileImage || null,
        availability: data.availability || undefined,
        email: data.email || "",
        socialLinks: data.socialLinks || {},
        stylePreset: (data.stylePreset as PortfolioStylePreset) || "MINIMAL",
        theme: data.theme || DEFAULT_PORTFOLIO_THEME,
        enabledSections: data.enabledSections || DEFAULT_ENABLED_SECTIONS,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        published: Boolean(data.published),
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Create a new portfolio for an authenticated user
 */
export async function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  const newPortfolioRef = doc(collection(db, "portfolios"));
  const portfolioId = newPortfolioRef.id;
  const path = `portfolios/${portfolioId}`;

  const slug = generateSlug(input.title);
  const stylePreset: PortfolioStylePreset = input.stylePreset || "MINIMAL";

  const payload = {
    id: portfolioId,
    ownerId: input.ownerId,
    title: input.title.trim(),
    slug,
    profession: input.profession.trim(),
    headline: input.headline.trim(),
    bio: input.bio.trim(),
    location: input.location?.trim() || "",
    profileImage: input.profileImage || null,
    availability: input.availability || "Available for work",
    email: input.email.trim(),
    socialLinks: input.socialLinks || {},
    stylePreset,
    theme: DEFAULT_PORTFOLIO_THEME,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    published: false,
  };

  try {
    await setDoc(newPortfolioRef, payload);

    return {
      ...payload,
      id: portfolioId,
      createdAt: null,
      updatedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
