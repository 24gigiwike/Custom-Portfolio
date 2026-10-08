import type { AuthPhase, UserProfile } from "../types";

export function phaseForLoadedAccount(account: UserProfile): AuthPhase {
  if (account.onboardingCompleted) return "READY";
  if (account.onboarding?.readyForTemplates) return "TEMPLATE_DISCOVERY";
  return "ONBOARDING_REQUIRED";
}

/**
 * A failed users/{uid} read is an account-load error, not a missing profile.
 */
export function accountLoadFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code === "permission-denied" || /permission-denied|insufficient permissions/i.test(raw)) {
    return "You're signed in, but your account data could not be read. This is not a new account. Try again in a moment.";
  }

  return "You're signed in, but your account could not be loaded. Check your connection and try again. This is not a new account.";
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return typeof error === "string" ? error : "";
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

export function userFacingWriteError(error: unknown, fallback: string): string {
  const raw = `${errorCode(error)} ${errorText(error)}`;
  if (/permission-denied|insufficient permissions/i.test(raw)) {
    return "You don't have permission to change this.";
  }
  if (errorCode(error) === "unavailable" || /unavailable|network|offline|failed to fetch/i.test(raw)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}

/**
 * Keep a specific application message.
 * Permission and network failures get a short explanation.
 * A raw Firebase message does not.
 */
export function readableSaveError(error: unknown, fallback: string): string {
  const mapped = userFacingWriteError(error, "");
  if (mapped) return mapped;
  const raw = error instanceof Error ? error.message.trim() : "";
  if (raw && !/firebase|firestore/i.test(raw)) return raw;
  return fallback;
}
