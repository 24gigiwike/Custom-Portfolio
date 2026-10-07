import type { PortfolioPublishing, UserPortfolio, UserPortfolioContent } from "../types/userPortfolio";
import { userFacingWriteError } from "./accountLoad";
import { normalizeUserPortfolio, readPublishing } from "./normalizeUserPortfolio";
import { reviewAssessment, type ReviewItem } from "./portfolioReview";
import { templateForCreation } from "./templateCatalog";

export type PublishRejectReason =
  | "signed-out"
  | "missing"
  | "wrong-owner"
  | "choose-template"
  | "unsupported"
  | "not-ready"
  | "failed";

export type PublishPlan =
  | { action: "reject"; reason: PublishRejectReason }
  | { action: "already-published"; portfolioId: string }
  | { action: "publish"; portfolioId: string; publishedAt: PortfolioPublishing["publishedAt"] };

export type UnpublishPlan =
  | { action: "reject"; reason: PublishRejectReason }
  | { action: "already-draft"; portfolioId: string }
  | { action: "unpublish"; portfolioId: string; publishedAt: PortfolioPublishing["publishedAt"] };

const PUBLISH_MESSAGES: Record<PublishRejectReason, string> = {
  "signed-out": "You need to be signed in to use your portfolio.",
  missing: "Create your portfolio first.",
  "wrong-owner": "You don't have permission to change this portfolio.",
  "choose-template": "Choose a template before publishing your portfolio.",
  unsupported: "This portfolio uses a template that is not available. It was left unchanged.",
  "not-ready": "This portfolio still needs attention before it can be published.",
  failed: "Your portfolio could not be updated.",
};

export function publishPlanMessage(reason: PublishRejectReason): string {
  return PUBLISH_MESSAGES[reason];
}

export function publishChoiceError(error: unknown, fallback: string): string {
  const guarded = userFacingWriteError(error, "");
  if (guarded) return guarded;
  const raw = error instanceof Error ? error.message : "";
  if ((Object.values(PUBLISH_MESSAGES) as readonly string[]).includes(raw)) return raw;
  return fallback;
}

export function isPortfolioPublished(publishing: { status?: string } | null | undefined): boolean {
  return publishing?.status === "published";
}

/** Important review gaps. Optional items are ignored. Unknown templates return null. */
export function publishingBlockers(portfolio: UserPortfolio): ReviewItem[] | null {
  const assessment = reviewAssessment(portfolio);
  if (!assessment) return null;
  return assessment.items.filter((item) => item.importance === "important" && item.status === "attention");
}

function ownerIdOf(data: Record<string, unknown>): string {
  return typeof data.ownerId === "string" ? data.ownerId : "";
}

function portfolioForActor(id: string, data: Record<string, unknown>, actorId: string): UserPortfolio | null {
  const portfolio = normalizeUserPortfolio(id, data);
  if (!portfolio || portfolio.ownerId !== actorId) return null;
  if (!templateForCreation(portfolio.selectedTemplate)) return null;
  return portfolio;
}

/**
 * Decide a publish click. This does not write.
 * An already published portfolio is left as published.
 */
export function planPublish(input: {
  actorId: string | null;
  owned: { id: string; data: Record<string, unknown> } | null;
}): PublishPlan {
  if (!input.actorId) return { action: "reject", reason: "signed-out" };
  if (!input.owned) return { action: "reject", reason: "missing" };
  if (ownerIdOf(input.owned.data) !== input.actorId) return { action: "reject", reason: "wrong-owner" };

  const selected = input.owned.data.selectedTemplate;
  if (typeof selected !== "string" || !selected.trim()) return { action: "reject", reason: "choose-template" };
  if (!templateForCreation(selected.trim())) return { action: "reject", reason: "unsupported" };

  const portfolio = portfolioForActor(input.owned.id, input.owned.data, input.actorId);
  if (!portfolio) return { action: "reject", reason: "unsupported" };
  if (isPortfolioPublished(portfolio.publishing)) {
    return { action: "already-published", portfolioId: input.owned.id };
  }
  const blockers = publishingBlockers(portfolio);
  if (!blockers || blockers.length > 0) return { action: "reject", reason: "not-ready" };
  return {
    action: "publish",
    portfolioId: input.owned.id,
    publishedAt: portfolio.publishing.publishedAt ?? null,
  };
}

/** Decide an unpublish click. This does not write or delete content. */
export function planUnpublish(input: {
  actorId: string | null;
  owned: { id: string; data: Record<string, unknown> } | null;
}): UnpublishPlan {
  if (!input.actorId) return { action: "reject", reason: "signed-out" };
  if (!input.owned) return { action: "reject", reason: "missing" };
  if (ownerIdOf(input.owned.data) !== input.actorId) return { action: "reject", reason: "wrong-owner" };

  const selected = input.owned.data.selectedTemplate;
  if (typeof selected !== "string" || !selected.trim()) return { action: "reject", reason: "choose-template" };
  if (!templateForCreation(selected.trim())) return { action: "reject", reason: "unsupported" };

  const portfolio = portfolioForActor(input.owned.id, input.owned.data, input.actorId);
  if (!portfolio) return { action: "reject", reason: "unsupported" };
  if (!isPortfolioPublished(portfolio.publishing)) {
    return { action: "already-draft", portfolioId: input.owned.id };
  }
  return {
    action: "unpublish",
    portfolioId: input.owned.id,
    publishedAt: portfolio.publishing.publishedAt ?? null,
  };
}

/** Publishing metadata only. Content, design, template, and owner are not included. */
export function publishDocumentFields(publishedAt: unknown): Record<string, unknown> {
  return {
    publishing: { status: "published", publishedAt },
    published: true,
  };
}

/** Draft again. The first publication time stays when it exists. */
export function unpublishDocumentFields(publishedAt: unknown): Record<string, unknown> {
  const publishing: Record<string, unknown> = { status: "draft" };
  if (publishedAt) publishing.publishedAt = publishedAt;
  return {
    publishing,
    published: false,
  };
}

/**
 * Ordinary saves keep the stored publishing state.
 * They cannot publish or unpublish.
 */
export function contentPreservingPublishing(
  current: UserPortfolio,
  content: UserPortfolioContent
): UserPortfolioContent {
  return {
    ...content,
    publishing: current.publishing,
  };
}

export function publishEntry(lookup: {
  status: "missing" | "legacy" | "ready";
  reason?: "unselected" | "unknown";
  portfolio?: UserPortfolio;
}):
  | { kind: "missing" }
  | { kind: "choose-template" }
  | { kind: "unsupported" }
  | { kind: "draft"; portfolio: UserPortfolio; blockers: ReviewItem[] }
  | { kind: "published"; portfolio: UserPortfolio } {
  if (lookup.status === "missing") return { kind: "missing" };
  if (lookup.status === "legacy" && lookup.reason === "unselected") return { kind: "choose-template" };
  if (lookup.status !== "ready" || !lookup.portfolio) return { kind: "unsupported" };
  const blockers = publishingBlockers(lookup.portfolio);
  if (!blockers) return { kind: "unsupported" };
  if (isPortfolioPublished(lookup.portfolio.publishing)) {
    return { kind: "published", portfolio: lookup.portfolio };
  }
  return { kind: "draft", portfolio: lookup.portfolio, blockers };
}

export function publishingFromDocument(data: Record<string, unknown>): PortfolioPublishing {
  return readPublishing(data);
}
