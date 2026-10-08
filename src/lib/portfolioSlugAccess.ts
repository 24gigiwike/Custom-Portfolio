import { doc, getDoc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import type { UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { normalizeUserPortfolio } from "./normalizeUserPortfolio";
import { canonicalPortfolioUrl } from "./portfolioSeo";
import {
  isSlugChange,
  parsePublicSlug,
  planSlugClaim,
  slugCheckMessage,
  slugClaimMessage,
  type SlugAvailability,
  type SlugRegistryView,
} from "./portfolioSlug";
import { publicPortfolioFromUserPortfolio, type PublicPortfolioFields } from "./publicPortfolio";

type SlugPortfolio = Pick<UserPortfolio, "id" | "ownerId" | "publicSlug" | "publicSlugAliases">;

function registryView(data: Record<string, unknown>): SlugRegistryView {
  return {
    portfolioId: typeof data.portfolioId === "string" ? data.portfolioId : "",
    role: data.role === "alias" ? "alias" : "active",
  };
}

function publicRecord(fields: PublicPortfolioFields, publishedAt: unknown) {
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

function unchecked(error: unknown): SlugAvailability {
  return { status: "unchecked", message: slugCheckMessage(error) };
}

/**
 * Advisory read of one slug and one id reservation.
 * A denied or unreachable read stays unchecked. It is not treated as taken.
 */
export async function inspectPublicSlug(
  firestore: Firestore,
  actorId: string,
  portfolio: SlugPortfolio,
  requested: string,
): Promise<SlugAvailability> {
  const parsed = parsePublicSlug(requested);
  if (parsed.ok === false) return { status: parsed.reason };
  if (parsed.slug === portfolio.publicSlug) return parsed.slug ? { status: "current" } : { status: "empty" };
  if (!actorId || portfolio.ownerId !== actorId) return unchecked(new Error("permission-denied"));

  let registry: SlugRegistryView = null;
  let identityReserved = false;
  if (parsed.slug) {
    try {
      const slugSnap = await getDoc(doc(firestore, "portfolioSlugs", parsed.slug));
      if (slugSnap.exists()) registry = registryView(slugSnap.data());
      const identitySnap = await getDoc(doc(firestore, "portfolioIds", parsed.slug));
      identityReserved = identitySnap.exists();
    } catch (error) {
      return unchecked(error);
    }
  }

  const decision = planSlugClaim({
    portfolioId: portfolio.id,
    currentSlug: portfolio.publicSlug,
    aliases: portfolio.publicSlugAliases,
    requested: parsed.slug,
    registry,
    identityReserved,
  });
  if (decision.ok === false) return { status: decision.reason };
  return { status: "available" };
}

/**
 * Authoritative slug claim. Reads happen before writes.
 * The private portfolio, registry, public projection, and sitemap stay in one transaction.
 */
export async function commitPublicSlug(
  firestore: Firestore,
  actorId: string,
  portfolioId: string,
  requested: string,
): Promise<void> {
  const parsed = parsePublicSlug(requested);
  if (parsed.ok === false) throw new Error(slugClaimMessage(parsed.reason));

  const portfolioRef = doc(firestore, "portfolios", portfolioId);
  const publicRef = doc(firestore, "publicPortfolios", portfolioId);
  const sitemapRef = doc(firestore, "sitemapEntries", portfolioId);

  await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(portfolioRef);
    const identitySnap = await transaction.get(doc(firestore, "portfolioIds", portfolioId));
    const current = snap.exists() ? normalizeUserPortfolio(snap.id, snap.data()) : null;
    if (!current || current.ownerId !== actorId) {
      throw new Error("You don't have permission to change this portfolio.");
    }

    let registry: SlugRegistryView = null;
    let identityReserved = false;
    if (parsed.slug) {
      try {
        const reservedIdentity = await transaction.get(doc(firestore, "portfolioIds", parsed.slug));
        identityReserved = reservedIdentity.exists();
        const slugSnap = await transaction.get(doc(firestore, "portfolioSlugs", parsed.slug));
        if (slugSnap.exists()) registry = registryView(slugSnap.data());
      } catch (error) {
        throw new Error(slugCheckMessage(error));
      }
    }

    let retireOwned = false;
    if (current.publicSlug && current.publicSlug !== parsed.slug) {
      try {
        const retireSnap = await transaction.get(doc(firestore, "portfolioSlugs", current.publicSlug));
        retireOwned = retireSnap.exists() && retireSnap.data().portfolioId === portfolioId;
      } catch (error) {
        throw new Error(slugCheckMessage(error));
      }
    }

    const decision = planSlugClaim({
      portfolioId,
      currentSlug: current.publicSlug,
      aliases: current.publicSlugAliases,
      requested: parsed.slug,
      registry,
      identityReserved,
    });
    if (decision.ok === false) throw new Error(slugClaimMessage(decision.reason));
    if (!identitySnap.exists()) transaction.set(doc(firestore, "portfolioIds", portfolioId), { portfolioId });
    if (!isSlugChange(decision)) return;

    const aliases = decision.retire && !retireOwned
      ? decision.aliases.filter((alias) => alias !== decision.retire)
      : decision.aliases;
    const next: UserPortfolioContent = {
      selectedTemplate: current.selectedTemplate,
      profile: current.profile,
      socialLinks: current.socialLinks,
      projects: current.projects,
      contact: current.contact,
      seo: {
        ...current.seo,
        canonicalUrl: canonicalPortfolioUrl(portfolioId, decision.publicSlug) ?? current.seo.canonicalUrl,
      },
      discoverability: current.discoverability,
      design: current.design,
      publicSlug: decision.publicSlug,
      publicSlugAliases: [...aliases],
      publishing: current.publishing,
    };

    transaction.update(portfolioRef, {
      publicSlug: next.publicSlug,
      publicSlugAliases: next.publicSlugAliases,
      seo: next.seo,
      updatedAt: serverTimestamp(),
    });
    if (decision.activate) {
      const record = { slug: decision.activate, portfolioId, role: "active" as const };
      const slugRef = doc(firestore, "portfolioSlugs", decision.activate);
      if (registry && registry.portfolioId === portfolioId) transaction.update(slugRef, record);
      else transaction.set(slugRef, record);
    }
    if (decision.retire && retireOwned) {
      transaction.update(doc(firestore, "portfolioSlugs", decision.retire), {
        slug: decision.retire,
        portfolioId,
        role: "alias",
      });
    }
    if (next.publishing.status === "published") {
      const fields = publicPortfolioFromUserPortfolio({
        ...current,
        ...next,
        id: current.id,
        ownerId: current.ownerId,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
      });
      if (!fields) throw new Error("That address could not be saved.");
      transaction.set(publicRef, publicRecord(fields, current.publishing.publishedAt ?? null));
      transaction.set(sitemapRef, {
        publicId: portfolioId,
        slug: fields.publicSlug,
        updatedAt: serverTimestamp(),
      });
    }
  });
}
