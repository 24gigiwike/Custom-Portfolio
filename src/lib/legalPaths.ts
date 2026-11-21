export const PRIVACY_POLICY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const REFUND_POLICY_PATH = "/refund-policy";

/** The date this refund policy was added to the product. */
export const REFUND_POLICY_UPDATED = "21 November 2026";

const LEGAL_PATHS = new Set<string>([PRIVACY_POLICY_PATH, TERMS_PATH, REFUND_POLICY_PATH]);

export function isLegalPath(path: string): boolean {
  const pathname = path.split("?")[0]?.split("#")[0] ?? "";
  return LEGAL_PATHS.has(pathname);
}
