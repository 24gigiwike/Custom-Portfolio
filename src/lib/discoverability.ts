import type { PortfolioDiscoverability, PortfolioFaq, PortfolioIdentity } from "../types/discoverability";

export const FAQ_LIMIT = 8;
const QUESTION_LIMIT = 160;
const ANSWER_LIMIT = 600;
const REGION_LIMIT = 120;

export function emptyDiscoverability(): PortfolioDiscoverability {
  return { identity: "", serviceRegion: "", faqs: [] };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clip(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : normalized.slice(0, limit).trim();
}

function identityOf(value: unknown): PortfolioIdentity {
  return value === "person" || value === "organization" ? value : "";
}

function faqOf(value: unknown): PortfolioFaq | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const question = clip(text(record.question), QUESTION_LIMIT);
  const answer = clip(text(record.answer), ANSWER_LIMIT);
  if (!question || !answer) return null;
  return { question, answer };
}

/** Keep only public, complete facts. Incomplete questions are dropped, not invented. */
export function normalizeDiscoverability(value: unknown): PortfolioDiscoverability {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const faqs = Array.isArray(record.faqs) ? record.faqs.flatMap((item) => {
    const faq = faqOf(item);
    return faq ? [faq] : [];
  }) : [];
  return {
    identity: identityOf(record.identity),
    serviceRegion: clip(text(record.serviceRegion), REGION_LIMIT),
    faqs: faqs.slice(0, FAQ_LIMIT),
  };
}
