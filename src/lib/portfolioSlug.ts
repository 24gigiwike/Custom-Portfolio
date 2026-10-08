/**
 * A public slug is an address for one permanent portfolio id.
 * The production domain is not stored with the slug.
 * Previous slugs stay attached to the same portfolio and are not offered to anyone else.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 48;
export const SLUG_ALIAS_LIMIT = 8;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names that must never become a portfolio address.
 * Collision with a real portfolio id is rejected separately.
 */
export const RESERVED_SLUGS = [
  "about",
  "account",
  "accounts",
  "admin",
  "administrator",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "broadbrand",
  "cdn",
  "contact",
  "copy",
  "create",
  "customportfolio",
  "dashboard",
  "delete",
  "demo",
  "design",
  "dev",
  "development",
  "discover",
  "docs",
  "documentation",
  "download",
  "downloads",
  "draft",
  "edit",
  "email",
  "favicon",
  "files",
  "firebase",
  "google",
  "health",
  "help",
  "home",
  "index",
  "legal",
  "login",
  "logout",
  "mail",
  "me",
  "moderator",
  "new",
  "null",
  "onboarding",
  "overview",
  "owner",
  "owners",
  "portfolio",
  "preview",
  "pricing",
  "privacy",
  "private",
  "production",
  "public",
  "publish",
  "register",
  "review",
  "robots",
  "root",
  "save",
  "seo",
  "settings",
  "sign-in",
  "sign-out",
  "signin",
  "signout",
  "signup",
  "sitemap",
  "staging",
  "static",
  "status",
  "support",
  "system",
  "template",
  "template-preview",
  "templates",
  "terms",
  "test",
  "undefined",
  "unpublish",
  "update",
  "upload",
  "uploads",
  "user",
  "users",
  "webmaster",
  "well-known",
  "workspace",
  "www",
] as const;

const RESERVED = new Set<string>(RESERVED_SLUGS);

export type SlugProblem = "invalid" | "reserved" | "taken" | "identity" | "alias-limit";

export type ParsedSlug = { ok: true; slug: string } | { ok: false; reason: "invalid" | "reserved" };

export type SlugRegistryView = { portfolioId: string; role: "active" | "alias" } | null;

export type SlugClaimPlan =
  | { ok: false; reason: SlugProblem }
  | { ok: true; unchanged: true; publicSlug: string; aliases: readonly string[] }
  | {
      ok: true;
      unchanged: false;
      publicSlug: string;
      aliases: readonly string[];
      activate: string | null;
      retire: string | null;
    };

export type AddressedPortfolio = {
  publicId: string;
  publicSlug: string;
};

export type AddressResolution =
  | { action: "unavailable" }
  | { action: "serve"; portfolioId: string }
  | { action: "redirect"; segment: string };

const ADDRESS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

/** Owner input. An empty value clears the active address. Reserved names are rejected. */
export function parsePublicSlug(input: string): ParsedSlug {
  const slug = input.trim().toLowerCase();
  if (!slug) return { ok: true, slug: "" };
  if (!isSlugShape(slug)) return { ok: false, reason: "invalid" };
  if (isReservedSlug(slug)) return { ok: false, reason: "reserved" };
  return { ok: true, slug };
}

/** A slug already stored for this portfolio. Reserved names are not dropped on read. */
export function storedPublicSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  const slug = value.trim().toLowerCase();
  return isSlugShape(slug) ? slug : "";
}

export function storedPublicSlugAliases(value: unknown, active: string): string[] {
  if (!Array.isArray(value)) return [];
  const aliases: string[] = [];
  for (const item of value) {
    const slug = storedPublicSlug(item);
    if (!slug || slug === active || aliases.includes(slug)) continue;
    aliases.push(slug);
    if (aliases.length === SLUG_ALIAS_LIMIT) break;
  }
  return aliases;
}

export function isSlugChange(
  plan: SlugClaimPlan
): plan is Extract<SlugClaimPlan, { ok: true; unchanged: false }> {
  return plan.ok === true && plan.unchanged === false;
}

export function slugClaimMessage(reason: SlugProblem): string {
  if (reason === "invalid") return "Use 3 to 48 lowercase letters, numbers, and single hyphens.";
  if (reason === "reserved") return "That address is reserved.";
  if (reason === "identity") return "That address is already used by a portfolio link.";
  if (reason === "alias-limit") {
    return "This portfolio is keeping as many previous addresses as it can. The current address stays in place.";
  }
  return "That address is already taken.";
}

/**
 * Decide a slug change from records the caller has already read.
 * This does not write. The transaction that claims the slug is authoritative.
 */
export function planSlugClaim(input: {
  portfolioId: string;
  currentSlug: string;
  aliases: readonly string[];
  requested: string;
  registry: SlugRegistryView;
  identityReserved: boolean;
}): SlugClaimPlan {
  const parsed = parsePublicSlug(input.requested);
  if (parsed.ok === false) return { ok: false, reason: parsed.reason };
  const nextSlug = parsed.slug;
  const currentSlug = storedPublicSlug(input.currentSlug);
  const aliases = storedPublicSlugAliases(input.aliases, currentSlug);
  if (nextSlug === input.portfolioId) return { ok: false, reason: "identity" };
  if (nextSlug && input.identityReserved) return { ok: false, reason: "identity" };
  if (nextSlug && input.registry && input.registry.portfolioId !== input.portfolioId) {
    return { ok: false, reason: "taken" };
  }
  if (nextSlug === currentSlug) return { ok: true, unchanged: true, publicSlug: currentSlug, aliases };

  const kept = aliases.filter((alias) => alias !== nextSlug && alias !== currentSlug);
  const retired = currentSlug && currentSlug !== nextSlug ? [currentSlug] : [];
  const nextAliases = [...kept, ...retired];
  if (nextAliases.length > SLUG_ALIAS_LIMIT) return { ok: false, reason: "alias-limit" };
  return {
    ok: true,
    unchanged: false,
    publicSlug: nextSlug,
    aliases: nextAliases,
    activate: nextSlug || null,
    retire: currentSlug && currentSlug !== nextSlug ? currentSlug : null,
  };
}

/**
 * One public request resolves to one published portfolio.
 * A portfolio id wins over a slug with the same text.
 * Any other saved address redirects to the current canonical segment.
 */
export function resolvePublicAddress(input: {
  requested: string;
  byId: AddressedPortfolio | null;
  slugRecord: SlugRegistryView;
  bySlug: AddressedPortfolio | null;
}): AddressResolution {
  const requested = input.requested.trim();
  if (!ADDRESS_PATTERN.test(requested)) return { action: "unavailable" };

  if (input.byId) {
    if (input.byId.publicId !== requested) return { action: "unavailable" };
    return serveOrRedirect(requested, input.byId);
  }

  if (!input.slugRecord || !input.bySlug) return { action: "unavailable" };
  if (input.slugRecord.portfolioId !== input.bySlug.publicId) return { action: "unavailable" };
  return serveOrRedirect(requested, input.bySlug);
}

export function canonicalPublicSegment(portfolioId: string, publicSlug: string | null | undefined): string | null {
  const id = portfolioId.trim();
  if (!ADDRESS_PATTERN.test(id)) return null;
  const slug = storedPublicSlug(publicSlug);
  return slug || id;
}

function serveOrRedirect(requested: string, portfolio: AddressedPortfolio): AddressResolution {
  const segment = canonicalPublicSegment(portfolio.publicId, portfolio.publicSlug);
  if (!segment) return { action: "unavailable" };
  if (requested !== segment) return { action: "redirect", segment };
  return { action: "serve", portfolioId: portfolio.publicId };
}

function isSlugShape(slug: string): boolean {
  return slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}
