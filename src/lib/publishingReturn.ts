/** Bachs checkout ids are merchant references. A matching value is not proof of payment. */
const CHECKOUT_REFERENCE = /^[A-Za-z0-9_-]{1,128}$/;

export type PaymentReturnPurpose = "publishing" | "domain";

/**
 * The return query can name the checkout purpose. It cannot prove that Bachs
 * collected the payment, and it cannot start registration.
 */
export function paymentReturnPurpose(search: string): PaymentReturnPurpose {
  const query = search.startsWith("?") ? search.slice(1) : search;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return "publishing";
  }
  const reference = params.get("reference") ?? "";
  if (reference.startsWith("domain:")) return "domain";
  if (reference.startsWith("publishing:")) return "publishing";
  const purpose = params.get("purpose");
  if (purpose === "domain-registration") return "domain";
  if (purpose === "annual-publishing") return "publishing";
  return "publishing";
}

export function readCheckoutReference(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  let raw: string | null;
  try {
    raw = new URLSearchParams(query).get("checkout_id");
  } catch {
    return null;
  }
  if (!raw || !CHECKOUT_REFERENCE.test(raw)) return null;
  return raw;
}
