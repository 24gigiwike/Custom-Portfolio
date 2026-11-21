export type AccountPolicyFailure = "unconfigured" | "network" | "unreadable";

export const POLICY_NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

export const POLICY_UNCONFIGURED_MESSAGE =
  "New portfolios cannot be created until account policy is configured. A portfolio you already have can still be opened.";

export const POLICY_UNREADABLE_MESSAGE =
  "New portfolios cannot be created right now. A portfolio you already have can still be opened.";

export function policyFailureMessage(reason: AccountPolicyFailure): string {
  if (reason === "network") return POLICY_NETWORK_MESSAGE;
  if (reason === "unconfigured") return POLICY_UNCONFIGURED_MESSAGE;
  return POLICY_UNREADABLE_MESSAGE;
}
