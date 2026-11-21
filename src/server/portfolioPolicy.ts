/**
 * Account age for the one-portfolio policy.
 * The effective instant must be an explicit UTC timestamp. A missing or
 * unzoned value is not a cutoff, and callers must fail closed.
 * The approved production instant is not stored here.
 */

const ZONED_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export type PolicyInstant =
  | { ok: true; at: Date }
  | { ok: false; reason: "missing" | "invalid" };

export type AccountAge = "legacy" | "restricted";

export function parsePolicyEffectiveAt(value: string | undefined | null): PolicyInstant {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return { ok: false, reason: "missing" };
  if (!ZONED_INSTANT.test(trimmed)) return { ok: false, reason: "invalid" };
  const at = new Date(trimmed);
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "invalid" };
  return { ok: true, at };
}

export function readPolicyEffectiveAt(env: NodeJS.ProcessEnv = process.env): PolicyInstant {
  return parsePolicyEffectiveAt(env.PORTFOLIO_POLICY_EFFECTIVE_AT);
}

/**
 * Compare Firebase Auth user.metadata.creationTime with the policy instant.
 * An unreadable creation time is not treated as a legacy account.
 * auth_time and Firestore profile timestamps are not accepted here.
 */
export function classifyAccountAge(
  creationTime: unknown,
  effectiveAt: Date,
): AccountAge | "unreadable" {
  if (typeof creationTime !== "string" || creationTime.trim() === "") return "unreadable";
  const createdAt = new Date(creationTime);
  if (Number.isNaN(createdAt.getTime())) return "unreadable";
  return createdAt.getTime() < effectiveAt.getTime() ? "legacy" : "restricted";
}
