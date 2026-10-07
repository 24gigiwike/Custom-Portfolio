import { doc, getDoc } from "firebase/firestore";
import type { PublicPortfolio } from "../types/publicPortfolio";
import { db } from "./firebase";
import { readPublicPortfolio } from "./publicPortfolio";

export type PublicPortfolioLookup =
  | { status: "ready"; portfolio: PublicPortfolio }
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

/**
 * Anonymous delivery reads only the public presentation document.
 * A missing document, a denied read, and an unknown template are the same unavailable result.
 */
export async function getPublicPortfolio(publicId: string): Promise<PublicPortfolioLookup> {
  try {
    const snap = await getDoc(doc(db, "publicPortfolios", publicId));
    if (!snap.exists()) return { status: "unavailable" };
    const portfolio = readPublicPortfolio(publicId, snap.data());
    if (!portfolio) return { status: "unavailable" };
    return { status: "ready", portfolio };
  } catch (error) {
    return { status: readFailure(error) };
  }
}
