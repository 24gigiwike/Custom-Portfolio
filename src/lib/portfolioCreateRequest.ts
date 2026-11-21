import { policyFailureMessage, type AccountPolicyFailure } from "./accountPolicyMessage";
import { auth } from "./firebase";

export type AccountPortfolioPolicy = "legacy" | "restricted";

export type AccountPolicyRead =
  | { ok: true; policy: AccountPortfolioPolicy }
  | { ok: false; reason: AccountPolicyFailure };

export type PortfolioCreateResult = {
  portfolioId: string;
  outcome: "created" | "existing";
};

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestStorageKey(scope: string): string {
  return `portfolio-create-request:${scope}`;
}

/** Stable id for one creation attempt. A lost response retries this id. A completed attempt gets a new one. */
export function portfolioCreateRequestId(scope: string): string {
  const key = requestStorageKey(scope);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && REQUEST_ID.test(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function completePortfolioCreateRequest(scope: string): void {
  try {
    sessionStorage.removeItem(requestStorageKey(scope));
  } catch {
    // A later attempt can still use a new id. Storage may be unavailable.
  }
}

type CreateResponse = {
  portfolioId?: unknown;
  outcome?: unknown;
  code?: unknown;
  error?: unknown;
};

/**
 * Ask the trusted server to create a portfolio.
 * The ID token is refreshed once when the server rejects an expired session.
 * Owner id and account age are not sent.
 */
export async function requestPortfolioCreate(body: Record<string, unknown>): Promise<PortfolioCreateResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("You need to be signed in to use your portfolio.");

  const send = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    return fetch("/api/portfolio-create", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };

  let response: Response;
  try {
    response = await send(false);
  } catch {
    response = await send(false);
  }
  if (response.status === 401) response = await send(true);
  let payload: CreateResponse = {};
  try {
    payload = await response.json() as CreateResponse;
  } catch {
    payload = {};
  }

  const portfolioId = typeof payload.portfolioId === "string" ? payload.portfolioId : "";
  if (portfolioId && (response.status === 200 || (response.status === 409 && payload.outcome === "existing"))) {
    return {
      portfolioId,
      outcome: payload.outcome === "existing" ? "existing" : "created",
    };
  }
  if (payload.code === "unknown-template") throw new Error("That template is not available.");
  if (payload.code === "policy-unconfigured") throw new Error(policyFailureMessage("unconfigured"));
  if (payload.code === "account-unreadable") throw new Error(policyFailureMessage("unreadable"));
  if (response.status === 401) throw new Error("You need to be signed in to use your portfolio.");
  throw new Error("Your portfolio could not be created.");
}

/**
 * Read the signed-in account policy from the server.
 * The client does not send a creation date, and a missing cutoff is not treated as a network failure.
 */
export async function readAccountPolicy(): Promise<AccountPolicyRead> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: "unreadable" };

  const send = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    return fetch("/api/portfolio-policy", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
  };

  let response: Response;
  try {
    response = await send(false);
  } catch {
    try {
      response = await send(false);
    } catch {
      return { ok: false, reason: "network" };
    }
  }
  if (response.status === 401) {
    try {
      response = await send(true);
    } catch {
      return { ok: false, reason: "network" };
    }
  }

  let payload: { policy?: unknown; code?: unknown } = {};
  try {
    payload = await response.json() as { policy?: unknown; code?: unknown };
  } catch {
    payload = {};
  }
  if (response.status === 200 && (payload.policy === "legacy" || payload.policy === "restricted")) {
    return { ok: true, policy: payload.policy };
  }
  if (payload.code === "policy-unconfigured") return { ok: false, reason: "unconfigured" };
  return { ok: false, reason: "unreadable" };
}
