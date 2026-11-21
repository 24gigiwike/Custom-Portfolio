export const PUBLISHING_PAYMENT_SUCCESS_PATH = "/portfolio/publish/return";
export const PUBLISHING_PAYMENT_CANCELLED_PATH = "/portfolio/publish/cancelled";

export type PublishingPaymentReturnOutcome = "success" | "cancelled";

function pathname(path: string): string {
  const bare = path.split("?")[0].split("#")[0] || "/";
  return bare.length > 1 && bare.endsWith("/") ? bare.slice(0, -1) : bare;
}

export function publishingPaymentReturnOutcome(path: string): PublishingPaymentReturnOutcome | null {
  const current = pathname(path);
  if (current === PUBLISHING_PAYMENT_SUCCESS_PATH) return "success";
  if (current === PUBLISHING_PAYMENT_CANCELLED_PATH) return "cancelled";
  return null;
}

export function isPublishingPaymentReturnPath(path: string): boolean {
  return publishingPaymentReturnOutcome(path) !== null;
}
