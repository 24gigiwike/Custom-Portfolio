import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { UserProfile } from "../types";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { auth, db } from "./firebase";
import { DEFAULT_ENABLED_SECTIONS, DEFAULT_PORTFOLIO_THEME, generateSlug } from "./portfolio";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import { seedPortfolioFromAccount } from "./portfolioSeed";
import { findCatalogTemplate, templateForCreation } from "./templateCatalog";
import {
  classifyStoredTemplate,
  planTemplateUse,
  reconcileAdoption,
  templateChoiceMessage,
  templateUpdateFailureMessage,
} from "./templateAdoption";

export type OwnedPortfolioLookup =
  | { status: "missing" }
  | { status: "legacy"; id: string; reason: "unselected" | "unknown" }
  | { status: "ready"; portfolio: UserPortfolio };

function catalogTemplateIdForUse(id: string): string | null {
  return templateForCreation(id)?.id ?? null;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("You need to be signed in to use your portfolio.");
  }
  return uid;
}

function readyPortfolio(id: string, data: Record<string, unknown>, ownerId: string): UserPortfolio | null {
  const portfolio = normalizeUserPortfolio(id, data);
  if (!portfolio || portfolio.ownerId !== ownerId) return null;
  return portfolio;
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
  const portfolio = readyPortfolio(existing.id, data, ownerId);
  if (portfolio) return { status: "ready", portfolio };
  const stored = classifyStoredTemplate(data, catalogTemplateIdForUse);
  if (stored.kind === "unselected") return { status: "legacy", id: existing.id, reason: "unselected" };
  return { status: "legacy", id: existing.id, reason: "unknown" };
}

/**
 * Use This Template.
 * No portfolio creates one. A template-less portfolio adopts onto the same document.
 * An existing catalog template is opened and is not replaced.
 */
export async function useCatalogTemplate(
  account: UserProfile | null,
  templateId: string
): Promise<UserPortfolio> {
  const ownerId = requireUid();
  const existing = await findOwnedDocument(ownerId);
  const plan = planTemplateUse({
    owned: existing ? { id: existing.id, data: existing.data() } : null,
    requestedTemplateId: templateId,
    ownerId,
    resolveCatalogTemplate: catalogTemplateIdForUse,
  });

  if (plan.action === "reject") throw new Error(templateChoiceMessage(plan.reason));
  if (plan.action === "create") return createPortfolio(account, templateId);
  if (plan.action === "open") {
    const portfolio = await getPortfolio(plan.portfolioId);
    if (!portfolio) throw new Error(templateUpdateFailureMessage());
    return portfolio;
  }

  const portfolioId = plan.portfolioId;
  await runTransaction(db, async (transaction) => {
    const portfolioRef = doc(db, "portfolios", portfolioId);
    const snap = await transaction.get(portfolioRef);
    const next = planTemplateUse({
      owned: snap.exists() ? { id: snap.id, data: snap.data() } : null,
      requestedTemplateId: templateId,
      ownerId,
      resolveCatalogTemplate: catalogTemplateIdForUse,
    });
    const decision = reconcileAdoption(next, portfolioId);
    if (decision.outcome === "reject") throw new Error(decision.message);
    if (decision.outcome === "unchanged") return;
    transaction.update(portfolioRef, {
      ...decision.fields,
      updatedAt: serverTimestamp(),
    });
  });

  const adopted = await getPortfolio(portfolioId);
  if (!adopted || adopted.id !== portfolioId) {
    throw new Error(templateUpdateFailureMessage());
  }
  return adopted;
}

export async function getPortfolio(portfolioId: string): Promise<UserPortfolio | null> {
  const ownerId = requireUid();
  const snap = await getDoc(doc(db, "portfolios", portfolioId));
  if (!snap.exists()) return null;
  return readyPortfolio(snap.id, snap.data(), ownerId);
}

/**
 * Create one template portfolio for the signed-in user.
 * The owner id always comes from Firebase Auth.
 */
export async function createPortfolio(
  account: UserProfile | null,
  templateId: string
): Promise<UserPortfolio> {
  const ownerId = requireUid();
  const template = templateForCreation(templateId);
  if (!template) {
    throw new Error("That template is not available.");
  }

  const existing = await findOwnedDocument(ownerId);
  if (existing) {
    const portfolio = readyPortfolio(existing.id, existing.data(), ownerId);
    if (portfolio) return portfolio;
    throw new Error("This account already has a workspace portfolio. It was left unchanged.");
  }

  const content = seedPortfolioFromAccount(account, template.id);
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

  const selectedTemplate = findCatalogTemplate(content.selectedTemplate)
    ? content.selectedTemplate
    : current.selectedTemplate;
  if (!findCatalogTemplate(selectedTemplate)) {
    throw new Error("This portfolio template is not available.");
  }

  const next: UserPortfolioContent = {
    ...content,
    selectedTemplate,
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
    design: content.design,
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
