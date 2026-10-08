import { doc, getDoc } from "firebase/firestore";
import type { PublicPortfolio } from "../types/publicPortfolio";
import { db } from "./firebase";
import { readPublicPortfolio } from "./publicPortfolio";
import { parsePublicSlug, resolvePublicAddress, type SlugRegistryView } from "./portfolioSlug";
import { publicPortfolioPath } from "../components/public/publicPortfolioPath";

export type PublicPortfolioLookup =
  | { status: "ready"; portfolio: PublicPortfolio }
  | { status: "redirect"; path: string }
  | { status: "unavailable" }
  | { status: "error" };

function readFailure(error: unknown): "unavailable" | "error" {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (code === "permission-denied" || code === "unauthenticated" || code === "not-found") {
    return "unavailable";
  }
  return "error";
}

async function readPublished(publicId: string): Promise<PublicPortfolio | "missing" | "invalid" | "error"> {
  try {
    const snap = await getDoc(doc(db, "publicPortfolios", publicId));
    if (!snap.exists()) return "missing";
    const portfolio = readPublicPortfolio(publicId, snap.data());
    return portfolio ?? "invalid";
  } catch (error) {
    return readFailure(error) === "unavailable" ? "missing" : "error";
  }
}

async function readSlug(slug: string): Promise<SlugRegistryView | "error"> {
  try {
    const snap = await getDoc(doc(db, "portfolioSlugs", slug));
    if (!snap.exists()) return null;
    const data = snap.data();
    const portfolioId = typeof data.portfolioId === "string" ? data.portfolioId : "";
    const role = data.role === "alias" || data.role === "active" ? data.role : "";
    if (!portfolioId || !role || data.slug !== slug) return null;
    return { portfolioId, role };
  } catch (error) {
    return readFailure(error) === "unavailable" ? null : "error";
  }
}

/**
 * Resolve a public id, active slug, or earlier slug to one published portfolio.
 * A denied or missing record is unavailable. The portfolio id wins over a slug.
 */
export async function getPublicPortfolio(address: string): Promise<PublicPortfolioLookup> {
  const requested = address.trim();
  const direct = await readPublished(requested);
  if (direct === "error") return { status: "error" };
  if (direct === "invalid") return { status: "unavailable" };

  let slugRecord: SlugRegistryView = null;
  let bySlug: PublicPortfolio | null = null;
  if (direct === "missing") {
    const parsed = parsePublicSlug(requested);
    if (parsed.ok && parsed.slug) {
      const record = await readSlug(parsed.slug);
      if (record === "error") return { status: "error" };
      slugRecord = record;
      if (record) {
        const target = await readPublished(record.portfolioId);
        if (target === "error") return { status: "error" };
        if (target !== "missing" && target !== "invalid") bySlug = target;
      }
    }
  }

  const byId = typeof direct === "object" ? direct : null;
  const plan = resolvePublicAddress({
    requested,
    byId,
    slugRecord,
    bySlug,
  });
  if (plan.action === "unavailable") return { status: "unavailable" };
  if (plan.action === "redirect") return { status: "redirect", path: publicPortfolioPath(plan.segment) };
  const portfolio = byId && byId.publicId === plan.portfolioId ? byId : bySlug;
  if (!portfolio || portfolio.publicId !== plan.portfolioId) return { status: "unavailable" };
  return { status: "ready", portfolio };
}
