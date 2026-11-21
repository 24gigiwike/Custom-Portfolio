import { FirebaseIdTokenError, firebaseProjectId, verifyFirebaseIdToken } from "./firebaseIdToken";
import { FirebaseProjectIsolationError } from "../lib/firebaseEnvironment";
import { firebaseAdminAuth, firebaseAdminFirestore } from "./firebaseAdmin";
import {
  accountSeedFromDocument,
  createPortfolioForAccount,
  parsePortfolioCreateBody,
  PortfolioCreateError,
} from "./portfolioCreate";
import { classifyAccountAge, readPolicyEffectiveAt } from "./portfolioPolicy";
import type { Firestore } from "firebase-admin/firestore";

type HeaderValue = string | string[] | undefined;

export type PortfolioCreateNodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};

export type PortfolioCreateNodeResponse = {
  status: (code: number) => PortfolioCreateNodeResponse;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

export type PortfolioCreateHandlerOptions = {
  env?: NodeJS.ProcessEnv;
  verify?: (token: string, projectId: string) => Promise<{ uid: string }>;
  firestore?: Firestore;
  readCreationTime?: (uid: string) => Promise<unknown>;
};

function headerValue(headers: Record<string, HeaderValue>, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return typeof value === "string" ? value : "";
}

function bearerToken(headers: Record<string, HeaderValue>): string | null {
  const match = /^Bearer\s+(\S+)$/.exec(headerValue(headers, "authorization").trim());
  return match?.[1] ?? null;
}

function send(res: PortfolioCreateNodeResponse, status: number, payload: Record<string, unknown>): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

function jsonBody(body: unknown): unknown {
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return JSON.parse(Buffer.from(body).toString("utf8"));
  }
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

/**
 * Trusted portfolio creation.
 * The UID comes from the verified ID token. Account age does not decide whether creation is allowed.
 */
export async function handlePortfolioCreate(
  req: PortfolioCreateNodeRequest,
  res: PortfolioCreateNodeResponse,
  options: PortfolioCreateHandlerOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("allow", "POST");
    send(res, 405, { error: "Use POST to create a portfolio.", code: "method" });
    return;
  }

  const token = bearerToken(req.headers);
  if (!token) {
    send(res, 401, { error: "Sign in to create a portfolio.", code: "unauthenticated" });
    return;
  }

  const env = options.env ?? process.env;
  let projectId = "";
  try {
    projectId = firebaseProjectId(env);
  } catch (error) {
    if (error instanceof FirebaseProjectIsolationError) {
      send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "unavailable" });
      return;
    }
    throw error;
  }

  let uid = "";
  try {
    const verified = await (options.verify ?? verifyFirebaseIdToken)(token, projectId);
    uid = verified.uid;
  } catch (error) {
    if (error instanceof FirebaseIdTokenError || error instanceof PortfolioCreateError) {
      send(res, 401, { error: "Sign in to create a portfolio.", code: "unauthenticated" });
      return;
    }
    throw error;
  }
  if (!uid) {
    send(res, 401, { error: "Sign in to create a portfolio.", code: "unauthenticated" });
    return;
  }

  let parsedBody: ReturnType<typeof parsePortfolioCreateBody>;
  try {
    parsedBody = parsePortfolioCreateBody(jsonBody(req.body));
  } catch (error) {
    if (error instanceof PortfolioCreateError) {
      send(res, error.status, { error: error.message, code: error.code });
      return;
    }
    send(res, 400, { error: "The portfolio request is not valid.", code: "invalid-request" });
    return;
  }

  const db = options.firestore ?? firebaseAdminFirestore(env);
  if (!db) {
    send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "unavailable" });
    return;
  }

  let account = null;
  if (parsedBody.purpose === "template") {
    const userSnap = await db.collection("users").doc(uid).get();
    account = accountSeedFromDocument(uid, userSnap.exists ? userSnap.data() : undefined);
  }

  try {
    const result = await createPortfolioForAccount({
      db,
      uid,
      request: parsedBody,
      account,
    });
    const status = result.outcome === "existing" ? 409 : 200;
    send(res, status, { portfolioId: result.portfolioId, outcome: result.outcome, code: result.outcome });
  } catch (error) {
    if (error instanceof PortfolioCreateError) {
      send(res, error.status, { error: error.message, code: error.code });
      return;
    }
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    console.error("portfolio-create failed", error instanceof Error ? error.name : "Error", code);
    send(res, 500, { error: "Your portfolio could not be created.", code: "create-failed" });
  }
}

/**
 * Account policy for the signed-in user.
 * The response is only "legacy" or "restricted". Auth metadata stays on the server.
 */
export async function handlePortfolioPolicy(
  req: PortfolioCreateNodeRequest,
  res: PortfolioCreateNodeResponse,
  options: PortfolioCreateHandlerOptions = {},
): Promise<void> {
  if ((req.method ?? "GET").toUpperCase() !== "GET") {
    res.setHeader("allow", "GET");
    send(res, 405, { error: "Use GET to read the account policy.", code: "method" });
    return;
  }

  const token = bearerToken(req.headers);
  if (!token) {
    send(res, 401, { error: "Sign in to use your portfolio.", code: "unauthenticated" });
    return;
  }

  const env = options.env ?? process.env;
  let projectId = "";
  try {
    projectId = firebaseProjectId(env);
  } catch (error) {
    if (error instanceof FirebaseProjectIsolationError) {
      send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "unavailable" });
      return;
    }
    throw error;
  }

  let uid = "";
  try {
    const verified = await (options.verify ?? verifyFirebaseIdToken)(token, projectId);
    uid = verified.uid;
  } catch (error) {
    if (error instanceof FirebaseIdTokenError) {
      send(res, 401, { error: "Sign in to use your portfolio.", code: "unauthenticated" });
      return;
    }
    throw error;
  }
  if (!uid) {
    send(res, 401, { error: "Sign in to use your portfolio.", code: "unauthenticated" });
    return;
  }

  const policy = readPolicyEffectiveAt(env);
  if (!policy.ok) {
    send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "policy-unconfigured" });
    return;
  }

  let creationTime: unknown;
  try {
    if (options.readCreationTime) {
      creationTime = await options.readCreationTime(uid);
    } else {
      const auth = await firebaseAdminAuth(env);
      if (!auth) {
        send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "unavailable" });
        return;
      }
      const user = await auth.getUser(uid);
      creationTime = user.metadata.creationTime;
    }
  } catch {
    send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "account-unreadable" });
    return;
  }

  const age = classifyAccountAge(creationTime, policy.at);
  if (age === "unreadable") {
    send(res, 503, { error: "Portfolio creation is unavailable right now.", code: "account-unreadable" });
    return;
  }
  send(res, 200, { policy: age });
}
