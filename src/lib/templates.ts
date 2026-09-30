import type { Template, TemplateRecommendationContext } from "../types/template";

/**
 * Actual templates are designed separately.
 * Discovery reads this catalog and currently receives none.
 */
export function listTemplates(): Template[] {
  return [];
}

/**
 * Reserved for Phase 1B. Onboarding already stores the context this can read.
 */
export function recommendTemplates(_context: TemplateRecommendationContext): Template[] {
  return listTemplates();
}
