/** Bachs checkout ids are merchant references. A matching value is not proof of payment. */
const CHECKOUT_REFERENCE = /^[A-Za-z0-9_-]{1,128}$/;

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
