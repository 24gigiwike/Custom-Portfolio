import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { UserProfile } from "../types";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { auth, db } from "./firebase";
import { DEFAULT_ENABLED_SECTIONS, DEFAULT_PORTFOLIO_THEME, generateSlug } from "./portfolio";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import { seedPortfolioFromAccount } from "./portfolioSeed";
import { findCatalogTemplate, templateForCreation } from "./templateCatalog";
import { userFacingWriteError } from "./accountLoad";
import {
  contentPreservingPublishing,
  planPublish,
  planUnpublish,
  publishDocumentFields,
  publishPlanMessage,
  unpublishDocumentFields,
} from "./portfolioPublishing";
import {
  publicDeliveryForSavedContent,
  publicDeliveryForUnpublish,
  publicPortfolioFromUserPortfolio,
  type PublicPortfolioFields,
} from "./publicPortfolio";
import { commitPublicSlug, inspectPublicSlug } from "./portfolioSlugAccess";
import type { SlugAvailability } from "./portfolioSlug";
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
    const identitySnap = await transaction.get(identityRef(portfolioId));
    const next = planTemplateUse({
      owned: snap.exists() ? { id: snap.id, data: snap.data() } : null,
      requestedTemplateId: templateId,
      ownerId,
      resolveCatalogTemplate: catalogTemplateIdForUse,
    });
    const decision = reconcileAdoption(next, portfolioId);
    if (decision.outcome === "reject") throw new Error(decision.message);
    if (decision.outcome === "unchanged") {
      rememberIdentity(transaction, portfolioId, identitySnap);
      return;
    }
    transaction.update(portfolioRef, {
      ...decision.fields,
      updatedAt: serverTimestamp(),
    });
    rememberIdentity(transaction, portfolioId, identitySnap);
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
  await runTransaction(db, async (transaction) => {
    transaction.set(portfolioRef, firestorePayload(portfolioId, ownerId, content, true));
    transaction.set(identityRef(portfolioId), { portfolioId });
  });

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
  const portfolioRef = doc(db, "portfolios", portfolioId);
  const publicRef = doc(db, "publicPortfolios", portfolioId);
  const sitemapRef = doc(db, "sitemapEntries", portfolioId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(portfolioRef);
      const identitySnap = await transaction.get(identityRef(portfolioId));
      const current = snap.exists() ? readyPortfolio(snap.id, snap.data(), ownerId) : null;
      if (!current) throw new Error("You don't have permission to change this portfolio.");

      const selectedTemplate = findCatalogTemplate(content.selectedTemplate)
        ? content.selectedTemplate
        : current.selectedTemplate;
      if (!findCatalogTemplate(selectedTemplate)) {
        throw new Error("This portfolio template is not available.");
      }

      const next = contentPreservingPublishing(current, { ...content, selectedTemplate });
      const delivery = publicDeliveryForSavedContent(current, next);
      if (delivery.action === "reject") throw new Error("Your portfolio could not be updated.");

      transaction.update(portfolioRef, firestorePayload(portfolioId, ownerId, next, false));
      rememberIdentity(transaction, portfolioId, identitySnap);
      if (delivery.action === "upsert") {
        transaction.set(publicRef, publicDocument(delivery.fields, current.publishing.publishedAt ?? null));
        transaction.set(sitemapRef, sitemapDocument(portfolioId, delivery.fields.publicSlug));
      }
    });
  } catch (error) {
    rethrowPortfolioWrite(error, "Your portfolio could not be updated.");
  }

  const saved = await getPortfolio(portfolioId);
  if (!saved) {
    throw new Error("Your portfolio was saved, but it could not be read back.");
  }
  return saved;
}

/**
 * Publish the existing portfolio and write its public presentation together.
 * Neither change is kept if the other cannot be written.
 */
export async function publishPortfolio(portfolioId: string): Promise<UserPortfolio> {
  const actorId = requireUid();
  const portfolioRef = doc(db, "portfolios", portfolioId);
  const publicRef = doc(db, "publicPortfolios", portfolioId);
  const sitemapRef = doc(db, "sitemapEntries", portfolioId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(portfolioRef);
      const identitySnap = await transaction.get(identityRef(portfolioId));
      const plan = planPublish({
        actorId,
        owned: snap.exists() ? { id: snap.id, data: snap.data() } : null,
      });
      if (plan.action === "reject") throw new Error(publishPlanMessage(plan.reason));
      const current = snap.exists() ? readyPortfolio(snap.id, snap.data(), actorId) : null;
      if (!current) throw new Error(publishPlanMessage("failed"));
      rememberIdentity(transaction, portfolioId, identitySnap);

      if (plan.action === "already-published") {
        const fields = publicPortfolioFromUserPortfolio(current);
        if (!fields || fields.publicId !== portfolioId) throw new Error(publishPlanMessage("failed"));
        transaction.set(publicRef, publicDocument(fields, current.publishing.publishedAt ?? null));
        transaction.set(sitemapRef, sitemapDocument(portfolioId, fields.publicSlug));
        return;
      }

      if (plan.action !== "publish" || plan.portfolioId !== portfolioId) return;
      const publishedAt = plan.publishedAt ?? serverTimestamp();
      const fields = publicPortfolioFromUserPortfolio({
        ...current,
        publishing: { status: "published", publishedAt: plan.publishedAt ?? null },
      });
      if (!fields || fields.publicId !== portfolioId) throw new Error(publishPlanMessage("failed"));
      transaction.update(portfolioRef, {
        ...publishDocumentFields(publishedAt),
        updatedAt: serverTimestamp(),
      });
      transaction.set(publicRef, publicDocument(fields, publishedAt));
      transaction.set(sitemapRef, sitemapDocument(portfolioId, fields.publicSlug));
    });
  } catch (error) {
    rethrowPortfolioWrite(error, publishPlanMessage("failed"));
  }

  const published = await getPortfolio(portfolioId);
  if (!published || published.id !== portfolioId || published.publishing.status !== "published") {
    throw new Error(publishPlanMessage("failed"));
  }
  return published;
}

/**
 * Return a published portfolio to draft and remove its public presentation.
 * The first publication time and the portfolio content stay in place.
 */
export async function unpublishPortfolio(portfolioId: string): Promise<UserPortfolio> {
  const actorId = requireUid();
  const portfolioRef = doc(db, "portfolios", portfolioId);
  const publicRef = doc(db, "publicPortfolios", portfolioId);
  const sitemapRef = doc(db, "sitemapEntries", portfolioId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(portfolioRef);
      const identitySnap = await transaction.get(identityRef(portfolioId));
      const plan = planUnpublish({
        actorId,
        owned: snap.exists() ? { id: snap.id, data: snap.data() } : null,
      });
      if (plan.action === "reject") throw new Error(publishPlanMessage(plan.reason));
      const removal = publicDeliveryForUnpublish(portfolioId);
      if (removal.action !== "remove" || removal.publicId !== portfolioId) {
        throw new Error(publishPlanMessage("failed"));
      }
      rememberIdentity(transaction, portfolioId, identitySnap);
      if (plan.action === "already-draft") {
        transaction.delete(publicRef);
        transaction.delete(sitemapRef);
        return;
      }
      if (plan.action !== "unpublish" || plan.portfolioId !== portfolioId) return;
      transaction.update(portfolioRef, {
        ...unpublishDocumentFields(plan.publishedAt),
        updatedAt: serverTimestamp(),
      });
      transaction.delete(publicRef);
      transaction.delete(sitemapRef);
    });
  } catch (error) {
    rethrowPortfolioWrite(error, publishPlanMessage("failed"));
  }

  const draft = await getPortfolio(portfolioId);
  if (!draft || draft.id !== portfolioId || draft.publishing.status !== "draft") {
    throw new Error(publishPlanMessage("failed"));
  }
  return draft;
}

/**
 * Write the public presentation for a portfolio that is already published.
 * Draft portfolios are left private. A failed write does not change publishing status.
 */
export async function syncPublishedPortfolio(portfolioId: string): Promise<void> {
  const actorId = requireUid();
  const portfolioRef = doc(db, "portfolios", portfolioId);
  const publicRef = doc(db, "publicPortfolios", portfolioId);
  const sitemapRef = doc(db, "sitemapEntries", portfolioId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(portfolioRef);
      const identitySnap = await transaction.get(identityRef(portfolioId));
      const current = snap.exists() ? readyPortfolio(snap.id, snap.data(), actorId) : null;
      if (!current) throw new Error("You don't have permission to change this portfolio.");
      rememberIdentity(transaction, portfolioId, identitySnap);
      if (current.publishing.status !== "published") return;
      const fields = publicPortfolioFromUserPortfolio(current);
      if (!fields || fields.publicId !== portfolioId) throw new Error("The public page could not be updated.");
      transaction.set(publicRef, publicDocument(fields, current.publishing.publishedAt ?? null));
      transaction.set(sitemapRef, sitemapDocument(portfolioId, fields.publicSlug));
    });
  } catch (error) {
    rethrowPortfolioWrite(error, "The public page could not be updated.");
  }
}

export type { SlugAvailability };

/** Advisory read. The save transaction decides whether the address is claimed. */
export async function previewPublicSlug(portfolio: UserPortfolio, requested: string): Promise<SlugAvailability> {
  return inspectPublicSlug(db, requireUid(), portfolio, requested);
}

/**
 * Claim, change, or clear the public slug for the signed-in owner's portfolio.
 * Previous slugs stay registered to this portfolio.
 */
export async function savePortfolioSlug(portfolioId: string, requested: string): Promise<UserPortfolio> {
  const ownerId = requireUid();
  try {
    await commitPublicSlug(db, ownerId, portfolioId, requested);
  } catch (error) {
    if (error instanceof Error && !("code" in error)) throw error;
    rethrowPortfolioWrite(error, "That address could not be saved.");
  }

  const saved = await getPortfolio(portfolioId);
  if (!saved) throw new Error("That address could not be saved.");
  return saved;
}

function identityRef(portfolioId: string) {
  return doc(db, "portfolioIds", portfolioId);
}

function rememberIdentity(
  transaction: { set: (ref: ReturnType<typeof identityRef>, data: { portfolioId: string }) => void },
  portfolioId: string,
  snap: { exists: () => boolean }
) {
  if (!snap.exists()) transaction.set(identityRef(portfolioId), { portfolioId });
}

function rethrowPortfolioWrite(error: unknown, fallback: string): never {
  if (error instanceof Error) {
    const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (!code && !/firebase|firestore/i.test(error.message)) throw error;
  }
  throw new Error(userFacingWriteError(error, fallback));
}

function sitemapDocument(publicId: string, slug: string) {
  return {
    publicId,
    slug,
    updatedAt: serverTimestamp(),
  };
}

/** Public document written beside the private portfolio. The two writes share one transaction. */
function publicDocument(fields: PublicPortfolioFields, publishedAt: unknown) {
  return {
    publicId: fields.publicId,
    selectedTemplate: fields.selectedTemplate,
    profile: fields.profile,
    socialLinks: fields.socialLinks,
    projects: fields.projects,
    contact: fields.contact,
    seo: fields.seo,
    discoverability: fields.discoverability,
    design: fields.design,
    publicSlug: fields.publicSlug,
    publishedAt: publishedAt ?? null,
    updatedAt: serverTimestamp(),
  };
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
    discoverability: content.discoverability,
    design: content.design,
    publicSlug: content.publicSlug,
    publicSlugAliases: content.publicSlugAliases,
    publishing: content.publishing,
    title: content.profile.brandName || "Portfolio",
    // Legacy private mirror of the display name. This is not the public address.
    slug: generateSlug(content.profile.brandName || "portfolio"),
    profession: content.profile.headline || content.profile.capabilityTags[0] || "",
    headline: content.profile.headline,
    bio: content.contact.description,
    email: content.profile.email,
    profileImage: content.profile.heroImage || null,
    stylePreset: "MINIMAL",
    theme: DEFAULT_PORTFOLIO_THEME,
    enabledSections: DEFAULT_ENABLED_SECTIONS,
    published: content.publishing.status === "published",
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}
