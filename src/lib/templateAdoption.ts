import type { UserPortfolioContent } from "../types/userPortfolio";
import { userFacingWriteError } from "./accountLoad";
import { portfolioContentForTemplate } from "./normalizeUserPortfolio";

export type StoredTemplateKind =
  | { kind: "unselected" }
  | { kind: "ready"; templateId: string }
  | { kind: "unknown"; templateId: string };

export type TemplateUsePlan =
  | { action: "create" }
  | { action: "open"; portfolioId: string }
  | {
      action: "adopt";
      portfolioId: string;
      content: UserPortfolioContent;
      /** When true, the stored socialLinks field is left exactly as it is. */
      preserveStoredSocialLinks: boolean;
    }
  | {
      action: "reject";
      reason: "unavailable" | "unknown-template" | "template-already-selected" | "wrong-owner";
    };

const TEMPLATE_CHOICE_MESSAGES = {
  unavailable: "That template is not available.",
  "unknown-template": "This portfolio already uses a template that is not available. It was left unchanged.",
  "template-already-selected": "This portfolio already has a template. It was left unchanged.",
  "wrong-owner": "You don't have permission to change this portfolio.",
  failed: "Your portfolio could not be updated.",
} as const;

type RejectReason = Extract<TemplateUsePlan, { action: "reject" }>["reason"];

export function templateChoiceMessage(reason: RejectReason): string {
  return TEMPLATE_CHOICE_MESSAGES[reason];
}

export function templateUpdateFailureMessage(): string {
  return TEMPLATE_CHOICE_MESSAGES.failed;
}

const KNOWN_TEMPLATE_CHOICE_ERRORS = [
  ...Object.values(TEMPLATE_CHOICE_MESSAGES),
  "You need to be signed in to use your portfolio.",
  "This account already has a workspace portfolio. It was left unchanged.",
  "Your portfolio was created, but it could not be read back.",
];

/** Show a known template-choice failure. Permission and network errors stay generic. */
export function templateChoiceError(error: unknown, fallback: string): string {
  const guarded = userFacingWriteError(error, "");
  if (guarded) return guarded;
  const raw = error instanceof Error ? error.message : "";
  if ((KNOWN_TEMPLATE_CHOICE_ERRORS as readonly string[]).includes(raw)) return raw;
  return fallback;
}

/**
 * Missing or blank selectedTemplate is unselected.
 * A non-empty id is ready only when the caller recognizes it in the catalog.
 */
export function classifyStoredTemplate(
  data: Record<string, unknown>,
  resolveCatalogTemplate: (id: string) => string | null
): StoredTemplateKind {
  if (typeof data.selectedTemplate !== "string") return { kind: "unselected" };
  const id = data.selectedTemplate.trim();
  if (!id) return { kind: "unselected" };
  const canonical = resolveCatalogTemplate(id);
  if (!canonical) return { kind: "unknown", templateId: id };
  return { kind: "ready", templateId: canonical };
}

/**
 * Decide what Use This Template should do. This does not write.
 * A template-less document can adopt. An explicit template id is never replaced.
 */
export function planTemplateUse(input: {
  owned: { id: string; data: Record<string, unknown> } | null;
  requestedTemplateId: string;
  ownerId: string;
  resolveCatalogTemplate: (id: string) => string | null;
}): TemplateUsePlan {
  const requested = input.resolveCatalogTemplate(input.requestedTemplateId.trim());
  if (!requested) return { action: "reject", reason: "unavailable" };
  if (!input.owned) return { action: "create" };

  const ownerId = typeof input.owned.data.ownerId === "string" ? input.owned.data.ownerId : "";
  if (!input.ownerId || ownerId !== input.ownerId) return { action: "reject", reason: "wrong-owner" };

  const stored = classifyStoredTemplate(input.owned.data, input.resolveCatalogTemplate);
  if (stored.kind === "unknown") return { action: "reject", reason: "unknown-template" };
  if (stored.kind === "ready" && stored.templateId !== requested) {
    return { action: "reject", reason: "template-already-selected" };
  }
  if (stored.kind === "ready") return { action: "open", portfolioId: input.owned.id };

  return {
    action: "adopt",
    portfolioId: input.owned.id,
    content: portfolioContentForTemplate(input.owned.data, requested),
    preserveStoredSocialLinks: "socialLinks" in input.owned.data && input.owned.data.socialLinks != null,
  };
}

/**
 * Fields written onto the existing document. Legacy mirrors that this object
 * omits stay on the document because the update does not replace the whole record.
 */
export function fieldsForTemplateAdoption(
  content: UserPortfolioContent,
  options: { preserveStoredSocialLinks: boolean }
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    selectedTemplate: content.selectedTemplate,
    profile: content.profile,
    projects: content.projects,
    contact: content.contact,
    seo: content.seo,
    design: content.design,
    publishing: { status: "draft" },
  };
  if (!options.preserveStoredSocialLinks) fields.socialLinks = content.socialLinks;
  return fields;
}

/**
 * Second look inside the adoption write.
 * A template that appeared after the first read is not overwritten.
 * A missing document is not replaced with a new portfolio.
 */
export function reconcileAdoption(
  plan: TemplateUsePlan,
  portfolioId: string
):
  | { outcome: "update"; portfolioId: string; fields: Record<string, unknown> }
  | { outcome: "unchanged"; portfolioId: string }
  | { outcome: "reject"; message: string } {
  if (plan.action === "open" && plan.portfolioId === portfolioId) {
    return { outcome: "unchanged", portfolioId };
  }
  if (plan.action === "adopt" && plan.portfolioId === portfolioId) {
    return {
      outcome: "update",
      portfolioId,
      fields: fieldsForTemplateAdoption(plan.content, {
        preserveStoredSocialLinks: plan.preserveStoredSocialLinks,
      }),
    };
  }
  if (plan.action === "reject") {
    return { outcome: "reject", message: templateChoiceMessage(plan.reason) };
  }
  return { outcome: "reject", message: templateUpdateFailureMessage() };
}
