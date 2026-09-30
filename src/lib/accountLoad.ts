import type { AuthPhase, UserProfile } from "../types";

export function phaseForLoadedAccount(account: UserProfile): AuthPhase {
  return account.onboardingCompleted ? "READY" : "ONBOARDING_REQUIRED";
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

export function userFacingWriteError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/permission-denied|insufficient permissions/i.test(raw)) {
    return "You don't have permission to change this.";
  }
  if (/unavailable|network|offline|failed to fetch/i.test(raw)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}
