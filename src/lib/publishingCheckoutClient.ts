import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION } from "./publishingEntitlement";
import {
  classifyPortfolioPublishingAccess,
  describePublishingLifecycle,
  type PublishingAccess,
  type PublishingLifecyclePhase,
} from "./publishingTerm";

const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublishingCheckoutResponse =
  | { outcome: "entitled" }
  | { outcome: "checkout"; purpose: "publish" | "renew"; checkoutId: string; checkoutUrl: string };

function attemptStorageKey(portfolioId: string): string {
  return `publishing-checkout-attempt:${portfolioId}`;
}

/** One attempt id per portfolio. A lost response retries it. A new portfolio gets its own id. */
export function publishingCheckoutAttemptId(portfolioId: string): string {
  const key = attemptStorageKey(portfolioId);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && ATTEMPT_ID.test(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export type PublishingTermView = {
  phase: PublishingLifecyclePhase;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  renewalOpensAt: string | null;
  renewed: boolean;
};

export async function readPublishingTerm(portfolioId: string, now = new Date()): Promise<PublishingTermView> {
  const user = auth.currentUser;
  if (!user) return { phase: "none", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null, renewed: false };
  const snap = await getDoc(doc(db, PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION, portfolioId));
  const lifecycle = describePublishingLifecycle({
    record: snap.exists() ? snap.data() : null,
    now,
  });
  if (snap.exists()) {
    const data = snap.data();
    if (data.uid !== user.uid || data.portfolioId !== portfolioId) {
      return { phase: "none", expiresAt: null, gracePeriodEndsAt: null, renewalOpensAt: null, renewed: false };
    }
  }
  const basis = snap.exists() ? snap.data().renewalBasis : null;
  return {
    ...lifecycle,
    renewed: lifecycle.phase === "active" && (basis === "early" || basis === "grace" || basis === "late"),
  };
}

export async function readPortfolioPublishingAccess(portfolioId: string): Promise<PublishingAccess> {
  const user = auth.currentUser;
  if (!user) return "payment-required";
  const snap = await getDoc(doc(db, PORTFOLIO_PUBLISHING_ENTITLEMENT_COLLECTION, portfolioId));
  return classifyPortfolioPublishingAccess({
    uid: user.uid,
    portfolioId,
    record: snap.exists() ? snap.data() : null,
    now: new Date(),
  });
}

/**
 * Ask the server for this portfolio's hosted payment page.
 * The response URL is not proof of payment.
 */
export async function requestPublishingCheckout(portfolioId: string): Promise<PublishingCheckoutResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("You need to be signed in to use your portfolio.");
  const attemptId = publishingCheckoutAttemptId(portfolioId);
  const send = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    return fetch("/api/publishing-checkout", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ portfolioId, attemptId }),
    });
  };
  let response: Response;
  try {
    response = await send(false);
  } catch {
    throw new Error("The payment page could not be opened.");
  }
  if (response.status === 401) response = await send(true);
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "The payment page could not be opened.");
  }
  if (payload.outcome === "entitled") return { outcome: "entitled" };
  if (
    payload.outcome === "checkout"
    && (payload.purpose === "publish" || payload.purpose === "renew")
    && typeof payload.checkoutId === "string"
    && typeof payload.checkoutUrl === "string"
    && payload.checkoutUrl.startsWith("https://")
  ) {
    return {
      outcome: "checkout",
      purpose: payload.purpose,
      checkoutId: payload.checkoutId,
      checkoutUrl: payload.checkoutUrl,
    };
  }
  throw new Error("The payment page could not be opened.");
}
